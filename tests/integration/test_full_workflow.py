import pytest
from fastapi.testclient import TestClient
from server.main import app, seed_initial_admin
from server.app.core.database import init_db
from agent.commands.executor import dispatch_command

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()
    seed_initial_admin()


def test_complete_end_to_end_fleet_lifecycle():
    # 1. SuperAdmin Login
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    org_id = login_resp.json()["user"]["org_id"]
    admin_headers = {"Authorization": f"Bearer {token}"}

    # 2. Admin creates Lab & Enrollment Token
    site_resp = client.get("/api/v2/admin/sites", headers=admin_headers)
    site_id = site_resp.json()[0]["id"]

    lab_resp = client.post(
        "/api/v2/admin/labs",
        json={"site_id": site_id, "name": "Cybersecurity Lab 3"},
        headers=admin_headers,
    )
    assert lab_resp.status_code == 200
    lab_id = lab_resp.json()["id"]

    tok_resp = client.post(
        "/api/v2/admin/enrollment-tokens",
        json={"org_id": org_id, "lab_id": lab_id, "name": "Lab 3 Token", "expires_days": 14, "max_uses": 30},
        headers=admin_headers,
    )
    assert tok_resp.status_code == 200
    enroll_token = tok_resp.json()["token"]

    # 3. Agent Enrolls
    enroll_resp = client.post(
        "/api/v2/agent/enroll",
        json={
            "enrollment_token": enroll_token,
            "hostname": "CYBER-LAB3-01",
            "os_name": "Windows",
            "os_version": "11 Pro",
            "ip_address": "10.0.3.15",
            "agent_version": "2.0.0",
        },
    )
    assert enroll_resp.status_code == 200
    device_id = enroll_resp.json()["device_id"]
    device_token = enroll_resp.json()["device_token"]
    device_headers = {"X-Device-Token": device_token}

    # 4. Agent ingests telemetry
    telemetry_resp = client.post(
        "/api/v2/agent/telemetry",
        json={
            "device_id": device_id,
            "snapshot_type": "full",
            "software": [
                {"name": "Python 3", "version": "3.8.0", "publisher": "Python Software Foundation"},
                {"name": "Node.js", "version": "20.10.0", "publisher": "OpenJS Foundation"},
            ],
            "drivers": [
                {"device_name": "Realtek Audio", "error_code": 10, "reason": "This device cannot start.", "impact": "Medium", "status": "Error"},
            ],
            "system_metrics": {"cpu_cores": 8, "ram_total_gb": 16.0, "disk_free_gb": 250.0},
        },
        headers=device_headers,
    )
    assert telemetry_resp.status_code == 200

    # 5. Admin queues dry-run package upgrade command
    cmd_resp = client.post(
        "/api/v2/commands/queue",
        json={
            "target_type": "device",
            "target_id": device_id,
            "command_type": "upgrade-package",
            "params": {"package_id": "Python.Python.3.13"},
            "dry_run": True,
        },
        headers=admin_headers,
    )
    assert cmd_resp.status_code == 200
    cmd_id = cmd_resp.json()["command_id"]

    # 6. Agent polls for commands
    poll_resp = client.get("/api/v2/agent/commands", headers=device_headers)
    assert poll_resp.status_code == 200
    polled_cmds = poll_resp.json()
    assert any(c["id"] == cmd_id for c in polled_cmds)

    target_cmd = next(c for c in polled_cmds if c["id"] == cmd_id)
    # Agent executes command
    success, result, log = dispatch_command(target_cmd["command_type"], target_cmd["params"], dry_run=target_cmd["dry_run"])
    assert success is True

    # 7. Agent submits result back to server
    sub_resp = client.post(
        "/api/v2/agent/commands/result",
        json={
            "command_id": cmd_id,
            "device_id": device_id,
            "status": "completed",
            "result": result,
            "execution_log": log,
        },
        headers=device_headers,
    )
    assert sub_resp.status_code == 200

    # 8. Exposure Assessment Ticket Generation
    ticket_resp = client.post(f"/api/v2/exposure/token?device_id={device_id}", headers=admin_headers)
    assert ticket_resp.status_code == 200
    ticket = ticket_resp.json()["ticket"]
    assert ticket is not None
