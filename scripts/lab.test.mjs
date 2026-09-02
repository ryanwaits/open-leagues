import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const VERBS = ["getGameLines", "getGameContext", "sampleGames", "evaluateBets", "summarizeRun"];

test("the lab's five primitives are verbs on MCP, exported as server fns, and in the catalog table", () => {
  const catalog = read("src/lib/agent/catalog.ts");
  const core = read("src/lib/agent/core.ts");
  const dispatch = read("src/lib/agent/dispatch.ts");
  const md = read("src/lib/agent/CATALOG.md");
  const fns = read("src/lib/data/fns.ts");
  for (const v of VERBS) {
    assert.match(catalog, new RegExp(`"${v}"`), v);
    assert.match(core, new RegExp(`"${v}"`), v);
    assert.match(dispatch, new RegExp(`case "${v}"`), v);
    assert.match(md, new RegExp(`^\\| ${v} \\| spectator \\| read \\|`, "m"), v);
    assert.match(fns, new RegExp(`export const ${v} = createServerFn`), v);
  }
});

test("grading is pure arithmetic: no network, no database, no opinion", () => {
  const bets = read("src/lib/lab/bets.ts");
  assert.doesNotMatch(bets, /fetch\(|getSql|import\("@\/lib\/data/);
  // nflverse sign conventions are documented where the math lives
  assert.match(bets, /positive\s+when the home team is favored/);
  assert.match(bets, /home score minus away score/);
});

test("the lines feed is open data with CORS and a season guard", () => {
  assert.ok(existsSync(join(root, "src/routes/api/lines/$season[.]json.ts")));
  const src = read("src/routes/api/lines/$season[.]json.ts");
  assert.match(src, /access-control-allow-origin/);
  assert.match(src, /season < 1999/);
  assert.match(read("src/lib/lab/lines.server.ts"), /nflverse\/nfldata/);
});
