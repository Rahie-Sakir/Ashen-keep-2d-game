/**
 * Tiny file-backed JSON database for SoulsFan Games.
 *
 * The whole store is a single JSON document with three collections:
 *   - players: registered users (display name + id)
 *   - saves: one save document per player
 *   - scores: leaderboard entries for completed runs
 *
 * This is deliberately dependency-free persistence for the browser edition.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const EMPTY = { players: [], saves: [], scores: [] };

export class JsonDB {
  constructor(path) {
    this.path = path;
    this.data = this._load();
  }

  _load() {
    try {
      if (!existsSync(this.path)) return structuredClone(EMPTY);
      const parsed = JSON.parse(readFileSync(this.path, "utf-8"));
      return {
        players: Array.isArray(parsed.players) ? parsed.players : [],
        saves: Array.isArray(parsed.saves) ? parsed.saves : [],
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  /** Persist the in-memory store to disk. */
  flush() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), "utf-8");
  }

  // --- players ---------------------------------------------------------
  createPlayer(player) {
    this.data.players.push(player);
    this.flush();
    return player;
  }

  getPlayer(id) {
    return this.data.players.find((p) => p.id === id) ?? null;
  }

  findPlayerByName(name) {
    const key = name.trim().toLowerCase();
    return this.data.players.find((p) => p.name.toLowerCase() === key) ?? null;
  }

  // --- saves -----------------------------------------------------------
  getSave(playerId) {
    return this.data.saves.find((s) => s.playerId === playerId) ?? null;
  }

  upsertSave(save) {
    const index = this.data.saves.findIndex((s) => s.playerId === save.playerId);
    if (index >= 0) this.data.saves[index] = save;
    else this.data.saves.push(save);
    this.flush();
    return save;
  }

  deleteSave(playerId) {
    const before = this.data.saves.length;
    this.data.saves = this.data.saves.filter((s) => s.playerId !== playerId);
    if (this.data.saves.length !== before) this.flush();
  }

  // --- leaderboard -----------------------------------------------------
  topScores(limit = 20) {
    return [...this.data.scores]
      .filter((score) => score.victory === true)
      .sort(
        (a, b) =>
          a.timeSeconds - b.timeSeconds ||
          b.levelReached - a.levelReached ||
          b.echoes - a.echoes ||
          String(a.createdAt).localeCompare(String(b.createdAt)),
      )
      .slice(0, limit);
  }

  addScore(score) {
    this.data.scores.push(score);
    this.flush();
    return score;
  }
}
