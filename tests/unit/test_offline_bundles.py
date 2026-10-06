import json
import pytest
from server.app.api.offline_api import sign_payload, verify_payload_signature


def test_bundle_signature_generation_and_validation():
    payload = json.dumps({"vulnerabilities": [{"cve_id": "CVE-2024-21892"}], "threats": []}).encode("utf-8")
    sig = sign_payload(payload)
    assert len(sig) == 64

    # Valid verification
    assert verify_payload_signature(payload, sig) is True

    # Tampered payload rejected
    tampered = json.dumps({"vulnerabilities": [{"cve_id": "CVE-TAMPERED"}], "threats": []}).encode("utf-8")
    assert verify_payload_signature(tampered, sig) is False
