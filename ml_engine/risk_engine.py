"""Predictive risk engine trained from real historical telemetry."""

from __future__ import annotations

import os
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable
from uuid import UUID

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from cloud_core.models import App, Driver, Machine, MachineCommand, ScanResult, SecurityEvent

LOOKBACK_DAYS = max(7, int(os.getenv("ML_RISK_LOOKBACK_DAYS", "90")))
MIN_TRAINING_ROWS = max(10, int(os.getenv("ML_RISK_MIN_SAMPLES", "25")))
RISK_ESCALATION_DELTA = max(1, int(os.getenv("ML_RISK_ESCALATION_DELTA", "10")))
COMPONENT_ESCALATION_DELTA = max(0, int(os.getenv("ML_COMPONENT_ESCALATION_DELTA", "2")))
CRITICAL_RISK_SCORE = max(70, int(os.getenv("ML_CRITICAL_RISK_SCORE", "85")))
PATCH_WINDOW_DAYS = max(1, int(os.getenv("ML_PATCH_HISTORY_DAYS", "7")))
EVENT_WINDOW_HOURS = max(1, int(os.getenv("ML_EVENT_HISTORY_HOURS", "24")))
MODEL_N_ESTIMATORS = max(50, int(os.getenv("ML_RF_N_ESTIMATORS", "250")))
MODEL_MAX_DEPTH = max(3, int(os.getenv("ML_RF_MAX_DEPTH", "14")))
MODEL_MIN_SAMPLES_LEAF = max(1, int(os.getenv("ML_RF_MIN_SAMPLES_LEAF", "2")))
MODEL_RANDOM_STATE = int(os.getenv("ML_RF_RANDOM_STATE", "42"))

HIGH_PROBABILITY_THRESHOLD = float(os.getenv("ML_RISK_HIGH_THRESHOLD", "0.70"))
MEDIUM_PROBABILITY_THRESHOLD = float(os.getenv("ML_RISK_MEDIUM_THRESHOLD", "0.40"))


@dataclass(slots=True)
class _ScanRow:
    scan_id: int
    machine_id: UUID
    timestamp: datetime
    risk_score: int
    cpu_usage: float
    ram_usage: float
    disk_usage: float


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _risk_level(probability: float) -> str:
    if probability >= HIGH_PROBABILITY_THRESHOLD:
        return "High"
    if probability >= MEDIUM_PROBABILITY_THRESHOLD:
        return "Medium"
    return "Low"


def _safe_probability(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


async def _scan_rows(db: AsyncSession) -> list[_ScanRow]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    rows = (
        (
            await db.execute(
                select(
                    ScanResult.id,
                    ScanResult.machine_id,
                    ScanResult.timestamp,
                    ScanResult.risk_score,
                    ScanResult.cpu_usage,
                    ScanResult.ram_usage,
                    ScanResult.disk_usage,
                )
                .where(ScanResult.timestamp >= cutoff)
                .order_by(ScanResult.machine_id.asc(), ScanResult.timestamp.asc())
            )
        )
        .all()
    )
    return [
        _ScanRow(
            scan_id=int(row.id),
            machine_id=row.machine_id,
            timestamp=_to_utc(row.timestamp),
            risk_score=int(row.risk_score),
            cpu_usage=float(row.cpu_usage),
            ram_usage=float(row.ram_usage),
            disk_usage=float(row.disk_usage),
        )
        for row in rows
    ]


async def _outdated_counts(db: AsyncSession) -> dict[int, int]:
    rows = (
        (
            await db.execute(
                select(App.scan_id, func.count(App.id))
                .where(
                    App.current_version != App.latest_version,
                    func.lower(App.latest_version) != "unknown",
                )
                .group_by(App.scan_id)
            )
        )
        .all()
    )
    return {int(scan_id): int(count) for scan_id, count in rows}


async def _unknown_counts(db: AsyncSession) -> dict[int, int]:
    rows = (
        (
            await db.execute(
                select(App.scan_id, func.count(App.id))
                .where(func.lower(App.latest_version).in_(["unknown", "n/a"]))
                .group_by(App.scan_id)
            )
        )
        .all()
    )
    return {int(scan_id): int(count) for scan_id, count in rows}


async def _missing_driver_counts(db: AsyncSession) -> dict[int, int]:
    rows = (
        (
            await db.execute(
                select(Driver.scan_id, func.count(Driver.id))
                .where(func.lower(Driver.status) != "installed")
                .group_by(Driver.scan_id)
            )
        )
        .all()
    )
    return {int(scan_id): int(count) for scan_id, count in rows}


async def _event_timestamps(db: AsyncSession) -> dict[UUID, list[datetime]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS + 2)
    rows = (
        (
            await db.execute(
                select(SecurityEvent.machine_id, SecurityEvent.timestamp)
                .where(SecurityEvent.timestamp >= cutoff)
                .order_by(SecurityEvent.machine_id.asc(), SecurityEvent.timestamp.asc())
            )
        )
        .all()
    )
    bucket: dict[UUID, list[datetime]] = defaultdict(list)
    for machine_id, timestamp in rows:
        bucket[machine_id].append(_to_utc(timestamp))
    return bucket


async def _patch_timeline(db: AsyncSession) -> dict[UUID, list[tuple[datetime, str]]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS + PATCH_WINDOW_DAYS)
    rows = (
        (
            await db.execute(
                select(MachineCommand.machine_id, MachineCommand.completed_at, MachineCommand.status)
                .where(
                    MachineCommand.command_type == "patch",
                    MachineCommand.completed_at.is_not(None),
                    MachineCommand.completed_at >= cutoff,
                )
                .order_by(MachineCommand.machine_id.asc(), MachineCommand.completed_at.asc())
            )
        )
        .all()
    )
    bucket: dict[UUID, list[tuple[datetime, str]]] = defaultdict(list)
    for machine_id, completed_at, status in rows:
        bucket[machine_id].append((_to_utc(completed_at), str(status).strip().lower()))
    return bucket


def _window_count(window: deque[datetime], earliest_allowed: datetime) -> int:
    while window and window[0] < earliest_allowed:
        window.popleft()
    return len(window)


def _patch_window_counts(window: deque[tuple[datetime, str]], earliest_allowed: datetime) -> tuple[int, int]:
    while window and window[0][0] < earliest_allowed:
        window.popleft()
    success = sum(1 for _, status in window if status == "completed")
    failed = sum(1 for _, status in window if status == "failed")
    return success, failed


def _iter_pairwise(rows: list[_ScanRow]) -> Iterable[tuple[_ScanRow, _ScanRow]]:
    for index in range(len(rows) - 1):
        yield rows[index], rows[index + 1]


async def predict_machine_risk(db: AsyncSession, machine_id: UUID) -> dict[str, object]:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise ValueError("Machine not found.")

    scans = await _scan_rows(db)
    if not scans:
        raise ValueError("No historical scans available for ML prediction.")

    outdated_by_scan = await _outdated_counts(db)
    unknown_by_scan = await _unknown_counts(db)
    missing_by_scan = await _missing_driver_counts(db)
    events_by_machine = await _event_timestamps(db)
    patches_by_machine = await _patch_timeline(db)

    grouped_scans: dict[UUID, list[_ScanRow]] = defaultdict(list)
    for row in scans:
        grouped_scans[row.machine_id].append(row)

    features: list[list[float]] = []
    labels: list[int] = []
    target_features: list[float] | None = None

    for candidate_machine_id, machine_scans in grouped_scans.items():
        event_list = events_by_machine.get(candidate_machine_id, [])
        patch_list = patches_by_machine.get(candidate_machine_id, [])

        event_index = 0
        patch_index = 0
        event_window: deque[datetime] = deque()
        patch_window: deque[tuple[datetime, str]] = deque()

        per_scan_features: dict[int, list[float]] = {}

        for idx, scan in enumerate(machine_scans):
            while event_index < len(event_list) and event_list[event_index] <= scan.timestamp:
                event_window.append(event_list[event_index])
                event_index += 1
            while patch_index < len(patch_list) and patch_list[patch_index][0] <= scan.timestamp:
                patch_window.append(patch_list[patch_index])
                patch_index += 1

            events_24h = _window_count(event_window, scan.timestamp - timedelta(hours=EVENT_WINDOW_HOURS))
            patch_success_7d, patch_failed_7d = _patch_window_counts(
                patch_window,
                scan.timestamp - timedelta(days=PATCH_WINDOW_DAYS),
            )

            previous_risk = machine_scans[idx - 1].risk_score if idx > 0 else scan.risk_score
            delta_risk = scan.risk_score - previous_risk
            outdated = outdated_by_scan.get(scan.scan_id, 0)
            missing = missing_by_scan.get(scan.scan_id, 0)
            unknown = unknown_by_scan.get(scan.scan_id, 0)

            vector = [
                float(scan.risk_score),
                float(scan.cpu_usage),
                float(scan.ram_usage),
                float(scan.disk_usage),
                float(delta_risk),
                float(outdated),
                float(missing),
                float(unknown),
                float(events_24h),
                float(patch_success_7d),
                float(patch_failed_7d),
            ]
            per_scan_features[scan.scan_id] = vector

        for current_scan, next_scan in _iter_pairwise(machine_scans):
            current_features = per_scan_features.get(current_scan.scan_id)
            if current_features is None:
                continue

            current_components = outdated_by_scan.get(current_scan.scan_id, 0) + missing_by_scan.get(current_scan.scan_id, 0)
            next_components = outdated_by_scan.get(next_scan.scan_id, 0) + missing_by_scan.get(next_scan.scan_id, 0)
            escalation = (
                next_scan.risk_score >= (current_scan.risk_score + RISK_ESCALATION_DELTA)
                or next_scan.risk_score >= CRITICAL_RISK_SCORE
                or next_components >= (current_components + COMPONENT_ESCALATION_DELTA)
            )
            features.append(current_features)
            labels.append(1 if escalation else 0)

        latest_scan = machine_scans[-1]
        if candidate_machine_id == machine_id:
            target_features = per_scan_features.get(latest_scan.scan_id)

    if target_features is None:
        raise ValueError("Machine has no usable scan features for prediction.")

    latest_machine_scan = grouped_scans.get(machine_id, [])
    latest_risk = float(latest_machine_scan[-1].risk_score if latest_machine_scan else 0.0)
    baseline_probability = _safe_probability(latest_risk / 100.0)

    if len(features) < MIN_TRAINING_ROWS:
        probability = baseline_probability
        model_state = "insufficient_samples"
    else:
        classes = sorted(set(labels))
        if len(classes) < 2:
            escalation_rate = float(labels[0]) if labels else baseline_probability
            probability = _safe_probability(escalation_rate)
            model_state = "single_class_history"
        else:
            classifier = RandomForestClassifier(
                n_estimators=MODEL_N_ESTIMATORS,
                max_depth=MODEL_MAX_DEPTH,
                min_samples_leaf=MODEL_MIN_SAMPLES_LEAF,
                random_state=MODEL_RANDOM_STATE,
                n_jobs=1,
                class_weight="balanced_subsample",
            )
            x_train = np.asarray(features, dtype=float)
            y_train = np.asarray(labels, dtype=int)
            classifier.fit(x_train, y_train)
            prediction = classifier.predict_proba(np.asarray([target_features], dtype=float))
            probability = _safe_probability(float(prediction[0][1]))
            model_state = "trained"

    return {
        "machine_id": str(machine_id),
        "risk_prediction": round(probability, 4),
        "risk_level": _risk_level(probability),
        "model": "RandomForestClassifier",
        "model_state": model_state,
        "training_rows": len(features),
        "lookback_days": LOOKBACK_DAYS,
    }
