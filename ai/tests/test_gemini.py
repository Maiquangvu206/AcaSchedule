"""Unit tests for the Gemini client: key rotation and graceful degradation."""

import asyncio

from app.services import gemini


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, headers: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self) -> dict:
        return self._payload


OK_PAYLOAD = {
    "candidates": [
        {
            "content": {"parts": [{"text": "Lời khuyên"}]},
            "finishReason": "STOP",
        }
    ]
}


def use_keys(monkeypatch, *keys: str) -> None:
    """Configure the cached settings object with a key pool."""
    gemini.reset_rotation_state()
    monkeypatch.setattr(gemini.get_settings(), "gemini_api_keys", ",".join(keys))


def test_quota_error_never_escapes(monkeypatch):
    """HTTP 429 from every key must degrade to the local fallback, not propagate."""

    async def fake_post(_payload, _key):
        raise gemini.GeminiError("Gemini returned HTTP 429", 429)

    use_keys(monkeypatch, "k1")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback text"))

    assert used_fallback is True
    assert text == "fallback text"


def test_successful_call_is_not_fallback(monkeypatch):
    async def fake_post(_payload, _key):
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "k1")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert used_fallback is False
    assert text == "Lời khuyên"


def test_exhausted_key_rotates_to_next_key(monkeypatch):
    calls: list[str] = []

    async def fake_post(_payload, key):
        calls.append(key)
        if key == "k1":
            return FakeResponse(429)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert used_fallback is False
    assert text == "Lời khuyên"
    assert calls == ["k1", "k2"]


def test_cooldown_skips_exhausted_key_on_next_request(monkeypatch):
    calls: list[str] = []

    async def fake_post(_payload, key):
        calls.append(key)
        if key == "k1":
            return FakeResponse(429)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))
    asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    # Second request must not touch the cooled-down key again.
    assert calls == ["k1", "k2", "k2"]


def test_invalid_key_is_parked(monkeypatch):
    calls: list[str] = []

    async def fake_post(_payload, key):
        calls.append(key)
        if key == "bad":
            return FakeResponse(403)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "bad", "good")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))
    asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert calls == ["bad", "good", "good"]


def test_bad_request_does_not_rotate(monkeypatch):
    calls: list[str] = []

    async def fake_post(_payload, key):
        calls.append(key)
        return FakeResponse(400)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(gemini, "_post_with_key", fake_post)

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    # 400 = bad request/unknown model: rotating keys cannot help.
    assert used_fallback is True
    assert text == "fallback"
    assert calls == ["k1"]


def test_missing_api_key_uses_fallback(monkeypatch):
    use_keys(monkeypatch, "")

    text, used_fallback = asyncio.run(gemini.generate_or_fallback("prompt", "fallback"))

    assert used_fallback is True
    assert text == "fallback"


def test_key_pool_parsing(monkeypatch):
    monkeypatch.setattr(gemini.get_settings(), "gemini_api_keys", " a , b ,, a ")
    monkeypatch.setattr(gemini.get_settings(), "gemini_api_key", "c")

    assert gemini.get_settings().gemini_key_pool == ["a", "b", "c"]


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
