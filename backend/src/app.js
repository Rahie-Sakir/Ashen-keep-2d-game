/**
 * Express application factory for SoulsFan Games.
 *
 * Takes a JsonDB instance so the same app can be booted against the main file
 * database or the isolated test database. Route modules are mounted under /api.
 */

import cors from "cors";
import express from "express";

import { leaderboardRouter } from "./routes/leaderboard.js";
import { playersRouter } from "./routes/players.js";
import { savesRouter } from "./routes/saves.js";

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  // Liveness probe used by the client to detect an offline backend.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "soulsfan-games", time: Date.now() });
  });

  app.use("/api/players", playersRouter(db));
  app.use("/api/saves", savesRouter(db));
  app.use("/api/leaderboard", leaderboardRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
