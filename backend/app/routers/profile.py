from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=schemas.ProfileOut)
async def get_profile(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(models.Profile).limit(1))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("/education", response_model=list[schemas.EducationOut])
async def list_education(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(models.Education)
        .where(
            models.Education.is_public.is_(True),
            models.Education.deleted_at.is_(None),
        )
        .order_by(models.Education.order_index)
    )
    return result.scalars().all()


@router.get("/certifications", response_model=list[schemas.CertificationOut])
async def list_certifications(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(models.Certification).where(
            models.Certification.is_public.is_(True),
            models.Certification.deleted_at.is_(None),
        )
    )
    return result.scalars().all()
