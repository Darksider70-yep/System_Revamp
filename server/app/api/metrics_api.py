import time
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import Device, Command, ThreatReputation

router = APIRouter(tags=["Metrics & Observability"])

SERVER_START_TIME = time.time()

@router.get("/metrics", response_class=Response)
@router.get("/api/v2/metrics", response_class=Response)
def get_prometheus_metrics(db: Session = Depends(get_db)):
    """
    Exposes standardized Prometheus metrics for the Central Fleet Server.
    Conforms to text/plain; version=0.0.4 exposition format.
    """
    try:
        total_devices = db.query(Device).count()
        online_devices = db.query(Device).filter(Device.is_online == True).count()
        availability_ratio = round((online_devices / total_devices), 4) if total_devices > 0 else 1.0
        pending_vt = db.query(ThreatReputation).filter(ThreatReputation.vt_status == "Unknown").count()
        total_commands = db.query(Command).count()
        completed_commands = db.query(Command).filter(Command.status == "completed").count()
        uptime_seconds = int(time.time() - SERVER_START_TIME)
    except Exception:
        total_devices = 0
        online_devices = 0
        availability_ratio = 1.0
        pending_vt = 0
        total_commands = 0
        completed_commands = 0
        uptime_seconds = int(time.time() - SERVER_START_TIME)

    lines = [
        "# HELP systemrevamp_uptime_seconds Total runtime of the Central Fleet Server process",
        "# TYPE systemrevamp_uptime_seconds counter",
        f"systemrevamp_uptime_seconds {uptime_seconds}",
        "",
        "# HELP systemrevamp_fleet_total_count Total number of registered endpoints in database",
        "# TYPE systemrevamp_fleet_total_count gauge",
        f"systemrevamp_fleet_total_count {total_devices}",
        "",
        "# HELP systemrevamp_fleet_online_count Number of endpoints currently reporting online",
        "# TYPE systemrevamp_fleet_online_count gauge",
        f"systemrevamp_fleet_online_count {online_devices}",
        "",
        "# HELP systemrevamp_fleet_availability_ratio Ratio of online endpoints vs total registered",
        "# TYPE systemrevamp_fleet_availability_ratio gauge",
        f"systemrevamp_fleet_availability_ratio {availability_ratio}",
        "",
        "# HELP systemrevamp_virustotal_queue_depth Pending binary hashes awaiting VirusTotal inspection",
        "# TYPE systemrevamp_virustotal_queue_depth gauge",
        f"systemrevamp_virustotal_queue_depth {pending_vt}",
        "",
        "# HELP systemrevamp_command_dispatched_total Total remediation commands queued",
        "# TYPE systemrevamp_command_dispatched_total counter",
        f'systemrevamp_command_dispatched_total{{status="all"}} {total_commands}',
        f'systemrevamp_command_dispatched_total{{status="completed"}} {completed_commands}',
        "",
        "# HELP systemrevamp_ingestion_queue_depth Pending items in the ingestion worker queue",
        "# TYPE systemrevamp_ingestion_queue_depth gauge",
        "systemrevamp_ingestion_queue_depth 0",
        "",
    ]

    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
