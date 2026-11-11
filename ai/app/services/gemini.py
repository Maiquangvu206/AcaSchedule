"""Gemini REST client with API-key rotation, retries and graceful fallback.

Uses the public Generative Language API via httpx so the service stays lightweight
(no gRPC / heavy SDK). Callers receive a ``(text, used_fallback)`` pair.

Key rotation
------------
`GEMINI_API_KEYS` accepts a comma-separated list (each key usually belongs to a
different Google AI Studio project, so each has its own quota). Requests are sent
round-robin; a key that answers ``429 RESOURCE_EXHAUSTED`` is parked for a while
and the next key is tried. See ``rotation.py`` for the shared mechanism.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import get_settings
from . import rotation
from . import runtime_config
from .rotation import (  # re-exported for backwards compatibility
    BASE_BACKOFF_SECONDS,
    MAX_ATTEMPTS_PER_KEY,
    MAX_BACKOFF_SECONDS,
    QUOTA_COOLDOWN_SECONDS,
    INVALID_KEY_COOLDOWN_SECONDS,
    RETRY_STATUSES,
)

logger = logging.getLogger(__name__)

PROVIDER = "gemini"

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_CONTINUATIONS = 2
CONTINUE_PROMPT = (
    "Câu trả lời trước bị cắt do giới hạn độ dài. Hãy viết tiếp ngay tại chỗ đang dừng, "
    "không lặp lại phần đã viết, và kết thúc trọn câu."
)


class GeminiError(RuntimeError):
    """Raised when Gemini is unavailable or returns an unusable payload."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def quota_exceeded(self) -> bool:
        """True when Gemini rejected the call because the API quota ran out."""
        return self.status_code == 429


def reset_rotation_state() -> None:
    """Clear this provider's cursor and cooldowns (used by tests)."""
    rotation.reset(PROVIDER)


def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
    return rotation.retry_delay(response, attempt)


async def _ordered_keys() -> list[str]:
    config = await runtime_config.get_runtime_config()
    return rotation.ordered_keys(PROVIDER, list(config.gemini_keys))


def _cool_down(key: str, seconds: float) -> None:
    rotation.cool_down(PROVIDER, key, seconds)


async def _post_with_key(payload: dict[str, object], key: str) -> httpx.Response:
    """POST to Gemini with one API key, retrying only transient 5xx/timeouts."""
    settings = get_settings()
    config = await runtime_config.get_runtime_config()
    url = f"{GEMINI_ENDPOINT}/{config.gemini_model}:generateContent"

    response: httpx.Response | None = None

    for attempt in range(MAX_ATTEMPTS_PER_KEY):
        try:
            async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
                response = await client.post(
                    url,
                    params={"key": key},
                    json=payload,
                )
        except httpx.HTTPError as exc:  # network/timeout
            if attempt + 1 < MAX_ATTEMPTS_PER_KEY:
                await asyncio.sleep(_retry_delay(None, attempt))
                continue
            raise GeminiError(f"Gemini request failed: {exc}") from exc

        if response.status_code not in RETRY_STATUSES:
            return response

        logger.warning(
            "Gemini returned HTTP %s (attempt %s/%s)",
            response.status_code,
            attempt + 1,
            MAX_ATTEMPTS_PER_KEY,
        )
        if attempt + 1 < MAX_ATTEMPTS_PER_KEY:
            await asyncio.sleep(_retry_delay(response, attempt))

    assert response is not None  # the loop always assigns before exiting
    return response


def _extract_text(response: httpx.Response) -> tuple[str, str | None]:
    data = response.json()
    try:
        candidate = data["candidates"][0]
        parts = candidate["content"]["parts"]
        text = "".join(
            part.get("text", "") for part in parts if not part.get("thought")
        )
        finish_reason = candidate.get("finishReason")
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Unexpected Gemini response shape") from exc
    return text, finish_reason


async def _request(contents: list[dict[str, object]]) -> tuple[str, str | None]:
    settings = get_settings()

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": settings.max_output_tokens,
        },
    }

    keys = await _ordered_keys()
    if not keys:
        raise GeminiError("GEMINI_API_KEY / GEMINI_API_KEYS is not configured")

    last_error: GeminiError | None = None

    for index, key in enumerate(keys, start=1):
        try:
            response = await _post_with_key(payload, key)
        except GeminiError as exc:
            # Network-level failure: other keys hit the same network, so stop.
            last_error = exc
            break

        status = response.status_code

        if status == 429:
            _cool_down(key, QUOTA_COOLDOWN_SECONDS)
            logger.warning(
                "Gemini key #%s out of quota (429) — cooling down %ss, trying next key",
                index,
                int(QUOTA_COOLDOWN_SECONDS),
            )
            last_error = GeminiError("Gemini quota exhausted on every configured key", 429)
            continue

        if status in (401, 403):
            _cool_down(key, INVALID_KEY_COOLDOWN_SECONDS)
            logger.warning(
                "Gemini key #%s rejected (HTTP %s) — cooling down %ss, trying next key",
                index,
                status,
                int(INVALID_KEY_COOLDOWN_SECONDS),
            )
            last_error = GeminiError(f"Gemini key rejected (HTTP {status})", status)
            continue

        if status >= 400:
            # Bad request / unknown model: rotating keys will not help.
            raise GeminiError(f"Gemini returned HTTP {status}", status)

        return _extract_text(response)

    raise last_error or GeminiError("Gemini is unavailable")


async def generate(prompt: str) -> str:
    config = await runtime_config.get_runtime_config()
    if not config.enabled:
        raise GeminiError("AI service is disabled by the administrator")
    if not config.gemini_keys:
        raise GeminiError("GEMINI_API_KEY is not configured")

    contents: list[dict[str, object]] = [
        {"role": "user", "parts": [{"text": prompt}]}
    ]
    chunks: list[str] = []

    for attempt in range(MAX_CONTINUATIONS + 1):
        text, finish_reason = await _request(contents)
        chunks.append(text)

        if finish_reason != "MAX_TOKENS":
            break
        if attempt == MAX_CONTINUATIONS:
            break

        # Keep the conversation going so the model continues exactly where it stopped.
        partial = "".join(chunks)
        contents = [
            {"role": "user", "parts": [{"text": prompt}]},
            {"role": "model", "parts": [{"text": partial}]},
            {"role": "user", "parts": [{"text": CONTINUE_PROMPT}]},
        ]

    result = "".join(chunks).strip()
    if not result:
        raise GeminiError("Gemini returned an empty response")
    return result


async def generate_or_fallback(prompt: str, fallback: str) -> tuple[str, bool]:
    """Gemini-only variant kept for backward compatibility.

    New callers should use ``services.llm.generate_or_fallback`` so OpenRouter is
    also tried before falling back.
    """

    try:
        return await generate(prompt), False
    except Exception as exc:  # noqa: BLE001 - degrade gracefully on any AI failure
        logger.warning("Gemini unavailable, using fallback answer: %s", exc)
        return fallback, True
