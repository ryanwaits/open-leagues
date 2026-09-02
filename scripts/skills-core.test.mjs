import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AGENT_CORE } from "../src/lib/agent/core.ts";

const root = join(import.meta.dirname, "..");
const skillsDir = join(root, "src/lib/agent/skills");

/** Not on MCP AGENT_CORE — may appear in skills only as PWA guidance. */
const PWA_ONLY = new Set([
  "addAllowlistEmail",
  "previewEspn",
  "importEspn",
  "previewRebuild",
  "importRebuild",
]);

function skillFiles() {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(skillsDir, d.name, "SKILL.md"));
}

/** camelCase ids in backticks (tool-shaped); skips `open-leagues-week`, paths, etc. */
function toolShapedBackticks(md) {
  const ids = [];
  for (const m of md.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/g)) {
    const id = m[1];
    if (/^[a-z]+([A-Z][a-zA-Z0-9]*)+$/.test(id)) ids.push(id);
  }
  return ids;
}

/** Field names the lab skills quote from summarizeRun / simulateBankroll payloads; not tools. */
const LAB_FIELDS = new Set([
  "pBreakEven",
  "maxDrawdown",
  "bySeason",
  "probLoss",
  "probBust",
  "winProbSource",
]);

test("six open-leagues skills exist", () => {
  const names = readdirSync(skillsDir).sort();
  assert.deepEqual(names, [
    "open-leagues-book",
    "open-leagues-lab-discover",
    "open-leagues-lab-run",
    "open-leagues-lineup",
    "open-leagues-migrate",
    "open-leagues-week",
  ]);
});

test("skill backtick tool ids ⊆ AGENT_CORE ∪ PWA_ONLY", () => {
  for (const file of skillFiles()) {
    const md = readFileSync(file, "utf8");
    for (const id of toolShapedBackticks(md)) {
      assert.ok(
        AGENT_CORE.has(id) || PWA_ONLY.has(id) || LAB_FIELDS.has(id),
        `${file}: unknown tool id \`${id}\` (not AGENT_CORE or PWA_ONLY)`,
      );
    }
  }
});

test("each league skill has getAgentContext; none mention tickAllLeagues", () => {
  for (const file of skillFiles()) {
    const md = readFileSync(file, "utf8");
    // The lab skills work on NFL games and a person's own strategies, not a league seat.
    if (!file.includes("open-leagues-lab-")) assert.match(md, /getAgentContext/, file);
    assert.doesNotMatch(md, /tickAllLeagues/, file);
  }
});

test("the lab skills never place a bet and never edit a frozen rule from the run", () => {
  const discover = readFileSync(join(skillsDir, "open-leagues-lab-discover/SKILL.md"), "utf8");
  const run = readFileSync(join(skillsDir, "open-leagues-lab-run/SKILL.md"), "utf8");
  for (const md of [discover, run]) assert.match(md, /Do \*\*not\*\* call `placeWager`/);
  assert.match(run, /Do \*\*not\*\* call `freezeStrategy`/);
  assert.match(discover, /Do \*\*not\*\* freeze a strategy that did not clear the holdout/);
});

test("migrate requires confirm: true; week does not mention sitPlayer", () => {
  const migrate = readFileSync(join(skillsDir, "open-leagues-migrate/SKILL.md"), "utf8");
  const week = readFileSync(join(skillsDir, "open-leagues-week/SKILL.md"), "utf8");
  assert.match(migrate, /confirm:\s*true/);
  assert.doesNotMatch(week, /sitPlayer/);
});
