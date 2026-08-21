from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session
from app.services.assistant import answer
from app.services.rate_limit import chat_limiter

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=schemas.AssistantReply)
async def chat(
    payload: schemas.AssistantQuery,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    chat_limiter.check(request)
    reply_text, sources, mode = await answer(payload.message, session)

    session.add(models.AssistantMessage(
        session_id=payload.session_id, role="user", content=payload.message,
    ))
    session.add(models.AssistantMessage(
        session_id=payload.session_id, role="assistant", content=reply_text,
    ))
    await session.commit()

    return schemas.AssistantReply(
        session_id=payload.session_id,
        reply=reply_text,
        sources=sources,
        mode=mode,
        created_at=datetime.utcnow(),
    )
