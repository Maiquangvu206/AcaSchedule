from fastapi import APIRouter

from ..config import get_settings

router = APIRouter()


@router.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "acaschedule-ai",
        "version": settings.app_version,
        "gemini_configured": bool(settings.gemini_key_pool),
        "gemini_keys": settings.gemini_key_count,
        "openrouter_configured": bool(settings.openrouter_key_pool),
        "openrouter_keys": settings.openrouter_key_count,
        "openrouter_model": settings.openrouter_model,
        "model": settings.gemini_model,
        "provider_order": settings.provider_order_list,
        # When true, keys/models are pulled live from the backend admin panel.
        "remote_config": bool(settings.backend_config_url and settings.internal_token),
    }
