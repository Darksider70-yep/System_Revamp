import datetime
import pytest
from server.app.core.database import SessionLocal
from server.app.models.models import Organization, Site, Lab, Device, DeviceSoftware, DeviceDriver, AdminUser
from server.app.api.admin_api import (
    get_fleet_software,
    get_fleet_drivers,
    get_hierarchy,
    get_compliance_report,
    export_report_csv,
)


def _get_admin_and_db():
    db = SessionLocal()
    admin = db.query(AdminUser).first()
    return admin, db


def test_fleet_software_aggregation_grouping():
    admin, db = _get_admin_and_db()
    try:
        lab = db.query(Lab).first()
        dev1 = Device(lab_id=lab.id, hostname="SW-TEST-PC01", device_token_hash="hash1", is_online=True)
        dev2 = Device(lab_id=lab.id, hostname="SW-TEST-PC02", device_token_hash="hash2", is_online=True)
        db.add_all([dev1, dev2])
        db.flush()

        # Both devices have software "TestApp"
        sw1 = DeviceSoftware(
            device_id=dev1.id,
            app_name="Git for Windows",
            version="2.40.0",
            latest_version="2.47.0",
            risk_level="High",
            publisher="The Git Community",
            version_source="endoflife.date",
        )
        sw2 = DeviceSoftware(
            device_id=dev2.id,
            app_name="Git for Windows",
            version="2.41.0",
            latest_version="2.47.0",
            risk_level="Medium",
            publisher="The Git Community",
            version_source="endoflife.date",
        )
        db.add_all([sw1, sw2])
        db.commit()

        # Run fleet software aggregation
        fleet_sw = get_fleet_software(risk_filter="all", user=admin, db=db)
        git_entry = next((s for s in fleet_sw if s["name"] == "Git for Windows"), None)

        assert git_entry is not None
        assert git_entry["device_count"] >= 2
        assert "SW-TEST-PC01" in git_entry["affected_devices"]
        assert "SW-TEST-PC02" in git_entry["affected_devices"]
        assert "2.40.0" in git_entry["installed_versions"]
        assert "2.41.0" in git_entry["installed_versions"]
        assert git_entry["version_source"] == "endoflife.date"
        # High risk escalates over Medium
        assert git_entry["risk_level"].upper() == "HIGH"
    finally:
        db.close()


def test_fleet_drivers_aggregation():
    admin, db = _get_admin_and_db()
    try:
        lab = db.query(Lab).first()
        dev1 = Device(lab_id=lab.id, hostname="DRV-TEST-PC01", device_token_hash="hash3", is_online=True)
        dev2 = Device(lab_id=lab.id, hostname="DRV-TEST-PC02", device_token_hash="hash4", is_online=True)
        db.add_all([dev1, dev2])
        db.flush()

        drv1 = DeviceDriver(
            device_id=dev1.id,
            device_name="Intel Ethernet I219-V",
            manufacturer="Intel",
            status="Failed",
            error_code=10,
            impact="High",
            risk_score=75,
            device_class_guid="{4d36e972-e325-11ce-bfc1-08002be10318}",
        )
        drv2 = DeviceDriver(
            device_id=dev2.id,
            device_name="Intel Ethernet I219-V",
            manufacturer="Intel",
            status="Failed",
            error_code=10,
            impact="High",
            risk_score=75,
            device_class_guid="{4d36e972-e325-11ce-bfc1-08002be10318}",
        )
        db.add_all([drv1, drv2])
        db.commit()

        fleet_drvs = get_fleet_drivers(errors_only=True, user=admin, db=db)
        intel_entry = next((d for d in fleet_drvs if "Intel Ethernet" in d["device_name"]), None)

        assert intel_entry is not None
        assert intel_entry["error_code"] == 10
        assert intel_entry["impact"] == "High"
        assert intel_entry["device_count"] >= 2
        assert "DRV-TEST-PC01" in intel_entry["affected_devices"]
        assert "DRV-TEST-PC02" in intel_entry["affected_devices"]
    finally:
        db.close()


def test_hierarchy_tree_structure():
    admin, db = _get_admin_and_db()
    try:
        tree = get_hierarchy(user=admin, db=db)
        assert isinstance(tree, list)
        assert len(tree) > 0
        org = tree[0]
        assert "name" in org
        assert "sites" in org
        assert isinstance(org["sites"], list)
        if len(org["sites"]) > 0:
            site = org["sites"][0]
            assert "labs" in site
            assert isinstance(site["labs"], list)
            if len(site["labs"]) > 0:
                lab = site["labs"][0]
                assert "device_count" in lab
                assert "online_count" in lab
    finally:
        db.close()


def test_compliance_report_and_csv_export():
    admin, db = _get_admin_and_db()
    try:
        # 1. Compliance Report
        report = get_compliance_report(user=admin, db=db)
        assert "compliance_percent" in report
        assert "breakdown" in report
        assert "devices" in report
        assert report["total_devices"] > 0

        # 2. CSV Export
        resp = export_report_csv(report_type="compliance", user=admin, db=db)
        assert resp.media_type == "text/csv"
        csv_body = resp.body.decode("utf-8")
        assert "Hostname,Lab,Operating System,Overall Risk" in csv_body
        assert len(csv_body.splitlines()) > 1

        # 3. Software CSV Export
        sw_resp = export_report_csv(report_type="software", user=admin, db=db)
        sw_csv = sw_resp.body.decode("utf-8")
        assert "Application,Publisher,Installed Version,Latest Version" in sw_csv

        # 4. Drivers CSV Export
        drv_resp = export_report_csv(report_type="drivers", user=admin, db=db)
        drv_csv = drv_resp.body.decode("utf-8")
        assert "Hardware Device,Manufacturer,Status,Error Code" in drv_csv
    finally:
        db.close()
