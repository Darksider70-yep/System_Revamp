import pytest
from server.app.auth.password import hash_password, verify_password
from server.app.auth.jwt_handler import create_access_token, decode_token
from server.app.auth.device_auth import (
    generate_enrollment_token,
    generate_device_token,
    sign_command,
    verify_command_signature,
)


def test_password_hashing():
    pw = "SuperSecurePassword123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_generation():
    token = create_access_token({"sub": "user-123", "role": "LabAdmin", "org_id": "org-456"})
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["role"] == "LabAdmin"
    assert payload["org_id"] == "org-456"
    assert payload["type"] == "access"


def test_device_tokens_and_signatures():
    raw_enroll, hash_enroll = generate_enrollment_token()
    assert raw_enroll.startswith("sr_enroll_")
    assert len(hash_enroll) == 64

    raw_dev, hash_dev = generate_device_token("dev-001")
    assert raw_dev.startswith("sr_dev_dev-001_")
    assert len(hash_dev) == 64

    cmd_id = "cmd-999"
    cmd_type = "rescan"
    params = '{"target": "all"}'
    sig = sign_command(cmd_id, cmd_type, params)
    assert verify_command_signature(cmd_id, cmd_type, params, sig) is True
    assert verify_command_signature(cmd_id, cmd_type, '{"target": "tampered"}', sig) is False
