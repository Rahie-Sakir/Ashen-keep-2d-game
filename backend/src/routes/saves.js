/**
 * Save routes: one save document per player, storing the browser game's
 * level, player stats, weapons, defeated bosses, and checkpoint.
 *
 *   GET    /api/saves/:playerId   -> 200 save | 404
 *   PUT    /api/saves/:playerId   { state } -> 200 save (upsert)
 *   DELETE /api/saves/:playerId   -> 204
 */

import { Router } from "express";

const SAVE_VERSION = 1;

function sanitizeState(state) {
  if (!state || typeof state !== "object") return null;
  const player = state.player ?? {};
  return {
    version: SAVE_VERSION,
    levelIndex: Number(state.levelIndex ?? 0),
    checkpoint: Array.isArray(state.checkpoint) ? state.checkpoint : [0, 150, 700],
    defeatedBosses: Array.isArray(state.defeatedBosses) ? state.defeatedBosses : [],
    gameTime: Number(state.gameTime ?? 0),
    victory: Boolean(state.victory),
    player: {
      health: Number(player.health ?? 100),
      maxHealth: Number(player.maxHealth ?? 100),
      stamina: Number(player.stamina ?? 100),
      maxStamina: Number(player.maxStamina ?? 100),
      attackPower: Number(player.attackPower ?? 1),
      characterLevel: Number(player.characterLevel ?? 1),
      echoes: Number(player.echoes ?? 0),
      weapon: String(player.weapon ?? "ash_blade"),
      unlockedWeapons: Array.isArray(player.unlockedWeapons)
        ? player.unlockedWeapons
        : ["ash_blade", "twin_fangs"],
    },
  };
}

export function savesRouter(db) {
  const router = Router();

  router.get("/:playerId", (req, res) => {
    const save = db.getSave(req.params.playerId);
    if (!save) return res.status(404).json({ error: "No save for this player." });
    return res.json(save);
  });

  router.put("/:playerId", (req, res) => {
    const playerId = req.params.playerId;
    if (!db.getPlayer(playerId)) {
      return res.status(404).json({ error: "Unknown player." });
    }
    const state = sanitizeState(req.body?.state);
    if (!state) return res.status(400).json({ error: "Invalid save state." });

    const save = db.upsertSave({
      playerId,
      state,
      updatedAt: new Date().toISOString(),
    });
    return res.json(save);
  });

  router.delete("/:playerId", (req, res) => {
    db.deleteSave(req.params.playerId);
    return res.status(204).end();
  });

  return router;
}
