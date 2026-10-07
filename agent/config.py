import json
import os
import sys
from pathlib import Path
from typing import Optional


def _get_agent_data_dir() -> Path:
    # 1. Explicit override via environment variable
    if os.getenv("SR_AGENT_DATA_DIR"):
        p = Path(os.environ["SR_AGENT_DATA_DIR"])
        p.mkdir(parents=True, exist_ok=True)
        return p

    # 2. Try PROGRAMDATA if running on Windows with write permissions
    prog_data = os.getenv("PROGRAMDATA")
    if prog_data:
        target = Path(prog_data) / "SystemRevampAgent"
        try:
            target.mkdir(parents=True, exist_ok=True)
            test_file = target / ".write_test"
            test_file.write_text("ok", encoding="utf-8")
            test_file.unlink()
            return target
        except (PermissionError, OSError):
            pass

    # 3. Fallback to user home directory
    user_target = Path.home() / ".systemrevamp"
    user_target.mkdir(parents=True, exist_ok=True)
    return user_target


AGENT_DATA_DIR = _get_agent_data_dir()
CONFIG_FILE = AGENT_DATA_DIR / "agent_config.json"
QUEUE_DB_PATH = AGENT_DATA_DIR / "agent_queue.db"


class AgentConfig:
    def __init__(self):
        self.server_url: str = os.getenv("SERVER_URL", "http://127.0.0.1:8000")
        self.device_id: Optional[str] = None
        self.device_token: Optional[str] = None
        self.org_id: Optional[str] = None
        self.lab_id: Optional[str] = None
        self.poll_interval_seconds: int = 300
        self.heartbeat_interval_seconds: int = 60
        self.command_poll_interval_seconds: int = 15
        self.agent_version: str = "2.0.0"
        self.is_demo_fast: bool = False
        self.load()

    def is_enrolled(self) -> bool:
        return bool(self.device_id and self.device_token)

    def set_demo_fast_mode(self, enabled: bool = True):
        self.is_demo_fast = enabled
        if enabled:
            self.poll_interval_seconds = 30
            self.heartbeat_interval_seconds = 10
            self.command_poll_interval_seconds = 5
        else:
            self.poll_interval_seconds = 300
            self.heartbeat_interval_seconds = 60
            self.command_poll_interval_seconds = 15

    def load(self):
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.server_url = data.get("server_url", self.server_url)
                    self.device_id = data.get("device_id")
                    self.device_token = data.get("device_token")
                    self.org_id = data.get("org_id")
                    self.lab_id = data.get("lab_id")
                    self.poll_interval_seconds = data.get("poll_interval_seconds", 300)
                    self.heartbeat_interval_seconds = data.get("heartbeat_interval_seconds", 60)
                    self.command_poll_interval_seconds = data.get("command_poll_interval_seconds", 15)
                    self.agent_version = data.get("agent_version", "2.0.0")
                    if data.get("is_demo_fast"):
                        self.set_demo_fast_mode(True)
            except Exception as e:
                print(f"[AGENT] Error loading config from {CONFIG_FILE}: {e}")

    def save(self):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "server_url": self.server_url,
                        "device_id": self.device_id,
                        "device_token": self.device_token,
                        "org_id": self.org_id,
                        "lab_id": self.lab_id,
                        "poll_interval_seconds": self.poll_interval_seconds,
                        "heartbeat_interval_seconds": self.heartbeat_interval_seconds,
                        "command_poll_interval_seconds": self.command_poll_interval_seconds,
                        "agent_version": self.agent_version,
                        "is_demo_fast": self.is_demo_fast,
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            print(f"[AGENT] Error saving config: {e}")


agent_config = AgentConfig()
