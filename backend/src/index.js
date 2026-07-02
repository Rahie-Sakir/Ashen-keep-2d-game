/**
 * Server entry point. Boots the SoulsFan Games API over a JSON file database.
 *
 * Env:
 *   PORT    - listen port (default 4000)
 *   DB_PATH - path to the JSON database file (default ./db.json)
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createApp } from "./app.js";
import { JsonDB } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? resolve(here, "..", "db.json");
const port = Number(process.env.PORT ?? 4000);

const db = new JsonDB(dbPath);
const app = createApp(db);

app.listen(port, () => {
  console.log(`SoulsFan Games server listening on http://localhost:${port}`);
  console.log(`Database: ${dbPath}`);
});
