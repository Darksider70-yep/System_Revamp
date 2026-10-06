import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Index,
)
from sqlalchemy.orm import relationship
from server.app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sites = relationship("Site", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("AdminUser", back_populates="organization", cascade="all, delete-orphan")
    enrollment_tokens = relationship("EnrollmentToken", back_populates="organization", cascade="all, delete-orphan")
    commands = relationship("Command", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="sites")
    labs = relationship("Lab", back_populates="site", cascade="all, delete-orphan")


class Lab(Base):
    __tablename__ = "labs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    network_subnet = Column(String(64), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    site = relationship("Site", back_populates="labs")
    device_groups = relationship("DeviceGroup", back_populates="lab", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="lab", cascade="all, delete-orphan")
    enrollment_tokens = relationship("EnrollmentToken", back_populates="lab", cascade="all, delete-orphan")


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lab_id = Column(String(36), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    policy_id = Column(String(64), default="default")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lab = relationship("Lab", back_populates="device_groups")
    devices = relationship("Device", back_populates="device_group")


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lab_id = Column(String(36), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(String(36), ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True)
    
    hostname = Column(String(255), nullable=False, index=True)
    os_name = Column(String(128), default="Windows")
    os_version = Column(String(128), default="")
    os_build = Column(String(64), default="")
    ip_address = Column(String(64), default="")
    mac_address = Column(String(64), default="")
    
    device_token_hash = Column(String(255), nullable=False, index=True)
    is_enrolled = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    last_heartbeat = Column(DateTime, default=datetime.datetime.utcnow)
    agent_version = Column(String(32), default="2.0.0")
    
    # System summary metrics
    cpu_model = Column(String(255), default="")
    cpu_cores = Column(Integer, default=1)
    ram_total_gb = Column(Float, default=0.0)
    disk_total_gb = Column(Float, default=0.0)
    disk_free_gb = Column(Float, default=0.0)
    uptime_seconds = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    lab = relationship("Lab", back_populates="devices")
    device_group = relationship("DeviceGroup", back_populates="devices")
    scan_snapshots = relationship("ScanSnapshot", back_populates="device", cascade="all, delete-orphan")
    software = relationship("DeviceSoftware", back_populates="device", cascade="all, delete-orphan")
    drivers = relationship("DeviceDriver", back_populates="device", cascade="all, delete-orphan")


class EnrollmentToken(Base):
    __tablename__ = "enrollment_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    lab_id = Column(String(36), ForeignKey("labs.id", ondelete="CASCADE"), nullable=True)
    
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(128), default="Default Lab Enrollment Token")
    created_by = Column(String(128), default="admin")
    expires_at = Column(DateTime, nullable=False)
    max_uses = Column(Integer, default=100)
    used_count = Column(Integer, default=0)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="enrollment_tokens")
    lab = relationship("Lab", back_populates="enrollment_tokens")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), default="")
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="LabAdmin")  # SuperAdmin, OrgAdmin, LabAdmin, LabOperator
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="users")


class ScanSnapshot(Base):
    __tablename__ = "scan_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_type = Column(String(32), default="full")  # full, delta, on-demand
    software_count = Column(Integer, default=0)
    driver_issues_count = Column(Integer, default=0)
    critical_risks_count = Column(Integer, default=0)
    system_metrics_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    device = relationship("Device", back_populates="scan_snapshots")


class DeviceSoftware(Base):
    __tablename__ = "device_software"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    app_name = Column(String(255), nullable=False, index=True)
    version = Column(String(128), default="Unknown")
    publisher = Column(String(255), default="")
    install_path = Column(Text, default="")
    binary_sha256 = Column(String(64), nullable=True, index=True)
    signature_status = Column(String(32), default="Unsigned")  # Valid, Unsigned, HashMismatch, NotTrusted
    signer_name = Column(String(255), default="")
    risk_level = Column(String(32), default="Low")  # Critical, High, Medium, Low, Unknown
    latest_version = Column(String(128), default="Unknown")
    winget_id = Column(String(128), nullable=True)
    last_scanned_at = Column(DateTime, default=datetime.datetime.utcnow)

    device = relationship("Device", back_populates="software")


class DeviceDriver(Base):
    __tablename__ = "device_drivers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    device_name = Column(String(255), nullable=False)
    device_id_pnp = Column(String(512), default="")
    error_code = Column(Integer, default=0)
    reason = Column(String(255), default="")
    impact = Column(String(32), default="Low")  # Critical, High, Medium, Low
    risk_score = Column(Integer, default=0)
    status = Column(String(32), default="Installed")  # Installed, Missing, Disabled, Error
    manufacturer = Column(String(255), default="Unknown")
    is_disabled = Column(Boolean, default=False)
    last_scanned_at = Column(DateTime, default=datetime.datetime.utcnow)

    device = relationship("Device", back_populates="drivers")


class ThreatReputation(Base):
    __tablename__ = "threat_reputations"

    sha256 = Column(String(64), primary_key=True, index=True)
    vt_score = Column(Integer, default=0)
    vt_status = Column(String(32), default="Unknown")  # Clean, Suspicious, Malicious, Unknown
    positives_count = Column(Integer, default=0)
    total_engines = Column(Integer, default=0)
    raw_vt_json = Column(Text, default="{}")
    last_checked_at = Column(DateTime, default=datetime.datetime.utcnow)


class VulnerabilityCatalog(Base):
    __tablename__ = "vulnerability_catalog"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    cve_id = Column(String(64), nullable=False, unique=True, index=True)
    app_name = Column(String(255), nullable=False, index=True)
    affected_versions_expr = Column(String(255), default="*")
    cvss_score = Column(Float, default=0.0)
    severity = Column(String(32), default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW
    fixed_in_version = Column(String(128), default="")
    summary = Column(Text, default="")
    published_date = Column(DateTime, default=datetime.datetime.utcnow)


class AppWingetMapping(Base):
    __tablename__ = "app_winget_mappings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    app_name = Column(String(255), nullable=False, unique=True, index=True)
    winget_id = Column(String(255), nullable=False)
    confidence = Column(Float, default=1.0)
    is_verified = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class InstallerCache(Base):
    __tablename__ = "installer_cache"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    app_name = Column(String(255), nullable=False, index=True)
    version = Column(String(128), nullable=False)
    sha256 = Column(String(64), nullable=False, unique=True)
    filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    storage_path = Column(Text, nullable=False)
    approved_by = Column(String(128), default="admin")
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)


class Command(Base):
    __tablename__ = "commands"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    target_type = Column(String(32), default="device")  # device, lab, fleet
    target_id = Column(String(36), nullable=False, index=True)
    
    command_type = Column(String(64), nullable=False)  # rescan, scan-drivers, enable-device, upgrade-package, run-protection-scan
    params_json = Column(Text, default="{}")
    signature = Column(String(512), default="")
    dry_run = Column(Boolean, default=False)
    status = Column(String(32), default="pending")  # pending, approved, dispatched, running, completed, failed
    
    created_by = Column(String(128), default="admin")
    approved_by = Column(String(128), nullable=True)
    result_json = Column(Text, default="{}")
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    dispatched_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="commands")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    org_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(128), nullable=False)
    action = Column(String(128), nullable=False)  # login, create_token, queue_command, approve_remediation, etc.
    target_type = Column(String(64), default="")
    target_id = Column(String(128), default="")
    details_json = Column(Text, default="{}")
    ip_address = Column(String(64), default="")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="audit_logs")
