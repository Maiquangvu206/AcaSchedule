"""Unit tests for the provider chain (Gemini ⇄ OpenRouter ⇄ fallback)."""

import asyncio

from app.config import get_settings
from app.services import gemini, llm, openrouter


def configure(monkeypatch, *, gemini_keys: str = "g1", openrouter_keys: str = "o1") -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_keys", gemini_keys)
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "openrouter_api_keys", openrouter_keys)
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(settings, "ai_provider_order", "gemini,openrouter")
    llm.reset_rotation_state()


def test_falls_over_to_openrouter_when_gemini_fails(monkeypatch):
    async def gemini_generate(_prompt):
        raise gemini.GeminiError("quota", 429)

    async def openrouter_generate(_prompt):
        return "Câu trả lời từ OpenRouter"

    configure(monkeypatch)
    monkeypatch.setattr(gemini, "generate", gemini_generate)
    monkeypatch.setattr(openrouter, "generate", openrouter_generate)

    text, provider, used_fallback = asyncio.run(
        llm.generate_or_fallback_meta("prompt", "fallback")
    )

    assert (text, provider, used_fallback) == (
        "Câu trả lời từ OpenRouter",
        "openrouter",
        False,
    )


def test_falls_over_to_gemini_when_openrouter_fails(monkeypatch):
    async def openrouter_generate(_prompt):
        raise openrouter.OpenRouterError("quota", 429)

    async def gemini_generate(_prompt):
        return "Câu trả lời từ Gemini"

    configure(monkeypatch)
    monkeypatch.setattr(
        get_settings(), "ai_provider_order", "openrouter,gemini"
    )
    monkeypatch.setattr(openrouter, "generate", openrouter_generate)
    monkeypatch.setattr(gemini, "generate", gemini_generate)

    text, provider, used_fallback = asyncio.run(
        llm.generate_or_fallback_meta("prompt", "fallback")
    )

    assert (text, provider, used_fallback) == ("Câu trả lời từ Gemini", "gemini", False)


def test_provider_order_rotates_each_request(monkeypatch):
    calls: list[str] = []

    async def gemini_generate(_prompt):
        calls.append("gemini")
        return "g"

    async def openrouter_generate(_prompt):
        calls.append("openrouter")
        return "o"

    configure(monkeypatch)
    monkeypatch.setattr(gemini, "generate", gemini_generate)
    monkeypatch.setattr(openrouter, "generate", openrouter_generate)

    asyncio.run(llm.generate("prompt"))
    asyncio.run(llm.generate("prompt"))

    assert calls == ["gemini", "openrouter"]


def test_only_configured_providers_are_used(monkeypatch):
    calls: list[str] = []

    async def gemini_generate(_prompt):  # pragma: no cover - must not be called
        calls.append("gemini")
        return "g"

    async def openrouter_generate(_prompt):
        calls.append("openrouter")
        return "o"

    configure(monkeypatch, gemini_keys="")
    monkeypatch.setattr(gemini, "generate", gemini_generate)
    monkeypatch.setattr(openrouter, "generate", openrouter_generate)

    assert asyncio.run(llm.generate("prompt")) == "o"
    assert calls == ["openrouter"]


def test_every_provider_failing_returns_fallback(monkeypatch):
    async def fail(_prompt):
        raise RuntimeError("down")

    configure(monkeypatch)
    monkeypatch.setattr(gemini, "generate", fail)
    monkeypatch.setattr(openrouter, "generate", fail)

    text, provider, used_fallback = asyncio.run(
        llm.generate_or_fallback_meta("prompt", "fallback text")
    )

    assert (text, provider, used_fallback) == ("fallback text", "fallback", True)


def test_generate_or_fallback_never_raises(monkeypatch):
    async def fail(_prompt):
        raise RuntimeError("down")

    configure(monkeypatch)
    monkeypatch.setattr(gemini, "generate", fail)
    monkeypatch.setattr(openrouter, "generate", fail)

    text, used_fallback = asyncio.run(llm.generate_or_fallback("prompt", "fb"))

    assert (text, used_fallback) == ("fb", True)
