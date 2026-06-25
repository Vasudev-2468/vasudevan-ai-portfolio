"""Portfolio Manager Agent.

Given an Upload (PDF certificate, paper, resume), this agent:
1. Extracts text via pypdf
2. Calls Claude (extractor system prompt) to produce structured candidates
3. Writes a PendingDiff for each candidate — never mutates user-facing tables
4. Also indexes the document text into Qdrant under the upload's source label

A human reviews the diffs in /admin and approves or rejects them.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.ingest import extract_pdf, ingest_pdf_bytes
from app.services.llm import llm


async def _log(session: AsyncSession, task_id: int, level: str, msg: str) -> None:
    session.add(models.AgentLog(task_id=task_id, level=level, message=msg))
    await session.flush()


async def run(task_id: int, session: AsyncSession) -> None:
    task = (await session.execute(
        select(models.AgentTask).where(models.AgentTask.id == task_id)
    )).scalar_one_or_none()
    if not task:
        return

    task.status = "running"
    await session.flush()

    try:
        upload = (await session.execute(
            select(models.Upload).where(models.Upload.id == task.upload_id)
        )).scalar_one_or_none()
        if not upload:
            raise RuntimeError("upload missing")

        await _log(session, task_id, "info", f"reading {upload.filename}")
        data = Path(upload.path).read_bytes()

        # 1) Extract text once
        text = extract_pdf(data)
        await _log(session, task_id, "info", f"extracted {len(text)} chars")

        # 2) Index into Qdrant (best-effort)
        try:
            n, _ = await ingest_pdf_bytes(data, source_label=f"Upload · {upload.filename}")
            await _log(session, task_id, "info", f"indexed {n} chunks into vector store")
        except Exception as ex:
            await _log(session, task_id, "warn", f"vector ingest failed: {ex}")

        # 3) Ask Claude for structured candidates
        extraction = await llm().extract_portfolio_diff(text)
        if extraction is None:
            await _log(session, task_id, "warn", "no LLM available — skipping extraction")
            task.result = {"summary": "Indexed only — set ANTHROPIC_API_KEY for extraction.", "candidates": 0}
            task.status = "done"
            upload.status = "done"
            task.finished_at = datetime.utcnow()
            await session.commit()
            return

        # 4) Create PendingDiff rows
        candidates = extraction.get("candidates", []) or []
        overall_conf = int(round(float(extraction.get("confidence", 0)) * 100))
        for c in candidates:
            session.add(models.PendingDiff(
                task_id=task_id,
                target_table=c.get("target", "unknown"),
                action=c.get("action", "create"),
                payload=c.get("fields", {}) or {},
                evidence=c.get("evidence"),
                confidence=overall_conf,
                status="pending",
            ))

        task.result = {
            "summary": extraction.get("summary", ""),
            "candidates": len(candidates),
            "confidence": overall_conf,
        }
        task.status = "done"
        upload.status = "done"
        task.finished_at = datetime.utcnow()
        await _log(session, task_id, "info", f"created {len(candidates)} pending diffs")
        await session.commit()

    except Exception as ex:
        task.status = "error"
        task.error = str(ex)
        task.finished_at = datetime.utcnow()
        await _log(session, task_id, "error", str(ex))
        await session.commit()


# ── Diff application ────────────────────────────────────────────────────

TARGET_MODEL = {
    "publication": models.Publication,
    "project": models.Project,
    "experience": models.Experience,
    "education": models.Education,
    "certification": models.Certification,
    "skill": models.Skill,
}


async def apply_diff(diff: models.PendingDiff, session: AsyncSession) -> None:
    Model = TARGET_MODEL.get(diff.target_table)
    if not Model:
        raise ValueError(f"unknown target: {diff.target_table}")

    payload = dict(diff.payload or {})
    # Coerce types for the few fields that need it
    if diff.target_table == "publication" and "year" in payload:
        try:
            payload["year"] = int(str(payload["year"])[:4])
        except Exception:
            payload.pop("year", None)

    if diff.action == "create":
        session.add(Model(**{k: v for k, v in payload.items() if hasattr(Model, k)}))
    elif diff.action == "update":
        if "id" not in payload:
            raise ValueError("update requires an id")
        target = (await session.execute(
            select(Model).where(Model.id == payload["id"])
        )).scalar_one_or_none()
        if not target:
            raise ValueError(f"target {Model.__tablename__}#{payload['id']} not found")
        for k, v in payload.items():
            if k != "id" and hasattr(Model, k):
                setattr(target, k, v)
    diff.status = "approved"
    diff.decided_at = datetime.utcnow()
