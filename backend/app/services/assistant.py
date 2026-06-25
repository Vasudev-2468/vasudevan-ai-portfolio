"""Hybrid retrieval-augmented assistant.

Order of operations:
1. Embed the question and retrieve top-k from Qdrant.
2. If ANTHROPIC_API_KEY is set, ask Claude with retrieved context as grounding.
3. Otherwise, fall back to keyword retrieval over SQL rows and return a
   formatted bullet list. This keeps the demo working without any LLM key.

The Qdrant index is populated on first boot from `ingest.ingest_portfolio`
and may be extended via the admin upload flow.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.llm import llm
from app.services.vector import vector_store


STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for",
    "from", "has", "have", "his", "her", "i", "in", "is", "it", "of", "on",
    "or", "that", "the", "to", "was", "what", "when", "where", "who", "why",
    "with", "you", "your", "vasudevan", "vasudev", "tell", "me", "about",
    "please", "show", "list", "all", "give",
}


@dataclass
class Source:
    label: str
    text: str

    def score(self, terms: set[str]) -> int:
        return len(terms & _tokens(self.text))


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-zA-Z]{3,}", text.lower()) if t not in STOPWORDS}


def _truncate(text: str, n: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


async def answer(question: str, session: AsyncSession) -> tuple[str, list[str], str]:
    """Returns (reply, sources, mode). mode ∈ {'llm', 'keyword', 'empty'}."""
    # --- 1) Try vector retrieval -----------------------------------------
    hits: list[dict] = []
    try:
        store = vector_store()
        if await store.count() > 0:
            results = await store.search(question, top_k=6)
            hits = [
                {"source": h.source, "text": h.text, "score": h.score}
                for h in results
                if h.score > 0.18
            ]
    except Exception:
        hits = []

    # --- 2) LLM path -----------------------------------------------------
    reply = await llm().chat(question, hits) if hits else None
    if reply is not None:
        labels = []
        seen = set()
        for h in hits:
            if h["source"] not in seen:
                labels.append(h["source"])
                seen.add(h["source"])
        return reply.text, labels[:5], "llm"

    # --- 3) Keyword fallback over SQL ------------------------------------
    return (*(await _keyword_fallback(question, session)), "keyword")


async def _keyword_fallback(question: str, session: AsyncSession) -> tuple[str, list[str]]:
    terms = _tokens(question)
    sources: list[Source] = []

    profile = (await session.execute(select(models.Profile).limit(1))).scalar_one_or_none()
    if profile:
        sources.append(Source(
            label=f"Profile · {profile.name}",
            text=f"{profile.title}. {profile.summary}",
        ))
    for exp in (await session.execute(select(models.Experience))).scalars():
        sources.append(Source(
            label=f"Experience · {exp.role} at {exp.company} ({exp.start_date}–{exp.end_date})",
            text=f"{exp.role} {exp.company} {exp.description}",
        ))
    for proj in (await session.execute(select(models.Project))).scalars():
        sources.append(Source(
            label=f"Project · {proj.title} ({proj.year})",
            text=f"{proj.title} {proj.summary} {' '.join(proj.achievements)} {' '.join(proj.tech_stack)}",
        ))
    for pub in (await session.execute(select(models.Publication))).scalars():
        sources.append(Source(
            label=f"{pub.kind.title()} · {pub.title} ({pub.year})",
            text=f"{pub.title} {pub.venue} {pub.authors}",
        ))
    for edu in (await session.execute(select(models.Education))).scalars():
        sources.append(Source(
            label=f"Education · {edu.degree}, {edu.institution} ({edu.year})",
            text=f"{edu.degree} {edu.institution}",
        ))

    if not terms:
        return (
            "Ask me about Vasudevan's research, publications, projects, experience, "
            "skills, or education — for example, 'What is his PhD work?'",
            [],
        )

    ranked = sorted(sources, key=lambda s: s.score(terms), reverse=True)
    top = [s for s in ranked if s.score(terms) > 0][:4]
    if not top:
        return (
            "I couldn't find a direct match in Vasudevan's profile for that question. "
            "Try asking about computer vision, gastrointestinal classification, fraud "
            "detection, the Journal Management System, or his teaching work.",
            [],
        )
    bullets = "\n".join(f"• {s.label}: {_truncate(s.text, 220)}" for s in top)
    return f"Based on Vasudevan's portfolio:\n{bullets}", [s.label for s in top]
