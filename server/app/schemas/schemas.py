import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, EmailStr, Field


# --- Auth & User Schemas ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class TOTPVerifyRequest(BaseModel):
    totp_code: str


class AdminUserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "LabAdmin"
    org_id: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: str
    org_id: str
    email: str
    name: str
    role: str
    totp_enabled: bool
    is_active: bool
    created_at: datetime.datetime


# --- Multi-Tenant Hierarchy Schemas ---

class OrgCreate(BaseModel):
    name: str


class OrgResponse(BaseModel):
    id: str
    name: str
    created_at: datetime.datetime
    sites_count: Optional[int] = 0
    devices_count: Optional[int] = 0


class SiteCreate(BaseModel):
    org_id: str
    name: str
    location: Optional[str] = ""


class SiteResponse(BaseModel):
    id: str
    org_id: str
    name: str
    location: str
    created_at: datetime.datetime
    labs_count: Optional[int] = 0


class LabCreate(BaseModel):
    site_id: str
    name: str
    network_subnet: Optional[str] = ""


class LabResponse(BaseModel):
    id: str
    site_id: str
    name: str
    network_subnet: str
    created_at: datetime.datetime
    devices_count: Optional[int] = 0


# --- Device & Enrollment Schemas ---

class EnrollmentTokenCreate(BaseModel):
    org_id: str
    lab_id: Optional[str] = None
    name: str = "Fleet Enrollment Token"
    expires_days: int = 30
    max_uses: int = 100


class EnrollmentTokenResponse(BaseModel):
    id: str
    token: str
    name: str
    expires_at: datetime.datetime
    max_uses: int
    used_count: int
    is_revoked: bool


class AgentEnrollRequest(BaseModel):
    enrollment_token: str
    hostname: str
    os_name: str
    os_version: str
    os_build: Optional[str] = ""
    ip_address: Optional[str] = ""
    mac_address: Optional[str] = ""
    agent_version: str = "2.0.0"


class AgentEnrollResponse(BaseModel):
    device_id: str
    device_token: str
    org_id: str
    lab_id: Optional[str] = None
    poll_interval_seconds: int = 300
    server_time: datetime.datetime


class AgentHeartbeatRequest(BaseModel):
    device_id: str
    ip_address: Optional[str] = None
    uptime_seconds: Optional[int] = 0
    cpu_percent: Optional[float] = 0.0
    ram_used_percent: Optional[float] = 0.0
    disk_free_gb: Optional[float] = 0.0


# --- Telemetry & Ingestion Schemas ---

class SoftwareReportItem(BaseModel):
    name: str
    version: str = "Unknown"
    publisher: Optional[str] = ""
    install_path: Optional[str] = ""
    binary_sha256: Optional[str] = None
    signature_status: Optional[str] = "Unsigned"  # Valid, Unsigned, HashMismatch, NotTrusted
    signer_name: Optional[str] = ""


class DriverReportItem(BaseModel):
    device_name: str
    device_id_pnp: Optional[str] = ""
    error_code: int = 0
    reason: Optional[str] = ""
    impact: Optional[str] = "Low"
    risk_score: Optional[int] = 0
    status: Optional[str] = "Installed"
    manufacturer: Optional[str] = "Unknown"
    is_disabled: Optional[bool] = False


class SystemMetrics(BaseModel):
    cpu_model: Optional[str] = ""
    cpu_cores: Optional[int] = 1
    ram_total_gb: Optional[float] = 0.0
    disk_total_gb: Optional[float] = 0.0
    disk_free_gb: Optional[float] = 0.0
    uptime_seconds: Optional[int] = 0


class TelemetryReport(BaseModel):
    device_id: str
    snapshot_type: str = "full"
    software: List[SoftwareReportItem] = []
    drivers: List[DriverReportItem] = []
    system_metrics: Optional[SystemMetrics] = None


class TelemetryIngestResponse(BaseModel):
    success: bool
    processed_software: int
    processed_drivers: int
    critical_risks: int
    message: str


# --- Commands & Remediation Schemas ---

class CommandQueueRequest(BaseModel):
    target_type: str = "device"  # device, lab, fleet
    target_id: str
    command_type: str  # rescan, scan-drivers, enable-device, upgrade-package, run-protection-scan
    params: Dict[str, Any] = {}
    dry_run: bool = False
    requires_approval: bool = False


class CommandApprovalRequest(BaseModel):
    command_id: str
    approved: bool


class CommandPollItem(BaseModel):
    id: str
    command_type: str
    params: Dict[str, Any]
    signature: str
    dry_run: bool


class CommandResultSubmit(BaseModel):
    command_id: str
    device_id: str
    status: str  # completed, failed
    result: Dict[str, Any]
    execution_log: Optional[str] = ""


# --- Fleet Analytics Schemas ---

class FleetOverview(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    compliance_percent: float
    critical_risk_devices: int
    high_risk_devices: int
    top_outdated_apps: List[Dict[str, Any]]
    top_missing_drivers: List[Dict[str, Any]]
    threats_flagged: int


class DeviceDetailResponse(BaseModel):
    id: str
    hostname: str
    os_name: str
    os_version: str
    ip_address: str
    mac_address: str
    is_online: bool
    last_heartbeat: datetime.datetime
    agent_version: str
    lab_name: Optional[str] = ""
    site_name: Optional[str] = ""
    org_name: Optional[str] = ""
    system_metrics: Dict[str, Any]
    software: List[Dict[str, Any]]
    drivers: List[Dict[str, Any]]
    recent_commands: List[Dict[str, Any]]
