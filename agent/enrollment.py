import platform
import socket
import requests
from agent.config import agent_config


def get_system_identity():
    hostname = socket.gethostname()
    os_name = platform.system()
    os_version = platform.version()
    os_release = platform.release()

    ip_address = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    return {
        "hostname": hostname,
        "os_name": os_name,
        "os_version": f"{os_release} ({os_version})",
        "ip_address": ip_address,
        "agent_version": agent_config.agent_version,
    }


def enroll(server_url: str, enrollment_token: str) -> bool:
    """Exchanges an enrollment token with the central server for a permanent device token."""
    agent_config.server_url = server_url.rstrip("/")
    identity = get_system_identity()
    payload = {
        "enrollment_token": enrollment_token,
        "hostname": identity["hostname"],
        "os_name": identity["os_name"],
        "os_version": identity["os_version"],
        "ip_address": identity["ip_address"],
        "agent_version": identity["agent_version"],
    }

    try:
        endpoint = f"{agent_config.server_url}/api/v2/agent/enroll"
        resp = requests.post(endpoint, json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            agent_config.device_id = data["device_id"]
            agent_config.device_token = data["device_token"]
            agent_config.org_id = data.get("org_id")
            agent_config.lab_id = data.get("lab_id")
            agent_config.poll_interval_seconds = data.get("poll_interval_seconds", 300)
            agent_config.save()
            print(f"[AGENT] Successfully enrolled device {agent_config.device_id}")
            return True
        else:
            print(f"[AGENT] Enrollment failed ({resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        print(f"[AGENT] Enrollment request exception: {e}")
        return False
