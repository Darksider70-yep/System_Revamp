import json
import os
from pathlib import Path
from typing import Optional

# Local persistent state storage
AGENT_DATA_DIR = Path(os.getenv("PROGRAMDATA", Path.home())) / "SystemRevampAgent"
AGENT_DATA_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_FILE = AGENT_DATA_DIR / "agent_config.json"
QUEUE_DB_PATH = AGENT_DATA_DIR / "agent_queue.db"


class AgentConfig:
    def __init__(self):
        self.server_url: str = os.getenv("SERVER_URL", "http://127.0.0.1:8080")
        self.device_id: Optional[str] = None
        self.device_token: Optional[str] = None
        self.org_id: Optional[str] = None
        self.lab_id: Optional[str] = None
        self.poll_interval_seconds: int = 300
        self.heartbeat_interval_seconds: int = 60
        self.agent_version: str = "2.0.0"
        self.load()

    def is_enrolled(self) -> bool:
        return bool(self.device_id and self.device_token)

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
                    self.agent_version = data.get("agent_version", "2.0.0")
            except Exception as e:
                print(f"[AGENT] Error loading config: {e}")

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
                        "agent_version": self.agent_version,
                    },
                    f,
                    indent=2,
                )
        except Exception as e:
            print(f"[AGENT] Error saving config: {e}")


agent_config = AgentConfig()
