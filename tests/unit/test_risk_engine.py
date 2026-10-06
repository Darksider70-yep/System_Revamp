import pytest
from server.app.services.risk_engine import calculate_risk_level, safe_parse_version


def test_authoritative_risk_classification():
    # Major jump >= 2 -> Critical
    assert calculate_risk_level("20.10.0", "22.11.0") == "Critical"
    assert calculate_risk_level("1.0.0", "3.0.0") == "Critical"
    assert calculate_risk_level("2.8.0", "4.0.0") == "Critical"

    # Known vulnerable -> Critical
    assert calculate_risk_level("1.0.0", "1.0.1", is_vulnerable=True) == "Critical"

    # 1 Major jump -> High
    assert calculate_risk_level("21.0.0", "22.11.0") == "High"
    assert calculate_risk_level("1.5.0", "2.0.0") == "High"

    # Minor jump -> Medium
    assert calculate_risk_level("3.8.0", "3.13.3") == "Medium"
    assert calculate_risk_level("128.0.0", "128.2.0") == "Medium"
    assert calculate_risk_level("3.12.0", "3.13.0") == "Medium"

    # Patch jump or up-to-date -> Low
    assert calculate_risk_level("128.0.6613.84", "128.0.6613.85") == "Low"
    assert calculate_risk_level("22.11.0", "22.11.0") == "Low"
    assert calculate_risk_level("23.0.0", "22.11.0") == "Low"

    # Unparseable / unknown
    assert calculate_risk_level("unknown", "22.11.0") == "Unknown"
    assert calculate_risk_level("custom_build", "2.0") == "Unknown"
