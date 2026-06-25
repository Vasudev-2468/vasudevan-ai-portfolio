"""Qdrant + fastembed integration.

Self-hosted dense embeddings via fastembed (BAAI/bge-small-en-v1.5, 384-dim).
No external API key required for retrieval — Anthropic is only used for the
generation step.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from app.config import get_settings


@dataclass
class Hit:
    score: float
    text: str
    source: str  # human-readable label
    metadata: dict


class VectorStore:
    """Thin wrapper around AsyncQdrantClient with lazy embedder."""

    _embedder = None  # class-level cache; fastembed model is heavy

    def __init__(self) -> None:
        s = get_settings()
        self.client = AsyncQdrantClient(url=s.qdrant_url)
        self.collection = s.qdrant_collection
        self.dim = s.embed_dim
        self.embed_model = s.embed_model

    @classmethod
    def _get_embedder(cls, model: str):
        if cls._embedder is None:
            # Imported lazily so test envs without fastembed installed don't fail
            from fastembed import TextEmbedding  # type: ignore

            cls._embedder = TextEmbedding(model_name=model)
        return cls._embedder

    async def ensure_collection(self) -> None:
        existing = await self.client.get_collections()
        if any(c.name == self.collection for c in existing.collections):
            return
        await self.client.create_collection(
            collection_name=self.collection,
            vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE),
        )

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        def _run() -> list[list[float]]:
            embedder = self._get_embedder(self.embed_model)
            return [list(v) for v in embedder.embed(texts)]

        return await asyncio.to_thread(_run)

    async def upsert(self, chunks: list[dict]) -> int:
        """chunks: list of {text, source, metadata}."""
        if not chunks:
            return 0
        await self.ensure_collection()
        vectors = await self._embed([c["text"] for c in chunks])
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=v,
                payload={
                    "text": c["text"],
                    "source": c["source"],
                    "metadata": c.get("metadata", {}),
                },
            )
            for c, v in zip(chunks, vectors)
        ]
        await self.client.upsert(collection_name=self.collection, points=points)
        return len(points)

    async def search(self, query: str, top_k: int = 6) -> list[Hit]:
        await self.ensure_collection()
        vector = (await self._embed([query]))[0]
        res = await self.client.query_points(
            collection_name=self.collection,
            query=vector,
            limit=top_k,
        )
        return [
            Hit(
                score=p.score,
                text=p.payload.get("text", ""),
                source=p.payload.get("source", ""),
                metadata=p.payload.get("metadata", {}),
            )
            for p in res.points
        ]

    async def count(self) -> int:
        try:
            res = await self.client.count(collection_name=self.collection)
            return res.count
        except Exception:
            return 0


_singleton: VectorStore | None = None


def vector_store() -> VectorStore:
    global _singleton
    if _singleton is None:
        _singleton = VectorStore()
    return _singleton
