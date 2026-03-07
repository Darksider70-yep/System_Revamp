"""Prometheus metrics helpers shared across System Revamp services."""

from __future__ import annotations

import re
import time
from typing import Any

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

API_REQUESTS_TOTAL = Counter(
    "system_revamp_api_requests_total",
    "Total HTTP requests handled by service.",
    ["service", "method", "path", "status_code"],
)
API_REQUEST_DURATION_SECONDS = Histogram(
    "system_revamp_api_request_duration_seconds",
    "HTTP request latency in seconds.",
    ["service", "method", "path"],
)
API_REQUESTS_IN_PROGRESS = Gauge(
    "system_revamp_api_requests_in_progress",
    "HTTP requests currently being processed.",
    ["service"],
)
SCAN_DURATION_SECONDS = Histogram(
    "system_revamp_scan_duration_seconds",
    "Duration of scan operations in seconds.",
    ["service", "scan_type"],
)
PATCH_OPERATIONS_TOTAL = Counter(
    "system_revamp_patch_operations_total",
    "Patch operation results.",
    ["service", "provider", "status"],
)

_UUID_RE = re.compile(
    r"\b[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}\b"
)
_NUMERIC_SEGMENT_RE = re.compile(r"/\d+")


def _metric_path(path: str) -> str:
    normalized = _UUID_RE.sub("{id}", path)
    normalized = _NUMERIC_SEGMENT_RE.sub("/{num}", normalized)
    return normalized


def install_metrics(app: FastAPI, service_name: str) -> None:
    if getattr(app.state, "_metrics_installed", False):
        return

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start = time.perf_counter()
        method = request.method.upper()
        path = _metric_path(request.url.path)
        API_REQUESTS_IN_PROGRESS.labels(service=service_name).inc()

        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed = max(0.0, time.perf_counter() - start)
            API_REQUEST_DURATION_SECONDS.labels(
                service=service_name,
                method=method,
                path=path,
            ).observe(elapsed)
            API_REQUESTS_TOTAL.labels(
                service=service_name,
                method=method,
                path=path,
                status_code=str(status_code),
            ).inc()
            API_REQUESTS_IN_PROGRESS.labels(service=service_name).dec()

    if not any(getattr(route, "path", "") == "/metrics" for route in app.routes):
        @app.get("/metrics", include_in_schema=False)
        async def metrics() -> Response:
            return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.state._metrics_installed = True


def observe_scan_duration(service_name: str, scan_type: str, duration_seconds: float) -> None:
    SCAN_DURATION_SECONDS.labels(service=service_name, scan_type=scan_type).observe(max(0.0, duration_seconds))


def record_patch_result(service_name: str, provider: str, status: str) -> None:
    clean_provider = (provider or "unknown").strip().lower() or "unknown"
    clean_status = (status or "unknown").strip().lower() or "unknown"
    PATCH_OPERATIONS_TOTAL.labels(
        service=service_name,
        provider=clean_provider,
        status=clean_status,
    ).inc()


def set_metric_gauge(name: str, value: Any) -> None:
    """Reserved helper for future gauge metrics without breaking imports."""
    _ = (name, value)
