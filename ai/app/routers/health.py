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
        "gemini_configured": bool(settings.gemini_api_key),
        "model": settings.gemini_model,
    }
