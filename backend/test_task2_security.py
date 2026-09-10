import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend directory is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Set test environment
os.environ["INTERNAL_API_KEY"] = "test-secret-key-12345"

# Import services
from scanner_service.main import app as scanner_app
from version_service.main import app as version_app
from protection_service.main import app as protection_app
from drivers_api import app as drivers_app
from common.auth import generate_sse_token, consume_sse_token

def test_root_heartbeat_open():
    """Verify that root / heartbeat requires no authentication on all services."""
    for app in [scanner_app, version_app, protection_app]:
        client = TestClient(app)
        res = client.get("/")
        assert res.status_code == 200, f"Heartbeat failed on {app}"

def test_auth_rejection_when_key_missing_or_invalid():
    """Verify 401 when X-Internal-Key is missing or wrong."""
    scanner_client = TestClient(scanner_app)
    version_client = TestClient(version_app)
    protection_client = TestClient(protection_app)
    drivers_client = TestClient(drivers_app)

    # Missing header
    assert scanner_client.get("/scan").status_code == 401
    assert version_client.post("/check-versions", json={}).status_code == 401
    assert protection_client.post("/protection/scan", json={"apps": []}).status_code == 401
    assert drivers_client.get("/drivers").status_code == 401
    assert drivers_client.post("/drivers/enable", json={}).status_code == 401
    assert scanner_client.post("/simulate-attack/token").status_code == 401

    # Invalid header
    bad_headers = {"X-Internal-Key": "wrong-key"}
    assert scanner_client.get("/scan", headers=bad_headers).status_code == 401
    assert version_client.post("/check-versions", json={}, headers=bad_headers).status_code == 401
    assert protection_client.post("/protection/scan", json={"apps": []}, headers=bad_headers).status_code == 401
    assert drivers_client.get("/drivers", headers=bad_headers).status_code == 401

def test_auth_success_with_valid_key():
    """Verify 200/valid status when X-Internal-Key is valid."""
    valid_headers = {"X-Internal-Key": "test-secret-key-12345"}
    scanner_client = TestClient(scanner_app)
    version_client = TestClient(version_app)
    drivers_client = TestClient(drivers_app)

    # Version check
    v_res = version_client.post("/check-versions", json={"Python": "3.11.0"}, headers=valid_headers)
    assert v_res.status_code == 200

    # Token request
    t_res = scanner_client.post("/simulate-attack/token", headers=valid_headers)
    assert t_res.status_code == 200
    data = t_res.json()
    assert "token" in data
    assert data["expiresIn"] == 30
    assert data["tokenType"] == "SingleUseSSE"

def test_single_use_sse_token_flow():
    """Verify token generation, validation, and single-use burn."""
    token = generate_sse_token(expires_in=30)
    assert token is not None

    # First consumption: Must succeed
    assert consume_sse_token(token) is True

    # Second consumption: Must fail (token burned)
    assert consume_sse_token(token) is False

    # Non-existent or raw key: Must fail
    assert consume_sse_token("test-secret-key-12345") is False
    assert consume_sse_token(None) is False
    assert consume_sse_token("") is False

def test_rate_limiting_simulate_attack_token():
    """Verify rate limit of 5 requests/min on POST /simulate-attack/token."""
    from common import redis_client
    with redis_client._MEMORY_RATELIMIT_LOCK:
        redis_client._MEMORY_RATELIMITS.clear()

    client = TestClient(scanner_app)
    valid_headers = {"X-Internal-Key": "test-secret-key-12345"}

    status_codes = []
    for _ in range(7):
        res = client.post("/simulate-attack/token", headers=valid_headers)
        status_codes.append(res.status_code)

    # First 5 should succeed (200), subsequent should return 429
    assert status_codes[:5] == [200, 200, 200, 200, 200]
    assert status_codes[5] == 429
    assert status_codes[6] == 429

def test_rate_limiting_protection_scan():
    """Verify rate limit of 10 requests/min on POST /protection/scan."""
    from common import redis_client
    with redis_client._MEMORY_RATELIMIT_LOCK:
        redis_client._MEMORY_RATELIMITS.clear()

    client = TestClient(protection_app)
    valid_headers = {"X-Internal-Key": "test-secret-key-12345"}

    status_codes = []
    for _ in range(12):
        res = client.post("/protection/scan", json={"apps": []}, headers=valid_headers)
        status_codes.append(res.status_code)

    assert status_codes[:10] == [200] * 10
    assert status_codes[10] == 429
    assert status_codes[11] == 429

def test_remediation_dry_run_vs_live():
    """Verify dry-run mode vs live execution mode in remediation script generation."""
    client = TestClient(scanner_app)
    valid_headers = {"X-Internal-Key": "test-secret-key-12345"}

    # 1. Dry run
    dry_res = client.post(
        "/generate-remediation-script",
        json={"apps": ["Google Chrome"], "drivers": ["nvlddmkm"], "dryRun": True},
        headers=valid_headers,
    )
    assert dry_res.status_code == 200
    dry_script = dry_res.text
    assert "[DRY RUN]" in dry_script
    assert "PREVIEW / DRY-RUN" in dry_script
    assert "No packages or drivers will be modified" in dry_script
    assert "Execute-LoggedCommand" not in dry_script  # Command wrapper only in live mode
    assert "$LogFile =" not in dry_script

    # 2. Live execution mode with audit logging
    live_res = client.post(
        "/generate-remediation-script",
        json={"apps": ["Google Chrome"], "drivers": ["nvlddmkm"], "dryRun": False},
        headers=valid_headers,
    )
    assert live_res.status_code == 200
    live_script = live_res.text
    assert "$LogFile =" in live_script
    assert "system_revamp_remediation_" in live_script
    assert "Execute-LoggedCommand" in live_script
    assert "winget upgrade" in live_script
    assert "UsoClient StartScan" in live_script

if __name__ == "__main__":
    test_root_heartbeat_open()
    print("PASS: Root heartbeat open without auth")
    test_auth_rejection_when_key_missing_or_invalid()
    print("PASS: Auth rejection on missing/invalid header")
    test_auth_success_with_valid_key()
    print("PASS: Auth success with valid key")
    test_single_use_sse_token_flow()
    print("PASS: Single-use SSE token flow and consumption")
    test_rate_limiting_simulate_attack_token()
    print("PASS: Rate limiting on POST /simulate-attack/token (5/min)")
    test_rate_limiting_protection_scan()
    print("PASS: Rate limiting on POST /protection/scan (10/min)")
    test_remediation_dry_run_vs_live()
    print("PASS: Remediation dry-run preview vs live audit logging")
    print("\nALL TASK 2 SECURITY TESTS PASSED! 🎉")
