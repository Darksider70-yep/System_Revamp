import pytest
from fastapi.testclient import TestClient
from server.main import app, seed_initial_admin
from server.app.core.database import init_db, SessionLocal
from server.app.models.models import (
    LatestVersionCache,
    VulnerabilityCatalog,
    Device,
    DeviceSoftware,
    Lab,
    Site,
    Organization,
)
from server.app.services.version_connectors import resolve_latest_version
from server.app.services.cve_connectors import (
    query_osv_vulnerabilities,
    sync_and_check_app_vulnerabilities,
)
from agent.collectors.drivers import _classify_impact

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()
    seed_initial_admin()


def test_driver_classification_by_standard_class_guid():
    # DiskDrive GUID -> Critical
    assert _classify_impact("NVMe SSD", "", "{4d36e967-e325-11ce-bfc1-08002be10318}") == "Critical"
    # Network GUID -> High
    assert _classify_impact("Ethernet Controller", "", "{4d36e972-e325-11ce-bfc1-08002be10318}") == "High"
    # Display GPU GUID -> Medium
    assert _classify_impact("Graphics Adapter", "", "{4d36e968-e325-11ce-bfc1-08002be10318}") == "Medium"
    # PrintQueue GUID -> Low
    assert _classify_impact("Office Printer", "", "{1ed2bbf9-11f0-4084-b21f-b054a77d616e}") == "Low"
    # Setup Class name fallback
    assert _classify_impact("Unknown", "Net") == "High"
    assert _classify_impact("Unknown", "DiskDrive") == "Critical"


def test_version_connector_and_caching():
    db = SessionLocal()
    try:
        # 1. Resolve python version via connector
        ver, source, fetched_at, is_stale = resolve_latest_version("python", db)
        assert ver is not None and ver != "Unknown"
        assert source == "endoflife.date"
        assert is_stale is False

        # 2. Verify it is cached in the DB table
        cached = db.query(LatestVersionCache).filter(LatestVersionCache.app_name == "python").first()
        assert cached is not None
        assert cached.latest_version == ver
        assert cached.source == "endoflife.date"

        # 3. Second call returns from DB cache immediately
        ver2, source2, _, is_stale2 = resolve_latest_version("python", db)
        assert ver2 == ver
        assert source2 == source
        assert is_stale2 is False
    finally:
        db.close()


def test_osv_cve_connector_live():
    db = SessionLocal()
    try:
        # Test OSV live query for requests package
        vulns = query_osv_vulnerabilities("requests", "2.19.0")
        assert isinstance(vulns, list)
        assert len(vulns) > 0
        first_vuln = vulns[0]
        assert "cve_id" in first_vuln
        assert first_vuln["source"] == "osv.dev"
        assert "cvss_score" in first_vuln

        # Test sync_and_check_app_vulnerabilities writes to VulnerabilityCatalog
        matches = sync_and_check_app_vulnerabilities("requests", "2.19.0", db)
        assert len(matches) > 0
        assert any("cve_id" in m for m in matches)

        # Check DB catalog was populated
        db_entries = db.query(VulnerabilityCatalog).filter(VulnerabilityCatalog.app_name.ilike("%requests%")).all()
        assert len(db_entries) > 0
    finally:
        db.close()


def test_exposure_assessment_stream_with_live_connectors():
    db = SessionLocal()
    try:
        # Create a test device with software
        org = db.query(Organization).first()
        site = db.query(Site).first()
        lab = db.query(Lab).first()

        test_dev = Device(
            lab_id=lab.id,
            hostname="EXPOSURE-TEST-PC",
            os_name="Windows",
            os_version="11",
            device_token_hash="testhash",
            is_online=True,
        )
        db.add(test_dev)
        db.flush()

        db.add(
            DeviceSoftware(
                device_id=test_dev.id,
                app_name="requests",
                version="2.19.0",
                publisher="PSF",
                risk_level="High",
            )
        )
        db.commit()

        # Login to get admin token
        login_resp = client.post(
            "/api/v2/auth/login",
            json={"email": "admin@systemrevamp.local", "password": "Admin@123456"},
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request exposure ticket
        ticket_resp = client.post(
            f"/api/v2/exposure/token?device_id={test_dev.id}",
            headers=headers,
        )
        assert ticket_resp.status_code == 200
        ticket = ticket_resp.json()["ticket"]

        # Stream exposure assessment
        stream_resp = client.get(
            f"/api/v2/exposure/stream/{test_dev.id}?ticket={ticket}",
        )
        assert stream_resp.status_code == 200
        content = stream_resp.text
        assert "Starting Exposure Assessment" in content
        assert "Assessment Complete" in content
        assert "osv.dev" in content or "NVD" in content
    finally:
        db.close()
