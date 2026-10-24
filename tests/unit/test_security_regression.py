import pytest
from fastapi.testclient import TestClient
from server.main import app
from server.app.core.database import SessionLocal
from server.app.models.models import AdminUser, Device, Organization, Site, Lab
from server.app.auth.jwt_handler import create_access_token
from server.app.auth.rbac import issue_ticket_token, consume_ticket_token
from agent.commands.executor import verify_signature

client = TestClient(app)

@pytest.fixture
def auth_header():
    db = SessionLocal()
    try:
        admin = db.query(AdminUser).first()
        if not admin:
            token = create_access_token(data={"sub": "admin-security-test", "role": "SuperAdmin"})
        else:
            token = create_access_token(data={"sub": admin.id, "role": admin.role, "org_id": admin.org_id})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

def test_single_use_sse_ticket_cannot_be_replayed():
    """Verify that ephemeral SSE ticket tokens are burned immediately upon first consumption."""
    device_id = "test-wks-sec-01"
    ticket = issue_ticket_token(device_id, ttl_seconds=30)
    assert ticket.startswith("sr_tkt_")

    # First consumption succeeds
    first_consumed = consume_ticket_token(ticket)
    assert first_consumed == device_id

    # Second consumption (replay attack) is rejected
    replayed = consume_ticket_token(ticket)
    assert replayed is None

def test_tampered_command_signature_rejected():
    """Verify that any modification to command parameters invalidates HMAC-SHA256 signature."""
    signing_key = "test_signing_key_secret_256bit_entropy"
    command_id = "cmd-sec-101"
    command_type = "run-package-update"
    valid_params = {"package_id": "Git.Git"}

    # Compute valid signature
    import hmac, hashlib, json
    params_sorted_json = json.dumps(valid_params, sort_keys=True)
    payload = f"{command_id}:{command_type}:{params_sorted_json}".encode("utf-8")
    valid_sig = hmac.new(signing_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    # Valid check passes
    assert verify_signature(command_id, command_type, valid_params, valid_sig, signing_key) is True

    # Tampered parameter fails
    tampered_params = {"package_id": "Git.Git; calc.exe"}
    assert verify_signature(command_id, command_type, tampered_params, valid_sig, signing_key) is False

    # Tampered command type fails
    assert verify_signature(command_id, "arbitrary-exec", valid_params, valid_sig, signing_key) is False

    # Tampered signature fails
    assert verify_signature(command_id, command_type, valid_params, "0" * 64, signing_key) is False

def test_ticket_endpoint_requires_auth():
    """Ensure generating an exposure ticket requires valid Admin Bearer token."""
    res = client.post("/api/v2/exposure/ticket?device_id=sample-id")
    assert res.status_code in (401, 403)
