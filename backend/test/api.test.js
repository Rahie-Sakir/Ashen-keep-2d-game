/**
 * End-to-end API tests. Boots the real app over a backend-local test database
 * file on an ephemeral port and drives it with fetch.
 */

import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.js";
import { JsonDB } from "../src/db.js";

let server;
let base;
let dbPath;

before(async () => {
  dbPath = join(process.cwd(), "test-db.json");
  rmSync(dbPath, { force: true });
  const db = new JsonDB(dbPath);
  const app = createApp(db);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server?.close();
  rmSync(dbPath, { force: true });
});

const json = (res) => res.json();

test("health responds ok", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await json(res)).status, "ok");
});

test("player registration is idempotent on name", async () => {
  const make = () =>
    fetch(`${base}/api/players`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Lumen" }),
    });
  const first = await make();
  assert.equal(first.status, 201);
  const a = await json(first);
  const second = await make();
  assert.equal(second.status, 200);
  const b = await json(second);
  assert.equal(a.id, b.id);
});

test("short names are rejected", async () => {
  const res = await fetch(`${base}/api/players`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x" }),
  });
  assert.equal(res.status, 400);
});

test("save round-trips through PUT then GET", async () => {
  const player = await json(
    await fetch(`${base}/api/players`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Keeper" }),
    }),
  );
  const put = await fetch(`${base}/api/saves/${player.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: { levelIndex: 2, player: { echoes: 99 } } }),
  });
  assert.equal(put.status, 200);
  const got = await json(await fetch(`${base}/api/saves/${player.id}`));
  assert.equal(got.state.levelIndex, 2);
  assert.equal(got.state.player.echoes, 99);
});

test("leaderboard ranks completed runs by fastest finish time", async () => {
  const register = async (name) =>
    json(
      await fetch(`${base}/api/players`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    );
  const submit = (id, echoes, timeSeconds) =>
    fetch(`${base}/api/leaderboard`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: id, echoes, timeSeconds, levelReached: 3, victory: true }),
    });
  const a = await register("Runner-A");
  const b = await register("Runner-B");
  await submit(a.id, 900, 800);
  await submit(b.id, 500, 600);
  const board = await json(await fetch(`${base}/api/leaderboard`));
  assert.equal(board[0].name, "Runner-B");
  assert.ok(board[0].timeSeconds <= board[1].timeSeconds);
});

test("leaderboard rejects unfinished runs", async () => {
  const player = await json(
    await fetch(`${base}/api/players`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unfinished" }),
    }),
  );
  const res = await fetch(`${base}/api/leaderboard`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player.id,
      echoes: 500,
      timeSeconds: 600,
      levelReached: 2,
      victory: false,
    }),
  });
  assert.equal(res.status, 400);
});
