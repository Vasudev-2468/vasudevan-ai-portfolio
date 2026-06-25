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


async def ingest_portfolio(session: AsyncSession) -> int:
    """Index all DB-backed portfolio content. Idempotent — recreates rows by
    using fresh UUIDs, so callers may want to clear the collection first."""
    store = vector_store()
    chunks: list[dict] = []

    # Profile + summary
    profile = (await session.execute(select(models.Profile).limit(1))).scalar_one_or_none()
    if profile:
        chunks.append({
            "text": f"{profile.name} — {profile.title}. {profile.summary}",
            "source": f"Profile · {profile.name}",
            "metadata": {"kind": "profile"},
        })

    # Experience
    for e in (await session.execute(select(models.Experience))).scalars():
        chunks.append({
            "text": (
                f"Role: {e.role} at {e.company} ({e.location}). "
                f"Dates: {e.start_date} — {e.end_date}. {e.description}"
            ),
            "source": f"Experience · {e.role} at {e.company} ({e.start_date}–{e.end_date})",
            "metadata": {"kind": "experience", "id": e.id},
        })

    # Education
    for ed in (await session.execute(select(models.Education))).scalars():
        chunks.append({
            "text": f"{ed.degree}, {ed.institution} ({ed.location}), {ed.year}.",
            "source": f"Education · {ed.degree}, {ed.institution} ({ed.year})",
            "metadata": {"kind": "education", "id": ed.id},
        })

    # Projects
    for p in (await session.execute(select(models.Project))).scalars():
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
    for pub in (await session.execute(select(models.Publication))).scalars():
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
    for c in (await session.execute(select(models.Certification))).scalars():
        chunks.append({
            "text": f"Certification / award: {c.name} — {c.issuer}.",
            "source": f"Certification · {c.name}",
            "metadata": {"kind": "certification", "id": c.id},
        })

    return await store.upsert(chunks)


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
