"""Live configuration pulled from the backend admin panel.

Admins manage API keys, models and provider order in the web UI. The backend
keeps them encrypted in PostgreSQL and exposes them to this service through
``GET /api/internal/ai/config`` (shared-secret auth).

This module caches that payload for 30 seconds. If the feed is unreachable the
last good config is reused; if there has never been a good config, the
environment variables are used, so the service keeps working without the
backend.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30.0
KNOWN_PROVIDERS = ("gemini", "openrouter")


@dataclass(frozen=True)
class RuntimeConfig:
    enabled: bool
    provider_order: tuple[str, ...]
    gemini_model: str
    openrouter_model: str
    gemini_keys: tuple[str, ...]
    openrouter_keys: tuple[str, ...]
    source: str = "env"


_cache: RuntimeConfig | None = None
_cached_at = 0.0
_lock = asyncio.Lock()


def reset_runtime_config_cache() -> None:
    """Forget the cached remote config (used by tests and after admin changes)."""
    global _cache, _cached_at
    _cache = None
    _cached_at = 0.0


def _dedupe(keys: list[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for item in keys:
        key = item.strip()
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return tuple(result)


def _provider_order(raw: str) -> tuple[str, ...]:
    ordered = [name.strip().lower() for name in raw.split(",")]
    ordered = [name for name in ordered if name in KNOWN_PROVIDERS]
    for name in KNOWN_PROVIDERS:
        if name not in ordered:
            ordered.append(name)
    return tuple(ordered)


def from_env(settings: Settings) -> RuntimeConfig:
    """Configuration derived purely from environment variables."""
    return RuntimeConfig(
        enabled=True,
        provider_order=tuple(settings.provider_order_list),
        gemini_model=settings.gemini_model,
        openrouter_model=settings.openrouter_model,
        gemini_keys=tuple(settings.gemini_key_pool),
        openrouter_keys=tuple(settings.openrouter_key_pool),
        source="env",
    )


def parse_remote(settings: Settings, payload: dict[str, object]) -> RuntimeConfig:
    """Merge the backend payload with env keys (DB keys take priority)."""
    env = from_env(settings)
    remote_gemini = payload.get("gemini_keys")
    remote_openrouter = payload.get("openrouter_keys")

    gemini_remote = [str(key) for key in remote_gemini] if isinstance(remote_gemini, list) else []
    openrouter_remote = (
        [str(key) for key in remote_openrouter] if isinstance(remote_openrouter, list) else []
    )

    gemini_keys = _dedupe(gemini_remote + list(env.gemini_keys))
    openrouter_keys = _dedupe(openrouter_remote + list(env.openrouter_keys))

    raw_order = payload.get("provider_order")
    order = (
        _provider_order(raw_order)
        if isinstance(raw_order, str) and raw_order.strip()
        else env.provider_order
    )

    gemini_model = payload.get("gemini_model")
    openrouter_model = payload.get("openrouter_model")
    enabled = payload.get("enabled")

    return RuntimeConfig(
        enabled=enabled if isinstance(enabled, bool) else True,
        provider_order=order,
        gemini_model=(
            gemini_model if isinstance(gemini_model, str) and gemini_model else env.gemini_model
        ),
        openrouter_model=(
            openrouter_model
            if isinstance(openrouter_model, str) and openrouter_model
            else env.openrouter_model
        ),
        gemini_keys=gemini_keys,
        openrouter_keys=openrouter_keys,
        source="backend",
    )


async def _fetch(settings: Settings) -> dict[str, object]:
    headers = {
        "Accept": "application/json",
        "X-Internal-Token": settings.internal_token,
    }
    async with httpx.AsyncClient(timeout=settings.backend_config_timeout_seconds) as client:
        response = await client.get(settings.backend_config_url, headers=headers)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Unexpected AI config payload")
    return data


async def get_runtime_config() -> RuntimeConfig:
    """Current provider/key configuration (remote with env fallback)."""
    settings = get_settings()

    if not settings.backend_config_url or not settings.internal_token:
        return from_env(settings)

    global _cache, _cached_at

    if _cache is not None and time.monotonic() - _cached_at < CACHE_TTL_SECONDS:
        return _cache

    async with _lock:
        if _cache is not None and time.monotonic() - _cached_at < CACHE_TTL_SECONDS:
            return _cache

        try:
            payload = await _fetch(settings)
        except Exception as exc:  # noqa: BLE001 - never break AI calls on config issues
            if _cache is not None:
                logger.warning("AI config feed unavailable (%s) — using cached config", exc)
                return _cache
            logger.warning("AI config feed unavailable (%s) — using environment keys", exc)
            return from_env(settings)

        _cache = parse_remote(settings, payload)
        _cached_at = time.monotonic()
        logger.debug(
            "AI config loaded from backend (%d Gemini keys, %d OpenRouter keys)",
            len(_cache.gemini_keys),
            len(_cache.openrouter_keys),
        )
        return _cache
