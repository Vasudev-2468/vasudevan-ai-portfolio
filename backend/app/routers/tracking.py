"""Public tracking endpoints.

Capture contact-form submissions and lightweight visitor analytics
(page views and download clicks). No auth — but rate-limit by sane
field-length caps and trust the frontend to send sensible payloads.

Every event with a session_id touches the Visitor table so the admin
can see a unified identity timeline (email becomes attached after the
visitor submits the contact form).
"""

from __future__ import annotations

import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.database import get_session
from app.services.audit import client_ip, upsert_visitor, user_agent
from app.services.notifications import forward_contact

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|facebookexternalhit|"
    r"whatsapp|telegrambot|linkedinbot|twitterbot|discordbot|"
    r"semrush|ahrefs|mj12bot|dotbot|petalbot|yandexbot|googlebot|baiduspider",
    re.IGNORECASE,
)


def _is_bot(ua: str | None) -> bool:
    if not ua:
        return True
    return bool(_BOT_RE.search(ua))


router = APIRouter(tags=["tracking"])


# ── Contact form ─────────────────────────────────────────────────────────


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    session_id: str | None = Field(default=None, max_length=64)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v.strip()):
            raise ValueError("invalid email")
        return v.strip()


@router.post("/contact")
async def post_contact(
    payload: ContactIn,
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    ip = client_ip(request)
    ua = user_agent(request)

    row = models.ContactMessage(
        name=payload.name.strip(),
        email=payload.email,
        subject=(payload.subject or "").strip() or None,
        message=payload.message.strip(),
        ip=ip,
        user_agent=ua,
    )
    session.add(row)

    await upsert_visitor(
        session,
        session_id=payload.session_id,
        ip=ip,
        ua=ua,
        email=payload.email,
        name=payload.name.strip(),
    )

    await session.commit()

    background_tasks.add_task(
        forward_contact,
        row.name,
        row.email,
        row.subject,
        row.message,
        ip,
    )
    return {"ok": True, "id": row.id}


# ── Page view ────────────────────────────────────────────────────────────


class PageViewIn(BaseModel):
    path: str = Field(min_length=1, max_length=255)
    referrer: str | None = Field(default=None, max_length=500)
    session_id: str | None = Field(default=None, max_length=64)


@router.post("/track/view")
async def post_view(
    payload: PageViewIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    ua = user_agent(request)
    if _is_bot(ua):
        return {"ok": True, "skipped": "bot"}
    ip = client_ip(request)
    row = models.PageView(
        path=payload.path[:255],
        referrer=(payload.referrer or None),
        session_id=payload.session_id,
        ip=ip,
        user_agent=ua,
    )
    session.add(row)
    await upsert_visitor(session, session_id=payload.session_id, ip=ip, ua=ua)
    await session.commit()
    return {"ok": True}


# ── Download ─────────────────────────────────────────────────────────────


class DownloadIn(BaseModel):
    resource: str = Field(min_length=1, max_length=255)
    path: str | None = Field(default=None, max_length=500)
    session_id: str | None = Field(default=None, max_length=64)


@router.post("/track/download")
async def post_download(
    payload: DownloadIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    if "://" in payload.resource:
        raise HTTPException(status_code=400, detail="resource must be a logical name")
    ua = user_agent(request)
    if _is_bot(ua):
        return {"ok": True, "skipped": "bot"}
    ip = client_ip(request)
    row = models.Download(
        resource=payload.resource,
        path=payload.path,
        session_id=payload.session_id,
        ip=ip,
        user_agent=ua,
    )
    session.add(row)
    await upsert_visitor(session, session_id=payload.session_id, ip=ip, ua=ua)
    await session.commit()
    return {"ok": True}


# ── Public custom fields (read-only) ─────────────────────────────────────


@router.get("/custom-fields")
async def public_custom_fields(session: AsyncSession = Depends(get_session)):
    from sqlalchemy import select

    rows = (
        await session.execute(
            select(models.CustomField).where(models.CustomField.is_public.is_(True))
        )
    ).scalars().all()
    return [{"key": r.key, "value": r.value, "kind": r.kind} for r in rows]
