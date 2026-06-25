import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.data.seed import seed_all
from app.database import Base, SessionLocal, engine
from app.routers import (
    admin,
    assistant,
    experience,
    news,
    profile,
    projects,
    publications,
    skills,
    tracking,
)
from app.services.ingest import ingest_portfolio
from app.services.vector import vector_store

settings = get_settings()
log = logging.getLogger("vasudevan")


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        await seed_all(session)

        # Build the vector index on first boot if empty
        try:
            existing = await vector_store().count()
        except Exception as ex:
            log.warning("vector store unavailable: %s", ex)
            existing = -1

        if existing == 0:
            try:
                n = await ingest_portfolio(session)
                log.info("indexed %d portfolio chunks", n)
            except Exception as ex:
                log.warning("portfolio ingest failed: %s", ex)

    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "llm_enabled": bool(settings.anthropic_api_key),
    }


prefix = settings.api_prefix
for r in (profile, experience, skills, projects, publications, news, tracking, assistant, admin):
    app.include_router(r.router, prefix=prefix)
