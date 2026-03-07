"""Security middleware for Cloud Security Core."""

from __future__ import annotations

import os
import threading
import time
import uuid
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class _RateLimiter:
    def __init__(self, max_requests_per_minute: int) -> None:
        self._max_requests = max(30, int(max_requests_per_minute))
        self._lock = threading.Lock()
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60.0
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < window_start:
                bucket.popleft()
            if len(bucket) >= self._max_requests:
                return False
            bucket.append(now)
            return True


def install_cloud_security(app: FastAPI) -> None:
    rate_limit = int(os.getenv("CLOUD_RATE_LIMIT_PER_MINUTE", "1200"))
    limiter = _RateLimiter(rate_limit)

    @app.middleware("http")
    async def security_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", "").strip() or str(uuid.uuid4())
        request.state.request_id = request_id
        client_ip = request.client.host if request.client else "unknown"
        limit_key = f"{client_ip}:{request.url.path}"

        if request.url.path not in {"/docs", "/openapi.json", "/redoc", "/metrics", "/health"} and not limiter.allow(limit_key):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "status": "error",
                    "service": "cloud_core",
                    "error": {
                        "code": "rate_limited",
                        "message": "Too many requests.",
                    },
                },
            )

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Service-Name"] = "cloud_core"
        response.headers["X-Request-ID"] = request_id
        return response
