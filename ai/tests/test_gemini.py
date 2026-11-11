"""Unit tests for the Gemini client's graceful degradation."""

import asyncio

from app.services import gemini


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, headers: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self) -> dict:
        return self._payload


def test_quota_error_never_escapes(monkeypatch):
    """HTTP 429 from Gemini must degrade to the local fallback, not propagate."""

    async def fake_post(_payload):
        raise gemini.GeminiError("Gemini returned HTTP 429", 429)

    monkeypatch.setattr(gemini, "_post", fake_post)

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback text"))

    assert used_fallback is True
    assert text == "fallback text"


def test_successful_call_is_not_fallback(monkeypatch):
    async def fake_post(_payload):
        return FakeResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {"parts": [{"text": "Lời khuyên"}]},
                        "finishReason": "STOP",
                    }
                ]
            },
        )

    monkeypatch.setattr(gemini, "_post", fake_post)
    monkeypatch.setattr(gemini.get_settings(), "gemini_api_key", "test-key")

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert used_fallback is False
    assert text == "Lời khuyên"


def test_missing_api_key_uses_fallback(monkeypatch):
    monkeypatch.setattr(gemini.get_settings(), "gemini_api_key", "")

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert used_fallback is True
    assert text == "fallback"


def test_retry_delay_honours_retry_after():
    response = FakeResponse(429, headers={"retry-after": "2"})

    assert gemini._retry_delay(response, 0) == 2.0
    # Missing/broken header falls back to exponential backoff.
    assert gemini._retry_delay(FakeResponse(429, headers={"retry-after": "abc"}), 0) > 0
    assert gemini._retry_delay(None, 0) == gemini.BASE_BACKOFF_SECONDS


def test_quota_exceeded_flag():
    assert gemini.GeminiError("x", 429).quota_exceeded is True
    assert gemini.GeminiError("x", 500).quota_exceeded is False
    assert gemini.GeminiError("x").quota_exceeded is False
