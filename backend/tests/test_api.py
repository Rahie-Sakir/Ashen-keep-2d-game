"""End-to-end tests for the FastAPI application and JSON persistence."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from backend.app import create_app
from backend.database import JsonDB

pytestmark = pytest.mark.anyio


@pytest.fixture()
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test-db.json"


@pytest.fixture()
async def api(db_path: Path) -> AsyncIterator[httpx.AsyncClient]:
    application = create_app(JsonDB(db_path))
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def register(api: httpx.AsyncClient, name: str) -> dict:
    response = await api.post("/api/players", json={"name": name})
    assert response.status_code == 201
    return response.json()


async def test_health_responds_ok(api: httpx.AsyncClient) -> None:
    response = await api.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "soulsfan-games"
    assert isinstance(response.json()["time"], int)


async def test_player_registration_is_case_insensitively_idempotent(
    api: httpx.AsyncClient,
) -> None:
    first = await api.post("/api/players", json={"name": "  Lumen  "})
    second = await api.post("/api/players", json={"name": "lUmEn"})
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["name"] == "Lumen"


@pytest.mark.parametrize("name", ["x", "", "a" * 25])
async def test_invalid_names_are_rejected(api: httpx.AsyncClient, name: str) -> None:
    response = await api.post("/api/players", json={"name": name})
    assert response.status_code == 400
    assert response.json() == {"error": "Name must be 2-24 characters."}


async def test_player_can_be_fetched_and_missing_player_is_404(
    api: httpx.AsyncClient,
) -> None:
    player = await register(api, "Keeper")
    response = await api.get(f"/api/players/{player['id']}")
    assert response.json() == player
    missing = await api.get("/api/players/not-real")
    assert missing.status_code == 404
    assert missing.json() == {"error": "Player not found."}


async def test_save_round_trips_with_defaults_and_can_be_deleted(
    api: httpx.AsyncClient,
) -> None:
    player = await register(api, "Scribe")
    url = f"/api/saves/{player['id']}"
    missing = await api.get(url)
    assert missing.status_code == 404

    saved = await api.put(
        url,
        json={"state": {"levelIndex": 2, "player": {"echoes": 99}}},
    )
    assert saved.status_code == 200
    assert saved.json()["state"]["version"] == 1
    assert saved.json()["state"]["levelIndex"] == 2
    assert saved.json()["state"]["player"]["echoes"] == 99
    assert saved.json()["state"]["player"]["weapon"] == "ash_blade"
    assert (await api.get(url)).json() == saved.json()

    deleted = await api.delete(url)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert (await api.get(url)).status_code == 404
    assert (await api.delete(url)).status_code == 204


async def test_save_rejects_unknown_player_and_invalid_state(
    api: httpx.AsyncClient,
) -> None:
    unknown = await api.put("/api/saves/not-real", json={"state": {}})
    assert unknown.status_code == 404
    player = await register(api, "Archivist")
    invalid = await api.put(f"/api/saves/{player['id']}", json={"state": None})
    assert invalid.status_code == 400
    assert invalid.json() == {"error": "Invalid save state."}


async def test_leaderboard_ranks_completed_runs_by_fastest_time(
    api: httpx.AsyncClient,
) -> None:
    slower = await register(api, "Runner-A")
    faster = await register(api, "Runner-B")
    for player, echoes, finish_time in [(slower, 900, 800), (faster, 500, 600)]:
        response = await api.post(
            "/api/leaderboard",
            json={
                "playerId": player["id"],
                "echoes": echoes,
                "timeSeconds": finish_time,
                "levelReached": 3,
                "victory": True,
            },
        )
        assert response.status_code == 201

    board = (await api.get("/api/leaderboard")).json()
    assert [entry["name"] for entry in board] == ["Runner-B", "Runner-A"]
    assert board[0]["timeSeconds"] <= board[1]["timeSeconds"]
    assert len((await api.get("/api/leaderboard?limit=1")).json()) == 1


async def test_leaderboard_rejects_unknown_and_unfinished_runs(
    api: httpx.AsyncClient,
) -> None:
    unknown = await api.post(
        "/api/leaderboard",
        json={
            "playerId": "not-real",
            "levelReached": 3,
            "timeSeconds": 1,
            "victory": True,
        },
    )
    assert unknown.status_code == 404

    player = await register(api, "Unfinished")
    response = await api.post(
        "/api/leaderboard",
        json={
            "playerId": player["id"],
            "echoes": 500,
            "timeSeconds": 600,
            "levelReached": 2,
            "victory": False,
        },
    )
    assert response.status_code == 400
    assert response.json() == {
        "error": (
            "Leaderboard entries must be completed three-level runs "
            "with a positive finish time."
        )
    }


async def test_database_format_survives_a_restart(
    api: httpx.AsyncClient,
    db_path: Path,
) -> None:
    player = await register(api, "Persistent")
    reloaded = JsonDB(db_path)
    assert reloaded.get_player(player["id"]) == player
    assert set(reloaded.data) == {"players", "saves", "scores"}


async def test_invalid_json_and_unknown_routes_use_api_errors(
    api: httpx.AsyncClient,
) -> None:
    invalid = await api.post(
        "/api/players",
        content="{",
        headers={"content-type": "application/json"},
    )
    assert invalid.status_code == 400
    assert invalid.json() == {"error": "Invalid JSON body."}
    assert (await api.get("/api/does-not-exist")).json() == {"error": "Not found"}


async def test_request_limit_and_cors_match_the_browser_contract(
    api: httpx.AsyncClient,
) -> None:
    oversized = await api.post(
        "/api/players",
        content=b"x" * (256 * 1024 + 1),
        headers={"content-type": "application/json"},
    )
    assert oversized.status_code == 413
    assert oversized.json() == {"error": "Request body must not exceed 256 KB."}

    preflight = await api.options(
        "/api/players",
        headers={
            "origin": "http://localhost:5173",
            "access-control-request-method": "POST",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "*"


async def test_openapi_schema_contains_every_api_path(api: httpx.AsyncClient) -> None:
    schema = (await api.get("/openapi.json")).json()
    assert set(schema["paths"]) == {
        "/api/health",
        "/api/leaderboard",
        "/api/players",
        "/api/players/{player_id}",
        "/api/saves/{player_id}",
    }
