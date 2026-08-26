import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_TOOLS } from "./catalog.ts";
import { AGENT_CORE } from "./core.ts";
import { dispatch } from "./dispatch.ts";

test("AGENT_CORE ⊆ AGENT_TOOLS and excludes tick", () => {
  const catalogIds = new Set(AGENT_TOOLS.map((t) => t.id));
  for (const id of AGENT_CORE) {
    assert.ok(catalogIds.has(id), `${id} missing from AGENT_TOOLS`);
    assert.notEqual(id, "tick");
    assert.notEqual(id, "tickAllLeagues");
  }
  assert.ok(!AGENT_CORE.has("tick"));
  assert.ok(!AGENT_CORE.has("tickAllLeagues"));
});

test("unknown id throws", async () => {
  await assert.rejects(() => dispatch("notARealTool", "user_x", {}), /Unknown tool/);
});

test("tick / tickAllLeagues refused", async () => {
  await assert.rejects(() => dispatch("tick", "user_x", {}), /cron clock|not a tool/);
  await assert.rejects(() => dispatch("tickAllLeagues", "user_x", {}), /cron clock|not a tool/);
});

test("mutating without userId refused", async () => {
  await assert.rejects(
    () => dispatch("sitPlayer", null, { leagueId: "lg_x", playerId: "p1" }),
    /OPENFF_USER|signed-in/,
  );
  await assert.rejects(
    () => dispatch("placeWager", undefined, { leagueId: "lg_x" }),
    /OPENFF_USER|signed-in/,
  );
  await assert.rejects(
    () => dispatch("importLeague", null, { sleeperId: "123", confirm: true }),
    /OPENFF_USER|signed-in/,
  );
});

test("importLeague without confirm refused", async () => {
  await assert.rejects(() => dispatch("importLeague", "user_x", { sleeperId: "123" }), /confirm/);
});

test("81's 26 new ids are reachable — not Unknown tool", async () => {
  // Args are intentionally missing required fields — this proves the
  // switch case exists and reaches argument validation, without touching
  // the database. getPulse/getSources take no args and would actually run
  // (network/DB calls), so they're checked by membership only, below.
  const needsArgs = [
    "getGameSummary",
    "getWeekStats",
    "findSleeperUser",
    "getByeWeeks",
    "getProjections",
    "getOutlooks",
    "getPlayerProfile",
    "getLeaders",
    "getPlayerSearch",
    "getLeagueBundle",
    "getTicks",
    "getActivity",
    "getRecap",
    "getWeekProjections",
    "previewInvite",
    "getDesk",
    "getMockPool",
    "getClaims",
    "getTrades",
    "getTradablePicks",
    "getSchedule",
  ];
  for (const id of needsArgs) {
    await assert.rejects(
      () => dispatch(id, "user_x", {}),
      (err) => {
        assert.doesNotMatch(err.message, /Unknown tool/, id);
        return true;
      },
    );
  }
  // getPulse/getSources take no args at all, and getScores/getLiveWire's
  // args (week/season/seasonType/kind) are all optional — none of these
  // four reject on {}, so they're checked by membership only, not by
  // rejection (calling them for real would make a live network request).
  for (const id of ["getPulse", "getSources", "getScores", "getLiveWire"]) {
    assert.ok(AGENT_CORE.has(id), id);
  }
});

test("exportLeague requires a signed-in user, like listMyLeagues", async () => {
  await assert.rejects(() => dispatch("exportLeague", null, { leagueId: "lg_x" }), /signed-in/);
});

test("082's 7 verb-completion ids reject cleanly without a user", async () => {
  for (const [id, args] of [
    ["queueRemove", { leagueId: "lg_x", playerId: "p1" }],
    ["queueReorder", { leagueId: "lg_x", playerIds: ["p1", "p2"] }],
    ["setAutodraft", { leagueId: "lg_x", on: true }],
    ["addDrop", { leagueId: "lg_x", addId: "p1", dropId: null }],
    ["cancelClaim", { leagueId: "lg_x", claimId: "c1" }],
    ["cancelTradeFn", { leagueId: "lg_x", tradeId: "t1" }],
    ["claimRoster", { leagueId: "lg_x", rosterId: 1 }],
  ]) {
    await assert.rejects(() => dispatch(id, null, args), /OPENFF_USER|signed-in/, id);
  }
});

test("setAutodraft requires a boolean `on`", async () => {
  await assert.rejects(
    () => dispatch("setAutodraft", "user_x", { leagueId: "lg_x", on: "yes" }),
    /boolean/,
  );
});

test("queueReorder requires playerIds to be an array", async () => {
  await assert.rejects(() => dispatch("queueReorder", "user_x", { leagueId: "lg_x" }), /playerIds/);
});
