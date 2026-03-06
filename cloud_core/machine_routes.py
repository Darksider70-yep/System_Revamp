"""Machine registration routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import write_audit_log
from .auth import generate_machine_api_key, hash_machine_api_key
from .database import get_db
from .models import Machine
from .schemas import MachineRegisterRequest, MachineRegisterResponse

router = APIRouter(tags=["machines"])


async def _invalidate_registration_cache(redis_client: object | None) -> None:
    if redis_client is None:
        return

    try:
        keys: set[str] = {"dashboard:overview"}
        async for key in redis_client.scan_iter(match="dashboard:machines:*"):
            keys.add(str(key))
        if keys:
            await redis_client.delete(*list(keys))
    except Exception:
        # Registration should still succeed even if cache invalidation fails.
        return


@router.post(
    "/register-machine",
    response_model=MachineRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_machine(
    payload: MachineRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MachineRegisterResponse:
    api_key = generate_machine_api_key()
    machine = Machine(
        hostname=payload.hostname.strip(),
        os=payload.os.strip(),
        os_version=payload.os_version.strip(),
        cpu=payload.cpu.strip(),
        ram_gb=int(payload.ram_gb),
        api_key_hash=hash_machine_api_key(api_key),
    )

    db.add(machine)
    try:
        await db.flush()
        await write_audit_log(
            db,
            action_type="machine_registration",
            machine_id=machine.id,
            details={
                "hostname": machine.hostname,
                "os": machine.os,
                "os_version": machine.os_version,
            },
        )
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register machine.") from exc

    await db.refresh(machine)
    redis_client = getattr(request.app.state, "redis", None)
    await _invalidate_registration_cache(redis_client)

    return MachineRegisterResponse(machine_id=machine.id, api_key=api_key)
