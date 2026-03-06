"""Version intelligence helpers for installed application analysis."""

from __future__ import annotations

import json
import logging
import re
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

import requests
from packaging.version import InvalidVersion, Version

LOGGER = logging.getLogger("version_service.version_checker")

CACHE_TTL_SECONDS = 3600
_SAFE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9 ._+\-()]{1,100}$")
_VERSION_CAPTURE_PATTERN = re.compile(r"^\s*Version:\s*([^\r\n]+)\s*$", re.IGNORECASE | re.MULTILINE)


class TTLCache:
    """Simple in-memory TTL cache with thread safety."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._items: Dict[str, Tuple[str, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[str]:
        """Return cached value if still valid."""
        now = time.time()
        with self._lock:
            value = self._items.get(key)
            if not value:
                return None
            cached_value, timestamp = value
            if now - timestamp >= self._ttl_seconds:
                self._items.pop(key, None)
                return None
            return cached_value

    def set(self, key: str, value: str) -> None:
        """Store key/value with current timestamp."""
        with self._lock:
            self._items[key] = (value, time.time())


LOOKUP_CACHE = TTLCache(ttl_seconds=CACHE_TTL_SECONDS)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _safe_parse_version(value: str) -> Optional[Version]:
    try:
        return Version(str(value).strip())
    except (InvalidVersion, TypeError, ValueError):
        return None


def load_latest_versions(db_path: Optional[Path] = None) -> Dict[str, str]:
    """Load latest software versions from local JSON database."""
    path = db_path or Path(__file__).with_name("latest_versions.json")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        LOGGER.error("Unable to read latest version database at %s: %s", path, exc)
        return {}

    if not isinstance(payload, dict):
        LOGGER.warning("latest_versions.json is not a JSON object")
        return {}

    cleaned: Dict[str, str] = {}
    for app_name, app_version in payload.items():
        key = _normalize_name(str(app_name))
        value = str(app_version).strip()
        if not key or not value:
            continue
        cleaned[key] = value
    return cleaned


def _lookup_local_version(app_name: str, latest_db: Mapping[str, str]) -> Optional[str]:
    normalized_name = _normalize_name(app_name)
    if normalized_name in latest_db:
        return latest_db[normalized_name]

    for known_name, known_version in latest_db.items():
        if normalized_name in known_name or known_name in normalized_name:
            return known_version
    return None


def _is_safe_lookup_name(app_name: str) -> bool:
    return bool(_SAFE_NAME_PATTERN.fullmatch(app_name.strip()))


def _lookup_pypi(app_name: str) -> Optional[str]:
    package_candidates: List[str] = []
    normalized = _normalize_name(app_name)
    slug = re.sub(r"[^A-Za-z0-9._-]", "-", normalized).strip("-")
    if slug:
        package_candidates.append(slug)
    first_token = normalized.split(" ")[0] if normalized else ""
    if first_token and first_token not in package_candidates:
        package_candidates.append(first_token)

    for candidate in package_candidates:
        cache_key = f"pypi::{candidate}"
        cached = LOOKUP_CACHE.get(cache_key)
        if cached is not None:
            return None if cached == "Unknown" else cached

        try:
            response = requests.get(
                f"https://pypi.org/pypi/{candidate}/json",
                timeout=(3, 6),
            )
            if response.status_code == 200:
                payload = response.json()
                latest_version = str(payload.get("info", {}).get("version", "")).strip()
                if latest_version:
                    LOOKUP_CACHE.set(cache_key, latest_version)
                    return latest_version
        except Exception as exc:
            LOGGER.debug("PyPI lookup failed for %s: %s", candidate, exc)

        LOOKUP_CACHE.set(cache_key, "Unknown")
    return None


def _lookup_winget(app_name: str) -> Optional[str]:
    if not _is_safe_lookup_name(app_name):
        LOGGER.warning("Unsafe application name skipped for winget lookup: %s", app_name)
        return None

    cache_key = f"winget::{_normalize_name(app_name)}"
    cached = LOOKUP_CACHE.get(cache_key)
    if cached is not None:
        return None if cached == "Unknown" else cached

    command = [
        "winget",
        "show",
        "--name",
        app_name.strip(),
        "--exact",
        "--accept-source-agreements",
        "--disable-interactivity",
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except FileNotFoundError:
        LOGGER.info("winget not available on this host")
        LOOKUP_CACHE.set(cache_key, "Unknown")
        return None
    except Exception as exc:
        LOGGER.debug("winget lookup failed for %s: %s", app_name, exc)
        LOOKUP_CACHE.set(cache_key, "Unknown")
        return None

    if result.returncode != 0:
        LOOKUP_CACHE.set(cache_key, "Unknown")
        return None

    match = _VERSION_CAPTURE_PATTERN.search(result.stdout or "")
    if not match:
        LOOKUP_CACHE.set(cache_key, "Unknown")
        return None

    version_value = match.group(1).strip()
    LOOKUP_CACHE.set(cache_key, version_value if version_value else "Unknown")
    return version_value if version_value else None


def _pick_best_latest(candidates: Iterable[Optional[str]]) -> Optional[str]:
    selected: Optional[str] = None
    selected_parsed: Optional[Version] = None

    for candidate in candidates:
        if not candidate:
            continue
        parsed = _safe_parse_version(candidate)
        if parsed is None:
            if selected is None:
                selected = candidate
            continue
        if selected_parsed is None or parsed > selected_parsed:
            selected = candidate
            selected_parsed = parsed
    return selected


def resolve_latest_version(app_name: str, latest_db: Mapping[str, str]) -> str:
    """Resolve latest version from local DB first, then live lookups."""
    local_version = _lookup_local_version(app_name, latest_db)
    if local_version:
        return local_version

    pypi_version = _lookup_pypi(app_name)
    winget_version = _lookup_winget(app_name)
    resolved = _pick_best_latest([pypi_version, winget_version])
    return resolved if resolved else "Unknown"


def _status_and_risk(current: str, latest: str) -> Tuple[str, str]:
    current_parsed = _safe_parse_version(current)
    latest_parsed = _safe_parse_version(latest)
    if current_parsed is None or latest_parsed is None:
        return "Unknown", "Unknown"

    if current_parsed >= latest_parsed:
        return "Up-to-date", "Low"

    if latest_parsed.major > current_parsed.major:
        return "Update Available", "High"
    if latest_parsed.minor > current_parsed.minor:
        return "Update Available", "Medium"
    if latest_parsed == current_parsed:
        return "Up-to-date", "Low"
    return "Update Available", "Low"


def check_latest_versions(installed_apps: Mapping[str, str]) -> List[Dict[str, str]]:
    """Compare installed versions with latest known versions."""
    latest_db = load_latest_versions()
    results: List[Dict[str, str]] = []

    normalized_items = [
        (str(app_name).strip(), str(current_version).strip())
        for app_name, current_version in installed_apps.items()
        if str(app_name).strip()
    ]
    max_workers = min(16, max(4, len(normalized_items)))

    def resolve(app_name: str, current_version: str) -> Dict[str, str]:
        latest_version = resolve_latest_version(app_name, latest_db)
        status, risk_level = _status_and_risk(current_version, latest_version)
        return {
            "name": app_name,
            "current": current_version,
            "latest": latest_version,
            "status": status,
            "riskLevel": risk_level,
        }

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(resolve, app_name, current_version) for app_name, current_version in normalized_items]
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as exc:
                LOGGER.warning("Version resolution worker failed: %s", exc)

    results.sort(key=lambda item: item.get("name", "").lower())
    return results
