# System Revamp v2.0 — Python SDK & Scripting Automation Guide

<p align="center">
  <strong>Production Python Integration Examples, Client Wrapper Classes, Batch Provisioning, and Streaming SSE Consumers</strong>
</p>

---

## 1. Overview & Setup

System Revamp v2.0 exposes a clean RESTful and SSE API. While the React 18 Admin Console serves interactive operations, system administrators, DevOps engineers, and SecOps teams can automate fleet operations using Python (3.10+).

### Installation of Prerequisites
```bash
pip install httpx requests
```

---

## 2. Reusable System Revamp Python Client

Below is a complete, production-ready Python client class encapsulating authentication, automatic token refresh, error handling, and core fleet operations:

```python
"""
system_revamp_client.py
Production Python SDK wrapper for System Revamp Central Fleet Server.
"""

import time
from typing import Dict, Any, List, Optional
import httpx

class SystemRevampClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.client = httpx.Client(base_url=self.base_url, timeout=15.0)

    # ---------------------------------------------------------
    # Authentication & Session Management
    # ---------------------------------------------------------
    def login(self, email: str, password: str, totp_code: Optional[str] = None) -> Dict[str, Any]:
        """Authenticate as an Administrator with optional 2FA TOTP."""
        payload = {"email": email, "password": password}
        resp = self.client.post("/api/v2/auth/login", json=payload)
        resp.raise_for_status()
        data = resp.json()

        if data.get("requires_2fa"):
            if not totp_code:
                raise ValueError("2FA TOTP code required for this administrative account.")
            verify_payload = {
                "temp_token": data["temp_token"],
                "totp_code": totp_code
            }
            v_resp = self.client.post("/api/v2/auth/2fa/verify", json=verify_payload)
            v_resp.raise_for_status()
            data = v_resp.json()

        self.access_token = data["access_token"]
        self.refresh_token = data.get("refresh_token")
        self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})
        return data

    def refresh_session(self) -> None:
        """Refresh the JWT access token using the active refresh token."""
        if not self.refresh_token:
            raise ValueError("No refresh token available. Re-login required.")
        resp = self.client.post("/api/v2/auth/refresh", json={"refresh_token": self.refresh_token})
        resp.raise_for_status()
        data = resp.json()
        self.access_token = data["access_token"]
        self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})

    # ---------------------------------------------------------
    # Provisioning & Token Management
    # ---------------------------------------------------------
    def create_enrollment_token(
        self,
        lab_id: str,
        name: str = "Bulk Lab Deployment",
        max_uses: int = 50,
        expires_in_hours: int = 72
    ) -> Dict[str, Any]:
        """Provision a scoped enrollment token for computer lab deployment."""
        payload = {
            "lab_id": lab_id,
            "name": name,
            "max_uses": max_uses,
            "expires_in_hours": expires_in_hours
        }
        resp = self.client.post("/api/v2/admin/enrollment-tokens", json=payload)
        resp.raise_for_status()
        return resp.json()

    # ---------------------------------------------------------
    # Fleet Querying & Inventory
    # ---------------------------------------------------------
    def get_fleet_overview(self) -> Dict[str, Any]:
        """Fetch fleet KPI statistics (total hosts, online ratio, critical CVEs)."""
        resp = self.client.get("/api/v2/admin/fleet/overview")
        resp.raise_for_status()
        return resp.json()

    def list_devices(self, lab_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List managed endpoints with optional filtering."""
        params = {}
        if lab_id:
            params["lab_id"] = lab_id
        if status:
            params["status"] = status
        resp = self.client.get("/api/v2/admin/devices", params=params)
        resp.raise_for_status()
        return resp.json().get("items", [])

    def get_device_details(self, device_id: str) -> Dict[str, Any]:
        """Retrieve deep inspection details for a single workstation."""
        resp = self.client.get(f"/api/v2/admin/devices/{device_id}")
        resp.raise_for_status()
        return resp.json()

    # ---------------------------------------------------------
    # Remediation Command Management
    # ---------------------------------------------------------
    def queue_command(
        self,
        device_id: str,
        command_type: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Queue a remediation command on an endpoint."""
        payload = {
            "device_id": device_id,
            "command_type": command_type,
            "params": params
        }
        resp = self.client.post("/api/v2/commands/queue", json=payload)
        resp.raise_for_status()
        return resp.json()

    def approve_command(self, command_id: str) -> Dict[str, Any]:
        """Approve a queued command and compute server HMAC signature."""
        resp = self.client.post(f"/api/v2/commands/{command_id}/approve")
        resp.raise_for_status()
        return resp.json()
```

---

## 3. Practical Automation Workflows

### 3.1 Script 1: Automated Health Check & Offline Workstation Alerting
This script inspects all computer labs and prints a list of offline workstations:

```python
#!/usr/bin/env python3
# check_offline_fleet.py

from system_revamp_client import SystemRevampClient

def main():
    client = SystemRevampClient("https://fleet.university.edu")
    client.login("admin@systemrevamp.local", "YourSecurePasswordHere")

    overview = client.get_fleet_overview()
    print(f"Total Fleet: {overview['total_endpoints']} | Online: {overview['online_endpoints']}")
    print(f"Availability: {overview['fleet_availability_ratio'] * 100:.1f}%\n")

    devices = client.list_devices(status="offline")
    if not devices:
        print("[OK] All monitored workstations are online!")
        return

    print(f"[ALERT] {len(devices)} workstations currently offline:")
    for d in devices:
        print(f" - Host: {d['hostname']:<20} | Lab: {d.get('lab_name', 'Unknown'):<15} | Last Seen: {d.get('last_seen', 'Never')}")

if __name__ == "__main__":
    main()
```

---

### 3.2 Script 2: Automated Bulk Remediation Dispatch
Queues and approves a silent package update for all workstations reporting an outdated application:

```python
#!/usr/bin/env python3
# dispatch_bulk_update.py

from system_revamp_client import SystemRevampClient

TARGET_PACKAGE = "Git.Git"

def main():
    client = SystemRevampClient("https://fleet.university.edu")
    client.login("admin@systemrevamp.local", "YourSecurePasswordHere")

    devices = client.list_devices()
    queued_count = 0

    for dev in devices:
        device_id = dev["id"]
        details = client.get_device_details(device_id)
        installed_software = details.get("software", [])

        # Check if workstation has Git installed
        has_git = any(pkg.get("name", "").lower() == "git" for pkg in installed_software)
        if has_git:
            print(f"Queueing update for {dev['hostname']} ({device_id})...")
            cmd = client.queue_command(
                device_id=device_id,
                command_type="run-package-update",
                params={"package_id": TARGET_PACKAGE, "silent": True}
            )
            # Auto-approve for staged rollout
            client.approve_command(cmd["command_id"])
            queued_count += 1

    print(f"\n[SUCCESS] Successfully queued and approved updates for {queued_count} workstations.")

if __name__ == "__main__":
    main()
```

---

### 3.3 Script 3: Real-Time SSE Exposure Stream Consumer
Demonstrates how to fetch a single-use ephemeral ticket and consume live vulnerability streaming events asynchronously using `httpx`:

```python
#!/usr/bin/env python3
# stream_exposure_events.py

import asyncio
import json
import httpx

SERVER_URL = "https://fleet.university.edu"
ADMIN_TOKEN = "your_jwt_bearer_token_here"
TARGET_DEVICE_ID = "wks-eng-104"

async def stream_live_exposure():
    async with httpx.AsyncClient(base_url=SERVER_URL, timeout=None) as client:
        # Step 1: Request single-use ephemeral ticket
        ticket_resp = await client.post(
            "/api/v2/exposure/ticket",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
        )
        ticket_resp.raise_for_status()
        ticket = ticket_resp.json()["ticket"]
        print(f"[OK] Ephemeral single-use ticket acquired: {ticket[:16]}...")

        # Step 2: Open SSE stream using the single-use ticket query parameter
        stream_url = f"/api/v2/exposure/stream/{TARGET_DEVICE_ID}?ticket={ticket}"
        print(f"[OK] Connecting to SSE stream for {TARGET_DEVICE_ID}...\n")

        async with client.stream("GET", stream_url) as response:
            if response.status_code != 200:
                print(f"[ERROR] Stream failed with status {response.status_code}")
                return

            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    raw_data = line[len("data:"):].strip()
                    if raw_data:
                        try:
                            event = json.loads(raw_data)
                            status = event.get("status", "progress")
                            pkg = event.get("package", "system")
                            cve = event.get("cve_id", "N/A")
                            cvss = event.get("cvss", 0.0)
                            print(f"[{status.upper():<8}] Pkg: {pkg:<20} | CVE: {cve:<15} | CVSS: {cvss}")
                        except json.JSONDecodeError:
                            print(f"[RAW]: {raw_data}")

if __name__ == "__main__":
    asyncio.run(stream_live_exposure())
```
