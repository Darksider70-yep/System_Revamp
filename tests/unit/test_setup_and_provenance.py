import datetime
import pytest
from fastapi.testclient import TestClient
from server.main import app, seed_initial_admin
from server.app.core.database import init_db, SessionLocal
from server.app.core.config import settings
from server.app.models.models import AdminUser, LatestVersionCache
from server.app.services.risk_engine import evaluate_software_risk

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()
    seed_initial_admin()


def test_setup_status_endpoint():
    resp = client.get("/api/v2/auth/setup-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "setup_required" in data
    assert "admin_count" in data
    assert data["admin_count"] >= 1
    assert data["setup_required"] is False

    # Attempting setup when admin already exists must return 400
    setup_attempt = client.post(
        "/api/v2/auth/setup",
        json={
            "org_name": "Test Org",
            "admin_email": "newadmin@test.local",
            "admin_password": "SecurePassword123",
            "admin_name": "Test Admin",
        },
    )
    assert setup_attempt.status_code == 400
    assert "already been completed" in setup_attempt.json()["detail"]


def test_threats_overview_provenance_and_keyless_behavior():
    # Login as admin
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Overview endpoint contains honest provenance
    resp = client.get("/api/v2/threats/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "vt_api_configured" in data
    assert "source" in data
    assert "fetched_at" in data
    assert "status_message" in data

    # Triggering queue when VT API key is not set returns honest 400 error
    old_key = settings.VIRUSTOTAL_API_KEY
    try:
        settings.VIRUSTOTAL_API_KEY = None
        queue_resp = client.post("/api/v2/threats/process-queue", headers=headers)
        assert queue_resp.status_code == 400
        assert "VT_API_KEY" in queue_resp.json()["detail"]
    finally:
        settings.VIRUSTOTAL_API_KEY = old_key


def test_fleet_overview_provenance_fields():
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v2/admin/fleet/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "source" in data
    assert data["source"] == "fleet_telemetry"
    assert "fetched_at" in data
    assert "stale" in data
    assert "status_message" in data


def test_evaluate_software_risk_provenance():
    db = SessionLocal()
    try:
        # Live connector returns real version from endoflife.date with provenance
        ver, risk, src, fetched, is_stale = evaluate_software_risk("Node.js", "20.10.0", db)
        assert ver is not None and ver != "Unknown"
        assert risk == "Critical"
        assert src in ("endoflife.date", "nodejs.org")
        assert is_stale is False

        # Test database cache lookup
        db.query(LatestVersionCache).filter(LatestVersionCache.app_name == "customapp").delete()
        db.add(
            LatestVersionCache(
                app_name="customapp",
                latest_version="3.5.0",
                source="winget",
                fetched_at=datetime.datetime.utcnow(),
                ttl_seconds=86400,
                is_stale=False,
            )
        )
        db.commit()

        ver2, risk2, src2, fetched2, is_stale2 = evaluate_software_risk("customapp", "3.4.0", db)
        assert ver2 == "3.5.0"
        assert risk2 == "Medium"
        assert src2 == "winget"
        assert is_stale2 is False
    finally:
        db.close()
