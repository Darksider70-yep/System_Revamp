"""
System Revamp v2.0 - Python SDK Client Wrapper
==============================================
Production-ready API client for automating fleet operations,
command dispatches, and real-time exposure streaming.
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
