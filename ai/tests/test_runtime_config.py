"""Tests for the live config feed (admin panel → AI service)."""

import asyncio

from app.config import get_settings
from app.services import runtime_config


def reset() -> None:
    runtime_config.reset_runtime_config_cache()


def remote(monkeypatch, payload: dict | None = None, *, fail: bool = False):
    settings = get_settings()
    monkeypatch.setattr(settings, "backend_config_url", "https://backend.test/api/internal/ai/config")
    monkeypatch.setattr(settings, "internal_token", "secret-token")
    monkeypatch.setattr(settings, "gemini_api_keys", "env-gemini")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "openrouter_api_keys", "env-openrouter")
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(settings, "gemini_model", "env-gemini-model")
    monkeypatch.setattr(settings, "openrouter_model", "env-openrouter-model")
    reset()

    calls: list[str] = []

    async def fake_fetch(_settings):
        calls.append("fetch")
        if fail:
            raise RuntimeError("feed down")
        return payload or {}

    monkeypatch.setattr(runtime_config, "_fetch", fake_fetch)
    return calls


def test_env_mode_when_feed_not_configured(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "backend_config_url", "")
    monkeypatch.setattr(settings, "internal_token", "")
    monkeypatch.setattr(settings, "gemini_api_keys", "g1,g2")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    reset()

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.source == "env"
    assert config.gemini_keys == ("g1", "g2")
    assert config.enabled is True


def test_remote_keys_merge_with_env(monkeypatch):
    calls = remote(
        monkeypatch,
        {
            "enabled": True,
            "provider_order": "openrouter,gemini",
            "gemini_model": "db-gemini",
            "openrouter_model": "db-openrouter",
            "gemini_keys": ["db-gemini-1", "db-gemini-2"],
            "openrouter_keys": ["db-openrouter-1"],
        },
    )

    config = asyncio.run(runtime_config.get_runtime_config())

    assert calls == ["fetch"]
    assert config.source == "backend"
    assert config.provider_order == ("openrouter", "gemini")
    assert config.gemini_model == "db-gemini"
    assert config.openrouter_model == "db-openrouter"
    # DB keys first, env keys kept as a safety net, duplicates removed.
    assert config.gemini_keys == ("db-gemini-1", "db-gemini-2", "env-gemini")
    assert config.openrouter_keys == ("db-openrouter-1", "env-openrouter")


def test_remote_config_is_cached(monkeypatch):
    calls = remote(monkeypatch, {"gemini_keys": ["db-gemini"]})

    asyncio.run(runtime_config.get_runtime_config())
    asyncio.run(runtime_config.get_runtime_config())

    assert calls == ["fetch"]


def test_feed_failure_uses_env_fallback(monkeypatch):
    remote(monkeypatch, fail=True)

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.source == "env"
    assert config.gemini_keys == ("env-gemini",)


def test_feed_failure_keeps_last_good_config(monkeypatch):
    calls = remote(monkeypatch, {"gemini_keys": ["db-gemini"]})
    first = asyncio.run(runtime_config.get_runtime_config())
    assert first.source == "backend"

    # Expire the cache and make the feed fail; the last good config survives.
    monkeypatch.setattr(runtime_config, "_cached_at", 0.0)

    async def failing_fetch(_settings):
        calls.append("fetch")
        raise RuntimeError("feed down")

    monkeypatch.setattr(runtime_config, "_fetch", failing_fetch)
    second = asyncio.run(runtime_config.get_runtime_config())

    assert second.source == "backend"
    assert second.gemini_keys == ("db-gemini", "env-gemini")


def test_kill_switch_is_honoured(monkeypatch):
    remote(monkeypatch, {"enabled": False, "gemini_keys": ["db-gemini"]})

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.enabled is False


def test_partial_payload_keeps_env_defaults(monkeypatch):
    remote(monkeypatch, {"gemini_keys": ["db-gemini"]})

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.provider_order[0] == "gemini"
    assert config.gemini_model == "env-gemini-model"
    assert config.openrouter_model == "env-openrouter-model"


def test_retired_model_from_db_falls_back_to_env(monkeypatch):
    # DB chưa chạy migration hoặc được khôi phục từ bản sao cũ.
    remote(monkeypatch, {"gemini_model": "gemini-1.5-flash", "gemini_keys": ["db-gemini"]})

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.gemini_model == "env-gemini-model"


def test_valid_model_from_db_is_used(monkeypatch):
    remote(monkeypatch, {"gemini_model": "gemini-3.5-flash"})

    config = asyncio.run(runtime_config.get_runtime_config())

    assert config.gemini_model == "gemini-3.5-flash"
