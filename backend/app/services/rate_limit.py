"""Per-IP token-bucket rate limiter for public LLM-billable endpoints.

Every LLM call and TTS call costs real money. A public POST endpoint with
no auth needs at least some throttling — this module supplies a cheap
in-process one. It is intentionally simple (no Redis dependency, no
distributed coordination) because a single-node deployment is the target
right now; if we ever run multiple backend replicas, swap this out for
Redis-backed sliding-window counters.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.services.audit import client_ip


class TokenBucket:
    """A minimal per-IP sliding window.

    `capacity` requests are allowed within any `window_seconds` interval.
    On overflow, we raise 429 with a `Retry-After` hint so well-behaved
    clients back off automatically.
    """

    def __init__(self, capacity: int, window_seconds: float) -> None:
        self.capacity = capacity
        self.window = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, request: Request) -> None:
        ip = client_ip(request) or "-"
        now = time.time()
        q = self._hits[ip]
        # Evict expired timestamps first.
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.capacity:
            retry_after = max(1, int(self.window - (now - q[0])))
            raise HTTPException(
                status_code=429,
                detail="Too many requests — please slow down.",
                headers={"Retry-After": str(retry_after)},
            )
        q.append(now)


# Public LLM-billable endpoints: /assistant/chat and /avatar/chat.
# 20 questions / minute per IP is generous for a real visitor and
# aggressive enough that a scraper can't run up a Claude bill.
chat_limiter = TokenBucket(capacity=20, window_seconds=60.0)

# Server-side TTS is even more expensive per call — half the budget.
tts_limiter = TokenBucket(capacity=10, window_seconds=60.0)
