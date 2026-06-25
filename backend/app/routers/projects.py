from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[schemas.ProjectOut])
async def list_projects(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(models.Project).order_by(models.Project.id))
    return result.scalars().all()
