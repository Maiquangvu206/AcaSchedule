"""Gemini REST client with graceful fallback.

Uses the public Generative Language API via httpx so the service stays lightweight
(no gRPC / heavy SDK). Callers receive a ``(text, used_fallback)`` pair.

Gemini's free tier answers ``429 RESOURCE_EXHAUSTED`` when the per-minute or
per-day quota is hit. That must never reach the student as an HTTP error: the
request is retried with backoff and, if it still fails, the local fallback
answer is returned.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_CONTINUATIONS = 2
CONTINUE_PROMPT = (
    "Câu trả lời trước bị cắt do giới hạn độ dài. Hãy viết tiếp ngay tại chỗ đang dừng, "
    "không lặp lại phần đã viết, và kết thúc trọn câu."
)

# Transient upstream states worth retrying (Gemini quota / overload).
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 3
BASE_BACKOFF_SECONDS = 1.5
MAX_BACKOFF_SECONDS = 5.0


class GeminiError(RuntimeError):
    """Raised when Gemini is unavailable or returns an unusable payload."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def quota_exceeded(self) -> bool:
        """True when Gemini rejected the call because the API quota ran out."""
        return self.status_code == 429


def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
    """Honour ``Retry-After`` when present, otherwise use exponential backoff."""
    if response is not None:
        raw = response.headers.get("retry-after")
        if raw:
            try:
                return max(0.0, min(float(raw), MAX_BACKOFF_SECONDS))
            except ValueError:
                pass
    return min(BASE_BACKOFF_SECONDS * (2**attempt), MAX_BACKOFF_SECONDS)


async def _post(payload: dict[str, object]) -> httpx.Response:
    settings = get_settings()
    url = f"{GEMINI_ENDPOINT}/{settings.gemini_model}:generateContent"

    last_error: Exception | None = None
    response: httpx.Response | None = None

    for attempt in range(MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
                response = await client.post(
                    url,
                    params={"key": settings.gemini_api_key},
                    json=payload,
                )
        except httpx.HTTPError as exc:  # network/timeout
            last_error = exc
            if attempt + 1 < MAX_ATTEMPTS:
                await asyncio.sleep(_retry_delay(None, attempt))
                continue
            raise GeminiError(f"Gemini request failed: {exc}") from exc

        if response.status_code not in RETRY_STATUSES:
            return response

        logger.warning(
            "Gemini returned HTTP %s (attempt %s/%s)",
            response.status_code,
            attempt + 1,
            MAX_ATTEMPTS,
        )
        if attempt + 1 < MAX_ATTEMPTS:
            await asyncio.sleep(_retry_delay(response, attempt))
            continue

    assert response is not None  # loop always assigns before exiting
    raise GeminiError(f"Gemini returned HTTP {response.status_code}", response.status_code)


async def _request(contents: list[dict[str, object]]) -> tuple[str, str | None]:
    settings = get_settings()

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": settings.max_output_tokens,
        },
    }

    response = await _post(payload)

    if response.status_code >= 400:
        raise GeminiError(f"Gemini returned HTTP {response.status_code}", response.status_code)

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


async def generate(prompt: str) -> str:
    settings = get_settings()

    if not settings.gemini_api_key:
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
    """Return Gemini output when possible, otherwise the local fallback.

    Never propagates quota errors: an exhausted Gemini quota must degrade to the
    deterministic local answer instead of a 429 for the student.
    """

    try:
        return await generate(prompt), False
    except Exception as exc:  # noqa: BLE001 - degrade gracefully on any AI failure
        logger.warning("Gemini unavailable, using fallback answer: %s", exc)
        return fallback, True
