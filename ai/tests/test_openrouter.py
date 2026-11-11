"""Unit tests for the OpenRouter client: key rotation, quota handling, continuation."""

import asyncio

from app.services import openrouter


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, headers: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self) -> dict:
        return self._payload


def completion(text: str, finish_reason: str = "stop") -> dict:
    return {
        "choices": [
            {"message": {"content": text}, "finish_reason": finish_reason}
        ]
    }


OK_PAYLOAD = completion("Lời khuyên")


def use_keys(monkeypatch, *keys: str) -> None:
    openrouter.reset_rotation_state()
    monkeypatch.setattr(openrouter.get_settings(), "openrouter_api_keys", ",".join(keys))
    monkeypatch.setattr(openrouter.get_settings(), "openrouter_api_key", "")


def test_successful_call_returns_text(monkeypatch):
    async def fake_post(_messages, _key):
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "k1")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    assert asyncio.run(openrouter.generate("prompt")) == "Lời khuyên"


def test_quota_error_rotates_to_next_key(monkeypatch):
    calls: list[str] = []

    async def fake_post(_messages, key):
        calls.append(key)
        if key == "k1":
            return FakeResponse(429)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    assert asyncio.run(openrouter.generate("prompt")) == "Lời khuyên"
    assert calls == ["k1", "k2"]


def test_credit_error_402_is_treated_as_quota(monkeypatch):
    calls: list[str] = []

    async def fake_post(_messages, key):
        calls.append(key)
        if key == "broke":
            return FakeResponse(402)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "broke", "funded")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    assert asyncio.run(openrouter.generate("prompt")) == "Lời khuyên"
    assert calls == ["broke", "funded"]


def test_invalid_key_is_parked_for_next_request(monkeypatch):
    calls: list[str] = []

    async def fake_post(_messages, key):
        calls.append(key)
        if key == "bad":
            return FakeResponse(401)
        return FakeResponse(200, OK_PAYLOAD)

    use_keys(monkeypatch, "bad", "good")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    asyncio.run(openrouter.generate("prompt"))
    asyncio.run(openrouter.generate("prompt"))

    assert calls == ["bad", "good", "good"]


def test_all_keys_exhausted_raises(monkeypatch):
    async def fake_post(_messages, _key):
        return FakeResponse(429)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    try:
        asyncio.run(openrouter.generate("prompt"))
    except openrouter.OpenRouterError as exc:
        assert exc.quota_exceeded is True
    else:  # pragma: no cover - the call must fail
        raise AssertionError("expected OpenRouterError")


def test_length_finish_reason_continues_answer(monkeypatch):
    replies = [
        FakeResponse(200, completion("Phần đầu bị cắt", "length")),
        FakeResponse(200, completion(" và phần cuối.", "stop")),
    ]
    messages_seen: list[list[dict[str, str]]] = []

    async def fake_post(messages, _key):
        messages_seen.append(messages)
        return replies[len(messages_seen) - 1]

    use_keys(monkeypatch, "k1")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    text = asyncio.run(openrouter.generate("prompt"))

    assert text == "Phần đầu bị cắt và phần cuối."
    assert len(messages_seen) == 2
    # The continuation request carries the partial answer back to the model.
    assert messages_seen[1][1]["role"] == "assistant"
    assert messages_seen[1][1]["content"] == "Phần đầu bị cắt"


def test_bad_request_does_not_rotate(monkeypatch):
    calls: list[str] = []

    async def fake_post(_messages, key):
        calls.append(key)
        return FakeResponse(400)

    use_keys(monkeypatch, "k1", "k2")
    monkeypatch.setattr(openrouter, "_post_with_key", fake_post)

    try:
        asyncio.run(openrouter.generate("prompt"))
    except openrouter.OpenRouterError:
        pass
    else:  # pragma: no cover
        raise AssertionError("expected OpenRouterError")

    assert calls == ["k1"]


def test_missing_api_key_raises(monkeypatch):
    use_keys(monkeypatch, "")

    try:
        asyncio.run(openrouter.generate("prompt"))
    except openrouter.OpenRouterError as exc:
        assert "not configured" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected OpenRouterError")


def test_key_pool_parsing(monkeypatch):
    settings = openrouter.get_settings()
    monkeypatch.setattr(settings, "openrouter_api_keys", " a , b ,, a ")
    monkeypatch.setattr(settings, "openrouter_api_key", "c")

    assert settings.openrouter_key_pool == ["a", "b", "c"]
    assert settings.openrouter_key_count == 3
