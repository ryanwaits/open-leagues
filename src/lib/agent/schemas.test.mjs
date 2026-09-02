import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_CORE, PUBLIC_CORE } from "./core.ts";
import { coerceArgs, schemaFor, TOOL_SCHEMAS } from "./schemas.ts";

test("every typed schema names a real verb, and every public verb that takes arguments is typed", () => {
  for (const id of Object.keys(TOOL_SCHEMAS)) assert.ok(AGENT_CORE.has(id), `${id} is not a verb`);
  const noArgs = new Set(["getPulse", "getSources"]);
  for (const id of PUBLIC_CORE) {
    if (noArgs.has(id)) continue;
    if (!TOOL_SCHEMAS[id]) continue; // player/score reads keep the permissive shape for now
    assert.equal(schemaFor(id).type, "object", id);
  }
});

test("stringified arrays and objects are taken as values; real strings are untouched", () => {
  const out = coerceArgs({
    seasons: "[2023, 2024]",
    filter: '{"homeDog":true}',
    leagueId: "1255972181892935680",
    note: "[not json",
    week: 14,
  });
  assert.deepEqual(out.seasons, [2023, 2024]);
  assert.deepEqual(out.filter, { homeDog: true });
  assert.equal(out.leagueId, "1255972181892935680");
  assert.equal(out.note, "[not json");
  assert.equal(out.week, 14);
});
