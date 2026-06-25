from fastapi import APIRouter, Query

from app.services.ai_news import get_ai_news

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/ai")
async def ai_news(refresh: bool = Query(False, description="Bypass Redis cache")):
    items = await get_ai_news(force_refresh=refresh)
    return {"count": len(items), "items": items}
