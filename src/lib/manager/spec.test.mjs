import assert from "node:assert/strict";
import { test } from "node:test";
import { attachRemaining, seedsFromTxs } from "./ledger.ts";
import { asLabeled, decideCall, freezeFrom, gradeVsNoMove, splitHoldout } from "./spec.ts";

function won(week, rosterId, playerId, bid, extra = {}) {
  const seeds = seedsFromTxs(week, [
    {
      transaction_id: `${week}-${playerId}`,
      type: "waiver",
      status: "complete",
      adds: { [playerId]: rosterId },
      settings: { waiver_bid: bid, seq: 1 },
    },
  ]);
  const [row] = attachRemaining(200, seeds);
  return asLabeled(
    { ...row, actual: extra.actual ?? 12, sleeperProj: extra.proj ?? 10 },
    { leagueId: extra.leagueId ?? "L1", season: extra.season ?? "2025", pos: extra.pos ?? "RB" },
  );
}

test("one season: last 4 weeks are holdout", () => {
  const moves = [];
  for (let w = 1; w <= 10; w++) moves.push(won(w, 1, `p${w}`, 5, { actual: 8 }));
  const split = splitHoldout(moves);
  assert.equal(split.holdoutWeeks.length, 4);
  assert.deepEqual(
    split.holdoutWeeks.map((w) => w.week),
    [7, 8, 9, 10],
  );
  assert.equal(split.discover.length, 6);
});

test("two seasons: later season is holdout only if it has 4+ weeks", () => {
  const a = [won(1, 1, "p", 5, { season: "2025" }), won(2, 1, "q", 5, { season: "2025" })];
  const thin = [...a, won(1, 1, "r", 5, { season: "2026", leagueId: "L2" })];
  const splitThin = splitHoldout(thin);
  assert.ok(splitThin.holdout.every((m) => m.season === "2025"));

  const fat = [];
  for (let w = 1; w <= 5; w++) fat.push(won(w, 1, `a${w}`, 5, { season: "2025" }));
  for (let w = 1; w <= 4; w++) fat.push(won(w, 1, `b${w}`, 5, { season: "2026", leagueId: "L2" }));
  const splitFat = splitHoldout(fat);
  assert.ok(splitFat.holdout.every((m) => m.season === "2026"));
  assert.ok(splitFat.discover.every((m) => m.season === "2025"));
});

test("grade vs always-no-move: wins with points beat it", () => {
  const holdout = [won(15, 1, "p", 10, { actual: 14 }), won(16, 1, "q", 4, { actual: 3 })];
  const g = gradeVsNoMove(holdout);
  assert.equal(g.n, 2);
  assert.equal(g.pointsVsNoMove, 17);
  assert.equal(g.beatNoMove, true);
  assert.equal(gradeVsNoMove([]).beatNoMove, false);
});

test("freezeFrom refuses a holdout that does not beat no-move", () => {
  const discover = [won(1, 1, "p", 10, { actual: 12, proj: 11 })];
  const holdout = [won(15, 1, "q", 10, { actual: 0 })];
  assert.equal(freezeFrom("s", "L1", discover, holdout, "t"), null);
  const ok = freezeFrom("s", "L1", discover, [won(15, 1, "q", 10, { actual: 9 })], "t");
  assert.ok(ok);
  assert.equal(ok.holdout.beatNoMove, true);
  assert.ok(ok.bidPctRemaining.RB.n >= 1);
});

test("decideCall: no FAAB → no-move; otherwise quantile band", () => {
  const history = [
    won(1, 2, "x", 20, { pos: "WR" }),
    won(2, 3, "y", 30, { pos: "WR" }),
    won(3, 4, "z", 40, { pos: "WR" }),
  ];
  const empty = decideCall({ remaining: 0, candidates: [], history, spec: null });
  assert.equal(empty.kind, "no-move");
  const call = decideCall({
    remaining: 178,
    candidates: [{ playerId: "star", pos: "WR", sleeperProj: 12, last3: 9 }],
    history,
    spec: null,
  });
  assert.equal(call.kind, "add");
  if (call.kind === "add") {
    assert.equal(call.playerId, "star");
    assert.equal(call.source, "quantile");
    assert.ok(call.bidHi <= 178);
    assert.ok(call.bidLo <= call.bidHi);
    assert.equal(call.comps, 3);
  }
});
