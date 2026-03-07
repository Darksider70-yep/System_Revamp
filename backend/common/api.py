"""Shared API hardening, health, and structured logging helpers."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

_LOGGING_CONFIGURED = False


class _JsonFormatter(logging.Formatter):
    """Emit structured JSON logs for service telemetry."""

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if hasattr(record, "service"):
            payload["service"] = getattr(record, "service")
        if hasattr(record, "event"):
            payload["event"] = getattr(record, "event")
        if hasattr(record, "request_id"):
            payload["request_id"] = getattr(record, "request_id")

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True)


def configure_logger(service_name: str) -> logging.Logger:
    global _LOGGING_CONFIGURED

    level_name = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    root_logger = logging.getLogger()

    if not _LOGGING_CONFIGURED:
        handler = logging.StreamHandler()
        handler.setFormatter(_JsonFormatter())
        root_logger.handlers = [handler]
        root_logger.setLevel(level_name)
        _LOGGING_CONFIGURED = True

    logger = logging.getLogger(service_name)
    logger.setLevel(level_name)
    return logger


def success_payload(
    service: str,
    data: Dict[str, Any] | None = None,
    *,
    request_id: str | None = None,
    **extra: Any,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": "success",
        "service": service,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id or "",
        "data": data or {},
    }
    payload.update(extra)
    return payload


def health_payload(
    service: str,
    *,
    database: Dict[str, Any] | None = None,
    cache: Dict[str, Any] | None = None,
    api: Dict[str, Any] | None = None,
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    checks = {
        "database": database or {"status": "not_configured"},
        "cache": cache or {"status": "not_configured"},
        "api": api or {"status": "ok"},
    }
    overall_status = "healthy"
    for item in checks.values():
        item_status = str(item.get("status", "ok")).strip().lower()
        if item_status not in {"ok", "healthy", "not_configured"}:
            overall_status = "degraded"
            break
    return {
        "status": overall_status,
        "service": service,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "details": details or {},
    }


def allowed_origins_from_env() -> list[str]:
    raw = os.getenv("SERVICE_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


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


def _error_payload(service_name: str, request_id: str, code: str, message: str) -> Dict[str, Any]:
    return {
        "status": "error",
        "service": service_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "error": {
            "code": code,
            "message": message,
        },
    }


def apply_standard_api_controls(app: FastAPI, service_name: str) -> None:
    service_api_key = os.getenv("SERVICE_API_KEY", "").strip()
    max_requests = int(os.getenv("SERVICE_RATE_LIMIT_PER_MINUTE", "600"))
    limiter = _RateLimiter(max_requests_per_minute=max_requests)

    @app.middleware("http")
    async def security_and_limits(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", "").strip() or str(uuid.uuid4())
        request.state.request_id = request_id

        client_ip = request.client.host if request.client else "unknown"
        endpoint_key = f"{client_ip}:{request.url.path}"
        if not limiter.allow(endpoint_key):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=_error_payload(
                    service_name,
                    request_id,
                    "rate_limited",
                    "Rate limit exceeded. Try again shortly.",
                ),
            )

        if service_api_key and request.url.path not in {"/health", "/metrics", "/", "/docs", "/openapi.json", "/redoc"}:
            provided_key = request.headers.get("X-Service-Api-Key", "").strip()
            if provided_key != service_api_key:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=_error_payload(
                        service_name,
                        request_id,
                        "invalid_api_key",
                        "Missing or invalid service API key.",
                    ),
                )

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Service-Name"] = service_name
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        request_id = getattr(request.state, "request_id", "")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(
                service_name,
                request_id,
                f"http_{exc.status_code}",
                detail,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "")
        logger = logging.getLogger(service_name)
        logger.exception(
            "Unhandled exception",
            extra={"service": service_name, "event": "unhandled_exception", "request_id": request_id},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload(
                service_name,
                request_id,
                "internal_error",
                "Internal server error.",
            ),
        )
