import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("tick route requires CRON_SECRET and returns 401 on mismatch", () => {
  const src = readFileSync(join(root, "src/routes/api/league/tick.ts"), "utf8");
  assert.ok(src.includes("CRON_SECRET"), "CRON_SECRET must be read");
  assert.match(src, /status:\s*401/, "401 path missing");
  assert.ok(src.includes("unauthorized"), "unauthorized error body missing");
});
