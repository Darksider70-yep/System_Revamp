import datetime
import json
import time
import requests
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from server.app.core.config import settings
from server.app.models.models import ThreatReputation

_LAST_VT_CALL_TIME = 0.0


def query_virustotal_hash(sha256: str) -> Optional[Dict[str, Any]]:
    global _LAST_VT_CALL_TIME
    if not settings.VIRUSTOTAL_API_KEY:
        return None

    # Enforce 4 req/min limit (15s between requests)
    now = time.time()
    elapsed = now - _LAST_VT_CALL_TIME
    if elapsed < 15.0:
        time.sleep(15.0 - elapsed)

    url = f"https://www.virustotal.com/api/v3/files/{sha256}"
    headers = {"x-apikey": settings.VIRUSTOTAL_API_KEY}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        _LAST_VT_CALL_TIME = time.time()
        if resp.status_code == 200:
            data = resp.json()
            stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            harmless = stats.get("harmless", 0)
            undetected = stats.get("undetected", 0)
            total = malicious + suspicious + harmless + undetected

            status = "Clean"
            if malicious > 0:
                status = "Malicious"
            elif suspicious > 0:
                status = "Suspicious"

            return {
                "sha256": sha256,
                "status": status,
                "score": int((malicious / total) * 100) if total > 0 else 0,
                "positives": malicious,
                "total": total,
                "raw": data,
            }
        elif resp.status_code == 404:
            return {
                "sha256": sha256,
                "status": "Unknown",
                "score": 0,
                "positives": 0,
                "total": 0,
                "raw": {},
            }
    except Exception as e:
        print(f"[VT] Exception querying VirusTotal for {sha256}: {e}")

    return None


def process_pending_vt_hashes(db: Session, max_items: int = 4) -> int:
    """Processes a batch of unscanned hashes from the fleet cache."""
    pending = (
        db.query(ThreatReputation)
        .filter(ThreatReputation.vt_status == "Unknown")
        .limit(max_items)
        .all()
    )

    processed_count = 0
    for record in pending:
        result = query_virustotal_hash(record.sha256)
        if result:
            record.vt_status = result["status"]
            record.vt_score = result["score"]
            record.positives_count = result["positives"]
            record.total_engines = result["total"]
            record.raw_vt_json = json.dumps(result["raw"])
            record.last_checked_at = datetime.datetime.utcnow()
            processed_count += 1

    db.commit()
    return processed_count
