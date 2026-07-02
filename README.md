# SoulsFan Games

SoulsFan Games is a browser-based 2D souls-like action platformer. The active
project is a full-stack web app: a React + Vite + TypeScript frontend running
the game on an HTML5 Canvas, backed by a Node/Express API with a persistent JSON
database.

Players register by name, play through three handcrafted levels, save progress
server-side, and submit a leaderboard entry when they finish the final level.
The leaderboard ranks completed runs by fastest finish time.

## Stack

- `frontend/`: React, Vite, TypeScript, Canvas game renderer, Web Audio music
- `backend/`: Express REST API
- `backend/db.json`: persistent JSON database for players, saves, and scores

## Run Locally

```bash
npm run install:all
npm run dev:server
npm run dev:client
```

Open http://localhost:5173.

The Vite dev server proxies `/api` to the Express server on port `4000`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/players` | Register or return a player by name |
| `GET` | `/api/players/:id` | Fetch a player |
| `GET` | `/api/saves/:playerId` | Load a save |
| `PUT` | `/api/saves/:playerId` | Create or update a save |
| `DELETE` | `/api/saves/:playerId` | Delete a save |
| `GET` | `/api/leaderboard` | Fastest completed runs |
| `POST` | `/api/leaderboard` | Submit a completed three-level run |

## Tests

```bash
npm test
npm run build
```

Server tests use `backend/test-db.json` during the run and delete it afterward.
No `tmp*` folders are created.
