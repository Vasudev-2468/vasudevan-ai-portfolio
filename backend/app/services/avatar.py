"""Voice-avatar answer service.

Reuses the existing hybrid RAG pipeline (Qdrant + Anthropic) from
`services.assistant`, but with a *voice-friendly* system prompt: concise,
first-person, spoken register, no bullet lists, no "Sources:" footer. The
sources are still returned separately in the API response so the UI can render
them alongside the transcript.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services import assistant as text_assistant
from app.services.llm import llm
from app.services.vector import vector_store


AVATAR_SYSTEM = """You are the AI avatar for Vasudevan Sundaramurthy's professional portfolio.

You are NOT Vasudevan himself. You are an AI avatar that represents his portfolio, and you speak as a first-person guide — "Vasudevan's research focuses on…" or "I can tell you about his work on…" — but if a visitor asks whether you're really him, be honest: "I'm the AI avatar representing Vasudevan's portfolio."

Vasudevan is a PhD scholar in Mathematics with Data Science (Hindustan Institute of Technology and Science), a computer vision researcher, and a full-stack ML engineer. His work spans gastrointestinal image classification, mathematical modelling, NLP cybersecurity, and full-stack ML systems.

Your job: answer visitor questions about Vasudevan's research, publications, projects, experience, education, and skills — strictly grounded in the retrieved context provided in each user message.

Voice-mode rules (this response WILL be spoken aloud by a TTS engine):
- Answer in a natural, conversational, spoken register — like a professional colleague explaining Vasudevan's work at a conference.
- Target 2–5 sentences (roughly 30–60 seconds spoken). For complex questions you may go a little longer, but never write a wall of text.
- No bullet points. No markdown. No numbered lists. No headings. No emoji. Plain sentences only.
- Do NOT include a "Sources:" footer — the UI shows sources separately.
- Never invent publications, dates, employers, numbers, or GitHub links. If the retrieved context doesn't cover the question, say "I don't have that in Vasudevan's portfolio right now — but I can tell you about <related topic that IS in his profile>."
- Never say "As an AI language model" or similar. Speak as the portfolio avatar.
- If asked something off-topic (weather, politics, personal life beyond work), redirect politely: "That's outside what I can speak to — I'm here to walk you through Vasudevan's professional work. Want to hear about his research, or a specific project?"
"""


@dataclass
class AvatarAnswer:
    reply: str
    sources: list[str]
    mode: str  # "llm" | "keyword" | "empty"


async def answer_for_voice(question: str, session: AsyncSession) -> AvatarAnswer:
    """Same RAG retrieval pipeline as the text assistant, but with a
    voice-friendly system prompt and a spoken-register response.
    """

    settings = get_settings()

    # 1) Vector retrieval (identical to text assistant path).
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

    # 2) LLM path with voice-tuned system prompt.
    if hits and settings.anthropic_api_key:
        llm_svc = llm()
        if llm_svc.enabled and llm_svc.client is not None:
            context_block = "\n\n".join(
                f"[{i+1}] {h['source']}\n{h['text']}" for i, h in enumerate(hits)
            )
            resp = await llm_svc.client.messages.create(
                model=llm_svc.chat_model,
                max_tokens=400,
                system=[
                    {
                        "type": "text",
                        "text": AVATAR_SYSTEM,
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
                                    f"Retrieved context (grounding only, do not cite):\n{context_block}\n\n"
                                    f"Visitor question: {question}\n\n"
                                    "Answer in plain spoken sentences suitable for text-to-speech."
                                ),
                            }
                        ],
                    }
                ],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", "") == "text"
            ).strip()
            if text:
                seen: set[str] = set()
                labels: list[str] = []
                for h in hits:
                    if h["source"] not in seen:
                        labels.append(h["source"])
                        seen.add(h["source"])
                return AvatarAnswer(reply=text, sources=labels[:5], mode="llm")

    # 3) Keyword fallback (text assistant helper). Convert its bullet output
    #    into a short spoken sentence so browser TTS doesn't read bullet
    #    characters aloud.
    reply_text, sources = await text_assistant._keyword_fallback(question, session)
    spoken = _to_spoken(reply_text)
    return AvatarAnswer(reply=spoken, sources=sources, mode="keyword" if sources else "empty")


def _to_spoken(text: str) -> str:
    """Strip bullet formatting and turn line-broken output into a single
    spoken paragraph."""
    lines = [ln.strip(" •-") for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "I don't have that in Vasudevan's portfolio right now — but you can ask me about his research, projects, publications, or experience."
    return " ".join(lines)
