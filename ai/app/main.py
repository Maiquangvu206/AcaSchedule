from fastapi import FastAPI

from .config import get_settings
from .routers import advisor, documents, health

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI Advisor & RAG service for AcaSchedule.",
)

app.include_router(health.router, tags=["health"])
app.include_router(advisor.router, tags=["advisor"])
app.include_router(documents.router, tags=["documents"])


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }
