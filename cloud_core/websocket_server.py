"""WebSocket broadcast hub for live machine updates."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

import redis.asyncio as redis
from fastapi import WebSocket, WebSocketDisconnect

LOGGER = logging.getLogger("cloud_core.websocket")


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class LiveMachineHub:
    """Fan-out live updates to connected dashboards."""

    def __init__(self, redis_client: redis.Redis | None = None, channel: str = "live-machines") -> None:
        self._redis_client = redis_client
        self._channel = channel
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._consumer_task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._redis_client is None:
            return
        if self._consumer_task and not self._consumer_task.done():
            return
        self._consumer_task = asyncio.create_task(self._consume_pubsub(), name="live-machine-pubsub-consumer")

    async def stop(self) -> None:
        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
            self._consumer_task = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

        await websocket.send_json({"type": "connected", "channel": self._channel})

        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            async with self._lock:
                self._connections.discard(websocket)

    async def publish(self, payload: dict[str, Any]) -> None:
        if self._redis_client is None:
            await self.broadcast(payload)
            return

        try:
            message = json.dumps(payload, default=_json_default)
            await self._redis_client.publish(self._channel, message)
        except Exception:
            LOGGER.exception("Failed to publish live message to Redis")
            await self.broadcast(payload)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._connections)

        stale: list[WebSocket] = []
        for connection in targets:
            try:
                await connection.send_json(payload)
            except Exception:
                stale.append(connection)

        if stale:
            async with self._lock:
                for connection in stale:
                    self._connections.discard(connection)

    async def _consume_pubsub(self) -> None:
        if self._redis_client is None:
            return

        pubsub = self._redis_client.pubsub()
        await pubsub.subscribe(self._channel)

        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue

                raw = message.get("data")
                if raw is None:
                    continue

                if isinstance(raw, str):
                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        LOGGER.warning("Ignoring malformed websocket payload from Redis")
                        continue
                elif isinstance(raw, dict):
                    payload = raw
                else:
                    continue

                if isinstance(payload, dict):
                    await self.broadcast(payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOGGER.exception("Live-machine Redis pub-sub loop crashed")
        finally:
            try:
                await pubsub.unsubscribe(self._channel)
                await pubsub.close()
            except Exception:
                LOGGER.exception("Failed to close Redis pub-sub cleanly")
