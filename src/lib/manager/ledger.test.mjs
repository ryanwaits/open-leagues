import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachRemaining,
  joinSources,
  lastN,
  mean,
  seedsFromTxs,
  spentOf,
  weekIsFrozen,
} from "./ledger.ts";

const budget = 200;

test("weekIsFrozen: prior season and prior weeks only", () => {
  const nfl = { season: "2026", week: 2, display_week: 2 };
  assert.equal(weekIsFrozen("2025", 18, nfl), true);
  assert.equal(weekIsFrozen("2026", 1, nfl), true);
  assert.equal(weekIsFrozen("2026", 2, nfl), false);
  assert.equal(weekIsFrozen("2027", 1, nfl), false);
});

test("mean / lastN empty is null", () => {
  assert.equal(mean([]), null);
  assert.equal(lastN([1, 2, 3, 4], 3), 3);
});

test("FAAB remaining never goes negative; only wins spend", () => {
  const w1 = seedsFromTxs(1, [
    {
      transaction_id: "a",
      type: "waiver",
      status: "complete",
      adds: { p1: 1 },
      drops: { old: 1 },
      settings: { waiver_bid: 22, seq: 1 },
    },
    {
      transaction_id: "b",
      type: "waiver",
      status: "failed",
      adds: { p2: 1 },
      settings: { waiver_bid: 50, seq: 2 },
    },
    {
      transaction_id: "c",
      type: "free_agent",
      status: "complete",
      adds: { p3: 2 },
      drops: { x: 2 },
    },
  ]);
  const w2 = seedsFromTxs(2, [
    {
      transaction_id: "d",
      type: "waiver",
      status: "complete",
      adds: { p4: 1 },
      settings: { waiver_bid: 180, seq: 1 },
    },
  ]);
  const rows = attachRemaining(budget, [...w1, ...w2]);
  const ryan = rows.filter((r) => r.rosterId === 1);
  assert.equal(ryan[0].remainingBefore, 200);
  assert.equal(ryan[0].type, "waiver_won");
  assert.equal(ryan[1].type, "waiver_lost");
  assert.equal(ryan[1].remainingBefore, 178);
  assert.equal(ryan[2].remainingBefore, 178);
  assert.equal(ryan[2].bid, 180);
  assert.equal(spentOf(budget, rows, 1), 200);
  assert.ok(rows.every((r) => r.remainingBefore >= 0));
  const wins = rows.filter((r) => r.type === "waiver_won");
  const sum = wins.reduce((n, r) => n + (r.bid ?? 0), 0);
  assert.equal(sum, 202);
});

test("joinSources uses only prior weeks for last3 / season avg", () => {
  const seeds = seedsFromTxs(4, [
    {
      transaction_id: "x",
      type: "waiver",
      status: "complete",
      adds: { p1: 1 },
      settings: { waiver_bid: 5, seq: 1 },
    },
  ]);
  const rows = attachRemaining(100, seeds);
  const joined = joinSources(
    rows,
    { 1: { p1: 10 }, 2: { p1: 12 }, 3: { p1: 8 }, 4: { p1: 20 } },
    { 4: { p1: 11.5 } },
    5,
  );
  assert.equal(joined[0].sleeperProj, 11.5);
  assert.equal(joined[0].last3, 10);
  assert.equal(joined[0].seasonAvg, 10);
  assert.equal(joined[0].actual, 20);
});
