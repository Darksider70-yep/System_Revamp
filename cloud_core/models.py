"""SQLAlchemy models for Cloud Security Core."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, PrimaryKeyConstraint, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hostname: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    os: Mapped[str] = mapped_column(String(120), nullable=False)
    os_version: Mapped[str] = mapped_column(String(120), nullable=False)
    cpu: Mapped[str] = mapped_column(String(255), nullable=False)
    ram_gb: Mapped[int] = mapped_column(Integer, nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    scans: Mapped[List["ScanResult"]] = relationship(
        back_populates="machine",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    events: Mapped[List["SecurityEvent"]] = relationship(
        back_populates="machine",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        back_populates="machine",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    commands: Mapped[List["MachineCommand"]] = relationship(
        back_populates="machine",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    group_memberships: Mapped[List["MachineGroupMembership"]] = relationship(
        back_populates="machine",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MachineGroup(Base):
    __tablename__ = "machine_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    policy: Mapped[Dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    scan_schedule_cron: Mapped[str | None] = mapped_column(String(120), nullable=True)
    patch_window_start: Mapped[str | None] = mapped_column(String(16), nullable=True)
    patch_window_end: Mapped[str | None] = mapped_column(String(16), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    memberships: Mapped[List["MachineGroupMembership"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MachineGroupMembership(Base):
    __tablename__ = "machine_group_memberships"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machine_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    group: Mapped[MachineGroup] = relationship(back_populates="memberships")
    machine: Mapped[Machine] = relationship(back_populates="group_memberships")

    __table_args__ = (
        PrimaryKeyConstraint("group_id", "machine_id", name="pk_machine_group_membership"),
        Index("ix_machine_group_membership_machine_group", "machine_id", "group_id"),
    )


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    cpu_usage: Mapped[float] = mapped_column(Float, nullable=False)
    ram_usage: Mapped[float] = mapped_column(Float, nullable=False)
    disk_usage: Mapped[float] = mapped_column(Float, nullable=False)
    network_activity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    metrics_raw: Mapped[Dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    machine: Mapped[Machine] = relationship(back_populates="scans")
    apps: Mapped[List["App"]] = relationship(
        back_populates="scan",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    drivers: Mapped[List["Driver"]] = relationship(
        back_populates="scan",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_scan_results_machine_timestamp", "machine_id", "timestamp"),
    )


class App(Base):
    __tablename__ = "apps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("scan_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    current_version: Mapped[str] = mapped_column(String(80), nullable=False)
    latest_version: Mapped[str] = mapped_column(String(80), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    scan: Mapped[ScanResult] = relationship(back_populates="apps")


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("scan_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    driver_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    scan: Mapped[ScanResult] = relationship(back_populates="drivers")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    machine: Mapped[Machine] = relationship(back_populates="events")

    __table_args__ = (
        Index("ix_security_events_machine_timestamp", "machine_id", "timestamp"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    details: Mapped[Dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    machine: Mapped[Machine | None] = relationship(back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_machine_timestamp", "machine_id", "timestamp"),
    )


class MachineCommand(Base):
    __tablename__ = "machine_commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    command_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True, default="queued")
    payload: Mapped[Dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[Dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    requested_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    machine: Mapped[Machine] = relationship(back_populates="commands")

    __table_args__ = (
        Index("ix_machine_commands_machine_status_created", "machine_id", "status", "created_at"),
    )
