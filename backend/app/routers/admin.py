"""Admin API: uploads, agent tasks, pending diffs.

Protected by a shared bearer token (settings.admin_token). Not a substitute
for real auth — swap for NextAuth + OAuth before exposing publicly.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Header,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import SessionLocal, get_session
from app.services.agents import portfolio_manager
from app.services.audit import audit, client_ip, user_agent
from app.services.ingest import ingest_portfolio
from app.services.vector import vector_store


router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = get_settings().admin_token
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if token != expected:
        raise HTTPException(status_code=403, detail="bad admin token")


# ── Stats ────────────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(require_admin)])
async def stats(session: AsyncSession = Depends(get_session)):
    counts = {}
    for label, Model in [
        ("uploads", models.Upload),
        ("agent_tasks", models.AgentTask),
        ("pending_diffs", models.PendingDiff),
        ("publications", models.Publication),
        ("projects", models.Project),
        ("contacts", models.ContactMessage),
        ("page_views", models.PageView),
        ("downloads", models.Download),
        ("visitors", models.Visitor),
        ("custom_fields", models.CustomField),
        ("audit_entries", models.AuditLog),
    ]:
        counts[label] = (await session.execute(
            select(func.count()).select_from(Model)
        )).scalar_one()

    counts["pending_review"] = (await session.execute(
        select(func.count()).select_from(models.PendingDiff)
        .where(models.PendingDiff.status == "pending")
    )).scalar_one()

    counts["vector_chunks"] = await vector_store().count()
    return counts


# ── Uploads + Portfolio Manager Agent ────────────────────────────────────

async def _run_portfolio_manager(task_id: int) -> None:
    async with SessionLocal() as bg_session:
        await portfolio_manager.run(task_id, bg_session)


@router.post(
    "/uploads",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_admin)],
)
async def upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="only PDFs are supported right now")

    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{int(datetime.utcnow().timestamp())}-{file.filename.replace('/', '_')}"
    dest = upload_dir / safe_name
    data = await file.read()
    dest.write_bytes(data)

    record = models.Upload(
        filename=file.filename,
        mime=file.content_type or "application/pdf",
        path=str(dest),
        size_bytes=len(data),
        status="processing",
    )
    session.add(record)
    await session.flush()

    task = models.AgentTask(
        agent="portfolio_manager",
        upload_id=record.id,
        status="queued",
        payload={"filename": file.filename},
    )
    session.add(task)
    await session.commit()

    background_tasks.add_task(_run_portfolio_manager, task.id)

    return {"upload_id": record.id, "task_id": task.id, "status": "queued"}


@router.get("/uploads", dependencies=[Depends(require_admin)])
async def list_uploads(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(models.Upload).order_by(models.Upload.created_at.desc()).limit(50)
    )).scalars().all()
    return [
        {
            "id": r.id, "filename": r.filename, "status": r.status,
            "size_bytes": r.size_bytes, "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/tasks", dependencies=[Depends(require_admin)])
async def list_tasks(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(models.AgentTask).order_by(models.AgentTask.created_at.desc()).limit(50)
    )).scalars().all()
    return [
        {
            "id": r.id, "agent": r.agent, "status": r.status, "upload_id": r.upload_id,
            "result": r.result, "error": r.error, "created_at": r.created_at,
            "finished_at": r.finished_at,
        }
        for r in rows
    ]


# ── Pending diffs ────────────────────────────────────────────────────────

@router.get("/diffs", dependencies=[Depends(require_admin)])
async def list_diffs(
    status_filter: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(models.PendingDiff).order_by(models.PendingDiff.created_at.desc())
    if status_filter:
        stmt = stmt.where(models.PendingDiff.status == status_filter)
    rows = (await session.execute(stmt.limit(200))).scalars().all()
    return [
        {
            "id": r.id,
            "task_id": r.task_id,
            "target_table": r.target_table,
            "action": r.action,
            "payload": r.payload,
            "evidence": r.evidence,
            "confidence": r.confidence,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/diffs/{diff_id}/approve", dependencies=[Depends(require_admin)])
async def approve(diff_id: int, session: AsyncSession = Depends(get_session)):
    diff = (await session.execute(
        select(models.PendingDiff).where(models.PendingDiff.id == diff_id)
    )).scalar_one_or_none()
    if not diff:
        raise HTTPException(status_code=404, detail="diff not found")
    if diff.status != "pending":
        raise HTTPException(status_code=409, detail=f"diff already {diff.status}")
    try:
        await portfolio_manager.apply_diff(diff, session)
        await session.commit()
    except Exception as ex:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(ex)) from ex
    return {"id": diff.id, "status": diff.status}


@router.post("/diffs/{diff_id}/reject", dependencies=[Depends(require_admin)])
async def reject(diff_id: int, session: AsyncSession = Depends(get_session)):
    diff = (await session.execute(
        select(models.PendingDiff).where(models.PendingDiff.id == diff_id)
    )).scalar_one_or_none()
    if not diff:
        raise HTTPException(status_code=404, detail="diff not found")
    diff.status = "rejected"
    diff.decided_at = datetime.utcnow()
    await session.commit()
    return {"id": diff.id, "status": diff.status}


# ── Visitor history (contacts, page views, downloads) ──────────────────


@router.get("/contacts", dependencies=[Depends(require_admin)])
async def list_contacts(
    limit: int = 200,
    session: AsyncSession = Depends(get_session),
):
    rows = (await session.execute(
        select(models.ContactMessage)
        .order_by(models.ContactMessage.created_at.desc())
        .limit(min(limit, 500))
    )).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "subject": r.subject,
            "message": r.message,
            "status": r.status,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/contacts/{contact_id}/status", dependencies=[Depends(require_admin)])
async def set_contact_status(
    contact_id: int,
    payload: dict,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    new_status = (payload.get("status") or "").strip()
    if new_status not in {"new", "read", "archived"}:
        raise HTTPException(status_code=400, detail="status must be new|read|archived")
    row = (await session.execute(
        select(models.ContactMessage).where(models.ContactMessage.id == contact_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="contact not found")
    previous = row.status
    row.status = new_status
    audit(
        session,
        "contact.status_change",
        target_table="contact_message",
        target_id=row.id,
        details={"from": previous, "to": new_status, "email": row.email},
        request=request,
    )
    await session.commit()
    return {"id": row.id, "status": row.status}


@router.get("/views", dependencies=[Depends(require_admin)])
async def list_views(
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    rows = (await session.execute(
        select(models.PageView)
        .order_by(models.PageView.created_at.desc())
        .limit(min(limit, 500))
    )).scalars().all()
    return [
        {
            "id": r.id,
            "path": r.path,
            "referrer": r.referrer,
            "session_id": r.session_id,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/views/stats", dependencies=[Depends(require_admin)])
async def view_stats(session: AsyncSession = Depends(get_session)):
    # Per-path counts (top 20)
    by_path = (await session.execute(
        select(models.PageView.path, func.count())
        .group_by(models.PageView.path)
        .order_by(func.count().desc())
        .limit(20)
    )).all()
    total = (await session.execute(
        select(func.count()).select_from(models.PageView)
    )).scalar_one()
    unique_sessions = (await session.execute(
        select(func.count(func.distinct(models.PageView.session_id)))
        .where(models.PageView.session_id.is_not(None))
    )).scalar_one()
    unique_ips = (await session.execute(
        select(func.count(func.distinct(models.PageView.ip)))
        .where(models.PageView.ip.is_not(None))
    )).scalar_one()
    return {
        "total": total,
        "unique_sessions": unique_sessions,
        "unique_ips": unique_ips,
        "by_path": [{"path": p, "count": c} for (p, c) in by_path],
    }


@router.get("/downloads", dependencies=[Depends(require_admin)])
async def list_downloads(
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    rows = (await session.execute(
        select(models.Download)
        .order_by(models.Download.created_at.desc())
        .limit(min(limit, 500))
    )).scalars().all()
    return [
        {
            "id": r.id,
            "resource": r.resource,
            "path": r.path,
            "session_id": r.session_id,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ── Daily analytics rollup ───────────────────────────────────────────────


@router.get("/analytics/daily", dependencies=[Depends(require_admin)])
async def analytics_daily(
    days: int = 30,
    session: AsyncSession = Depends(get_session),
):
    """Per-day counts of views / contacts / downloads over the last N days.

    Returns a dense array — one entry per day, missing days zero-filled.
    """
    from datetime import datetime, timedelta

    days = max(1, min(days, 90))
    today = datetime.utcnow().date()
    start = today - timedelta(days=days - 1)
    # Column is naive UTC; keep the bound naive to satisfy asyncpg.
    start_dt = datetime.combine(start, datetime.min.time())

    async def _per_day(model) -> dict[str, int]:
        rows = (
            await session.execute(
                select(
                    func.date(model.created_at).label("d"),
                    func.count().label("n"),
                )
                .where(model.created_at >= start_dt)
                .group_by(func.date(model.created_at))
            )
        ).all()
        return {str(d): int(n) for (d, n) in rows}

    views = await _per_day(models.PageView)
    contacts = await _per_day(models.ContactMessage)
    downloads = await _per_day(models.Download)

    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        key = d.isoformat()
        out.append(
            {
                "date": key,
                "views": views.get(key, 0),
                "contacts": contacts.get(key, 0),
                "downloads": downloads.get(key, 0),
            }
        )
    return {"days": days, "series": out}


# ── Reindex ──────────────────────────────────────────────────────────────

@router.post("/reindex", dependencies=[Depends(require_admin)])
async def reindex(session: AsyncSession = Depends(get_session)):
    n = await ingest_portfolio(session)
    return {"chunks_indexed": n}


# ── Login / Logout (audited) ─────────────────────────────────────────────


class LoginIn(BaseModel):
    token: str = Field(min_length=1, max_length=200)


@router.post("/login")
async def admin_login(
    payload: LoginIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    expected = get_settings().admin_token
    masked = payload.token[:4] + "…" if payload.token else "<empty>"
    if payload.token != expected:
        audit(
            session,
            "admin.login_fail",
            actor="anonymous",
            details={"token_prefix": masked},
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=403, detail="bad admin token")
    audit(
        session,
        "admin.login",
        actor="admin",
        details={"token_prefix": masked},
        request=request,
    )
    await session.commit()
    return {"ok": True}


@router.post("/logout", dependencies=[Depends(require_admin)])
async def admin_logout(request: Request, session: AsyncSession = Depends(get_session)):
    audit(session, "admin.logout", actor="admin", request=request)
    await session.commit()
    return {"ok": True}


# ── Custom fields (CRUD, audited) ────────────────────────────────────────


class CustomFieldIn(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value: str | None = Field(default=None, max_length=8000)
    kind: str = Field(default="text", max_length=20)
    description: str | None = Field(default=None, max_length=500)
    is_public: bool = False


def _serialize_field(r: models.CustomField) -> dict:
    return {
        "id": r.id,
        "key": r.key,
        "value": r.value,
        "kind": r.kind,
        "description": r.description,
        "is_public": r.is_public,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


@router.get("/custom-fields", dependencies=[Depends(require_admin)])
async def list_custom_fields(session: AsyncSession = Depends(get_session)):
    rows = (
        await session.execute(
            select(models.CustomField).order_by(models.CustomField.key)
        )
    ).scalars().all()
    return [_serialize_field(r) for r in rows]


@router.post("/custom-fields", dependencies=[Depends(require_admin)])
async def create_custom_field(
    payload: CustomFieldIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    existing = (
        await session.execute(
            select(models.CustomField).where(models.CustomField.key == payload.key)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"key '{payload.key}' already exists")
    row = models.CustomField(
        key=payload.key,
        value=payload.value,
        kind=payload.kind,
        description=payload.description,
        is_public=payload.is_public,
    )
    session.add(row)
    await session.flush()
    audit(
        session,
        "custom_field.create",
        target_table="custom_field",
        target_id=row.id,
        details={"after": payload.model_dump()},
        request=request,
    )
    await session.commit()
    return _serialize_field(row)


@router.put("/custom-fields/{field_id}", dependencies=[Depends(require_admin)])
async def update_custom_field(
    field_id: int,
    payload: CustomFieldIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    row = (
        await session.execute(
            select(models.CustomField).where(models.CustomField.id == field_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    before = _serialize_field(row)
    row.key = payload.key
    row.value = payload.value
    row.kind = payload.kind
    row.description = payload.description
    row.is_public = payload.is_public
    audit(
        session,
        "custom_field.update",
        target_table="custom_field",
        target_id=row.id,
        details={"before": {k: before[k] for k in ("key", "value", "kind", "is_public")},
                 "after": payload.model_dump()},
        request=request,
    )
    await session.commit()
    return _serialize_field(row)


@router.delete("/custom-fields/{field_id}", dependencies=[Depends(require_admin)])
async def delete_custom_field(
    field_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    row = (
        await session.execute(
            select(models.CustomField).where(models.CustomField.id == field_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    snapshot = _serialize_field(row)
    await session.delete(row)
    audit(
        session,
        "custom_field.delete",
        target_table="custom_field",
        target_id=field_id,
        details={"before": {k: snapshot[k] for k in ("key", "value", "kind", "is_public")}},
        request=request,
    )
    await session.commit()
    return {"ok": True, "id": field_id}


# ── Visitors (joined with activity counts + email) ───────────────────────


@router.get("/visitors", dependencies=[Depends(require_admin)])
async def list_visitors(
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    visitors = (
        await session.execute(
            select(models.Visitor)
            .order_by(models.Visitor.last_seen.desc())
            .limit(min(limit, 500))
        )
    ).scalars().all()
    if not visitors:
        return []

    sids = [v.session_id for v in visitors]
    emails = [v.email for v in visitors if v.email]

    async def _counts_by_sid(model) -> dict[str, int]:
        rows = (
            await session.execute(
                select(model.session_id, func.count())
                .where(model.session_id.in_(sids))
                .group_by(model.session_id)
            )
        ).all()
        return {sid: int(n) for (sid, n) in rows}

    views_by_sid = await _counts_by_sid(models.PageView)
    downloads_by_sid = await _counts_by_sid(models.Download)

    messages_by_email: dict[str, int] = {}
    if emails:
        rows = (
            await session.execute(
                select(models.ContactMessage.email, func.count())
                .where(models.ContactMessage.email.in_(emails))
                .group_by(models.ContactMessage.email)
            )
        ).all()
        messages_by_email = {e: int(n) for (e, n) in rows}

    return [
        {
            "id": v.id,
            "session_id": v.session_id,
            "email": v.email,
            "name": v.name,
            "ip": v.ip,
            "user_agent": v.user_agent,
            "first_seen": v.first_seen,
            "last_seen": v.last_seen,
            "views": views_by_sid.get(v.session_id, 0),
            "downloads": downloads_by_sid.get(v.session_id, 0),
            "messages": messages_by_email.get(v.email, 0) if v.email else 0,
        }
        for v in visitors
    ]


# ── Audit log ────────────────────────────────────────────────────────────


@router.get("/audit", dependencies=[Depends(require_admin)])
async def list_audit(
    limit: int = 200,
    action_prefix: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(models.AuditLog).order_by(models.AuditLog.created_at.desc())
    if action_prefix:
        stmt = stmt.where(models.AuditLog.action.startswith(action_prefix))
    rows = (await session.execute(stmt.limit(min(limit, 1000)))).scalars().all()
    return [
        {
            "id": r.id,
            "action": r.action,
            "actor": r.actor,
            "target_table": r.target_table,
            "target_id": r.target_id,
            "details": r.details,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "created_at": r.created_at,
        }
        for r in rows
    ]
