from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/experience", tags=["experience"])


@router.get("", response_model=list[schemas.ExperienceOut])
async def list_experience(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(models.Experience).order_by(models.Experience.order_index)
    )
    return result.scalars().all()
