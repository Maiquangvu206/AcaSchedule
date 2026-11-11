"""OpenRouter client (OpenAI-compatible) with API-key rotation.

OpenRouter exposes many models behind one endpoint, including free ones. Keys are
rotated the same way as Gemini keys (see ``rotation.py``): round-robin with a
per-key cooldown after a 429/402 (quota, credits) or 401/403 (invalid key).

Configure with:
    OPENROUTER_API_KEYS=key1,key2,key3,key4,key5
    OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import get_settings
from . import rotation
from . import runtime_config
from .rotation import (
    INVALID_KEY_COOLDOWN_SECONDS,
    MAX_ATTEMPTS_PER_KEY,
    QUOTA_COOLDOWN_SECONDS,
    RETRY_STATUSES,
)

logger = logging.getLogger(__name__)

PROVIDER = "openrouter"
MAX_CONTINUATIONS = 2
CONTINUE_PROMPT = (
    "Câu trả lời trước bị cắt do giới hạn độ dài. Hãy viết tiếp ngay tại chỗ đang dừng, "
    "không lặp lại phần đã viết, và kết thúc trọn câu."
)


class OpenRouterError(RuntimeError):
    """Raised when OpenRouter is unavailable or returns an unusable payload."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def quota_exceeded(self) -> bool:
        """True when the key ran out of quota/credits (429 or 402)."""
        return self.status_code in (402, 429)


def reset_rotation_state() -> None:
    """Clear this provider's cursor and cooldowns (used by tests)."""
    rotation.reset(PROVIDER)


async def _ordered_keys() -> list[str]:
    config = await runtime_config.get_runtime_config()
    return rotation.ordered_keys(PROVIDER, list(config.openrouter_keys))


def _cool_down(key: str, seconds: float) -> None:
    rotation.cool_down(PROVIDER, key, seconds)


async def _post_with_key(messages: list[dict[str, str]], key: str) -> httpx.Response:
    """POST one completion request, retrying only transient 5xx/timeouts."""
    settings = get_settings()
    config = await runtime_config.get_runtime_config()
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"

    payload = {
        "model": config.openrouter_model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": settings.max_output_tokens,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-Title": "AcaSchedule",
    }

    response: httpx.Response | None = None

    for attempt in range(MAX_ATTEMPTS_PER_KEY):
        try:
            async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:  # network/timeout
            if attempt + 1 < MAX_ATTEMPTS_PER_KEY:
                await asyncio.sleep(rotation.retry_delay(None, attempt))
                continue
            raise OpenRouterError(f"OpenRouter request failed: {exc}") from exc

        if response.status_code not in RETRY_STATUSES:
            return response

        logger.warning(
            "OpenRouter returned HTTP %s (attempt %s/%s)",
            response.status_code,
            attempt + 1,
            MAX_ATTEMPTS_PER_KEY,
        )
        if attempt + 1 < MAX_ATTEMPTS_PER_KEY:
            await asyncio.sleep(rotation.retry_delay(response, attempt))

    assert response is not None  # the loop always assigns before exiting
    return response


def _extract_text(response: httpx.Response) -> tuple[str, str | None]:
    data = response.json()
    try:
        choice = data["choices"][0]
        content = choice["message"]["content"]
        finish_reason = choice.get("finish_reason")
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError("Unexpected OpenRouter response shape") from exc

    if not isinstance(content, str):
        raise OpenRouterError("Unexpected OpenRouter response shape")
    return content, finish_reason


async def _request(messages: list[dict[str, str]]) -> tuple[str, str | None]:
    keys = await _ordered_keys()
    if not keys:
        raise OpenRouterError("OPENROUTER_API_KEY / OPENROUTER_API_KEYS is not configured")

    last_error: OpenRouterError | None = None

    for index, key in enumerate(keys, start=1):
        try:
            response = await _post_with_key(messages, key)
        except OpenRouterError as exc:
            # Network-level failure: other keys share the same network, so stop.
            last_error = exc
            break

        status = response.status_code

        if status in (402, 429):
            _cool_down(key, QUOTA_COOLDOWN_SECONDS)
            logger.warning(
                "OpenRouter key #%s out of quota/credits (%s) — cooling down %ss, trying next key",
                index,
                status,
                int(QUOTA_COOLDOWN_SECONDS),
            )
            last_error = OpenRouterError(
                "OpenRouter quota exhausted on every configured key", 429
            )
            continue

        if status in (401, 403):
            _cool_down(key, INVALID_KEY_COOLDOWN_SECONDS)
            logger.warning(
                "OpenRouter key #%s rejected (HTTP %s) — cooling down %ss, trying next key",
                index,
                status,
                int(INVALID_KEY_COOLDOWN_SECONDS),
            )
            last_error = OpenRouterError(f"OpenRouter key rejected (HTTP {status})", status)
            continue

        if status >= 400:
            # Bad request / unknown model: rotating keys will not help.
            raise OpenRouterError(f"OpenRouter returned HTTP {status}", status)

        return _extract_text(response)

    raise last_error or OpenRouterError("OpenRouter is unavailable")


async def generate(prompt: str) -> str:
    config = await runtime_config.get_runtime_config()
    if not config.enabled:
        raise OpenRouterError("AI service is disabled by the administrator")
    if not config.openrouter_keys:
        raise OpenRouterError("OPENROUTER_API_KEY is not configured")

    messages: list[dict[str, str]] = [{"role": "user", "content": prompt}]
    chunks: list[str] = []

    for attempt in range(MAX_CONTINUATIONS + 1):
        text, finish_reason = await _request(messages)
        chunks.append(text)

        if finish_reason != "length":
            break
        if attempt == MAX_CONTINUATIONS:
            break

        # Continue exactly where the model stopped so the answer never ends mid-sentence.
        partial = "".join(chunks)
        messages = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": partial},
            {"role": "user", "content": CONTINUE_PROMPT},
        ]

    result = "".join(chunks).strip()
    if not result:
        raise OpenRouterError("OpenRouter returned an empty response")
    return result
