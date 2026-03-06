"""FastAPI entrypoint for Cloud Security Core (port 9000)."""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request, WebSocket, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import JWT_EXPIRE_MINUTES, create_admin_access_token, validate_admin_credentials
from .database import engine, get_redis_client, init_db
from .machine_routes import router as machine_router
from .scan_routes import router as scan_router
from .security import install_cloud_security
from .schemas import LoginRequest, TokenResponse
from .websocket_server import LiveMachineHub

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("cloud_core.main")

app = FastAPI(title="Cloud Security Core", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_cloud_security(app)

app.include_router(machine_router)
app.include_router(scan_router)


@app.on_event("startup")
async def startup_event() -> None:
    await init_db()

    redis_client = None
    try:
        redis_client = get_redis_client()
        await redis_client.ping()
        LOGGER.info("Redis connected")
    except Exception:
        LOGGER.exception("Redis unavailable, continuing without cache/pub-sub")
        redis_client = None

    live_hub = LiveMachineHub(redis_client=redis_client)
    await live_hub.start()
    alert_hub = LiveMachineHub(redis_client=redis_client, channel="alerts")
    await alert_hub.start()

    app.state.redis = redis_client
    app.state.live_hub = live_hub
    app.state.alert_hub = alert_hub


@app.on_event("shutdown")
async def shutdown_event() -> None:
    live_hub: LiveMachineHub | None = getattr(app.state, "live_hub", None)
    if live_hub is not None:
        await live_hub.stop()
    alert_hub: LiveMachineHub | None = getattr(app.state, "alert_hub", None)
    if alert_hub is not None:
        await alert_hub.stop()

    redis_client = getattr(app.state, "redis", None)
    if redis_client is not None:
        try:
            await redis_client.close()
        except Exception:
            LOGGER.exception("Failed to close Redis cleanly")

    await engine.dispose()


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Cloud Security Core running"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "service": "cloud_core"}


@app.post("/auth/login", response_model=TokenResponse)
async def admin_login(payload: LoginRequest) -> TokenResponse:
    if not validate_admin_credentials(payload.username, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
        )

    token = create_admin_access_token(subject=payload.username)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=JWT_EXPIRE_MINUTES * 60,
    )


@app.websocket("/live-machines")
async def live_machines(websocket: WebSocket) -> None:
    live_hub: LiveMachineHub = app.state.live_hub
    await live_hub.connect(websocket)


@app.websocket("/alerts")
async def alerts(websocket: WebSocket) -> None:
    alert_hub: LiveMachineHub = app.state.alert_hub
    await alert_hub.connect(websocket)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "service": "cloud_core",
            "error": {
                "code": f"http_{exc.status_code}",
                "message": str(exc.detail),
            },
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    LOGGER.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "service": "cloud_core",
            "error": {
                "code": "internal_error",
                "message": "Internal server error.",
            },
        },
    )
