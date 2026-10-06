import pytest
from fastapi.testclient import TestClient
from server.main import app, seed_initial_admin
from server.app.core.database import init_db

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    seed_initial_admin()


def test_full_telemetry_ingestion_and_fleet_aggregation():
    # 1. Admin login & token generation
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
    )
    assert login_resp.status_code == 200
    admin_token = login_resp.json()["access_token"]
    org_id = login_resp.json()["user"]["org_id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    tok_resp = client.post(
        "/api/v2/admin/enrollment-tokens",
        json={"org_id": org_id, "name": "Telemetry Ingestion Test Token", "expires_days": 1, "max_uses": 2},
        headers=admin_headers,
    )
    raw_enroll_token = tok_resp.json()["token"]

    # 2. Agent enrolls
    agent_resp = client.post(
        "/api/v2/agent/enroll",
        json={
            "enrollment_token": raw_enroll_token,
            "hostname": "LAB-PC-02",
            "os_name": "Windows",
            "os_version": "11 (22631)",
            "ip_address": "192.168.1.102",
            "agent_version": "2.0.0",
        },
    )
    assert agent_resp.status_code == 200
    device_id = agent_resp.json()["device_id"]
    device_token = agent_resp.json()["device_token"]
    device_headers = {"X-Device-Token": device_token}

    # 3. Agent submits Telemetry
    telemetry_payload = {
        "device_id": device_id,
        "snapshot_type": "full",
        "software": [
            {
                "name": "Node.js",
                "version": "20.10.0",  # Latest is 22.11.0 -> Major diff 2 = Critical
                "publisher": "OpenJS Foundation",
                "install_path": "C:\\Program Files\\nodejs\\node.exe",
                "binary_sha256": "4b5c7e3f89012a456789abcdef0123456789abcdef0123456789abcdef012345",
                "signature_status": "Valid",
                "signer_name": "OpenJS Foundation",
            },
            {
                "name": "Google Chrome",
                "version": "128.0.6613.85",  # Up to date -> Low
                "publisher": "Google LLC",
                "install_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "binary_sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "signature_status": "Valid",
                "signer_name": "Google LLC",
            },
        ],
        "drivers": [
            {
                "device_name": "NVIDIA GeForce GTX 1050 Ti",
                "device_id_pnp": "PCI\\VEN_10DE&DEV_1C82",
                "error_code": 28,
                "reason": "The drivers for this device are not installed.",
                "impact": "Medium",
                "risk_score": 50,
                "status": "Missing",
                "manufacturer": "NVIDIA",
                "is_disabled": False,
            }
        ],
        "system_metrics": {
            "cpu_model": "Intel Core i7-12700K",
            "cpu_cores": 12,
            "ram_total_gb": 32.0,
            "disk_total_gb": 1000.0,
            "disk_free_gb": 650.0,
            "uptime_seconds": 3600,
        },
    }

    ingest_resp = client.post(
        "/api/v2/agent/telemetry",
        json=telemetry_payload,
        headers=device_headers,
    )
    assert ingest_resp.status_code == 200
    ingest_data = ingest_resp.json()
    assert ingest_data["success"] is True
    assert ingest_data["processed_software"] == 2
    assert ingest_data["processed_drivers"] == 1
    assert ingest_data["critical_risks"] == 1  # Node.js 20->22 is Critical

    # 4. Verify Admin Device Detail
    detail_resp = client.get(f"/api/v2/admin/devices/{device_id}", headers=admin_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["hostname"] == "LAB-PC-02"
    assert len(detail["software"]) == 2
    node_sw = next(s for s in detail["software"] if "Node" in s["name"])
    assert node_sw["risk_level"] == "Critical"
    assert len(detail["drivers"]) == 1
    assert detail["drivers"][0]["error_code"] == 28

    # 5. Verify Fleet Overview Aggregation
    fleet_resp = client.get("/api/v2/admin/fleet/overview", headers=admin_headers)
    assert fleet_resp.status_code == 200
    fleet = fleet_resp.json()
    assert fleet["total_devices"] >= 1
    assert fleet["critical_risk_devices"] >= 1
    assert any(app["app_name"] == "Node.js" for app in fleet["top_outdated_apps"])
    assert any("NVIDIA" in drv["device_name"] for drv in fleet["top_missing_drivers"])
