import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/routes/api/mcp.ts"), "utf8");

test("mcp HTTP route authenticates via lookupToken or requireUserId", () => {
  assert.ok(
    src.includes("lookupToken") || src.includes("requireUserId"),
    "must call lookupToken or requireUserId",
  );
  assert.match(src, /status:\s*401/, "401 path missing");
});

test("mcp HTTP route does not use OPENLEAGUES_USER", () => {
  assert.doesNotMatch(src, /\bOPENLEAGUES_USER\b/);
});

test("mcp HTTP route does not import tickAllLeagues", () => {
  assert.doesNotMatch(src, /tickAllLeagues/);
});

test("mcp HTTP route dispatches via agent/dispatch", () => {
  assert.match(src, /from ["']@\/lib\/agent\/dispatch["']/);
  assert.match(src, /\bdispatch\b/);
});
