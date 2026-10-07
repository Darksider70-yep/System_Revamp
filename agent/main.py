import argparse
import sys
import time
from typing import Dict, Any

from agent.config import agent_config
from agent.enrollment import enroll
from agent.queue import enqueue_report, flush_queue
from agent.collectors.system import collect_system_metrics
from agent.collectors.software import collect_installed_software
from agent.collectors.drivers import collect_drivers
from agent.collectors.protection import audit_software_binary


def run_full_scan() -> Dict[str, Any]:
    print("[AGENT] Starting full system telemetry collection...")
    
    # 1. System metrics
    sys_metrics = collect_system_metrics()
    
    # 2. Software collection + Binary audit
    raw_software = collect_installed_software()
    processed_software = []
    for sw in raw_software:
        audit = audit_software_binary(sw.get("install_path", ""))
        processed_software.append({
            "name": sw["name"],
            "version": sw["version"],
            "publisher": sw.get("publisher", ""),
            "install_path": sw.get("install_path", ""),
            "binary_sha256": audit["binary_sha256"],
            "signature_status": audit["signature_status"],
            "signer_name": audit["signer_name"],
        })

    # 3. Drivers collection
    drivers = collect_drivers()

    report = {
        "device_id": agent_config.device_id,
        "snapshot_type": "full",
        "software": processed_software,
        "drivers": drivers,
        "system_metrics": sys_metrics,
    }

    print(f"[AGENT] Collected {len(processed_software)} software items, {len(drivers)} drivers.")
    return report


def scan_and_report():
    if not agent_config.is_enrolled():
        print("[AGENT] Device not enrolled. Cannot report telemetry.")
        return

    report = run_full_scan()
    enqueue_report("telemetry", report)
    flushed = flush_queue()
    print(f"[AGENT] Telemetry queued. Flushed {flushed} pending reports to server.")


def run_daemon():
    if not agent_config.is_enrolled():
        print("[AGENT] Error: Agent is not enrolled. Run 'python -m agent.main enroll --token <token>' first.")
        sys.exit(1)

    print(f"[AGENT] Starting System Revamp Agent Daemon (Device ID: {agent_config.device_id})")
    print(f"[AGENT] Polling server: {agent_config.server_url}")

    # Initial scan on startup
    scan_and_report()

    last_scan_time = time.time()
    last_heartbeat_time = 0

    while True:
        now = time.time()

        # Heartbeat every 60s
        if now - last_heartbeat_time >= agent_config.heartbeat_interval_seconds:
            try:
                import requests
                headers = {"X-Device-Token": agent_config.device_token}
                requests.post(
                    f"{agent_config.server_url}/api/v2/agent/heartbeat",
                    json={"device_id": agent_config.device_id},
                    headers=headers,
                    timeout=5,
                )
            except Exception:
                pass
            last_heartbeat_time = now

        # Full scan every poll interval
        if now - last_scan_time >= agent_config.poll_interval_seconds:
            scan_and_report()
            last_scan_time = now

        # Retry flushing offline queue
        flush_queue()

        time.sleep(10)


def main():
    parser = argparse.ArgumentParser(description="System Revamp Endpoint Agent")
    subparsers = parser.add_subparsers(dest="command")

    # Enroll command
    enroll_parser = subparsers.add_parser("enroll", help="Enroll this device with the central server")
    enroll_parser.add_argument("--server", default="http://127.0.0.1:8000", help="Central server URL")
    enroll_parser.add_argument("--token", required=True, help="One-time enrollment token")

    # Scan command
    subparsers.add_parser("scan", help="Run a manual on-demand scan and report to server")

    # Daemon command
    subparsers.add_parser("run-daemon", help="Run agent continuously in background")

    args = parser.parse_args()

    if args.command == "enroll":
        success = enroll(args.server, args.token)
        sys.exit(0 if success else 1)
    elif args.command == "scan":
        scan_and_report()
    elif args.command == "run-daemon":
        run_daemon()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
