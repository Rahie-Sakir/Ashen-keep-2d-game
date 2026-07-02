/**
 * Leaderboard routes: submit a completed three-level run and read the board.
 *
 *   GET  /api/leaderboard?limit=20   -> 200 [ score, ... ]
 *   POST /api/leaderboard            { playerId, echoes, levelReached,
 *                                      timeSeconds, victory } -> 201 score
 *
 * Ranking: fastest completed time first. Echoes are retained as a secondary stat.
 */

import { Router } from "express";
import { nanoid } from "nanoid";

export function leaderboardRouter(db) {
  const router = Router();

  router.get("/", (req, res) => {
    const requested = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(requested)
      ? Math.min(100, Math.max(1, Math.floor(requested)))
      : 20;
    res.json(db.topScores(limit));
  });

  router.post("/", (req, res) => {
    const { playerId, echoes, levelReached, timeSeconds, victory } = req.body ?? {};
    const player = db.getPlayer(playerId);
    if (!player) return res.status(404).json({ error: "Unknown player." });

    const finished = victory === true;
    const normalizedLevel = Math.max(0, Number(levelReached ?? 0));
    const normalizedTime = Number(timeSeconds);
    if (!finished || normalizedLevel < 3 || !Number.isFinite(normalizedTime) || normalizedTime <= 0) {
      return res.status(400).json({
        error: "Leaderboard entries must be completed three-level runs with a positive finish time.",
      });
    }

    const score = {
      id: nanoid(12),
      playerId,
      name: player.name,
      echoes: Math.max(0, Number(echoes ?? 0)),
      levelReached: normalizedLevel,
      timeSeconds: normalizedTime,
      victory: true,
      createdAt: new Date().toISOString(),
    };
    db.addScore(score);
    return res.status(201).json(score);
  });

  return router;
}
