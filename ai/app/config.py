from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_keys(raw: str, single: str) -> list[str]:
    """Unique, non-empty keys from a comma-separated pool plus a single key."""
    seen: set[str] = set()
    pool: list[str] = []
    for item in [*raw.split(","), single]:
        key = item.strip()
        if key and key not in seen:
            seen.add(key)
            pool.append(key)
    return pool


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AcaSchedule AI Service"
    app_version: str = "0.1.0"

    # ── Gemini (Google AI Studio) ─────────────────────────────────────────
    # Single key (backward compatible) …
    gemini_api_key: str = ""
    # … or a comma-separated pool: GEMINI_API_KEYS=key1,key2,key3
    # Each key should come from a different Google AI Studio project so each has
    # its own quota; the client rotates between them.
    gemini_api_keys: str = ""

    gemini_model: str = "gemini-1.5-flash"
    gemini_timeout_seconds: float = 30.0

    # ── OpenRouter ────────────────────────────────────────────────────────
    # Single key (backward compatible) …
    openrouter_api_key: str = ""
    # … or a pool: OPENROUTER_API_KEYS=key1,key2,key3,key4,key5
    openrouter_api_keys: str = ""

    openrouter_model: str = "google/gemini-2.0-flash-001"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Free OpenRouter models can queue for a while, so allow a generous timeout.
    openrouter_timeout_seconds: float = 60.0
    # Sent as HTTP-Referer / X-Title, used by OpenRouter for rankings.
    openrouter_site_url: str = "https://acaschedule-frontend-ax5x.onrender.com"

    # ── Provider chain ────────────────────────────────────────────────────
    # Comma-separated preference order; unknown names are ignored. The chain is
    # rotated per request so neither provider is always asked first.
    ai_provider_order: str = "gemini,openrouter"

    # ── Backend config feed (admin-managed keys/settings) ─────────────────
    # When both are set, the AI service pulls the live key pool and models from
    # the backend every 30s. Empty = env-only mode (GEMINI_* / OPENROUTER_*).
    backend_config_url: str = ""
    internal_token: str = ""
    backend_config_timeout_seconds: float = 5.0

    # Gemini 3.x counts internal "thinking" tokens against this budget, so keep it
    # generous enough that the visible answer is never cut off mid-sentence.
    max_output_tokens: int = 8192

    max_context_chars: int = 20_000

    @property
    def gemini_key_pool(self) -> list[str]:
        """Unique, non-empty Gemini API keys in configuration order."""
        return _split_keys(self.gemini_api_keys, self.gemini_api_key)

    @property
    def gemini_key_count(self) -> int:
        return len(self.gemini_key_pool)

    @property
    def openrouter_key_pool(self) -> list[str]:
        """Unique, non-empty OpenRouter API keys in configuration order."""
        return _split_keys(self.openrouter_api_keys, self.openrouter_api_key)

    @property
    def openrouter_key_count(self) -> int:
        return len(self.openrouter_key_pool)

    @property
    def provider_order_list(self) -> list[str]:
        """Known provider names in configured order (empty entries dropped)."""
        known = {"gemini", "openrouter"}
        order = [name.strip().lower() for name in self.ai_provider_order.split(",")]
        ordered = [name for name in order if name in known]
        # Always keep both providers reachable even if the env var is malformed.
        return ordered + [name for name in ("gemini", "openrouter") if name not in ordered]


@lru_cache
def get_settings() -> Settings:
    return Settings()
