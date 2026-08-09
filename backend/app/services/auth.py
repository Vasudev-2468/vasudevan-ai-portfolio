"""Password hashing, TOTP verification, backup codes, and session management.

Single-admin, cookie-based auth. The frontend never sees the session id
directly — it lives in an HttpOnly cookie set by `set_session_cookie` and
consumed by `current_user`. All admin routes take
`Depends(current_user)` so unauthenticated requests get a 401.
"""

from __future__ import annotations

import hmac
import secrets
import time
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256
from typing import Annotated

import pyotp
from fastapi import Cookie, Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import get_session
from app.services.audit import client_ip, user_agent


# ── Password + backup code hashing ──────────────────────────────────────

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


# Backup codes use bcrypt too but with a lower cost — they're one-shot
# short strings, not human passwords, so the extra cost buys little.
_code_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)


def _normalize_code(code: str) -> str:
    """Strip whitespace + separators + uppercase, so `U5b4-UVWG`, `U5B4 UVWG`,
    and `u5b4uvwg` all hash+verify identically."""
    return "".join(ch for ch in code.upper() if ch.isalnum())


def hash_backup_code(code: str) -> str:
    return _code_ctx.hash(_normalize_code(code))


def verify_backup_code(code: str, hashed: str) -> bool:
    try:
        return _code_ctx.verify(_normalize_code(code), hashed)
    except Exception:
        return False


def generate_backup_codes(n: int = 10) -> list[str]:
    """Return N plaintext codes (shown to user once) formatted `XXXX-XXXX`."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # skip visually ambiguous
    codes: list[str] = []
    for _ in range(n):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


# ── TOTP ────────────────────────────────────────────────────────────────


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(secret: str, email: str, issuer: str = "vasudevan.ai") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    try:
        return pyotp.TOTP(secret).verify(code.strip().replace(" ", ""), valid_window=1)
    except Exception:
        return False


# ── 2FA challenge tokens (HMAC-signed, 5 min TTL) ───────────────────────
#
# After password succeeds but before TOTP, we hand the client a short-lived
# token bound to the user id. The client posts it back with the code. We
# also track jti in an in-process set so a challenge can't be redeemed
# twice — enough for single-admin scale.

_used_challenges: deque[str] = deque(maxlen=1024)
_CHALLENGE_TTL_SECONDS = 300


def make_challenge(user_id: int) -> str:
    jti = secrets.token_urlsafe(16)
    exp = int(time.time()) + _CHALLENGE_TTL_SECONDS
    payload = f"{user_id}.{exp}.{jti}"
    sig = hmac.new(
        get_settings().secret_key.encode(), payload.encode(), sha256
    ).hexdigest()
    return f"{payload}.{sig}"


def verify_challenge(token: str) -> int | None:
    """Return user_id if valid + unused, else None. Marks token used on success."""
    try:
        user_id_s, exp_s, jti, sig = token.split(".", 3)
    except ValueError:
        return None
    payload = f"{user_id_s}.{exp_s}.{jti}"
    expected = hmac.new(
        get_settings().secret_key.encode(), payload.encode(), sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        if int(exp_s) < time.time():
            return None
        user_id = int(user_id_s)
    except ValueError:
        return None
    if jti in _used_challenges:
        return None
    _used_challenges.append(jti)
    return user_id


# ── Rate limiter (in-memory, per IP, sliding window) ────────────────────


_LIMIT_WINDOW_SECONDS = 15 * 60
_LIMIT_MAX_FAILURES = 5
_fail_buckets: dict[str, deque[float]] = {}


def _bucket(ip: str) -> deque[float]:
    b = _fail_buckets.setdefault(ip, deque())
    now = time.time()
    while b and now - b[0] > _LIMIT_WINDOW_SECONDS:
        b.popleft()
    return b


def check_rate_limit(request: Request) -> None:
    ip = client_ip(request) or "-"
    b = _bucket(ip)
    if len(b) >= _LIMIT_MAX_FAILURES:
        raise HTTPException(
            status_code=429,
            detail="too many failed attempts — try again in a few minutes",
        )


def record_failure(request: Request) -> None:
    ip = client_ip(request) or "-"
    _bucket(ip).append(time.time())


def clear_failures(request: Request) -> None:
    ip = client_ip(request) or "-"
    _fail_buckets.pop(ip, None)


# ── Sessions ────────────────────────────────────────────────────────────


@dataclass
class AuthedUser:
    id: int
    email: str
    totp_enabled: bool


async def create_session(
    session: AsyncSession,
    user_id: int,
    request: Request,
) -> str:
    """Insert a session row + return its opaque id. Caller sets the cookie."""
    sid = uuid.uuid4().hex
    ttl_days = get_settings().session_ttl_days
    now = datetime.utcnow()
    row = models.AdminSession(
        id=sid,
        user_id=user_id,
        created_at=now,
        last_seen=now,
        expires_at=now + timedelta(days=ttl_days),
        ip=client_ip(request),
        user_agent=user_agent(request),
    )
    session.add(row)
    return sid


def set_session_cookie(response: Response, sid: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.session_cookie_name,
        value=sid,
        max_age=s.session_ttl_days * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(
        key=s.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
    )


async def revoke_session(session: AsyncSession, sid: str) -> None:
    row = (
        await session.execute(
            select(models.AdminSession).where(models.AdminSession.id == sid)
        )
    ).scalar_one_or_none()
    if row and row.revoked_at is None:
        row.revoked_at = datetime.utcnow()


async def admin_user_exists(session: AsyncSession) -> bool:
    row = (
        await session.execute(select(models.AdminUser).limit(1))
    ).scalar_one_or_none()
    return row is not None


# ── FastAPI dependency ──────────────────────────────────────────────────


# Only bump last_seen/expires_at when they're staler than this. Prevents a
# write per request when the frontend polls every few seconds.
_SESSION_BUMP_INTERVAL_SECONDS = 60


async def current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> AuthedUser:
    """Guard for every protected admin endpoint.

    Reads the session cookie, looks up the row, checks expiry + revocation,
    lazily bumps `last_seen` (sliding window, throttled to ~1/min), and
    returns the underlying user. Raises 401 on any failure.
    """
    s = get_settings()
    sid = request.cookies.get(s.session_cookie_name)
    if not sid:
        raise HTTPException(status_code=401, detail="not signed in")

    row = (
        await session.execute(
            select(models.AdminSession).where(models.AdminSession.id == sid)
        )
    ).scalar_one_or_none()
    if not row or row.revoked_at is not None:
        raise HTTPException(status_code=401, detail="session revoked")

    now = datetime.utcnow()
    if row.expires_at < now:
        raise HTTPException(status_code=401, detail="session expired")

    # Slide the window, but only write to DB if last_seen is stale enough.
    # At the frontend's 8s poll interval this cuts writes ~7x while still
    # keeping the session alive under active use.
    if (now - row.last_seen).total_seconds() >= _SESSION_BUMP_INTERVAL_SECONDS:
        row.last_seen = now
        row.expires_at = now + timedelta(days=s.session_ttl_days)
        await session.commit()

    user = (
        await session.execute(
            select(models.AdminUser).where(models.AdminUser.id == row.user_id)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="user missing")
    return AuthedUser(id=user.id, email=user.email, totp_enabled=user.totp_enabled)


# Convenience for cookie-based introspection when we want the raw sid
# (used by logout to look up + revoke the current session row).


def read_session_cookie(request: Request) -> str | None:
    return request.cookies.get(get_settings().session_cookie_name)
