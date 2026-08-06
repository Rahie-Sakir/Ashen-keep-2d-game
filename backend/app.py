"""FastAPI application and route definitions for SoulsFan Games."""

from __future__ import annotations

import json
import math
import os
import secrets
import string
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from .database import JsonDB

MAX_BODY_BYTES = 256 * 1024
SAVE_VERSION = 1
ID_ALPHABET = string.ascii_letters + string.digits + "_-"


class ApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message


def _database_path() -> Path:
    configured = os.getenv("DB_PATH")
    return Path(configured) if configured else Path(__file__).with_name("db.json")


def _new_id(length: int = 12) -> str:
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(length))


def _timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


async def _json_body(request: Request) -> Any:
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise ApiError(413, "Request body must not exceed 256 KB.")
    if not body:
        return {}
    try:
        return json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ApiError(400, "Invalid JSON body.") from error


def _object(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _number(value: Any, default: int | float) -> int | float:
    """Apply JavaScript-like numeric coercion while keeping JSON finite."""
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number):
        return default
    return int(number) if number.is_integer() else number


def _string(value: Any, default: str) -> str:
    if value is None:
        return default
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def _sanitize_save_state(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    player = _object(value.get("player"))
    checkpoint = value.get("checkpoint")
    defeated_bosses = value.get("defeatedBosses")
    unlocked_weapons = player.get("unlockedWeapons")
    return {
        "version": SAVE_VERSION,
        "levelIndex": _number(value.get("levelIndex"), 0),
        "checkpoint": checkpoint if isinstance(checkpoint, list) else [0, 150, 700],
        "defeatedBosses": defeated_bosses if isinstance(defeated_bosses, list) else [],
        "gameTime": _number(value.get("gameTime"), 0),
        "victory": bool(value.get("victory")),
        "player": {
            "health": _number(player.get("health"), 100),
            "maxHealth": _number(player.get("maxHealth"), 100),
            "stamina": _number(player.get("stamina"), 100),
            "maxStamina": _number(player.get("maxStamina"), 100),
            "attackPower": _number(player.get("attackPower"), 1),
            "characterLevel": _number(player.get("characterLevel"), 1),
            "echoes": _number(player.get("echoes"), 0),
            "weapon": _string(player.get("weapon"), "ash_blade"),
            "unlockedWeapons": (
                unlocked_weapons
                if isinstance(unlocked_weapons, list)
                else ["ash_blade", "twin_fangs"]
            ),
        },
    }


def create_app(database: JsonDB | None = None) -> FastAPI:
    """Build an API instance, optionally using an isolated database."""
    db = database or JsonDB(_database_path())
    api = FastAPI(
        title="SoulsFan Games API",
        description="Persistent player saves and fastest-run leaderboard.",
        version="1.0.0",
    )
    api.state.db = db
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.exception_handler(ApiError)
    async def api_error_handler(
        _request: Request,
        error: ApiError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"error": error.message},
        )

    @api.exception_handler(StarletteHTTPException)
    async def http_error_handler(
        _request: Request,
        error: StarletteHTTPException,
    ) -> JSONResponse:
        if error.status_code == 404:
            return JSONResponse(status_code=404, content={"error": "Not found"})
        return JSONResponse(
            status_code=error.status_code,
            content={"detail": error.detail},
        )

    @api.get("/api/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "service": "soulsfan-games",
            "time": int(time.time() * 1000),
        }

    @api.post("/api/players")
    async def register_player(request: Request) -> JSONResponse:
        payload = _object(await _json_body(request))
        name = _string(payload.get("name"), "").strip()
        if len(name) < 2 or len(name) > 24:
            raise ApiError(400, "Name must be 2-24 characters.")

        existing = db.find_player_by_name(name)
        if existing is not None:
            return JSONResponse(status_code=200, content=existing)

        player = {"id": _new_id(), "name": name, "createdAt": _timestamp()}
        db.create_player(player)
        return JSONResponse(status_code=201, content=player)

    @api.get("/api/players/{player_id}")
    async def get_player(player_id: str) -> dict[str, Any]:
        player = db.get_player(player_id)
        if player is None:
            raise ApiError(404, "Player not found.")
        return player

    @api.get("/api/saves/{player_id}")
    async def get_save(player_id: str) -> dict[str, Any]:
        save = db.get_save(player_id)
        if save is None:
            raise ApiError(404, "No save for this player.")
        return save

    @api.put("/api/saves/{player_id}")
    async def put_save(player_id: str, request: Request) -> dict[str, Any]:
        if db.get_player(player_id) is None:
            raise ApiError(404, "Unknown player.")
        payload = _object(await _json_body(request))
        state = _sanitize_save_state(payload.get("state"))
        if state is None:
            raise ApiError(400, "Invalid save state.")
        return db.upsert_save(
            {"playerId": player_id, "state": state, "updatedAt": _timestamp()}
        )

    @api.delete("/api/saves/{player_id}", status_code=204)
    async def delete_save(player_id: str) -> Response:
        db.delete_save(player_id)
        return Response(status_code=204)

    @api.get("/api/leaderboard")
    async def get_leaderboard(request: Request) -> list[dict[str, Any]]:
        raw_limit = request.query_params.get("limit", "20")
        requested = _number(raw_limit, 20)
        limit = min(100, max(1, math.floor(requested)))
        return db.top_scores(limit)

    @api.post("/api/leaderboard")
    async def submit_score(request: Request) -> JSONResponse:
        payload = _object(await _json_body(request))
        player_id = payload.get("playerId")
        player = db.get_player(player_id) if isinstance(player_id, str) else None
        if player is None:
            raise ApiError(404, "Unknown player.")

        level_reached = _number(payload.get("levelReached"), 0)
        time_seconds = _number(payload.get("timeSeconds"), 0)
        if (
            payload.get("victory") is not True
            or level_reached < 3
            or time_seconds <= 0
        ):
            raise ApiError(
                400,
                "Leaderboard entries must be completed three-level runs "
                "with a positive finish time.",
            )

        echoes = max(0, _number(payload.get("echoes"), 0))
        score = {
            "id": _new_id(),
            "playerId": player_id,
            "name": player["name"],
            "echoes": echoes,
            "levelReached": level_reached,
            "timeSeconds": time_seconds,
            "victory": True,
            "createdAt": _timestamp(),
        }
        db.add_score(score)
        return JSONResponse(status_code=201, content=score)

    return api


app = create_app()
