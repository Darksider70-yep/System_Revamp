"""Pydantic schemas for Cloud Security Core APIs."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MachineRegisterRequest(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    os: str = Field(..., min_length=1, max_length=120)
    os_version: str = Field(..., min_length=1, max_length=120)
    cpu: str = Field(..., min_length=1, max_length=255)
    ram_gb: int = Field(..., ge=1, le=4096)


class MachineRegisterResponse(BaseModel):
    machine_id: UUID
    api_key: str


class AppPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    current_version: str = Field(..., min_length=1, max_length=80)
    latest_version: str = Field(..., min_length=1, max_length=80)
    risk_level: str = Field(..., min_length=1, max_length=20)


class DriverPayload(BaseModel):
    driver_name: str = Field(..., min_length=1, max_length=255)
    status: str = Field(..., min_length=1, max_length=30)


class SystemMetricsPayload(BaseModel):
    cpu_usage: float = Field(..., ge=0, le=100)
    ram_usage: float = Field(..., ge=0, le=100)
    disk_usage: float = Field(..., ge=0, le=100)
    network_activity: str | None = Field(default=None, max_length=32)
    network_bytes_per_second: int | None = Field(default=None, ge=0)


class SecurityEventPayload(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=255)
    risk_level: str = Field(..., min_length=1, max_length=20)
    timestamp: datetime
    details: str | None = Field(default=None, max_length=500)


class ScanUploadRequest(BaseModel):
    machine_id: UUID
    timestamp: datetime
    apps: list[AppPayload]
    drivers: list[DriverPayload]
    system_metrics: SystemMetricsPayload
    risk_score: int = Field(..., ge=0, le=100)
    security_events: list[SecurityEventPayload] = Field(default_factory=list)


class ScanUploadResponse(BaseModel):
    status: str
    queue_id: str | None = None
    accepted_at: datetime


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class DashboardOverviewResponse(BaseModel):
    total_machines: int
    machines_online: int
    total_vulnerabilities: int
    average_risk_score: float
    last_updated: datetime


class MachineSummary(BaseModel):
    id: UUID
    hostname: str
    os: str
    last_scan: datetime | None
    risk_score: int | None
    alerts: int
    online: bool


class MachineListResponse(BaseModel):
    total: int
    items: list[MachineSummary]


class AppRecord(BaseModel):
    name: str
    current_version: str
    latest_version: str
    risk_level: str


class DriverRecord(BaseModel):
    driver_name: str
    status: str


class SecurityEventRecord(BaseModel):
    event_type: str
    risk_level: str
    timestamp: datetime
    details: str | None = None


class MetricsPoint(BaseModel):
    timestamp: datetime
    cpu_usage: float
    ram_usage: float
    disk_usage: float
    risk_score: int


class MachineDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hostname: str
    os: str
    os_version: str
    cpu: str
    ram_gb: int
    registered_at: datetime
    last_scan: datetime | None
    risk_score: int | None
    alerts: int
    online: bool
    installed_apps: list[AppRecord]
    outdated_software: list[AppRecord]
    driver_issues: list[DriverRecord]
    security_events: list[SecurityEventRecord]
    system_metrics: list[MetricsPoint]


class RiskScoreBreakdown(BaseModel):
    outdated_apps: int
    missing_drivers: int
    cpu_spikes: int
    security_events: int


class RiskScoreResponse(BaseModel):
    machine_id: UUID
    risk_score: int
    breakdown: RiskScoreBreakdown


class SecurityEventsResponse(BaseModel):
    machine_id: UUID
    count: int
    events: list[SecurityEventRecord]


class PatchInstallRequest(BaseModel):
    machine_id: UUID
    software: str = Field(..., min_length=1, max_length=255)


class PatchInstallResponse(BaseModel):
    status: str
    command_id: UUID
    command_type: str
    machine_id: UUID


class PatchStatusItem(BaseModel):
    command_id: UUID | None = None
    software: str
    status: str
    provider: str
    timestamp: datetime
    new_version: str | None = None


class PatchStatusResponse(BaseModel):
    machine_id: UUID
    count: int
    items: list[PatchStatusItem]


class ManualScanCommandRequest(BaseModel):
    force_full: bool = Field(default=True)


class MachinePatchCommandRequest(BaseModel):
    software: str | None = Field(default=None, max_length=255)
    patch_all: bool = Field(default=False)


class MachineCommandQueueResponse(BaseModel):
    status: str
    command_id: UUID
    machine_id: UUID
    command_type: str
    queued_at: datetime


class MachineCommandItem(BaseModel):
    id: UUID
    machine_id: UUID
    command_type: str
    status: str
    payload: dict[str, object] | None = None
    result: dict[str, object] | None = None
    created_at: datetime
    updated_at: datetime
    dispatched_at: datetime | None = None
    completed_at: datetime | None = None


class MachineCommandPollResponse(BaseModel):
    machine_id: UUID
    command: MachineCommandItem | None = None


class MachineCommandResultRequest(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)
    result: dict[str, object] = Field(default_factory=dict)
    error: str | None = Field(default=None, max_length=1000)
