"""AI Avatar endpoints.

- POST /avatar/chat     — voice-friendly RAG answer (reuses existing Qdrant + Claude)
- POST /avatar/tts      — server-side TTS proxy (ElevenLabs if configured, else 501)
- POST /avatar/session  — talking-head provider session handshake (501 if none configured)

Every endpoint that would leak provider credentials proxies through here — the
browser never sees an API key.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.config import get_settings
from app.database import get_session
from app.services.avatar import answer_for_voice
from app.services.rate_limit import chat_limiter, tts_limiter


router = APIRouter(prefix="/avatar", tags=["avatar"])


# ---------- Schemas -----------------------------------------------------------


class AvatarChatQuery(BaseModel):
    session_id: str = Field(default="avatar-anonymous", max_length=128)
    message: str = Field(min_length=1, max_length=1500)


class AvatarChatReply(BaseModel):
    session_id: str
    reply: str
    sources: list[str] = []
    mode: str = "llm"
    created_at: datetime


class TTSQuery(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str | None = None  # provider-specific voice id


class SessionConfig(BaseModel):
    """Config the browser needs to start a real-time avatar session.

    `provider` is what the frontend uses to pick a client-side adapter.
    `browser-photo` is the built-in fallback: no session needed, the browser
    drives audio-analysis lip-sync over the profile photo.
    """

    provider: Literal["browser-photo", "did", "heygen", "simli"] = "browser-photo"
    photo_url: str | None = None
    # For remote providers, the browser gets an already-scoped session token.
    # We NEVER return the raw provider API key.
    session_token: str | None = None
    session_url: str | None = None
    voice_id: str | None = None
    tts_available: bool = False  # true if /avatar/tts will return audio


# ---------- Chat --------------------------------------------------------------


@router.post("/chat", response_model=AvatarChatReply)
async def chat(
    payload: AvatarChatQuery,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    chat_limiter.check(request)

    answer = await answer_for_voice(payload.message, session)

    # Persist the transcript alongside the text-assistant history. Tag
    # with an "avatar:" prefix on the DB session id so avatar and text
    # transcripts never collide, then return the SAME tagged id to the
    # client — otherwise a subsequent request that reuses the returned
    # id would get double-prefixed (previously the raw id was returned,
    # splitting history across `X` and `avatar:X`).
    tagged_session = (
        payload.session_id
        if payload.session_id.startswith("avatar:")
        else f"avatar:{payload.session_id}"
    )
    session.add(
        models.AssistantMessage(
            session_id=tagged_session, role="user", content=payload.message
        )
    )
    session.add(
        models.AssistantMessage(
            session_id=tagged_session, role="assistant", content=answer.reply
        )
    )
    await session.commit()

    return AvatarChatReply(
        session_id=tagged_session,
        reply=answer.reply,
        sources=answer.sources,
        mode=answer.mode,
        created_at=datetime.utcnow(),
    )


# ---------- Session handshake -------------------------------------------------


@router.get("/session", response_model=SessionConfig)
async def get_session_config(session: AsyncSession = Depends(get_session)):
    """Tell the browser which avatar provider to use and any handshake data.

    The primary provider is chosen by the AVATAR_PROVIDER env var. Remote
    providers (D-ID, HeyGen, Simli) require their respective API keys — if
    the key isn't set, we transparently fall back to `browser-photo`.
    """

    settings = get_settings()

    # Look up the profile photo (falls back to the shipped placeholder).
    from sqlalchemy import select

    profile = (
        await session.execute(select(models.Profile).limit(1))
    ).scalar_one_or_none()
    photo_url = (profile.photo_url if profile else None) or "/images/avatar.png"

    provider = (settings.avatar_provider or "browser-photo").lower()
    tts_available = bool(settings.elevenlabs_api_key)

    # For real-time providers we would mint a scoped session token here.
    # Since we don't ship any provider key by default, we degrade cleanly.
    if provider in ("did", "heygen", "simli"):
        key_field = {
            "did": settings.did_api_key,
            "heygen": settings.heygen_api_key,
            "simli": settings.simli_api_key,
        }[provider]
        if not key_field:
            provider = "browser-photo"

    return SessionConfig(
        provider=provider,  # type: ignore[arg-type]
        photo_url=photo_url,
        session_token=None,  # remote-provider adapters mint this server-side
        session_url=None,
        voice_id=settings.tts_voice_id,
        tts_available=tts_available,
    )


# ---------- TTS ---------------------------------------------------------------


@router.post("/tts")
async def tts(payload: TTSQuery, request: Request):
    """Return MP3 audio bytes for the given text.

    Uses ElevenLabs when `ELEVENLABS_API_KEY` is set; otherwise responds 501
    so the browser knows to fall back to `speechSynthesis`.
    """

    tts_limiter.check(request)

    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=501,
            detail="Server TTS is not configured. Use browser speechSynthesis.",
        )

    voice = payload.voice or settings.tts_voice_id or "EXAVITQu4vr4xnSDxMaL"  # ElevenLabs "Sarah" default
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "accept": "audio/mpeg",
                "content-type": "application/json",
            },
            json={
                "text": payload.text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TTS provider error: {resp.status_code}")

    return Response(content=resp.content, media_type="audio/mpeg")
