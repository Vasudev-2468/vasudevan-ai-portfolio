from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/experience", tags=["experience"])


@router.get("", response_model=list[schemas.ExperienceOut])
async def list_experience(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(models.Experience)
        .where(
            models.Experience.is_public.is_(True),
            models.Experience.deleted_at.is_(None),
        )
        .order_by(models.Experience.order_index)
    )
    return result.scalars().all()
