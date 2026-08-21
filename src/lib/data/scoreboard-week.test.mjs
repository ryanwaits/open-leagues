import { test } from "bun:test";
import assert from "node:assert/strict";
import { resolveScoreboard, scoreboardIsNow } from "./scoreboard-week.ts";

const pre3 = { week: 3, season: 2026, seasonType: "pre" };
const reg5 = { week: 5, season: 2026, seasonType: "regular" };

test("empty search follows ESPN's current pre week, not Sleeper display_week", () => {
  assert.deepEqual(resolveScoreboard({}, pre3), { seasonType: "pre", week: 3, season: 2026 });
});

test("Pre tab during preseason stays on the current pre week", () => {
  assert.deepEqual(resolveScoreboard({ kind: "pre" }, pre3), {
    seasonType: "pre",
    week: 3,
    season: 2026,
  });
});

test("Regular tab during preseason opens regular week 1, not the pre week number", () => {
  assert.deepEqual(resolveScoreboard({ kind: "regular" }, pre3), {
    seasonType: "regular",
    week: 1,
    season: 2026,
  });
});

test("Post tab during preseason opens post week 1", () => {
  assert.deepEqual(resolveScoreboard({ kind: "post" }, pre3), {
    seasonType: "post",
    week: 1,
    season: 2026,
  });
});

test("an explicit week wins", () => {
  assert.deepEqual(resolveScoreboard({ kind: "pre", week: 2 }, pre3), {
    seasonType: "pre",
    week: 2,
    season: 2026,
  });
});

test("empty search in regular season is the current regular week", () => {
  assert.deepEqual(resolveScoreboard({}, reg5), { seasonType: "regular", week: 5, season: 2026 });
});

test("Pre tab during regular season opens pre week 1", () => {
  assert.deepEqual(resolveScoreboard({ kind: "pre" }, reg5), {
    seasonType: "pre",
    week: 1,
    season: 2026,
  });
});

test("Regular tab during regular season stays on the current week", () => {
  assert.deepEqual(resolveScoreboard({ kind: "regular" }, reg5), {
    seasonType: "regular",
    week: 5,
    season: 2026,
  });
});

test("waits for ESPN when nothing is in the URL", () => {
  assert.equal(resolveScoreboard({}, null), null);
});

test("explicit search does not need ESPN", () => {
  assert.deepEqual(resolveScoreboard({ kind: "pre", week: 3, season: 2026 }, null), {
    seasonType: "pre",
    week: 3,
    season: 2026,
  });
});

test("scoreboardIsNow matches the unfiltered ESPN board", () => {
  assert.equal(scoreboardIsNow({ seasonType: "pre", week: 3, season: 2026 }, pre3), true);
  assert.equal(scoreboardIsNow({ seasonType: "regular", week: 1, season: 2026 }, pre3), false);
});
