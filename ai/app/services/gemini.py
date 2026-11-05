"""Gemini REST client with graceful fallback.

Uses the public Generative Language API via httpx so the service stays lightweight
(no gRPC / heavy SDK). Callers receive a ``(text, used_fallback)`` pair.
"""

from __future__ import annotations

import httpx

from ..config import get_settings

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(RuntimeError):
    """Raised when Gemini is unavailable or returns an unusable payload."""


async def generate(prompt: str) -> str:
    settings = get_settings()

    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    url = f"{GEMINI_ENDPOINT}/{settings.gemini_model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
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
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Unexpected Gemini response shape") from exc


async def generate_or_fallback(prompt: str, fallback: str) -> tuple[str, bool]:
    """Return Gemini output when configured, otherwise the local fallback."""

    try:
        return await generate(prompt), False
    except GeminiError:
        return fallback, True
