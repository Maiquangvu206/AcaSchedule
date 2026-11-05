from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AcaSchedule AI Service"
    app_version: str = "0.1.0"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    gemini_timeout_seconds: float = 30.0

    max_context_chars: int = 20_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
