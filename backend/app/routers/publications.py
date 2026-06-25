from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/publications", tags=["publications"])


@router.get("", response_model=list[schemas.PublicationOut])
async def list_publications(
    kind: str | None = Query(default=None, pattern="^(journal|conference|patent)$"),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(models.Publication).order_by(models.Publication.year.desc())
    if kind:
        stmt = stmt.where(models.Publication.kind == kind)
    result = await session.execute(stmt)
    return result.scalars().all()
