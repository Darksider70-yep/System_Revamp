"""Offline package generation and application helpers."""

from __future__ import annotations

import hashlib
import io
import json
import platform
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from packaging.version import InvalidVersion, Version


def _normalize_name(value: str) -> str:
    return " ".join(str(value).strip().lower().split())


def _safe_parse_version(value: str | None) -> Version | None:
    if not value:
        return None
    try:
        return Version(str(value).strip())
    except (InvalidVersion, TypeError, ValueError):
        return None


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _lookup_latest(app_name: str, latest_versions: Mapping[str, str]) -> str:
    normalized = _normalize_name(app_name)
    direct = latest_versions.get(normalized)
    if direct:
        return direct

    for known_name, known_version in latest_versions.items():
        if normalized in known_name or known_name in normalized:
            return known_version
    return "Unknown"


def _risk_level(current: str, latest: str) -> str:
    current_parsed = _safe_parse_version(current)
    latest_parsed = _safe_parse_version(latest)
    if current_parsed is None or latest_parsed is None:
        return "Unknown"
    if current_parsed >= latest_parsed:
        return "Low"
    if latest_parsed.major > current_parsed.major:
        return "High"
    if latest_parsed.minor > current_parsed.minor:
        return "Medium"
    return "Low"


def build_vulnerability_intelligence(
    installed_apps: Sequence[Mapping[str, Any]],
    latest_versions: Mapping[str, str],
) -> list[dict[str, Any]]:
    intelligence: list[dict[str, Any]] = []
    for item in installed_apps:
        name = str(item.get("name", "")).strip()
        current = str(item.get("version", item.get("current", "Unknown"))).strip() or "Unknown"
        if not name:
            continue
        latest = _lookup_latest(name, latest_versions)
        if latest == "Unknown":
            continue
        if current == latest:
            continue
        intelligence.append(
            {
                "name": name,
                "current_version": current,
                "latest_version": latest,
                "risk_level": _risk_level(current, latest),
            }
        )
    intelligence.sort(key=lambda item: (item["risk_level"], item["name"]))
    return intelligence


def build_patch_instructions(manifest: Mapping[str, Any]) -> str:
    lines = [
        "SYSTEM REVAMP OFFLINE UPDATE PACKAGE",
        f"Generated at: {manifest.get('generated_at', 'unknown')}",
        f"Platform: {manifest.get('platform', 'unknown')}",
        "",
        "Workflow:",
        "1. Transfer this ZIP to the offline machine using approved media.",
        "2. POST the ZIP to /apply-offline-package on the offline System Revamp Agent.",
        "3. Review the scheduled patch plan returned by the agent.",
        "4. Execute /auto-patch when an approved repository is available locally.",
        "",
        "Contents:",
        "- updates_manifest.json: integrity data, vulnerability intelligence, patch metadata",
        "- latest_versions.json: synchronized version intelligence database",
        "- patch_instructions.txt: operational instructions",
    ]
    return "\n".join(lines)


@dataclass(slots=True)
class OfflinePackage:
    filename: str
    content: bytes
    manifest: dict[str, Any]


def create_offline_package(
    *,
    latest_versions: Mapping[str, str],
    installed_apps: Sequence[Mapping[str, Any]],
    patch_metadata: Sequence[Mapping[str, Any]],
    source_service: str,
    mode: str = "full",
    package_dir: Path | None = None,
) -> OfflinePackage:
    generated_at = datetime.now(timezone.utc).isoformat()
    clean_versions = {
        _normalize_name(key): str(value).strip()
        for key, value in latest_versions.items()
        if _normalize_name(key) and str(value).strip()
    }
    vulnerability_intelligence = build_vulnerability_intelligence(installed_apps, clean_versions)

    latest_versions_bytes = json.dumps(clean_versions, indent=2, sort_keys=True).encode("utf-8")
    manifest: dict[str, Any] = {
        "package_version": 1,
        "generated_at": generated_at,
        "source_service": source_service,
        "platform": platform.system(),
        "mode": mode,
        "counts": {
            "latest_versions": len(clean_versions),
            "vulnerabilities": len(vulnerability_intelligence),
            "patch_candidates": len(patch_metadata),
        },
        "vulnerability_intelligence": vulnerability_intelligence,
        "patch_metadata": [dict(item) for item in patch_metadata],
    }
    instructions_bytes = build_patch_instructions(manifest).encode("utf-8")
    manifest["files"] = {
        "latest_versions.json": {
            "sha256": _sha256_bytes(latest_versions_bytes),
            "bytes": len(latest_versions_bytes),
        },
        "patch_instructions.txt": {
            "sha256": _sha256_bytes(instructions_bytes),
            "bytes": len(instructions_bytes),
        },
    }

    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("updates_manifest.json", manifest_bytes)
        archive.writestr("latest_versions.json", latest_versions_bytes)
        archive.writestr("patch_instructions.txt", instructions_bytes)
    content = buffer.getvalue()
    filename = f"system_revamp_offline_{mode}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"

    if package_dir is not None:
        package_dir.mkdir(parents=True, exist_ok=True)
        (package_dir / filename).write_bytes(content)

    return OfflinePackage(filename=filename, content=content, manifest=manifest)


def validate_offline_package(package_bytes: bytes) -> tuple[dict[str, Any], dict[str, str], str]:
    with zipfile.ZipFile(io.BytesIO(package_bytes), "r") as archive:
        required_files = {"updates_manifest.json", "latest_versions.json", "patch_instructions.txt"}
        archive_names = set(archive.namelist())
        missing = required_files - archive_names
        if missing:
            raise ValueError(f"Offline package missing required files: {', '.join(sorted(missing))}")

        manifest_bytes = archive.read("updates_manifest.json")
        latest_versions_bytes = archive.read("latest_versions.json")
        instructions_bytes = archive.read("patch_instructions.txt")

    manifest = json.loads(manifest_bytes.decode("utf-8"))
    checks = manifest.get("files", {})
    expected_latest = str((checks.get("latest_versions.json") or {}).get("sha256", "")).strip()
    expected_instructions = str((checks.get("patch_instructions.txt") or {}).get("sha256", "")).strip()

    actual_latest = _sha256_bytes(latest_versions_bytes)
    actual_instructions = _sha256_bytes(instructions_bytes)
    if expected_latest and expected_latest != actual_latest:
        raise ValueError("latest_versions.json failed integrity validation")
    if expected_instructions and expected_instructions != actual_instructions:
        raise ValueError("patch_instructions.txt failed integrity validation")

    latest_versions = json.loads(latest_versions_bytes.decode("utf-8"))
    if not isinstance(latest_versions, dict):
        raise ValueError("latest_versions.json must contain a JSON object")

    return manifest, {str(k): str(v) for k, v in latest_versions.items()}, instructions_bytes.decode("utf-8")


def apply_offline_package(
    *,
    package_bytes: bytes,
    installed_apps: Sequence[Mapping[str, Any]],
    latest_versions_path: Path,
    applied_metadata_path: Path,
    scheduled_updates_path: Path,
) -> dict[str, Any]:
    manifest, latest_versions, _ = validate_offline_package(package_bytes)

    latest_versions_path.parent.mkdir(parents=True, exist_ok=True)
    latest_versions_path.write_text(json.dumps(latest_versions, indent=2, sort_keys=True), encoding="utf-8")

    vulnerability_intelligence = build_vulnerability_intelligence(installed_apps, latest_versions)
    scheduled_updates = {
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "source_manifest": {
            "generated_at": manifest.get("generated_at"),
            "source_service": manifest.get("source_service"),
            "mode": manifest.get("mode"),
        },
        "scheduled_updates": vulnerability_intelligence,
    }

    applied_metadata_path.parent.mkdir(parents=True, exist_ok=True)
    scheduled_updates_path.parent.mkdir(parents=True, exist_ok=True)
    applied_metadata_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    scheduled_updates_path.write_text(json.dumps(scheduled_updates, indent=2, sort_keys=True), encoding="utf-8")

    return {
        "status": "package_applied",
        "updates_available": len(vulnerability_intelligence),
        "scheduled_updates": vulnerability_intelligence,
        "manifest": {
            "generated_at": manifest.get("generated_at"),
            "source_service": manifest.get("source_service"),
            "mode": manifest.get("mode"),
        },
    }


def list_offline_packages(package_dir: Path) -> list[dict[str, Any]]:
    if not package_dir.exists():
        return []
    items: list[dict[str, Any]] = []
    for path in sorted(package_dir.glob("*.zip"), key=lambda item: item.stat().st_mtime, reverse=True):
        stat = path.stat()
        items.append(
            {
                "name": path.name,
                "path": str(path),
                "bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            }
        )
    return items
