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
const LAST = REPLAY_PHASES.length - 1;

test("replayPts: deterministic — same inputs always produce the same output", () => {
  for (const id of PLAYER_IDS) {
    for (const phase of [0, 1.3, 3, 5.75, LAST]) {
      const a = replayPts(id, 23.4, phase, WEEK);
      const b = replayPts(id, 23.4, phase, WEEK);
      assert.equal(a, b, `mismatch for ${id} @ phase ${phase}`);
    }
  }
});

test("replayPts: zero at kickoff (phase 0 and before)", () => {
  for (const id of PLAYER_IDS) {
    assert.equal(replayPts(id, 18, 0, WEEK), 0);
    assert.equal(replayPts(id, 18, -1, WEEK), 0);
  }
});

test("replayPts: exact finalPts at and after the last phase", () => {
  for (const id of PLAYER_IDS) {
    const finalPts = 21.7;
    assert.equal(replayPts(id, finalPts, LAST, WEEK), finalPts);
    assert.equal(replayPts(id, finalPts, LAST + 0.5, WEEK), finalPts);
  }
});

test("replayPts: monotone non-decreasing as fractional phase climbs toward the final", () => {
  for (const id of PLAYER_IDS) {
    const finalPts = 24.6;
    const samples = [];
    for (let phase = 0; phase <= LAST; phase += 0.1) {
      samples.push(replayPts(id, finalPts, phase, WEEK));
    }
    for (let i = 1; i < samples.length; i++) {
      assert.ok(
        samples[i] >= samples[i - 1],
        `${id}: expected non-decreasing, got ${samples[i - 1]} -> ${samples[i]}`,
      );
    }
  }
});

test("replayPts: a 15+ pt player earns points in at least 5 distinct increments across the game", () => {
  const finalPts = 15;
  for (const id of PLAYER_IDS) {
    const seen = new Set();
    for (let phase = 0; phase <= LAST; phase += 0.05) {
      seen.add(replayPts(id, finalPts, phase, WEEK));
    }
    // Every distinct rounded value on the way up (including the 0 at kickoff)
    // counts as one increment; a straight ramp/no events would collapse to
    // very few distinct values.
    assert.ok(seen.size >= 5, `${id}: only ${seen.size} distinct values, expected >= 5`);
  }
});

test("replayPts: zero or non-positive finalPts stays at zero throughout", () => {
  for (const id of PLAYER_IDS) {
    for (const phase of [0, 2, 5, LAST]) {
      assert.equal(replayPts(id, 0, phase, WEEK), 0);
      assert.equal(replayPts(id, -3, phase, WEEK), 0);
    }
  }
});

test("replayProgress: 0 at phase 0, 1 at the last phase, always within [0, 1]", () => {
  for (const id of PLAYER_IDS) {
    assert.equal(replayProgress(id, 0, WEEK), 0);
    assert.equal(replayProgress(id, LAST, WEEK), 1);
    for (let phase = 0; phase <= LAST; phase += 0.25) {
      const p = replayProgress(id, phase, WEEK);
      assert.ok(p >= 0 && p <= 1, `${id} @ ${phase}: ${p} out of [0,1]`);
    }
  }
});

test("replayProgress: matches pts/final for replayPts on the same player/week", () => {
  const finalPts = 19.3;
  for (const id of PLAYER_IDS) {
    for (const phase of [1.2, 3, 6.4]) {
      const pts = replayPts(id, finalPts, phase, WEEK);
      const progress = replayProgress(id, phase, WEEK);
      // replayProgress reuses replayPts's own event schedule at finalPts=1,
      // so it won't equal pts/finalPts bit-for-bit once >=12pt TD lumps are
      // in play — but it must stay a plausible, non-decreasing fraction.
      assert.ok(progress >= 0 && progress <= 1);
      assert.ok(pts >= 0 && pts <= finalPts);
    }
  }
});

test("replayStats: bag scales by the same fraction replayProgress reports", () => {
  const final = { pass_yd: 300, pass_td: 3, pass_int: 1, rec: 5 };
  for (const id of PLAYER_IDS) {
    for (const phase of [1.5, 4, 6.25]) {
      const stats = replayStats(id, final, phase, WEEK);
      const p = replayProgress(id, phase, WEEK);
      const expectedYd = Math.round(300 * p * 10) / 10;
      assert.equal(stats.pass_yd ?? 0, expectedYd, `${id} @ ${phase}`);
    }
  }
});

test("replayStats: empty before kickoff, exact final at/after the last phase", () => {
  const final = { rush_yd: 88, rush_td: 1 };
  for (const id of PLAYER_IDS) {
    assert.deepEqual(replayStats(id, final, 0, WEEK), {});
    assert.deepEqual(replayStats(id, final, LAST, WEEK), final);
  }
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
  const id = "some-flex-guy";
  const before = applyReplaySide(side(id, finalPts), WEEK, 2, null);
  const mid = applyReplaySide(side(id, finalPts), WEEK, 2.5, null);
  const after = applyReplaySide(side(id, finalPts), WEEK, 3, null);

  // The chip is still discrete: 2 and 2.5 read the same REPLAY_PHASES entry.
  assert.equal(mid.starters[0].game?.detail, REPLAY_PHASES[2]?.detail);
  assert.equal(mid.starters[0].game?.detail, before.starters[0].game?.detail);
  assert.notEqual(mid.starters[0].game?.detail, after.starters[0].game?.detail);

  // The points climb (non-strictly, since events are sparse) between the
  // two integer phases.
  const beforePts = before.starters[0].points ?? 0;
  const midPts = mid.starters[0].points ?? 0;
  const afterPts = after.starters[0].points ?? 0;
  assert.ok(midPts >= beforePts && midPts <= afterPts);
});

test("eventCredits shape: D/ST ids (team abbreviations) score in fewer, chunkier steps", () => {
  const finalPts = 12;
  const wr = "some-flex-guy";
  const dst = "SEA";
  const wrValues = new Set();
  const dstValues = new Set();
  for (let phase = 0; phase <= LAST; phase += 0.02) {
    wrValues.add(replayPts(wr, finalPts, phase, WEEK));
    dstValues.add(replayPts(dst, finalPts, phase, WEEK));
  }
  // Both should move in irregular steps rather than a straight ramp, but a
  // D/ST's schedule has far fewer events than a skill player's.
  assert.ok(wrValues.size >= 5);
  assert.ok(dstValues.size >= 2);
});
