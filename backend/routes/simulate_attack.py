import asyncio
import datetime
import json
import random
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

try:
    from common.auth import consume_sse_token, generate_sse_token, verify_internal_key
    from common import redis_client
except ModuleNotFoundError:
    try:
        from backend.common.auth import consume_sse_token, generate_sse_token, verify_internal_key
        from backend.common import redis_client
    except Exception:
        verify_internal_key = None
        generate_sse_token = None
        consume_sse_token = None
        redis_client = None

router = APIRouter()


def now():
    return datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


@router.post("/simulate-attack/token")
async def request_simulate_attack_token(request: Request):
    """
    Issues a short-lived (~30s), single-use token for initiating an SSE attack simulation.
    Protected by the standard X-Internal-Key header.
    """
    if verify_internal_key:
        await verify_internal_key(request)

    token = generate_sse_token(expires_in=30) if generate_sse_token else "dev-token"
    return {
        "token": token,
        "expiresIn": 30,
        "tokenType": "SingleUseSSE",
    }


@router.get("/simulate-attack/{app_name}")
async def simulate_attack(app_name: str, request: Request, token: Optional[str] = Query(None)):
    """
    Streams realistic fake attack logs in real-time for the given app using SSE.
    Requires a valid single-use token generated via POST /simulate-attack/token.
    Tokens are consumed and invalidated immediately upon first connection.
    """
    # 1. Validate and consume the single-use SSE ticket token
    if consume_sse_token:
        is_valid = consume_sse_token(token)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid, expired, or already-consumed simulation token. Request a new token via POST /simulate-attack/token.",
                headers={"WWW-Authenticate": "Token"},
            )

    # 2. Rate limit check (5 starts per 60s per client IP)
    if redis_client:
        client_host = request.client.host if request.client else "unknown"
        allowed, retry_after = redis_client.check_rate_limit(
            f"simulate_attack:{client_host}",
            max_requests=5,
            window_seconds=60,
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for attack simulations. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

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
