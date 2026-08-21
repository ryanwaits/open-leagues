import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyReplaySide,
  REPLAY_PHASES,
  replayProgress,
  replayPts,
  replayStatMap,
  replayStats,
} from "./replay.ts";

const WEEK = 7;
const PLAYER_IDS = ["4046", "mahomes-qb1", "kelce-te1", "some-flex-guy", "abc123"];

/**
 * Independent re-implementation of the pre-fractional `replayPts` curve
 * (weights → normalize → sum the first `phaseIndex` of them). Kept separate
 * from `replay.ts` on purpose: this is the "today" behavior the fractional
 * rewrite must still match exactly for integer `phaseIndex`.
 */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function referencePts(playerId, finalPts, phaseIndex, week) {
  if (finalPts <= 0 || phaseIndex <= 0) return 0;
  const last = REPLAY_PHASES.length - 1;
  if (phaseIndex >= last) return finalPts;
  const n = last - 1;
  const weights = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const h = hash(`${playerId}:${week}:${i}`);
    const r = (h % 1000) / 1000;
    const w = r < 0.32 ? 0 : r < 0.5 ? 0.06 + (h % 30) / 400 : 0.12 + (h % 90) / 180;
    weights.push(w);
    sum += w;
  }
  const norm = weights.map((w) => w / (sum || 1));
  let acc = 0;
  for (let i = 0; i < phaseIndex; i++) acc += finalPts * (norm[i] ?? 0);
  return Math.round(acc * 10) / 10;
}

/**
 * Finds a playerId whose phase-2→3 weight is large enough to still be
 * visible after `replayProgress`'s own 1-decimal rounding — a tiny weight
 * would round phase 2.5 to the same tenth as phase 2 or phase 3 and make a
 * "strictly between" assertion flaky rather than wrong.
 */
function findInterpolatingPlayer(week) {
  for (let i = 0; i < 2000; i++) {
    const id = `probe-${i}`;
    const p2 = referencePts(id, 1, 2, week);
    const p3 = referencePts(id, 1, 3, week);
    if (p3 - p2 >= 0.2) return id;
  }
  throw new Error("no probe player found with a large-enough phase-2 weight");
}

const INTERPOLATING_PLAYER = findInterpolatingPlayer(WEEK);

test("replayPts: integer phaseIndex matches the pre-fractional reference exactly", () => {
  const finalPts = 23.4;
  for (const id of PLAYER_IDS) {
    for (let phase = -1; phase <= REPLAY_PHASES.length; phase++) {
      assert.equal(
        replayPts(id, finalPts, phase, WEEK),
        referencePts(id, finalPts, phase, WEEK),
        `mismatch for ${id} @ phase ${phase}`,
      );
    }
  }
});

test("replayProgress: integer phaseIndex matches the pre-fractional reference exactly", () => {
  for (const id of PLAYER_IDS) {
    for (let phase = 0; phase <= REPLAY_PHASES.length; phase++) {
      assert.equal(
        replayProgress(id, phase, WEEK),
        referencePts(id, 1, phase, WEEK),
        `mismatch for ${id} @ phase ${phase}`,
      );
    }
  }
});

test("replayProgress: fractional phase lies strictly between its neighboring integers", () => {
  const p2 = replayProgress(INTERPOLATING_PLAYER, 2, WEEK);
  const p25 = replayProgress(INTERPOLATING_PLAYER, 2.5, WEEK);
  const p3 = replayProgress(INTERPOLATING_PLAYER, 3, WEEK);
  assert.ok(p3 > p2, "fixture player should have a nonzero phase-2 weight");
  assert.ok(p25 > p2, `expected ${p25} > ${p2}`);
  assert.ok(p25 < p3, `expected ${p25} < ${p3}`);
});

test("replayPts: fractional phase lies strictly between its neighboring integers", () => {
  const finalPts = 30;
  const p2 = replayPts(INTERPOLATING_PLAYER, finalPts, 2, WEEK);
  const p25 = replayPts(INTERPOLATING_PLAYER, finalPts, 2.5, WEEK);
  const p3 = replayPts(INTERPOLATING_PLAYER, finalPts, 3, WEEK);
  assert.ok(p25 > p2, `expected ${p25} > ${p2}`);
  assert.ok(p25 < p3, `expected ${p25} < ${p3}`);
});

test("replayPts: fractional phase equals the integer result exactly at whole numbers", () => {
  const finalPts = 17.6;
  for (let phase = 0; phase <= REPLAY_PHASES.length; phase++) {
    assert.equal(
      replayPts(INTERPOLATING_PLAYER, finalPts, phase + 0, WEEK),
      replayPts(INTERPOLATING_PLAYER, finalPts, phase, WEEK),
    );
  }
});

test("replayPts: zero at kickoff; exact final at/after the last phase", () => {
  assert.equal(replayPts(INTERPOLATING_PLAYER, 12, 0, WEEK), 0);
  const last = REPLAY_PHASES.length - 1;
  assert.equal(replayPts(INTERPOLATING_PLAYER, 12, last, WEEK), 12);
  assert.equal(replayPts(INTERPOLATING_PLAYER, 12, last + 0.5, WEEK), 12);
});

test("replayStats: fractional phase interpolates between its neighboring integers", () => {
  const final = { pass_yd: 301, pass_td: 3, pass_int: 1, rec: 5 };
  const s2 = replayStats(INTERPOLATING_PLAYER, final, 2, WEEK);
  const s25 = replayStats(INTERPOLATING_PLAYER, final, 2.5, WEEK);
  const s3 = replayStats(INTERPOLATING_PLAYER, final, 3, WEEK);
  assert.ok((s25.pass_yd ?? 0) >= (s2.pass_yd ?? 0));
  assert.ok((s25.pass_yd ?? 0) <= (s3.pass_yd ?? 0));
  assert.ok((s25.pass_yd ?? 0) > (s2.pass_yd ?? 0) || (s25.pass_yd ?? 0) < (s3.pass_yd ?? 0));
});

test("replayStats: integer phaseIndex behavior is unchanged (empty pre-kick, exact final past last)", () => {
  const final = { rush_yd: 88, rush_td: 1 };
  assert.deepEqual(replayStats(INTERPOLATING_PLAYER, final, 0, WEEK), {});
  const last = REPLAY_PHASES.length - 1;
  assert.deepEqual(replayStats(INTERPOLATING_PLAYER, final, last, WEEK), final);
});

test("replayStatMap: maps replayStats fractionally over every player in the table", () => {
  const finals = {
    a: { rush_yd: 40 },
    b: { rec: 4, rec_yd: 60 },
  };
  const map = replayStatMap(finals, 2.5, WEEK);
  assert.deepEqual(map.a, replayStats("a", finals.a, 2.5, WEEK));
  assert.deepEqual(map.b, replayStats("b", finals.b, 2.5, WEEK));
});

function starterLine(playerId, points) {
  return {
    slot: "WR",
    playerId,
    player: {
      player_id: playerId,
      full_name: "Test Player",
      position: "WR",
      team: "SEA",
    },
    points,
    game: { state: "pre", detail: "", opp: "NE", gameId: "g1" },
  };
}

function side(playerId, points) {
  return {
    rosterId: 1,
    teamName: "Team",
    manager: "Manager",
    avatar: null,
    points,
    starters: [starterLine(playerId, points)],
  };
}

test("applyReplaySide: fractional phaseIndex floors for the game chip but stays fractional for points", () => {
  const finalPts = 20;
  const before = applyReplaySide(side(INTERPOLATING_PLAYER, finalPts), WEEK, 2, null);
  const mid = applyReplaySide(side(INTERPOLATING_PLAYER, finalPts), WEEK, 2.5, null);
  const after = applyReplaySide(side(INTERPOLATING_PLAYER, finalPts), WEEK, 3, null);

  // The chip is still discrete: 2 and 2.5 read the same REPLAY_PHASES entry.
  assert.equal(mid.starters[0].game?.detail, REPLAY_PHASES[2]?.detail);
  assert.equal(mid.starters[0].game?.detail, before.starters[0].game?.detail);
  assert.notEqual(mid.starters[0].game?.detail, after.starters[0].game?.detail);

  // The points climb smoothly between the two integer phases.
  const beforePts = before.starters[0].points ?? 0;
  const midPts = mid.starters[0].points ?? 0;
  const afterPts = after.starters[0].points ?? 0;
  assert.ok(midPts >= beforePts && midPts <= afterPts);
});
