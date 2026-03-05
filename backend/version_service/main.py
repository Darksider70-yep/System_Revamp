"""FastAPI entrypoint for Version Intelligence Service (port 8002)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Mapping

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

try:
    from version_checker import check_latest_versions
except ImportError:  # pragma: no cover
    from .version_checker import check_latest_versions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("version_service.main")

MAX_APPS_PER_REQUEST = 500
MAX_NAME_LENGTH = 120
MAX_VERSION_LENGTH = 64

app = FastAPI(title="Version Intelligence Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_installed_apps(payload: Any) -> Dict[str, str]:
    """Validate and normalize request body for version checks."""
    if not isinstance(payload, Mapping):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")

    if len(payload) > MAX_APPS_PER_REQUEST:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {MAX_APPS_PER_REQUEST} applications can be checked per request.",
        )

    normalized: Dict[str, str] = {}
    for raw_name, raw_version in payload.items():
        name = str(raw_name).strip()
        version = str(raw_version).strip()

        if not name:
            raise HTTPException(status_code=422, detail="Application names cannot be empty.")
        if len(name) > MAX_NAME_LENGTH:
            raise HTTPException(
                status_code=422,
                detail=f"Application name too long: {name[:40]}...",
            )
        if not version:
            raise HTTPException(status_code=422, detail=f"Version is missing for '{name}'.")
        if len(version) > MAX_VERSION_LENGTH:
            raise HTTPException(
                status_code=422,
                detail=f"Version value too long for '{name}'.",
            )

        normalized[name] = version
    return normalized


@app.get("/")
def root() -> Dict[str, str]:
    """Health endpoint."""
    return {"message": "Version Intelligence Service running"}


@app.post("/check-versions")
def check_versions(installed_apps: Dict[str, Any]) -> Dict[str, Any]:
    """Compare installed versions against local/live intelligence sources."""
    try:
        validated = _validate_installed_apps(installed_apps)
        results = check_latest_versions(validated)
        return {"apps": results}
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Unexpected error in /check-versions: %s", exc)
        raise HTTPException(status_code=500, detail="Version check failed.") from exc
