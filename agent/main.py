import argparse
import json
import os
import platform
import socket
import sys
import time
from typing import Dict, Any

import requests

from agent.config import agent_config
from agent.enrollment import enroll
from agent.queue import enqueue_report, flush_queue
from agent.collectors.system import collect_system_metrics
from agent.collectors.software import collect_installed_software
from agent.collectors.drivers import collect_drivers
from agent.collectors.protection import audit_software_binary
from agent.commands.executor import dispatch_command


def run_full_scan() -> Dict[str, Any]:
    print("[AGENT] 🔍 Starting full system telemetry collection...")

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

    print(f"[AGENT] 📊 Collected {len(processed_software)} software items, {len(drivers)} drivers.")
    return report


def scan_and_report() -> bool:
    if not agent_config.is_enrolled():
        print("[AGENT] ❌ Device not enrolled. Cannot report telemetry.")
        return False

    report = run_full_scan()
    enqueue_report("telemetry", report)
    flushed = flush_queue()
    print(f"[AGENT] 📤 Telemetry report sent to server ({len(report['software'])} apps, {len(report['drivers'])} drivers).")
    return True


def poll_and_execute_commands():
    """Polls central server for HMAC-signed commands and executes allowlisted actions."""
    if not agent_config.is_enrolled():
        return

    url = f"{agent_config.server_url}/api/v2/agent/commands"
    headers = {
        "X-Device-Token": agent_config.device_token,
        "Content-Type": "application/json",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code != 200:
            return

        commands = resp.json()
        if not commands:
            return

        for cmd in commands:
            cmd_id = cmd["id"]
            cmd_type = cmd["command_type"]
            params = cmd.get("params", {})
            dry_run = cmd.get("dry_run", False)

            print(f"[AGENT] 📥 Command received: '{cmd_type}' (ID: {cmd_id}) [Dry-Run: {dry_run}]")

            # Execute via allowlist dispatcher
            success, result_data, log_output = dispatch_command(cmd_type, params, dry_run=dry_run)
            status_label = "success" if success else "failed"

            # If remediation action succeeded, trigger immediate post-remediation scan for verification
            if success and not dry_run and cmd_type in ("rescan", "enable-device", "scan-drivers", "upgrade-package"):
                print(f"[AGENT] 🔄 Triggering post-remediation verification telemetry scan for '{cmd_type}'...")
                scan_and_report()

            print(f"[AGENT] ⚙️ Command executed: {status_label.upper()} -> {log_output.strip()[:100]}")

            # Submit result back
            result_payload = {
                "command_id": cmd_id,
                "status": status_label,
                "result": result_data,
                "execution_log": log_output,
            }

            res_resp = requests.post(
                f"{agent_config.server_url}/api/v2/agent/commands/result",
                json=result_payload,
                headers=headers,
                timeout=10,
            )
            if res_resp.status_code == 200:
                print(f"[AGENT] ✅ Result for command '{cmd_type}' submitted to server.")

    except Exception as e:
        # Silent ignore on network transient errors
        pass


def send_heartbeat():
    if not agent_config.is_enrolled():
        return

    try:
        headers = {"X-Device-Token": agent_config.device_token}
        requests.post(
            f"{agent_config.server_url}/api/v2/agent/heartbeat",
            json={
                "device_id": agent_config.device_id,
                "ip_address": socket.gethostbyname(socket.gethostname()) if platform.system() == "Windows" else "127.0.0.1",
            },
            headers=headers,
            timeout=5,
        )
    except Exception:
        pass


def run_daemon(demo_fast: bool = False):
    if not agent_config.is_enrolled():
        print("[AGENT] ❌ Error: Agent is not enrolled. Run 'python -m agent.main enroll --token <token>' first.")
        sys.exit(1)

    if demo_fast or agent_config.is_demo_fast:
        agent_config.set_demo_fast_mode(True)
        print("[AGENT] ⚡ Demo-Fast mode ACTIVE (Heartbeat: 10s, Command Poll: 5s, Scan: 30s)")

    hostname = socket.gethostname()
    print(f"[AGENT] 🚀 Starting System Revamp Agent Daemon")
    print(f"[AGENT] 🖥️  Hostname: {hostname} | Device GUID: {agent_config.device_id}")
    print(f"[AGENT] 🌐 Central Server URL: {agent_config.server_url}")

    # Initial scan on startup
    scan_and_report()

    last_scan_time = time.time()
    last_heartbeat_time = 0
    last_command_poll_time = 0

    while True:
        now = time.time()

        # Heartbeat
        if now - last_heartbeat_time >= agent_config.heartbeat_interval_seconds:
            send_heartbeat()
            last_heartbeat_time = now

        # Command Polling
        if now - last_command_poll_time >= agent_config.command_poll_interval_seconds:
            poll_and_execute_commands()
            last_command_poll_time = now

        # Full Telemetry Scan
        if now - last_scan_time >= agent_config.poll_interval_seconds:
            scan_and_report()
            last_scan_time = now

        # Offline queue retry
        flush_queue()

        time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description="System Revamp Endpoint Agent")
    subparsers = parser.add_subparsers(dest="command")

    # Enroll command
    enroll_parser = subparsers.add_parser("enroll", help="Enroll this device with the central server")
    enroll_parser.add_argument("--server", default="http://127.0.0.1:8000", help="Central server URL")
    enroll_parser.add_argument("--token", required=True, help="One-time enrollment token")
    enroll_parser.add_argument("--demo-fast", action="store_true", help="Enable fast demo polling intervals")

    # Scan command
    subparsers.add_parser("scan", help="Run a manual on-demand scan and report to server")

    # Daemon command
    daemon_parser = subparsers.add_parser("run-daemon", help="Run agent continuously in background")
    daemon_parser.add_argument("--demo-fast", action="store_true", help="Enable fast demo polling intervals")

    args = parser.parse_args()

    if args.command == "enroll":
        if args.demo_fast:
            agent_config.set_demo_fast_mode(True)
        success = enroll(args.server, args.token)
        if success:
            hostname = socket.gethostname()
            print(f"[AGENT] 🎉 Enrolled as {hostname} ({agent_config.device_id})")
            print("[AGENT] Performing initial baseline scan...")
            scan_and_report()
            print(f"[AGENT] Enrolled as {hostname}, first report sent.")
        sys.exit(0 if success else 1)
    elif args.command == "scan":
        scan_and_report()
    elif args.command == "run-daemon":
        run_daemon(demo_fast=args.demo_fast)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
