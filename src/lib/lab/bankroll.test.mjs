import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateBankroll } from "./bankroll.ts";
import { binomialTail } from "./bets.ts";

const g = (grade, odds = -110, season = 2025, week = 1) => ({
  gameId: `${season}_${String(week).padStart(2, "0")}_A_B`,
  market: "spread",
  side: "home",
  grade,
  units: grade === "win" ? 0.91 : grade === "loss" ? -1 : 0,
  oddsUsed: odds,
  lineUsed: null,
  clv: null,
  season,
  week,
});

test("binomial tail: the luck check", () => {
  assert.equal(binomialTail(0, 10, 0.5), 1);
  assert.equal(binomialTail(11, 10, 0.5), 0);
  // 42 of 78 at a 52.4% break-even is well within luck
  const p = binomialTail(42, 78, 0.524);
  assert.ok(p > 0.3 && p < 0.5, String(p));
  // 60 of 78 is not
  assert.ok(binomialTail(60, 78, 0.524) < 0.001);
});

test("flat staking does not compound; percent staking does", () => {
  const bets = [g("win"), g("win"), g("loss")];
  const flat = simulateBankroll({
    graded: bets,
    bankroll: 1000,
    policy: { type: "flat", unit: 10 },
    bootstrap: 0,
  });
  assert.equal(flat.final, 1008.18);
  assert.equal(flat.bets, 3);
  const pctSim = simulateBankroll({
    graded: bets,
    bankroll: 1000,
    policy: { type: "percent", pct: 1 },
    bootstrap: 0,
  });
  // 1% of a growing bankroll: 10, then 10.0909, then lose 1% of 1018.26
  assert.equal(
    pctSim.final,
    1008.08,
    "the third bet risks 1% of a larger bankroll, so the loss is larger",
  );
  assert.equal(pctSim.curve.length, 3);
});

test("kelly from history is flagged, and a losing sample stakes nothing", () => {
  const bets = [g("loss"), g("loss"), g("win")];
  const k = simulateBankroll({
    graded: bets,
    bankroll: 500,
    policy: { type: "kelly", fraction: 0.5 },
    bootstrap: 0,
  });
  assert.equal(k.winProbSource, "history");
  assert.equal(k.winProbUsed, 0.33);
  assert.equal(k.final, 500, "a 33% hit rate at -110 has negative Kelly, so no money moves");
  const given = simulateBankroll({
    graded: bets,
    bankroll: 500,
    policy: { type: "kelly", fraction: 0.25, cap: 2, winProb: 0.6 },
    bootstrap: 0,
  });
  assert.equal(given.winProbSource, "given");
  assert.ok(given.final < 500 && given.final > 480, "capped at 2% per bet, two losses then a win");
});

test("drawdown, losing run, and bust", () => {
  const bets = [g("loss"), g("loss"), g("loss"), g("win")];
  const s = simulateBankroll({
    graded: bets,
    bankroll: 100,
    policy: { type: "flat", unit: 40 },
    bootstrap: 0,
  });
  assert.equal(s.bust, true, "three 40-unit losses on a 100 bankroll");
  assert.equal(s.final, 0);
  assert.equal(s.longestLosingRun.bets, 3);
  assert.equal(s.maxDrawdown.pct, 100);
});

test("bootstrap is seeded and resamples the bets with replacement", () => {
  const bets = Array.from({ length: 40 }, (_, i) => g(i % 2 ? "win" : "loss", -110, 2025, i + 1));
  const a = simulateBankroll({
    graded: bets,
    bankroll: 1000,
    policy: { type: "percent", pct: 5 },
    bootstrap: 200,
    seed: 7,
  });
  const b = simulateBankroll({
    graded: bets,
    bankroll: 1000,
    policy: { type: "percent", pct: 5 },
    bootstrap: 200,
    seed: 7,
  });
  assert.deepEqual(a.bootstrap, b.bootstrap, "same seed, same band");
  assert.ok(a.bootstrap.final.p5 < a.bootstrap.final.p95, "resampling spreads the ending");
  assert.equal(a.bootstrap.runs, 200);
  assert.ok(
    a.bootstrap.final.p5 <= a.bootstrap.final.p50 && a.bootstrap.final.p50 <= a.bootstrap.final.p95,
  );
  assert.ok(a.bootstrap.probLoss > 0.5, "20-20 at -110 loses the vig in most samples");
});
