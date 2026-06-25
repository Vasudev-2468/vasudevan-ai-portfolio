"""Live AI-news aggregator: Dev.to + Hacker News (Algolia) + arXiv (best-effort).

Cached in Redis for 6 h so each upstream is hit at most ~4 ×/day. Each source
is tried in parallel; failures degrade gracefully (the others still flow). If
everything fails AND there is no cache, returns an empty list and the frontend
renders a "feed unavailable" line.
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass
from typing import Optional
from xml.etree import ElementTree as ET

import httpx
from redis.asyncio import Redis

from app.config import get_settings

log = logging.getLogger("vasudevan.ai_news")

DEVTO_URL = "https://dev.to/api/articles"
HN_URL = "https://hn.algolia.com/api/v1/search_by_date"
ARXIV_URL = "https://export.arxiv.org/api/query"

CACHE_KEY = "news:ai:v2"
CACHE_TTL_SECONDS = 6 * 60 * 60

FAST_TIMEOUT = 10.0
SLOW_TIMEOUT = 8.0  # arXiv is unreliable; don't block the response on it
MAX_ITEMS = 14


@dataclass
class NewsItem:
    source: str       # "devto" | "hn" | "arxiv"
    kind: str         # "article" | "story" | "paper"
    title: str
    url: str
    summary: str
    published_at: str  # ISO 8601


_redis: Optional[Redis] = None


def _client() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


async def _fetch_devto(http: httpx.AsyncClient) -> list[NewsItem]:
    items: list[NewsItem] = []
    for tag in ("artificial-intelligence", "machinelearning"):
        params = {"tag": tag, "per_page": "6", "top": "1"}
        r = await http.get(DEVTO_URL, params=params, timeout=FAST_TIMEOUT)
        r.raise_for_status()
        for h in r.json():
            title = (h.get("title") or "").strip()
            url = h.get("url") or h.get("canonical_url") or ""
            if not title or not url:
                continue
            items.append(
                NewsItem(
                    source="devto",
                    kind="article",
                    title=title,
                    url=url,
                    summary=(h.get("description") or "").strip()[:240],
                    published_at=h.get("published_at") or h.get("published_timestamp") or "",
                )
            )
    return items


async def _fetch_hn(http: httpx.AsyncClient) -> list[NewsItem]:
    params = {
        "tags": "story",
        "query": "AI OR LLM OR agentic OR \"computer vision\"",
        "hitsPerPage": "10",
    }
    r = await http.get(HN_URL, params=params, timeout=FAST_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    items: list[NewsItem] = []
    for h in data.get("hits", []):
        title = (h.get("title") or h.get("story_title") or "").strip()
        url = h.get("url") or (
            f"https://news.ycombinator.com/item?id={h.get('objectID')}"
            if h.get("objectID")
            else ""
        )
        if not title or not url:
            continue
        items.append(
            NewsItem(
                source="hn",
                kind="story",
                title=title,
                url=url,
                summary=f"Hacker News · {h.get('points', 0)} points · {h.get('num_comments', 0)} comments",
                published_at=h.get("created_at") or "",
            )
        )
    return items


async def _fetch_arxiv(http: httpx.AsyncClient) -> list[NewsItem]:
    params = {
        "search_query": "cat:cs.AI OR cat:cs.LG OR cat:cs.CV",
        "sortBy": "submittedDate",
        "sortOrder": "descending",
        "max_results": "6",
    }
    r = await http.get(ARXIV_URL, params=params, timeout=SLOW_TIMEOUT)
    r.raise_for_status()
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(r.text)
    items: list[NewsItem] = []
    for entry in root.findall("atom:entry", ns):
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
        summary = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip()
        published = entry.findtext("atom:published", default="", namespaces=ns) or ""
        link = ""
        for link_el in entry.findall("atom:link", ns):
            if link_el.get("rel") == "alternate":
                link = link_el.get("href", "")
                break
        if not title or not link:
            continue
        items.append(
            NewsItem(
                source="arxiv",
                kind="paper",
                title=" ".join(title.split()),
                url=link,
                summary=" ".join(summary.split())[:240],
                published_at=published,
            )
        )
    return items


async def get_ai_news(force_refresh: bool = False) -> list[dict]:
    r = _client()
    if not force_refresh:
        try:
            cached = await r.get(CACHE_KEY)
            if cached:
                return json.loads(cached)
        except Exception as ex:
            log.warning("redis read failed: %s", ex)

    async with httpx.AsyncClient(follow_redirects=True) as http:
        results = await asyncio.gather(
            _fetch_devto(http),
            _fetch_hn(http),
            _fetch_arxiv(http),
            return_exceptions=True,
        )

    items: list[NewsItem] = []
    for label, res in zip(("devto", "hn", "arxiv"), results):
        if isinstance(res, list):
            log.info("news source %s: %d items", label, len(res))
            items.extend(res)
        elif isinstance(res, BaseException):
            log.warning("news source %s failed: %s: %s", label, type(res).__name__, res)

    # Dedupe by url
    seen: set[str] = set()
    deduped: list[NewsItem] = []
    for it in items:
        if it.url in seen:
            continue
        seen.add(it.url)
        deduped.append(it)

    deduped.sort(key=lambda x: x.published_at, reverse=True)
    payload = [asdict(i) for i in deduped[:MAX_ITEMS]]

    try:
        await r.set(CACHE_KEY, json.dumps(payload), ex=CACHE_TTL_SECONDS)
    except Exception as ex:
        log.warning("redis write failed: %s", ex)

    return payload
