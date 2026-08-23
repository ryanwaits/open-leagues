import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  lastPointOnly,
  matchupChartReady,
  mergeSamples,
  pairIsFinal,
  sampleMatchup,
  samplesFromTicks,
} from "./matchup-series.ts";

function starter(playerId, state = "in", detail = "9:41 - 3rd", points = 10) {
  return {
    slot: "WR",
    playerId,
    player: { player_id: playerId, team: "SF", position: "WR" },
    points,
    game: { state, detail, opp: null, gameId: "g1" },
  };
}

function side(rosterId, teamName, playerIds, points = 20) {
  return {
    rosterId,
    teamName,
    manager: teamName,
    avatar: null,
    points,
    starters: playerIds.map((id) => starter(id)),
  };
}

function outlookMap(ids, mean = 15, sd = 5) {
  const map = {};
  for (const id of ids) map[id] = { mean, sd };
  return map;
}

function pair(homeRosterId = 1, awayRosterId = 2) {
  return {
    matchupId: 1,
    home: side(homeRosterId, "Home Team", ["p1", "p2"], 40),
    away: side(awayRosterId, "Away Team", ["p3", "p4"], 30),
  };
}

test("sampleMatchup: youPct in (0,100), youProj = youPts + remaining", () => {
  const p = pair();
  const map = outlookMap(["p1", "p2", "p3", "p4"]);
  const sample = sampleMatchup(p, map, 1, 1000);
  assert.ok(sample);
  assert.ok(sample.youPct > 0 && sample.youPct < 100, `got ${sample.youPct}`);
  // Two "in" starters each ~half remaining at mean 15 => ~15 remaining total.
  assert.ok(
    Math.abs(sample.youProj - (40 + 15)) < 5,
    `youProj ${sample.youProj} not close to pts+remaining`,
  );
  assert.equal(sample.at, 1000);
});

test("sampleMatchup: flipping mine swaps you/them", () => {
  const p = pair(1, 2);
  const map = outlookMap(["p1", "p2", "p3", "p4"]);
  const asHome = sampleMatchup(p, map, 1, 1000);
  const asAway = sampleMatchup(p, map, 2, 1000);
  assert.ok(asHome && asAway);
  assert.equal(asHome.youPts, asAway.themPts);
  assert.equal(asHome.themPts, asAway.youPts);
  assert.ok(Math.abs(asHome.youPct + asAway.youPct - 100) < 0.01);
});

test("sampleMatchup: null with no away side", () => {
  const p = pair();
  const solo = { ...p, away: null };
  assert.equal(sampleMatchup(solo, {}, 1), null);
});

test("sampleMatchup: null with an empty outlook map (outlooks not loaded yet)", () => {
  const p = pair();
  assert.equal(sampleMatchup(p, {}, 1, 1000), null);
});

test("sampleMatchup: null when the map is missing even one starter's outlook", () => {
  const p = pair();
  const map = outlookMap(["p1", "p2", "p3"]); // p4 missing
  assert.equal(sampleMatchup(p, map, 1, 1000), null);
});

test("sampleMatchup: a full map produces a real sample", () => {
  const p = pair();
  const map = outlookMap(["p1", "p2", "p3", "p4"]);
  const sample = sampleMatchup(p, map, 1, 1000);
  assert.ok(sample);
  assert.ok(sample.youProj + sample.themProj > 0);
});

test("samplesFromTicks: signs correctly when mine is the away roster", () => {
  const p = pair(1, 2);
  const rows = [{ at: 1000, homePts: 40, awayPts: 30, homeProj: 100, awayProj: 90, homePct: 65 }];
  const asAway = samplesFromTicks(rows, p, 2);
  assert.equal(asAway.length, 1);
  const s = asAway[0];
  assert.equal(s.youPts, 30);
  assert.equal(s.themPts, 40);
  assert.equal(s.youProj, 90);
  assert.equal(s.themProj, 100);
  assert.equal(s.youPct, 35);
  assert.equal(s.margin, -10);
});

test("samplesFromTicks: home-signed by default (mine null or home)", () => {
  const p = pair(1, 2);
  const rows = [{ at: 1000, homePts: 40, awayPts: 30, homeProj: 100, awayProj: 90, homePct: 65 }];
  const asHome = samplesFromTicks(rows, p, 1);
  assert.equal(asHome[0].youPts, 40);
  assert.equal(asHome[0].youPct, 65);
});

test("mergeSamples: sorts by time, dedupes equal `at` preferring session, caps", () => {
  const stored = [
    { at: 1, youProj: 1, themProj: 1, youPts: 1, themPts: 1, youPct: 1, margin: 0, live: true },
    { at: 3, youProj: 1, themProj: 1, youPts: 1, themPts: 1, youPct: 1, margin: 0, live: true },
  ];
  const session = [
    { at: 2, youProj: 2, themProj: 2, youPts: 2, themPts: 2, youPct: 2, margin: 0, live: true },
    { at: 3, youProj: 99, themProj: 1, youPts: 1, themPts: 1, youPct: 1, margin: 98, live: true },
  ];
  const merged = mergeSamples(stored, session);
  assert.deepEqual(
    merged.map((s) => s.at),
    [1, 2, 3],
  );
  // The `at: 3` sample came from session, not stored.
  assert.equal(merged.find((s) => s.at === 3).youProj, 99);
});

test("mergeSamples: caps to the most-recent `cap` entries", () => {
  const stored = Array.from({ length: 10 }, (_, i) => ({
    at: i,
    youProj: i,
    themProj: 0,
    youPts: 0,
    themPts: 0,
    youPct: 0,
    margin: 0,
    live: true,
  }));
  const merged = mergeSamples(stored, [], 3);
  assert.deepEqual(
    merged.map((s) => s.at),
    [7, 8, 9],
  );
});

test("lastPointOnly: empty in, empty out", () => {
  assert.deepEqual(lastPointOnly([]), []);
});

test("lastPointOnly: duplicates the final point a moment earlier (liveline needs >= 2 points)", () => {
  const points = [
    { time: 1, value: 10 },
    { time: 2, value: 20 },
    { time: 3, value: 30 },
  ];
  assert.deepEqual(lastPointOnly(points), [
    { time: 2, value: 30 },
    { time: 3, value: 30 },
  ]);
});

test("pairIsFinal: true only when all starters are post", () => {
  const p = pair();
  assert.equal(pairIsFinal(p), false);

  const post = {
    ...p,
    home: {
      ...p.home,
      starters: p.home.starters.map((s) => ({ ...s, game: { ...s.game, state: "post" } })),
    },
    away: {
      ...p.away,
      starters: p.away.starters.map((s) => ({ ...s, game: { ...s.game, state: "post" } })),
    },
  };
  assert.equal(pairIsFinal(post), true);

  const mixed = {
    ...post,
    away: {
      ...post.away,
      starters: [post.away.starters[0], { ...post.away.starters[1], game: { state: "in" } }],
    },
  };
  assert.equal(pairIsFinal(mixed), false);
});

function withState(p, state) {
  return {
    ...p,
    home: {
      ...p.home,
      starters: p.home.starters.map((s) => ({ ...s, game: { ...s.game, state } })),
    },
    away: {
      ...p.away,
      starters: p.away.starters.map((s) => ({ ...s, game: { ...s.game, state } })),
    },
  };
}

test("matchupChartReady: all games pre, 0 ticks -> false", () => {
  const p = withState(pair(), "pre");
  assert.equal(matchupChartReady(p, 0), false);
});

test("matchupChartReady: all games pre, 3 ticks -> true", () => {
  const p = withState(pair(), "pre");
  assert.equal(matchupChartReady(p, 3), true);
});

test("matchupChartReady: one starter in/post, 0 ticks -> true", () => {
  const p = withState(pair(), "pre");
  const started = {
    ...p,
    home: {
      ...p.home,
      starters: [p.home.starters[0], { ...p.home.starters[1], game: { state: "in" } }],
    },
  };
  assert.equal(matchupChartReady(started, 0), true);
});
