import assert from "node:assert/strict";
import { test } from "node:test";
import { attachRemaining, seedsFromTxs } from "./ledger.ts";
import {
  asLabeled,
  comparableMoves,
  decideCall,
  freezeFrom,
  gradeVsNoMove,
  posFilled,
  splitHoldout,
  startSlotsFrom,
} from "./spec.ts";

function seat(players, slots = { QB: 1, RB: 2, WR: 2, TE: 1 }) {
  return { starterSlots: slots, players };
}

function p(pos, slot, extra = {}) {
  return {
    playerId: extra.id ?? pos + slot,
    name: extra.name ?? pos,
    pos,
    slot,
    injury: extra.injury ?? null,
    bye: extra.bye ?? false,
  };
}

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

test("1QB + healthy starter and backup is filled; Out starter with no backup is a hole", () => {
  const slots = startSlotsFrom(["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"]);
  assert.equal(slots.QB, 1);
  const filled = seat([
    p("QB", "starter", { name: "Mahomes", injury: "Questionable" }),
    p("QB", "bench", { name: "Dart" }),
  ]);
  assert.equal(posFilled(filled, "QB"), true);
  const hole = seat([p("QB", "starter", { name: "Mahomes", injury: "Out" })]);
  assert.equal(posFilled(hole, "QB"), false);
  const byeHole = seat([p("QB", "starter", { bye: true })]);
  assert.equal(posFilled(byeHole, "QB"), false);
});

test("decideCall: Young vs Mahomes+Dart is no-move; hole at WR still adds", () => {
  const history = [
    won(1, 2, "x", 20, { pos: "QB" }),
    won(2, 3, "y", 30, { pos: "QB" }),
    won(3, 4, "z", 40, { pos: "QB" }),
    won(1, 5, "w1", 12, { pos: "WR" }),
    won(2, 6, "w2", 18, { pos: "WR" }),
    won(3, 7, "w3", 24, { pos: "WR" }),
  ];
  const guru = seat([
    p("QB", "starter", { name: "Mahomes", injury: "Questionable" }),
    p("QB", "bench", { name: "Dart" }),
    p("RB", "starter"),
    p("RB", "starter"),
    p("WR", "starter"),
    p("WR", "starter"),
    p("TE", "starter"),
  ]);
  const young = decideCall({
    remaining: 178,
    candidates: [{ playerId: "9228", pos: "QB", sleeperProj: 18, last3: null, seasonAvg: 22 }],
    history,
    spec: null,
    seat: guru,
  });
  assert.equal(young.kind, "no-move");
  assert.match(young.reason, /hole/i);

  const wrThin = seat([
    p("QB", "starter", { name: "Mahomes" }),
    p("QB", "bench", { name: "Dart" }),
    p("WR", "starter"),
  ]);
  const call = decideCall({
    remaining: 178,
    candidates: [
      { playerId: "9228", pos: "QB", sleeperProj: 18, last3: null, seasonAvg: 22 },
      { playerId: "star", pos: "WR", sleeperProj: 12, last3: 9, seasonAvg: 10 },
    ],
    history,
    spec: null,
    seat: wrThin,
  });
  assert.equal(call.kind, "add");
  if (call.kind === "add") {
    assert.equal(call.playerId, "star");
    assert.equal(call.pos, "WR");
    assert.equal(call.source, "quantile");
    assert.equal(call.comps, 3);
  }
});

test("decideCall: no FAAB → no-move; empty purse before ranking", () => {
  const empty = decideCall({
    remaining: 0,
    candidates: [{ playerId: "star", pos: "WR", sleeperProj: 12, last3: 9, seasonAvg: null }],
    history: [],
    spec: null,
    seat: seat([]),
  });
  assert.equal(empty.kind, "no-move");
});

test("comparableMoves is the bid-band set, not tape order", () => {
  const history = [
    won(1, 2, "a", 5, { pos: "QB" }),
    won(2, 3, "b", 80, { pos: "QB" }),
    won(3, 4, "c", 12, { pos: "WR" }),
  ];
  // remaining 178 → window 125–231; remainingBefore on these isolated wins is 200
  const qb = comparableMoves(history, "QB", 178);
  assert.equal(qb.length, 2);
  assert.deepEqual(
    qb.map((m) => m.playerId),
    ["a", "b"],
  );
});
