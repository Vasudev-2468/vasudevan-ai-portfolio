"""Admin auth endpoints: setup / login / 2FA / password / me / logout.

All flows write to `AuditLog` via the existing `audit()` helper so a paper
trail of every attempt (success or failure) is available in the Dashboard →
Audit log panel.
"""

from __future__ import annotations

import base64
from datetime import datetime
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.database import get_session
from app.services import auth as auth_svc
from app.services.audit import audit


router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


# ── Schemas ─────────────────────────────────────────────────────────────


class SetupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class TwoFAIn(BaseModel):
    challenge: str
    code: str = Field(min_length=4, max_length=20)


class EnableTwoFAIn(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class DisableTwoFAIn(BaseModel):
    password: str
    code: str = Field(min_length=6, max_length=20)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=200)


# ── Helpers ─────────────────────────────────────────────────────────────


def _qr_png_data_url(data: str) -> str:
    """Return a `data:image/png;base64,…` URL for the TOTP provisioning URI.

    PNG chosen over SVG because the previous SVG output used the `svg:`
    namespace prefix + fixed `mm` dimensions, which browsers refuse to
    render inline via `innerHTML`. A base64 PNG drops straight into an
    `<img src=…>` tag with no injection or scaling issues.
    """
    # box_size=10 → ~290×290 px for a typical otpauth URI (v2, ~40 chars).
    # border=2 keeps the "quiet zone" required by scanners without waste.
    img = qrcode.make(data, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


async def _load_user(session: AsyncSession, user_id: int) -> models.AdminUser:
    row = (
        await session.execute(
            select(models.AdminUser).where(models.AdminUser.id == user_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="user not found")
    return row


# ── Bootstrap ───────────────────────────────────────────────────────────


@router.get("/status")
async def auth_status(session: AsyncSession = Depends(get_session)):
    """Called by the frontend on load to decide setup/login/authed."""
    return {"needs_setup": not await auth_svc.admin_user_exists(session)}


@router.post("/setup")
async def setup(
    payload: SetupIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Create the very first admin. Self-locks once a user exists."""
    if await auth_svc.admin_user_exists(session):
        raise HTTPException(status_code=403, detail="admin already provisioned")
    user = models.AdminUser(
        email=str(payload.email).lower(),
        password_hash=auth_svc.hash_password(payload.password),
        totp_enabled=False,
        backup_codes=[],
    )
    session.add(user)
    await session.flush()
    sid = await auth_svc.create_session(session, user.id, request)
    audit(
        session,
        "auth.setup",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    auth_svc.set_session_cookie(response, sid)
    return {"ok": True, "user": {"id": user.id, "email": user.email, "totp_enabled": False}}


# ── Login (password → maybe 2FA) ────────────────────────────────────────


@router.post("/login")
async def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    auth_svc.check_rate_limit(request)
    email = str(payload.email).lower()
    user = (
        await session.execute(
            select(models.AdminUser).where(models.AdminUser.email == email)
        )
    ).scalar_one_or_none()

    if not user or not auth_svc.verify_password(payload.password, user.password_hash):
        auth_svc.record_failure(request)
        audit(
            session,
            "auth.login_fail",
            actor=email or "anonymous",
            details={"reason": "bad_credentials"},
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="invalid email or password")

    if user.totp_enabled:
        # Password OK — issue a challenge and wait for the code.
        challenge = auth_svc.make_challenge(user.id)
        audit(
            session,
            "auth.login_challenge",
            actor=user.email,
            target_table="admin_user",
            target_id=user.id,
            request=request,
        )
        await session.commit()
        return {"needs_2fa": True, "challenge": challenge}

    # No 2FA — issue session cookie now.
    sid = await auth_svc.create_session(session, user.id, request)
    user.last_login_at = datetime.utcnow()
    auth_svc.clear_failures(request)
    audit(
        session,
        "auth.login",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    auth_svc.set_session_cookie(response, sid)
    return {
        "ok": True,
        "user": {"id": user.id, "email": user.email, "totp_enabled": user.totp_enabled},
    }


@router.post("/2fa")
async def submit_2fa(
    payload: TwoFAIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    auth_svc.check_rate_limit(request)
    user_id = auth_svc.verify_challenge(payload.challenge)
    if user_id is None:
        auth_svc.record_failure(request)
        audit(
            session,
            "auth.2fa_fail",
            actor="anonymous",
            details={"reason": "bad_challenge"},
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="challenge expired — sign in again")

    user = await _load_user(session, user_id)
    code = payload.code.strip().replace(" ", "").replace("-", "").upper()

    ok = False
    used_backup = False
    if user.totp_secret and auth_svc.verify_totp(user.totp_secret, code):
        ok = True
    else:
        # Try backup codes. Rebuild the list with new dicts so SQLAlchemy's
        # JSON column sees a fresh value (in-place mutation of nested dicts
        # is invisible to change tracking without MutableList/MutableDict).
        rebuilt: list[dict] = []
        stamped_at = datetime.utcnow().isoformat()
        for entry in list(user.backup_codes or []):
            new_entry = dict(entry)
            if (
                not used_backup
                and not new_entry.get("used_at")
                and auth_svc.verify_backup_code(code, new_entry["hash"])
            ):
                new_entry["used_at"] = stamped_at
                ok = True
                used_backup = True
            rebuilt.append(new_entry)
        if used_backup:
            user.backup_codes = rebuilt

    if not ok:
        auth_svc.record_failure(request)
        audit(
            session,
            "auth.2fa_fail",
            actor=user.email,
            target_table="admin_user",
            target_id=user.id,
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="invalid 2FA code")

    sid = await auth_svc.create_session(session, user.id, request)
    user.last_login_at = datetime.utcnow()
    auth_svc.clear_failures(request)
    audit(
        session,
        "auth.login" if not used_backup else "auth.login_backup",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    auth_svc.set_session_cookie(response, sid)
    return {
        "ok": True,
        "user": {"id": user.id, "email": user.email, "totp_enabled": True},
    }


# ── Session lifecycle ───────────────────────────────────────────────────


@router.get("/me")
async def me(
    user: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    return {"id": user.id, "email": user.email, "totp_enabled": user.totp_enabled}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    sid = auth_svc.read_session_cookie(request)
    if sid:
        await auth_svc.revoke_session(session, sid)
        audit(session, "auth.logout", actor="admin", request=request)
        await session.commit()
    auth_svc.clear_session_cookie(response)
    return {"ok": True}


# ── Password change ─────────────────────────────────────────────────────


@router.post("/password")
async def change_password(
    payload: PasswordChangeIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    user = await _load_user(session, authed.id)
    if not auth_svc.verify_password(payload.current_password, user.password_hash):
        audit(
            session,
            "auth.password_change_fail",
            actor=user.email,
            target_table="admin_user",
            target_id=user.id,
            details={"reason": "wrong_current"},
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=400, detail="current password is wrong")
    user.password_hash = auth_svc.hash_password(payload.new_password)
    audit(
        session,
        "auth.password_change",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    return {"ok": True}


# ── 2FA lifecycle ───────────────────────────────────────────────────────


@router.get("/2fa/setup")
async def setup_2fa(
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    """Provision a fresh TOTP secret + backup codes (not activated yet).

    The provisioning URI + a rendered SVG QR code are returned so the
    frontend can display either. Backup codes are shown ONCE — only their
    hashes are persisted. If setup is called while 2FA is already enabled,
    it's rejected — disable first.
    """
    user = await _load_user(session, authed.id)
    if user.totp_enabled:
        raise HTTPException(status_code=409, detail="2FA already enabled — disable first")

    secret = auth_svc.new_totp_secret()
    uri = auth_svc.totp_uri(secret, user.email)
    plaintext_codes = auth_svc.generate_backup_codes(10)
    hashed = [
        {"hash": auth_svc.hash_backup_code(c), "used_at": None} for c in plaintext_codes
    ]

    user.totp_pending_secret = secret
    user.backup_codes = hashed
    audit(
        session,
        "auth.2fa_setup_initiated",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()

    return {
        "secret": secret,
        "provisioning_uri": uri,
        "qr_png": _qr_png_data_url(uri),
        "backup_codes": plaintext_codes,
    }


@router.post("/2fa/enable")
async def enable_2fa(
    payload: EnableTwoFAIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    user = await _load_user(session, authed.id)
    if user.totp_enabled:
        raise HTTPException(status_code=409, detail="2FA already enabled")
    if not user.totp_pending_secret:
        raise HTTPException(status_code=400, detail="run /2fa/setup first")
    if not auth_svc.verify_totp(user.totp_pending_secret, payload.code):
        audit(
            session,
            "auth.2fa_enable_fail",
            actor=user.email,
            target_table="admin_user",
            target_id=user.id,
            request=request,
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="code did not verify — try again")

    user.totp_secret = user.totp_pending_secret
    user.totp_pending_secret = None
    user.totp_enabled = True
    audit(
        session,
        "auth.2fa_enabled",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    return {"ok": True}


@router.post("/2fa/disable")
async def disable_2fa(
    payload: DisableTwoFAIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    user = await _load_user(session, authed.id)
    if not user.totp_enabled:
        raise HTTPException(status_code=409, detail="2FA is not enabled")
    if not auth_svc.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="password is wrong")

    code = payload.code.strip().replace(" ", "").replace("-", "").upper()
    ok = False
    if user.totp_secret and auth_svc.verify_totp(user.totp_secret, code):
        ok = True
    else:
        for entry in list(user.backup_codes or []):
            if not entry.get("used_at") and auth_svc.verify_backup_code(code, entry["hash"]):
                ok = True
                break
    if not ok:
        raise HTTPException(status_code=401, detail="code did not verify")

    user.totp_enabled = False
    user.totp_secret = None
    user.totp_pending_secret = None
    user.backup_codes = []
    audit(
        session,
        "auth.2fa_disabled",
        actor=user.email,
        target_table="admin_user",
        target_id=user.id,
        request=request,
    )
    await session.commit()
    return {"ok": True}


# ── Session management ─────────────────────────────────────────────────
#
# Every browser sign-in creates an AdminSession row. The admin can list
# active sessions on other devices and revoke them individually or all
# at once (useful after "I logged in from a friend's laptop and forgot").


@router.get("/sessions")
async def list_sessions(
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    current_sid = auth_svc.read_session_cookie(request)
    rows = (
        await session.execute(
            select(models.AdminSession)
            .where(
                models.AdminSession.user_id == authed.id,
                models.AdminSession.revoked_at.is_(None),
            )
            .order_by(models.AdminSession.last_seen.desc())
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "is_current": r.id == current_sid,
            "created_at": r.created_at,
            "last_seen": r.last_seen,
            "expires_at": r.expires_at,
            "ip": r.ip,
            "user_agent": r.user_agent,
        }
        for r in rows
    ]


@router.post("/sessions/{sid}/revoke")
async def revoke_named_session(
    sid: str,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    row = (
        await session.execute(
            select(models.AdminSession).where(models.AdminSession.id == sid)
        )
    ).scalar_one_or_none()
    if not row or row.user_id != authed.id:
        raise HTTPException(status_code=404, detail="session not found")
    await auth_svc.revoke_session(session, sid)
    is_self = sid == auth_svc.read_session_cookie(request)
    audit(
        session,
        "auth.session_revoked",
        actor=authed.email,
        target_table="admin_session",
        target_id=sid,
        details={"self": is_self},
        request=request,
    )
    await session.commit()
    # If the admin revoked their current session, clear the cookie so the
    # next request lands on /login cleanly instead of showing "session revoked".
    if is_self:
        auth_svc.clear_session_cookie(response)
    return {"ok": True, "id": sid}


@router.post("/sessions/revoke-others")
async def revoke_others(
    request: Request,
    session: AsyncSession = Depends(get_session),
    authed: auth_svc.AuthedUser = Depends(auth_svc.current_user),
):
    current_sid = auth_svc.read_session_cookie(request)
    stamped = datetime.utcnow()
    rows = (
        await session.execute(
            select(models.AdminSession).where(
                models.AdminSession.user_id == authed.id,
                models.AdminSession.revoked_at.is_(None),
            )
        )
    ).scalars().all()
    count = 0
    for r in rows:
        if r.id == current_sid:
            continue
        r.revoked_at = stamped
        count += 1
    audit(
        session,
        "auth.sessions_revoked_others",
        actor=authed.email,
        target_table="admin_session",
        details={"count": count},
        request=request,
    )
    await session.commit()
    return {"ok": True, "revoked": count}
