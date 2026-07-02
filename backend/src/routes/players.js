/**
 * Player routes: register a user and look one up.
 *
 *   POST /api/players       { name }            -> 201 { id, name, createdAt }
 *   GET  /api/players/:id                       -> 200 player | 404
 *
 * Registration is idempotent on name: re-using a name returns the existing
 * player so a returning visitor keeps their save without accounts/passwords.
 */

import { Router } from "express";
import { nanoid } from "nanoid";

export function playersRouter(db) {
  const router = Router();

  router.post("/", (req, res) => {
    const name = String(req.body?.name ?? "").trim();
    if (name.length < 2 || name.length > 24) {
      return res.status(400).json({ error: "Name must be 2-24 characters." });
    }
    const existing = db.findPlayerByName(name);
    if (existing) return res.status(200).json(existing);

    const player = { id: nanoid(12), name, createdAt: new Date().toISOString() };
    db.createPlayer(player);
    return res.status(201).json(player);
  });

  router.get("/:id", (req, res) => {
    const player = db.getPlayer(req.params.id);
    if (!player) return res.status(404).json({ error: "Player not found." });
    return res.json(player);
  });

  return router;
}
