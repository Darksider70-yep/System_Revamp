import pytest
from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)

def test_prometheus_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    body = response.text
    
    # Assert key metrics defined in MONITORING_AND_OBSERVABILITY.md exist in output
    assert "systemrevamp_uptime_seconds" in body
    assert "systemrevamp_fleet_total_count" in body
    assert "systemrevamp_fleet_online_count" in body
    assert "systemrevamp_fleet_availability_ratio" in body
    assert "systemrevamp_virustotal_queue_depth" in body
    assert "systemrevamp_command_dispatched_total" in body
    assert "systemrevamp_ingestion_queue_depth" in body

def test_api_v2_metrics_alias():
    response = client.get("/api/v2/metrics")
    assert response.status_code == 200
    assert "systemrevamp_fleet_total_count" in response.text
