"""Gemini REST client with graceful fallback.

Uses the public Generative Language API via httpx so the service stays lightweight
(no gRPC / heavy SDK). Callers receive a ``(text, used_fallback)`` pair.
"""

from __future__ import annotations

import httpx

from ..config import get_settings

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
MAX_CONTINUATIONS = 2
CONTINUE_PROMPT = (
    "Câu trả lời trước bị cắt do giới hạn độ dài. Hãy viết tiếp ngay tại chỗ đang dừng, "
    "không lặp lại phần đã viết, và kết thúc trọn câu."
)


class GeminiError(RuntimeError):
    """Raised when Gemini is unavailable or returns an unusable payload."""


async def _request(contents: list[dict[str, object]]) -> tuple[str, str | None]:
    settings = get_settings()

    url = f"{GEMINI_ENDPOINT}/{settings.gemini_model}:generateContent"
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": settings.max_output_tokens,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
            response = await client.post(
                url,
                params={"key": settings.gemini_api_key},
                json=payload,
            )
    except httpx.HTTPError as exc:  # network/timeout
        raise GeminiError(f"Gemini request failed: {exc}") from exc

    if response.status_code >= 400:
        raise GeminiError(f"Gemini returned HTTP {response.status_code}")

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
    """Return Gemini output when configured, otherwise the local fallback."""

    try:
        return await generate(prompt), False
    except GeminiError:
        return fallback, True
