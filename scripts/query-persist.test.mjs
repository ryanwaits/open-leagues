import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("PERSIST_ROOTS allowlist includes workbook keys and excludes live keys", () => {
  const src = readFileSync(join(root, "src/lib/query-persist.ts"), "utf8");
  const match = src.match(/PERSIST_ROOTS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(match, "PERSIST_ROOTS Set literal not found");
  const roots = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const set = new Set(roots);

  for (const key of [
    "league",
    "matchups",
    "team",
    "my-leagues",
    "desk",
    "settings",
    "wire",
    "player-profile",
  ]) {
    assert.ok(set.has(key), `missing persist root: ${key}`);
  }
  for (const key of ["scores", "pulse", "live-wire", "week-stats", "draft"]) {
    assert.ok(!set.has(key), `live key must not persist: ${key}`);
  }

  const buster = src.match(/PERSIST_BUSTER\s*=\s*"([^"]+)"/);
  assert.ok(buster?.[1], "PERSIST_BUSTER must be a non-empty string");

  const stale = src.match(/PERSIST_STALE_ON_RESTORE\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(stale, "PERSIST_STALE_ON_RESTORE Set literal not found");
  const staleRoots = new Set([...stale[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  for (const key of ["league", "matchups", "team"]) {
    assert.ok(staleRoots.has(key), `must stale-on-restore: ${key}`);
  }
  for (const key of ["byes", "player-profile", "my-leagues"]) {
    assert.ok(!staleRoots.has(key), `must not stale-on-restore: ${key}`);
  }
});

test("persistQueryClient is gated behind typeof window !== undefined", () => {
  const src = readFileSync(join(root, "src/lib/query-client.ts"), "utf8");
  const windowIdx = src.indexOf('typeof window !== "undefined"');
  const persistIdx = src.indexOf("persistQueryClient({");
  assert.ok(windowIdx !== -1, "window guard missing");
  assert.ok(persistIdx !== -1, "persistQueryClient call missing");
  assert.ok(windowIdx < persistIdx, "typeof window check must appear before persistQueryClient");
});
