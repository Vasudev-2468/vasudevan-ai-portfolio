from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[schemas.SkillOut])
async def list_skills(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(models.Skill))
    return result.scalars().all()
