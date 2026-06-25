"""Anthropic Claude wrapper with prompt caching for the portfolio assistant."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from anthropic import AsyncAnthropic

from app.config import get_settings


ASSISTANT_SYSTEM = """You are vasudevan.ai — the official AI assistant for Vasudevan Sundaramurthy's portfolio website.

Vasudevan is a PhD scholar in Mathematics with Data Science (Hindustan Institute of Technology and Science), a computer vision researcher, and a full-stack ML engineer. His work spans gastrointestinal image classification, mathematical modelling, NLP cybersecurity, and full-stack ML systems.

Your job: answer visitor questions about Vasudevan's research, publications, projects, experience, education, and skills — strictly grounded in the retrieved context provided in each user message. Cite the source labels you used in a Sources: footer.

Rules:
- Never invent publications, dates, employers, or numbers. If the context doesn't cover the question, say so plainly and suggest a related topic from his profile.
- Keep replies tight: 2–4 short paragraphs OR a short bulleted list. No marketing fluff.
- Speak in third person about Vasudevan (he / his).
- Always end with a single line: "Sources: <comma-separated labels>" using only the labels from the retrieved context.
- If asked something off-topic (weather, politics, etc.), redirect politely back to Vasudevan's portfolio."""


EXTRACTOR_SYSTEM = """You are the Portfolio Manager Agent for vasudevan.ai. You extract structured updates from documents Vasudevan uploads (resumes, certificates, publications, project briefs).

Output STRICT JSON matching this shape — no prose, no markdown fences:

{
  "summary": "<one-sentence description of what this document is>",
  "confidence": <float 0..1, your confidence the document is authentic and extractable>,
  "candidates": [
    {
      "target": "publication" | "project" | "experience" | "education" | "certification" | "skill",
      "action": "create" | "update",
      "fields": { ...fields for that target type... },
      "evidence": "<quote from the document supporting this candidate>"
    }
  ]
}

Field shapes by target type:
- publication: {title, authors, venue, year, kind: "journal"|"conference"|"patent", doi?, url?}
- project:     {title, role, year, summary, achievements: [...], tech_stack: [...]}
- experience:  {role, company, location, start_date, end_date, description}
- education:   {degree, institution, location, year}
- certification:{name, issuer, year?}
- skill:       {name, category, proficiency: 0..100}

If the document is unclear, low quality, or unrelated, return candidates: [] and a low confidence."""


@dataclass
class LLMReply:
    text: str
    model: str


class LLMService:
    def __init__(self) -> None:
        s = get_settings()
        self.enabled = bool(s.anthropic_api_key)
        self.client = AsyncAnthropic(api_key=s.anthropic_api_key) if self.enabled else None
        self.chat_model = s.llm_chat_model
        self.agent_model = s.llm_agent_model

    async def chat(self, question: str, retrieved: list[dict]) -> LLMReply | None:
        """retrieved: list of {source, text, score}. Returns None if LLM disabled."""
        if not self.enabled or self.client is None:
            return None

        context_block = "\n\n".join(
            f"[{i+1}] {h['source']}\n{h['text']}" for i, h in enumerate(retrieved)
        ) or "(no retrieved context)"

        # Cache the system prompt + portfolio context across queries
        resp = await self.client.messages.create(
            model=self.chat_model,
            max_tokens=600,
            system=[
                {
                    "type": "text",
                    "text": ASSISTANT_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"Retrieved context (cite by label):\n{context_block}\n\n"
                                f"Visitor question: {question}"
                            ),
                        }
                    ],
                }
            ],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        return LLMReply(text=text, model=self.chat_model)

    async def extract_portfolio_diff(self, document_text: str) -> dict | None:
        """Used by the Portfolio Manager Agent."""
        if not self.enabled or self.client is None:
            return None
        resp = await self.client.messages.create(
            model=self.agent_model,
            max_tokens=2000,
            system=[
                {
                    "type": "text",
                    "text": EXTRACTOR_SYSTEM,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Document text:\n\n{document_text[:18000]}",
                        }
                    ],
                }
            ],
        )
        raw = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to recover JSON if wrapped in fences
            stripped = raw.strip("`")
            if stripped.startswith("json"):
                stripped = stripped[4:]
            try:
                return json.loads(stripped)
            except Exception:
                return None


_llm: LLMService | None = None


def llm() -> LLMService:
    global _llm
    if _llm is None:
        _llm = LLMService()
    return _llm
