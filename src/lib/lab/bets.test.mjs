import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateBets,
  gradeBet,
  impliedProbability,
  profitPerUnit,
  sampleGames,
  summarize,
} from "./bets.ts";

// 2025_14_DAL_DET, real: DET home, spread_line 3.5 (home favored), total 55.5, DET 44 DAL 30.
const game = {
  gameId: "2025_14_DAL_DET",
  season: 2025,
  week: 14,
  home: "DET",
  away: "DAL",
  spread: 3.5,
  total: 55.5,
  homeMoneyline: -192,
  awayMoneyline: 160,
  homeSpreadOdds: -110,
  awaySpreadOdds: -110,
  overOdds: -110,
  underOdds: -110,
  result: 14,
  points: 74,
  homeScore: 44,
  awayScore: 30,
  divGame: false,
  roof: "dome",
  surface: "fieldturf",
  homeRest: 7,
  awayRest: 7,
  weekday: "Thursday",
  gameday: "2025-12-04",
  gametime: "20:15",
  homeQb: "Jared Goff",
  awayQb: "Dak Prescott",
  referee: null,
};

test("odds arithmetic", () => {
  assert.equal(profitPerUnit(-110), 100 / 110);
  assert.equal(profitPerUnit(160), 1.6);
  assert.equal(Math.round(impliedProbability(-192) * 1000) / 1000, 0.658);
  assert.equal(Math.round(impliedProbability(160) * 1000) / 1000, 0.385);
});

test("spread, total, and moneyline grade against nflverse sign conventions", () => {
  const home = gradeBet(game, { gameId: game.gameId, market: "spread", side: "home" });
  assert.equal(home.grade, "win", "DET -3.5 covered a 14-point win");
  assert.equal(home.units, 0.91);
  const away = gradeBet(game, { gameId: game.gameId, market: "spread", side: "away", stake: 2 });
  assert.equal(away.grade, "loss");
  assert.equal(away.units, -2);
  const over = gradeBet(game, { gameId: game.gameId, market: "total", side: "over" });
  assert.equal(over.grade, "win");
  const ml = gradeBet(game, { gameId: game.gameId, market: "moneyline", side: "away" });
  assert.equal(ml.grade, "loss");
  assert.equal(ml.oddsUsed, 160);
});

test("a taken number that differs from the close records closing-line value", () => {
  // took DET -2.5 when it closed -3.5: +1 point of CLV, still a win
  const b = gradeBet(game, { gameId: game.gameId, market: "spread", side: "home", line: 2.5 });
  assert.equal(b.clv, 1);
  const u = gradeBet(game, { gameId: game.gameId, market: "total", side: "under", line: 57.5 });
  assert.equal(u.clv, 2, "under 57.5 vs a 55.5 close is two points of value");
  assert.equal(u.grade, "loss", "…and it still lost, 74 points were scored");
});

test("pushes and voids", () => {
  const push = gradeBet(
    { ...game, result: 3 },
    { gameId: game.gameId, market: "spread", side: "home", line: 3 },
  );
  assert.equal(push.grade, "push");
  assert.equal(push.units, 0);
  const unplayed = gradeBet(
    { ...game, result: null, points: null },
    { gameId: game.gameId, market: "total", side: "over" },
  );
  assert.equal(unplayed.grade, "void");
  const missing = gradeBet(undefined, { gameId: "nope", market: "moneyline", side: "home" });
  assert.equal(missing.grade, "void");
});

test("summary: record, roi, break-even, drawdown, streaks, by season", () => {
  const g2 = { ...game, gameId: "2024_01_A_B", season: 2024, week: 1, result: -7, points: 40 };
  const graded = evaluateBets(
    [game, g2],
    [
      { gameId: game.gameId, market: "spread", side: "home" }, // win +0.91
      { gameId: game.gameId, market: "total", side: "under" }, // loss -1
      { gameId: g2.gameId, market: "spread", side: "home" }, // loss -1 (home lost by 7, favored by 3.5)
      { gameId: "missing", market: "spread", side: "home" }, // void
    ],
  );
  const s = summarize(graded);
  assert.equal(s.bets, 4);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 2);
  assert.equal(s.voids, 1);
  assert.equal(s.staked, 3);
  assert.equal(s.units, -1.09);
  assert.equal(s.roi, -0.36);
  assert.equal(s.winRate, 0.33);
  assert.equal(s.breakEven, 0.52, "at -110 you need 52.4%");
  assert.equal(s.longestLoss, 1, "season order: 2024 loss, 2025 win, 2025 loss");
  assert.equal(
    s.maxDrawdown,
    1.09,
    "season order: 2024 loss (−1), 2025 win (+0.91) then loss (−1)",
  );
  assert.equal(s.bySeason["2025"].roi, -0.04, "−0.09 over 2 units; JS rounds −4.5 up");
  assert.deepEqual(Object.keys(s.bySeason).sort(), ["2024", "2025"]);
  assert.equal(s.bySeason["2024"].units, -1);
});

test("sampleGames is the cohort language: home dogs, spread bands, rest, roof", () => {
  const games = [
    game,
    { ...game, gameId: "x1", spread: -2.5, roof: "outdoors", homeRest: 10, awayRest: 6 },
    { ...game, gameId: "x2", spread: -7, divGame: true, weekday: "Sunday" },
    { ...game, gameId: "x3", spread: null, result: null, points: null },
  ];
  assert.deepEqual(
    sampleGames(games, { homeDog: true }).map((g) => g.gameId),
    ["x1", "x2"],
  );
  assert.deepEqual(
    sampleGames(games, { homeDog: true, spreadAbs: [0, 3] }).map((g) => g.gameId),
    ["x1"],
  );
  assert.deepEqual(
    sampleGames(games, { restEdge: [3, 14] }).map((g) => g.gameId),
    ["x1"],
  );
  assert.deepEqual(
    sampleGames(games, { divGame: true }).map((g) => g.gameId),
    ["x2"],
  );
  assert.deepEqual(
    sampleGames(games, { roof: ["dome"], played: true }).map((g) => g.gameId),
    [game.gameId, "x2"],
  );
  assert.equal(sampleGames(games, { played: false }).length, 1);
});
