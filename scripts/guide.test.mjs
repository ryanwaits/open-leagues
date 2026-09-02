import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("the guide is a docs page with an audience filter", () => {
  assert.match(read("src/lib/docs/nav.ts"), /"guide"/);
  const pages = read("src/lib/docs/pages.tsx");
  assert.match(pages, /guide,/);
  assert.match(pages, /showsFor\(s\.audience, audience\)/);
  assert.match(read("src/components/docs-shell.tsx"), /showsFor\(s\.audience, audience\)/);
});

test("every guide output is real: one league, no placeholders", () => {
  const guide = read("src/lib/docs/guide.tsx");
  assert.match(guide, /1255972181892935680/);
  assert.doesNotMatch(guide, /lorem|TODO|example\.com|The Backyard|Butterbean/i);
  // the engine's exact refusal strings, not paraphrases
  const dispatch = read("src/lib/agent/dispatch.ts");
  assert.match(dispatch, /is a write; this token is read-only/);
  assert.match(guide, /is a write; this token is read-only/);
  assert.match(dispatch, /requires confirm: true/);
  assert.match(guide, /requires confirm: true/);
  assert.match(dispatch, /is a cron clock, not a tool/);
  assert.match(guide, /is a cron clock, not a tool/);
});

test("guide sections follow pain → fix → run → output", () => {
  const guide = read("src/lib/docs/guide.tsx");
  assert.match(guide, />the pain</);
  assert.match(guide, />the fix</);
  assert.match(guide, />what you run</);
  assert.match(guide, />what comes back</);
});
