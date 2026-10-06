import json
import sqlite3
import time
import requests
from agent.config import QUEUE_DB_PATH, agent_config


def init_queue_db():
    conn = sqlite3.connect(str(QUEUE_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pending_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            last_attempt REAL DEFAULT 0,
            created_at REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()


init_queue_db()


def enqueue_report(report_type: str, payload: dict):
    conn = sqlite3.connect(str(QUEUE_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO pending_reports (report_type, payload_json, created_at) VALUES (?, ?, ?)",
        (report_type, json.dumps(payload), time.time()),
    )
    conn.commit()
    conn.close()


def flush_queue() -> int:
    """Attempts to flush buffered offline reports to the central server with exponential backoff."""
    if not agent_config.is_enrolled():
        return 0

    conn = sqlite3.connect(str(QUEUE_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT id, report_type, payload_json, attempts, last_attempt FROM pending_reports ORDER BY id ASC")
    rows = cursor.fetchall()

    flushed_count = 0
    now = time.time()
    headers = {
        "X-Device-Token": agent_config.device_token,
        "Content-Type": "application/json",
    }

    for row_id, report_type, payload_json, attempts, last_attempt in rows:
        # Calculate backoff delay: 5s, 10s, 20s, 40s... max 300s
        backoff = min(5 * (2 ** attempts), 300)
        if now - last_attempt < backoff:
            continue

        endpoint = f"{agent_config.server_url}/api/v2/agent/{report_type}"
        try:
            resp = requests.post(endpoint, data=payload_json, headers=headers, timeout=10)
            if resp.status_code == 200:
                cursor.execute("DELETE FROM pending_reports WHERE id = ?", (row_id,))
                conn.commit()
                flushed_count += 1
            else:
                cursor.execute(
                    "UPDATE pending_reports SET attempts = attempts + 1, last_attempt = ? WHERE id = ?",
                    (now, row_id),
                )
                conn.commit()
        except Exception:
            cursor.execute(
                "UPDATE pending_reports SET attempts = attempts + 1, last_attempt = ? WHERE id = ?",
                (now, row_id),
            )
            conn.commit()

    conn.close()
    return flushed_count
