"""Ingestion pipeline: extract → chunk → embed → upsert to Qdrant.

Two ingestion paths:
1. SQL → vector: pulls the seeded portfolio rows (publications, projects, ...)
   and indexes them so the assistant can cite them.
2. PDF → vector: reads a PDF (resume, certificate, paper) and indexes its
   chunks under a custom source label.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Callable

from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.vector import vector_store


CHUNK_SIZE = 900   # ~250 tokens, healthy for bge-small
CHUNK_OVERLAP = 120


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = " ".join(text.split())
    if len(text) <= size:
        return [text] if text else []
    out: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        out.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return out


def extract_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


async def ingest_portfolio(session: AsyncSession, *, rebuild: bool = False) -> int:
    """Index all DB-backed portfolio content.

    When `rebuild=True`, the vector collection is cleared first so callers get
    a clean idempotent rebuild (used by admin content mutations and the manual
    reindex endpoint). Without `rebuild`, chunks are appended with fresh UUIDs
    and duplicates accumulate across calls — kept for backwards compat.
    """
    store = vector_store()
    if rebuild:
        await store.clear()
    chunks: list[dict] = []

    def _public(Model):
        # Only index rows the public site would render — unpublished or
        # trashed entities shouldn't leak into the assistant's answers.
        return select(Model).where(
            Model.is_public.is_(True), Model.deleted_at.is_(None)
        )

    # Profile + summary
    profile = (await session.execute(select(models.Profile).limit(1))).scalar_one_or_none()
    if profile:
        chunks.append({
            "text": f"{profile.name} — {profile.title}. {profile.summary}",
            "source": f"Profile · {profile.name}",
            "metadata": {"kind": "profile"},
        })

    # Experience
    for e in (await session.execute(_public(models.Experience))).scalars():
        chunks.append({
            "text": (
                f"Role: {e.role} at {e.company} ({e.location}). "
                f"Dates: {e.start_date} — {e.end_date}. {e.description}"
            ),
            "source": f"Experience · {e.role} at {e.company} ({e.start_date}–{e.end_date})",
            "metadata": {"kind": "experience", "id": e.id},
        })

    # Education
    for ed in (await session.execute(_public(models.Education))).scalars():
        chunks.append({
            "text": f"{ed.degree}, {ed.institution} ({ed.location}), {ed.year}.",
            "source": f"Education · {ed.degree}, {ed.institution} ({ed.year})",
            "metadata": {"kind": "education", "id": ed.id},
        })

    # Projects
    for p in (await session.execute(_public(models.Project))).scalars():
        text = (
            f"Project: {p.title} ({p.year}, role: {p.role}). {p.summary} "
            f"Achievements: {' | '.join(p.achievements)}. "
            f"Tech: {', '.join(p.tech_stack)}."
        )
        for ch in chunk_text(text):
            chunks.append({
                "text": ch,
                "source": f"Project · {p.title} ({p.year})",
                "metadata": {"kind": "project", "id": p.id},
            })

    # Publications
    for pub in (await session.execute(_public(models.Publication))).scalars():
        chunks.append({
            "text": (
                f"{pub.kind.title()} ({pub.year}): {pub.title}. "
                f"Authors: {pub.authors}. Venue: {pub.venue}."
                + (f" DOI: {pub.doi}." if pub.doi else "")
            ),
            "source": f"{pub.kind.title()} · {pub.title} ({pub.year})",
            "metadata": {"kind": "publication", "id": pub.id, "pub_kind": pub.kind},
        })

    # Certifications
    for c in (await session.execute(_public(models.Certification))).scalars():
        chunks.append({
            "text": f"Certification / award: {c.name} — {c.issuer}.",
            "source": f"Certification · {c.name}",
            "metadata": {"kind": "certification", "id": c.id},
        })

    return await store.upsert(chunks)


# ── Per-entity chunk builders ─────────────────────────────────────────────
#
# One function per entity type. Each returns the list of `{text, source,
# metadata}` chunks that represent that row in the vector store, matching
# exactly what `ingest_portfolio` produces. The admin content mutations
# call `reindex_entity(kind, session, id)` after a save so only the touched
# entity's points are recomputed — no full rebuild, no empty-collection
# window.


def _profile_chunks(p: models.Profile) -> list[dict]:
    return [
        {
            "text": f"{p.name} — {p.title}. {p.summary}",
            "source": f"Profile · {p.name}",
            "metadata": {"kind": "profile"},
        }
    ]


def _experience_chunks(e: models.Experience) -> list[dict]:
    return [
        {
            "text": (
                f"Role: {e.role} at {e.company} ({e.location}). "
                f"Dates: {e.start_date} — {e.end_date}. {e.description}"
            ),
            "source": f"Experience · {e.role} at {e.company} ({e.start_date}–{e.end_date})",
            "metadata": {"kind": "experience"},
        }
    ]


def _education_chunks(ed: models.Education) -> list[dict]:
    return [
        {
            "text": f"{ed.degree}, {ed.institution} ({ed.location}), {ed.year}.",
            "source": f"Education · {ed.degree}, {ed.institution} ({ed.year})",
            "metadata": {"kind": "education"},
        }
    ]


def _project_chunks(p: models.Project) -> list[dict]:
    text = (
        f"Project: {p.title} ({p.year}, role: {p.role}). {p.summary} "
        f"Achievements: {' | '.join(p.achievements)}. "
        f"Tech: {', '.join(p.tech_stack)}."
    )
    return [
        {"text": ch, "source": f"Project · {p.title} ({p.year})", "metadata": {"kind": "project"}}
        for ch in chunk_text(text)
    ]


def _publication_chunks(pub: models.Publication) -> list[dict]:
    return [
        {
            "text": (
                f"{pub.kind.title()} ({pub.year}): {pub.title}. "
                f"Authors: {pub.authors}. Venue: {pub.venue}."
                + (f" DOI: {pub.doi}." if pub.doi else "")
            ),
            "source": f"{pub.kind.title()} · {pub.title} ({pub.year})",
            "metadata": {"kind": "publication", "pub_kind": pub.kind},
        }
    ]


def _certification_chunks(c: models.Certification) -> list[dict]:
    return [
        {
            "text": f"Certification / award: {c.name} — {c.issuer}.",
            "source": f"Certification · {c.name}",
            "metadata": {"kind": "certification"},
        }
    ]


_MODELS: dict[str, tuple[type, Callable[[object], list[dict]]]] = {
    "profile": (models.Profile, _profile_chunks),
    "experience": (models.Experience, _experience_chunks),
    "education": (models.Education, _education_chunks),
    "project": (models.Project, _project_chunks),
    "publication": (models.Publication, _publication_chunks),
    "certification": (models.Certification, _certification_chunks),
    # Skills aren't embedded individually — they'd be too short and noisy.
    # Silently no-op if the router calls reindex_entity for them.
}


async def reindex_entity(
    kind: str, entity_id: int, session: AsyncSession
) -> int:
    """Re-embed just the given (kind, id) in place.

    Removes vectors if the row is gone, trashed (deleted_at is set), or
    unpublished (is_public is false) — the assistant should only surface
    what the public site would show. Returns the number of chunks now
    stored for the entity.
    """
    store = vector_store()
    entry = _MODELS.get(kind)
    if not entry:
        return 0
    Model, builder = entry
    row = (
        await session.execute(select(Model).where(Model.id == entity_id))
    ).scalar_one_or_none()
    if row is not None and (
        getattr(row, "deleted_at", None) is not None
        or getattr(row, "is_public", True) is False
    ):
        await store.delete_entity(kind, entity_id)
        return 0
    if not row:
        await store.delete_entity(kind, entity_id)
        return 0
    return await store.upsert_entity(kind, entity_id, builder(row))


async def unindex_entity(kind: str, entity_id: int) -> None:
    """Remove all vector points for a (kind, id) — used on hard delete."""
    await vector_store().delete_entity(kind, entity_id)


async def ingest_pdf_bytes(data: bytes, source_label: str) -> tuple[int, str]:
    text = extract_pdf(data)
    chunks = [
        {"text": ch, "source": source_label, "metadata": {"kind": "upload"}}
        for ch in chunk_text(text)
    ]
    n = await vector_store().upsert(chunks)
    return n, text


async def ingest_pdf_file(path: Path, source_label: str) -> tuple[int, str]:
    return await ingest_pdf_bytes(path.read_bytes(), source_label)
