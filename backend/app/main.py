import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import get_settings
from app.data.seed import seed_all
from app.database import Base, SessionLocal, engine
from app.routers import (
    admin,
    admin_auth,
    admin_content,
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


async def _add_column_if_missing(conn, table: str, column: str, coltype: str) -> None:
    """Idempotent single-column ALTER for both SQLite (dev) and Postgres (prod)."""
    dialect = conn.dialect.name
    try:
        if dialect == "sqlite":
            rows = (
                await conn.exec_driver_sql(f"PRAGMA table_info({table})")
            ).fetchall()
            if not any(r[1] == column for r in rows):
                await conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"
                )
        else:
            await conn.execute(
                text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coltype}"
                )
            )
    except Exception as ex:  # never block startup on a schema check
        log.warning("%s.%s column check skipped: %s", table, column, ex)


async def _ensure_columns(conn) -> None:
    """Grow the schema in place for columns added after tables were first
    created. `Base.metadata.create_all` only creates missing tables, not
    missing columns — so admin-content additions (version, is_public,
    deleted_at, photo_url) need this migration step."""
    await _add_column_if_missing(conn, "profile", "photo_url", "VARCHAR(500)")
    for tbl in ("experience", "education", "skill", "project", "publication", "certification"):
        await _add_column_if_missing(conn, tbl, "version", "INTEGER DEFAULT 0")
        await _add_column_if_missing(conn, tbl, "is_public", "BOOLEAN DEFAULT TRUE")
        await _add_column_if_missing(conn, tbl, "deleted_at", "TIMESTAMP NULL")


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_columns(conn)

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
for r in (profile, experience, skills, projects, publications, news, tracking, assistant, admin_auth, admin, admin_content):
    app.include_router(r.router, prefix=prefix)

# Serve admin-uploaded assets (currently just profile photos) at /media/*.
# The upload dir is created if missing so this mount never fails on cold
# containers.
_media_root = Path(settings.upload_dir)
_media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_media_root)), name="media")
