import re
import pytest
from fastapi.testclient import TestClient
from server.main import app
from server.app.core.database import SessionLocal
from server.app.models.models import VulnerabilityCatalog, AdminUser
from server.app.auth.jwt_handler import create_access_token
import scripts.verify_no_mocks as verify_tool


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header():
    db = SessionLocal()
    try:
        admin = db.query(AdminUser).first()
        if not admin:
            token = create_access_token(data={"sub": "admin-system-id", "role": "SuperAdmin"})
        else:
            token = create_access_token(data={"sub": admin.id, "role": admin.role, "org_id": admin.org_id})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_lineage_contract_endpoints_registered():
    """Verify all core endpoints documented in DATA_LINEAGE.md are registered in FastAPI."""
    routes = [route.path for route in app.routes]

    expected_endpoints = [
        "/api/v2/admin/fleet/overview",
        "/api/v2/admin/fleet/software",
        "/api/v2/admin/fleet/drivers",
        "/api/v2/admin/devices",
        "/api/v2/admin/hierarchy",
        "/api/v2/admin/reports/compliance",
        "/api/v2/admin/reports/export",
        "/api/v2/admin/audit-logs",
        "/api/v2/admin/enrollment-tokens",
        "/api/v2/commands/queue",
        "/api/v2/commands/history",
        "/api/v2/threats/overview",
        "/api/v2/auth/login",
        "/api/v2/auth/setup-status",
    ]

    for endpoint in expected_endpoints:
        assert endpoint in routes, f"Endpoint {endpoint} documented in DATA_LINEAGE.md is not registered in FastAPI routes!"


def test_fleet_endpoints_honest_structure(client, auth_header):
    """Verify fleet endpoints return authentic real schema without fabrication."""
    # 1. Fleet Overview
    res = client.get("/api/v2/admin/fleet/overview", headers=auth_header)
    assert res.status_code == 200
    data = res.json()
    assert "total_devices" in data
    assert "online_devices" in data
    assert "critical_risk_devices" in data
    assert "compliance_percent" in data
    assert isinstance(data["top_outdated_apps"], list)
    assert isinstance(data["top_missing_drivers"], list)

    # 2. Fleet Software
    res_sw = client.get("/api/v2/admin/fleet/software", headers=auth_header)
    assert res_sw.status_code == 200
    assert isinstance(res_sw.json(), list)

    # 3. Fleet Drivers
    res_drv = client.get("/api/v2/admin/fleet/drivers", headers=auth_header)
    assert res_drv.status_code == 200
    assert isinstance(res_drv.json(), list)

    # 4. Threats Overview
    res_threats = client.get("/api/v2/threats/overview", headers=auth_header)
    assert res_threats.status_code == 200
    threats_data = res_threats.json()
    assert "total_unique_hashes" in threats_data
    assert "flagged_threats" in threats_data
    assert "vt_api_configured" in threats_data

    # 5. Commands History
    res_cmd = client.get("/api/v2/commands/history", headers=auth_header)
    assert res_cmd.status_code == 200
    assert isinstance(res_cmd.json(), list)

    # 6. Devices List
    res_dev = client.get("/api/v2/admin/devices", headers=auth_header)
    assert res_dev.status_code == 200
    assert isinstance(res_dev.json(), list)


def test_vulnerability_catalog_real_cve_identifiers():
    """Verify vulnerability catalog only contains legitimate real-world CVE syntax, zero placeholders."""
    db = SessionLocal()
    try:
        cves = db.query(VulnerabilityCatalog).all()
        cve_regex = re.compile(r"^CVE-\d{4}-\d{4,7}$")

        for entry in cves:
            assert cve_regex.match(entry.cve_id), f"Invalid or placeholder CVE ID detected: {entry.cve_id}"
            assert "XXXX" not in entry.cve_id
            assert entry.cve_id != "CVE-2023-12345"
            assert entry.cve_id != "CVE-2024-99999"
            assert entry.cvss_score >= 0.0 and entry.cvss_score <= 10.0
            assert entry.severity.upper() in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    finally:
        db.close()


def test_static_ci_guard_passes():
    """Programmatic execution of verify_no_mocks scanner to ensure CI check passes in test suite."""
    exit_code = verify_tool.main()
    assert exit_code == 0, "verify_no_mocks tool reported violations!"
