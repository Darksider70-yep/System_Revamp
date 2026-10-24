#!/usr/bin/env python3
"""
System Revamp v2.0 - Offline Fleet Checker
==========================================
Queries the Central Fleet Server and reports offline workstations across all computer labs.
"""

import sys
import os
from pathlib import Path

# Ensure local script directory is in path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))
from system_revamp_client import SystemRevampClient

def main():
    server_url = os.getenv("SERVER_URL", "http://127.0.0.1:8000")
    admin_email = os.getenv("ADMIN_EMAIL", "admin@systemrevamp.local")
    admin_pass = os.getenv("ADMIN_PASSWORD", "Admin@123456")

    print(f"Connecting to System Revamp Server: {server_url}...")
    client = SystemRevampClient(server_url)
    try:
        client.login(admin_email, admin_pass)
    except Exception as e:
        print(f"[ERROR] Failed to authenticate with server: {e}")
        sys.exit(1)

    overview = client.get_fleet_overview()
    print(f"Total Fleet: {overview.get('total_endpoints', 0)} | Online: {overview.get('online_endpoints', 0)}")
    print(f"Availability Ratio: {overview.get('fleet_availability_ratio', 1.0) * 100:.1f}%\n")

    devices = client.list_devices(status="offline")
    if not devices:
        print("[OK] All monitored workstations are online!")
        return

    print(f"[ALERT] {len(devices)} workstations currently offline:")
    for d in devices:
        print(f" - Host: {d.get('hostname', 'Unknown'):<20} | Lab: {d.get('lab_name', 'Unknown'):<15} | Last Seen: {d.get('last_seen', 'Never')}")

if __name__ == "__main__":
    main()
