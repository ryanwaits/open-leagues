import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const VERBS = [
  "getGameLines",
  "getGameContext",
  "getBettingSplits",
  "sampleGames",
  "evaluateBets",
  "summarizeRun",
  "simulateBankroll",
  "freezeStrategy",
  "listStrategies",
  "getStrategy",
  "deleteStrategy",
  "recordLabRun",
  "getLabRuns",
];

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
    assert.match(md, new RegExp(`^\\| ${v} \\| spectator \\| (read|atomic) \\|`, "m"), v);
    assert.match(fns, new RegExp(`export const ${v} = createServerFn`), v);
  }
});

test("grading is pure arithmetic: no network, no database, no opinion", () => {
  const bets = read("src/lib/lab/bets.ts");
  assert.doesNotMatch(bets, /fetch\(|getSql|import\("@\/lib\/data/);
  // nflverse sign conventions are documented where the math lives
  assert.match(bets, /positive[\s*]+when the home team is favored/);
  assert.match(bets, /home score minus away score/);
});

test("the lines feed is open data with CORS and a season guard", () => {
  assert.ok(existsSync(join(root, "src/routes/api/lines/$season[.]json.ts")));
  const src = read("src/routes/api/lines/$season[.]json.ts");
  assert.match(src, /access-control-allow-origin/);
  assert.match(src, /season < 1999/);
  assert.match(read("src/lib/lab/lines.server.ts"), /nflverse\/nfldata/);
});

test("splits are opt-in and every pulled week is kept", () => {
  const sp = read("src/lib/lab/splits.server.ts");
  assert.match(sp, /OPENLEAGUES_SPLITS_SOURCE/);
  assert.match(sp, /export function splitsSources\(\)/);
  for (const src of ["actionnetwork", "dknetwork", "wiseguyteam"])
    assert.match(sp, new RegExp(`"${src}"`), src);
  assert.match(sp, /ol_live_splits_log/, "live sources keep their own refresh log");
  assert.match(sp, /ol_game_splits_log/);
  assert.match(read(".env.example"), /OPENLEAGUES_SPLITS_SOURCE=/);
  // filters can ask for a ticket share, so the user's own example runs unchanged
  assert.match(read("src/lib/lab/bets.ts"), /tickets\?: \[number, number\]/);
});

test("two lab skills: discover freezes, run never places", () => {
  const discover = read("skills/open-leagues-lab-discover/SKILL.md");
  const run = read("skills/open-leagues-lab-run/SKILL.md");
  assert.match(discover, /hold ?out/i);
  assert.match(discover, /pBreakEven/);
  assert.match(discover, /freezeStrategy/);
  assert.match(discover, /Do \*\*not\*\* call `placeWager`/);
  assert.match(run, /getStrategy/);
  assert.match(run, /simulateBankroll/);
  assert.match(run, /recordLabRun/);
  assert.match(run, /Do \*\*not\*\* call `placeWager`/);
  assert.match(run, /Do \*\*not\*\* call `freezeStrategy`/);
  // the writes are mutating in the catalog, so a read token cannot freeze or record
  const catalog = read("src/lib/agent/catalog.ts");
  for (const v of ["freezeStrategy", "deleteStrategy", "recordLabRun"]) {
    assert.match(catalog, new RegExp(`"${v}",[\\s\\S]{0,400}?"atomic"`), v);
  }
});

test("staking arithmetic is pure and seeded", () => {
  const b = read("src/lib/lab/bankroll.ts");
  assert.doesNotMatch(b, /fetch\(|getSql/);
  assert.match(b, /mulberry32/);
  assert.match(b, /winProbSource/);
});
