"""Small, thread-safe JSON database used by the FastAPI service.

The on-disk shape is intentionally identical to the former Express backend,
so existing players, saves, and leaderboard entries need no data migration.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any


def _empty_data() -> dict[str, list[dict[str, Any]]]:
    return {"players": [], "saves": [], "scores": []}


class JsonDB:
    """A single-document JSON store with one save per player."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._lock = RLock()
        self.data = self._load()

    def _load(self) -> dict[str, list[dict[str, Any]]]:
        try:
            parsed = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(parsed, dict):
                return _empty_data()
            return {
                "players": (
                    parsed.get("players")
                    if isinstance(parsed.get("players"), list)
                    else []
                ),
                "saves": (
                    parsed.get("saves")
                    if isinstance(parsed.get("saves"), list)
                    else []
                ),
                "scores": (
                    parsed.get("scores")
                    if isinstance(parsed.get("scores"), list)
                    else []
                ),
            }
        except (OSError, json.JSONDecodeError):
            return _empty_data()

    def _flush_unlocked(self) -> None:
        """Atomically replace the database document with the in-memory state."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.path.parent,
                prefix=f".{self.path.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                json.dump(
                    self.data,
                    temporary,
                    ensure_ascii=False,
                    indent=2,
                    allow_nan=False,
                )
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_path = Path(temporary.name)
            os.replace(temporary_path, self.path)
        except Exception:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            raise

    def flush(self) -> None:
        with self._lock:
            self._flush_unlocked()

    # Players
    def create_player(self, player: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.data["players"].append(player)
            self._flush_unlocked()
            return player

    def get_player(self, player_id: str) -> dict[str, Any] | None:
        with self._lock:
            return next(
                (
                    player
                    for player in self.data["players"]
                    if player.get("id") == player_id
                ),
                None,
            )

    def find_player_by_name(self, name: str) -> dict[str, Any] | None:
        key = name.strip().lower()
        with self._lock:
            return next(
                (
                    player
                    for player in self.data["players"]
                    if str(player.get("name", "")).lower() == key
                ),
                None,
            )

    # Saves
    def get_save(self, player_id: str) -> dict[str, Any] | None:
        with self._lock:
            return next(
                (
                    save
                    for save in self.data["saves"]
                    if save.get("playerId") == player_id
                ),
                None,
            )

    def upsert_save(self, save: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            existing_index = next(
                (
                    index
                    for index, existing in enumerate(self.data["saves"])
                    if existing.get("playerId") == save["playerId"]
                ),
                None,
            )
            if existing_index is None:
                self.data["saves"].append(save)
            else:
                self.data["saves"][existing_index] = save
            self._flush_unlocked()
            return save

    def delete_save(self, player_id: str) -> None:
        with self._lock:
            remaining = [
                save for save in self.data["saves"] if save.get("playerId") != player_id
            ]
            if len(remaining) != len(self.data["saves"]):
                self.data["saves"] = remaining
                self._flush_unlocked()

    # Leaderboard
    def top_scores(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            completed = [
                score
                for score in self.data["scores"]
                if score.get("victory") is True
            ]
            completed.sort(
                key=lambda score: (
                    _sortable_number(score.get("timeSeconds"), float("inf")),
                    -_sortable_number(score.get("levelReached"), 0),
                    -_sortable_number(score.get("echoes"), 0),
                    str(score.get("createdAt", "")),
                )
            )
            return completed[:limit]

    def add_score(self, score: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.data["scores"].append(score)
            self._flush_unlocked()
            return score


def _sortable_number(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback
