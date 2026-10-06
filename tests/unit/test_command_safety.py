import pytest
from fastapi import HTTPException
from server.app.api.commands_api import sanitize_parameter_value, ALLOWED_COMMAND_TYPES
from agent.commands.executor import dispatch_command


def test_allowed_command_types():
    assert "rescan" in ALLOWED_COMMAND_TYPES
    assert "scan-drivers" in ALLOWED_COMMAND_TYPES
    assert "enable-device" in ALLOWED_COMMAND_TYPES
    assert "upgrade-package" in ALLOWED_COMMAND_TYPES
    assert "arbitrary-bash" not in ALLOWED_COMMAND_TYPES


def test_parameter_sanitization():
    # Valid parameters
    assert sanitize_parameter_value("OpenJS.NodeJS") == "OpenJS.NodeJS"
    assert sanitize_parameter_value("PCI\\VEN_10DE&DEV_1C82") == "PCI\\VEN_10DE&DEV_1C82"

    # Malicious injection attempts with shell metacharacters
    with pytest.raises(HTTPException):
        sanitize_parameter_value("OpenJS.NodeJS; rm -rf /")

    with pytest.raises(HTTPException):
        sanitize_parameter_value("NodeJS | Invoke-Expression")

    with pytest.raises(HTTPException):
        sanitize_parameter_value("NodeJS `whoami`")

    with pytest.raises(HTTPException):
        sanitize_parameter_value("NodeJS > C:\\pwn.txt")


def test_dry_run_command_execution():
    success, result, log = dispatch_command("upgrade-package", {"package_id": "Python.Python.3.13"}, dry_run=True)
    assert success is True
    assert "Dry run preview" in log
    assert "Python.Python.3.13" in log
    assert result["action"] == "upgrade-package"


def test_no_secrets_in_generated_command_output():
    # Verify no API keys or passwords are leaked in command logs
    _, _, log = dispatch_command("upgrade-package", {"package_id": "OpenJS.NodeJS"}, dry_run=True)
    assert "sr_enroll_" not in log
    assert "sr_dev_" not in log
    assert "secret" not in log.lower()
    assert "Admin@" not in log
