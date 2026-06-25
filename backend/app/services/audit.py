"""Tiny helpers for writing AuditLog rows + Visitor upserts.

Keep these synchronous-style (just create-and-add) — the caller commits
the surrounding transaction so the audit row lands atomically with the
action it describes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def user_agent(request: Request) -> str | None:
    ua = request.headers.get("user-agent")
    return ua[:500] if ua else None


def audit(
    session: AsyncSession,
    action: str,
    *,
    actor: str = "admin",
    target_table: str | None = None,
    target_id: Any = None,
    details: dict | None = None,
    request: Request | None = None,
) -> None:
    row = models.AuditLog(
        action=action,
        actor=actor,
        target_table=target_table,
        target_id=str(target_id) if target_id is not None else None,
        details=details or {},
        ip=client_ip(request) if request else None,
        user_agent=user_agent(request) if request else None,
    )
    session.add(row)


async def upsert_visitor(
    session: AsyncSession,
    *,
    session_id: str | None,
    ip: str | None = None,
    ua: str | None = None,
    email: str | None = None,
    name: str | None = None,
) -> models.Visitor | None:
    """Insert or update a Visitor by session_id; returns the row (or None
    if no session_id supplied). Always bumps last_seen.
    """
    if not session_id:
        return None
    now = datetime.utcnow()
    existing = (
        await session.execute(
            select(models.Visitor).where(models.Visitor.session_id == session_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.last_seen = now
        if ip and not existing.ip:
            existing.ip = ip
        if ua and not existing.user_agent:
            existing.user_agent = ua
        if email:
            existing.email = email
        if name:
            existing.name = name
        return existing
    row = models.Visitor(
        session_id=session_id,
        email=email,
        name=name,
        ip=ip,
        user_agent=ua,
        first_seen=now,
        last_seen=now,
    )
    session.add(row)
    return row
