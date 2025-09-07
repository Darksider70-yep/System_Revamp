from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import asyncio
import json
import random
import datetime

router = APIRouter()

def now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

@router.get("/simulate-attack/{app_name}")
async def simulate_attack(app_name: str, request: Request):
    """
    Streams realistic fake attack logs in real-time for the given app using SSE.
    Sends a structured summary at the end.
    """

        # inside simulate_attack.py
    async def log_generator():
        steps = [
            {"step": 1, "message": f"Reconnaissance started on {app_name}", "level": "INFO"},
            {"step": 2, "message": "Scanning for open ports (80, 443, 8080)...", "level": "INFO"},
            {"step": 3, "message": "Discovered service: HTTPS on 443 (TLS 1.2)", "level": "INFO"},
            {"step": 4, "message": "Checking known CVEs... found CVE-2023-12345 vulnerability", "level": "WARN"},
            {"step": 5, "message": "Injecting simulated exploit payload...", "level": "INFO"},
            {"step": 6, "message": "Privilege escalation attempt with token reuse...", "level": "INFO"},
            {"step": 7, "message": "Accessing /etc/shadow (SIMULATED)", "level": "INFO"},
            {"step": 8, "message": f"Exfiltrating data to 185.199.{random.randint(0,255)}.{random.randint(0,255)}", "level": "INFO"},
            {"step": 9, "message": "Hashing payload: " + hex(random.getrandbits(64)), "level": "INFO"},
            {"step": 10, "message": "Simulation complete. Target compromised. (FAKE)", "level": "SUCCESS"},
        ]

        try:
            for step in steps:
                if await request.is_disconnected():
                    break

                log = {
                    "timestamp": now(),
                    "step": step["step"],
                    "progress": int((step["step"] / len(steps)) * 100),
                    "level": step["level"],
                    "message": step["message"]
                }

                yield f"data: {json.dumps(log)}\n\n"
                await asyncio.sleep(random.uniform(0.6, 1.8))

            if not await request.is_disconnected():
                # Send structured summary
                summary = {
                    "app": app_name,
                    "status": "Simulation finished",
                    "success": True,
                    "issues_found": ["CVE-2023-12345"],
                    "exfil_target": "185.199.x.x"
                }
                yield f"event: summary\ndata: {json.dumps(summary)}\n\n"

                # Explicit end signal
                yield 'event: end\ndata: {"done": true}\n\n'

        except asyncio.CancelledError:
            return


    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
