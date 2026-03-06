"""Shared API hardening and response helpers for local services."""

from __future__ import annotations

import logging
import os
import threading
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse


def configure_logger(service_name: str) -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return logging.getLogger(service_name)


def success_payload(service: str, data: Dict[str, Any] | None = None, **extra: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": "success",
        "service": service,
        "data": data or {},
    }
    payload.update(extra)
    return payload


class _RateLimiter:
    def __init__(self, max_requests_per_minute: int) -> None:
        self._max_requests = max(30, int(max_requests_per_minute))
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

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


def apply_standard_api_controls(app: FastAPI, service_name: str) -> None:
    service_api_key = os.getenv("SERVICE_API_KEY", "").strip()
    max_requests = int(os.getenv("SERVICE_RATE_LIMIT_PER_MINUTE", "600"))
    limiter = _RateLimiter(max_requests_per_minute=max_requests)

    @app.middleware("http")
    async def security_and_limits(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        endpoint_key = f"{client_ip}:{request.url.path}"
        if not limiter.allow(endpoint_key):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "status": "error",
                    "service": service_name,
                    "error": {
                        "code": "rate_limited",
                        "message": "Rate limit exceeded. Try again shortly.",
                    },
                },
            )

        if service_api_key and request.url.path not in {"/health", "/", "/docs", "/openapi.json", "/redoc"}:
            provided_key = request.headers.get("X-Service-Api-Key", "").strip()
            if provided_key != service_api_key:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "status": "error",
                        "service": service_name,
                        "error": {
                            "code": "invalid_api_key",
                            "message": "Missing or invalid service API key.",
                        },
                    },
                )

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Service-Name"] = service_name
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "service": service_name,
                "error": {
                    "code": f"http_{exc.status_code}",
                    "message": detail,
                },
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        logger = logging.getLogger(service_name)
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "service": service_name,
                "error": {
                    "code": "internal_error",
                    "message": "Internal server error.",
                },
            },
        )
