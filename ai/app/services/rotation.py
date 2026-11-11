"""Round-robin key rotation with per-key cooldowns, shared by every AI provider.

Each provider keeps its own cursor and its own cooldown table, so exhausting a
Gemini key never parks an OpenRouter key (and vice versa).
"""

from __future__ import annotations

import time

import httpx

# Transient upstream states worth retrying with the same key.
RETRY_STATUSES = frozenset({500, 502, 503, 504})
MAX_ATTEMPTS_PER_KEY = 2
BASE_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 4.0

# How long a key is skipped after the provider reports it exhausted / invalid.
QUOTA_COOLDOWN_SECONDS = 60.0
INVALID_KEY_COOLDOWN_SECONDS = 600.0

_cursors: dict[str, int] = {}
_cooldowns: dict[str, float] = {}


def _slot(provider: str, key: str) -> str:
    return f"{provider}\x00{key}"


def ordered_keys(provider: str, keys: list[str]) -> list[str]:
    """Keys to try, in rotation order, skipping the ones still cooling down."""
    if not keys:
        return []

    now = time.monotonic()
    ready = [key for key in keys if _cooldowns.get(_slot(provider, key), 0.0) <= now]
    # Every key is cooling down → still try them (best effort) rather than fail fast.
    pool = ready or keys

    start = _cursors.get(provider, 0) % len(pool)
    _cursors[provider] = (start + 1) % len(pool)
    return pool[start:] + pool[:start]


def cool_down(provider: str, key: str, seconds: float) -> None:
    _cooldowns[_slot(provider, key)] = time.monotonic() + seconds


def reset(provider: str | None = None) -> None:
    """Clear rotation state; all providers when `provider` is omitted."""
    if provider is None:
        _cursors.clear()
        _cooldowns.clear()
        return
    _cursors.pop(provider, None)
    prefix = f"{provider}\x00"
    for slot in [slot for slot in _cooldowns if slot.startswith(prefix)]:
        _cooldowns.pop(slot, None)


def retry_delay(response: httpx.Response | None, attempt: int) -> float:
    """Honour ``Retry-After`` when present, otherwise use exponential backoff."""
    if response is not None:
        raw = response.headers.get("retry-after")
        if raw:
            try:
                return max(0.0, min(float(raw), MAX_BACKOFF_SECONDS))
            except ValueError:
                pass
    return min(BASE_BACKOFF_SECONDS * (2**attempt), MAX_BACKOFF_SECONDS)
