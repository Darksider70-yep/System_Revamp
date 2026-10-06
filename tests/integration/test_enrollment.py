import pytest
from fastapi.testclient import TestClient
from server.main import app, seed_initial_admin
from server.app.core.database import init_db, SessionLocal
from server.app.models.models import Organization, Site, Lab, AdminUser, EnrollmentToken, Device

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    seed_initial_admin()


def test_admin_login_and_token_creation():
    # 1. Login as SuperAdmin
    resp = client.post(
        "/api/v2/auth/login",
        json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    jwt_token = data["access_token"]
    org_id = data["user"]["org_id"]

    headers = {"Authorization": f"Bearer {jwt_token}"}

    # 2. Create an Enrollment Token
    tok_resp = client.post(
        "/api/v2/admin/enrollment-tokens",
        json={
            "org_id": org_id,
            "name": "Integration Test Token",
            "expires_days": 7,
            "max_uses": 5,
        },
        headers=headers,
    )
    assert tok_resp.status_code == 200
    token_data = tok_resp.json()
    raw_enroll_token = token_data["token"]
    assert raw_enroll_token.startswith("sr_enroll_")

    # 3. Agent enrolls with the token
    agent_resp = client.post(
        "/api/v2/agent/enroll",
        json={
            "enrollment_token": raw_enroll_token,
            "hostname": "LAB-PC-01",
            "os_name": "Windows",
            "os_version": "11 (22631)",
            "ip_address": "192.168.1.101",
            "agent_version": "2.0.0",
        },
    )
    assert agent_resp.status_code == 200
    agent_data = agent_resp.json()
    device_id = agent_data["device_id"]
    device_token = agent_data["device_token"]
    assert device_token.startswith("sr_dev_")

    # 4. Agent sends heartbeat with device token
    hb_resp = client.post(
        "/api/v2/agent/heartbeat",
        json={"device_id": device_id, "ip_address": "192.168.1.101", "uptime_seconds": 1200},
        headers={"X-Device-Token": device_token},
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "ok"

    # 5. Admin lists devices and sees LAB-PC-01
    dev_resp = client.get("/api/v2/admin/devices", headers=headers)
    assert dev_resp.status_code == 200
    dev_list = dev_resp.json()
    assert any(d["hostname"] == "LAB-PC-01" for d in dev_list)
