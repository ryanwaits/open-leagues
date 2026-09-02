import assert from "node:assert/strict";
import { test } from "node:test";
import { nflverseAbbr, parseActionNetwork, shapeSplits } from "./splits.ts";

// Trimmed from the real 2025 week 14 response (DAL @ DET).
const payload = {
  games: [
    {
      season: 2025,
      week: 14,
      home_team_id: 146,
      away_team_id: 140,
      teams: [
        { id: 140, abbr: "DAL" },
        { id: 146, abbr: "DET" },
      ],
      markets: {
        15: {
          event: {
            spread: [
              {
                side: "home",
                value: -3.5,
                odds: -110,
                bet_info: { money: { percent: 32 }, tickets: { percent: 28 } },
              },
              {
                side: "away",
                value: 3.5,
                odds: -110,
                bet_info: { money: { percent: 68 }, tickets: { percent: 72 } },
              },
            ],
            total: [
              {
                side: "under",
                value: 55.5,
                odds: -110,
                bet_info: { money: { percent: 33 }, tickets: { percent: 39 } },
              },
              {
                side: "over",
                value: 55.5,
                odds: -110,
                bet_info: { money: { percent: 67 }, tickets: { percent: 61 } },
              },
            ],
            moneyline: [
              {
                side: "home",
                value: 0,
                odds: -185,
                bet_info: { money: { percent: 36 }, tickets: { percent: 56 } },
              },
              {
                side: "away",
                value: 0,
                odds: 155,
                bet_info: { money: { percent: 64 }, tickets: { percent: 44 } },
              },
            ],
          },
        },
      },
    },
    {
      season: 2025,
      week: 14,
      home_team_id: 1,
      away_team_id: 2,
      teams: [
        { id: 1, abbr: "LAR" },
        { id: 2, abbr: "WSH" },
      ],
      markets: {},
    },
  ],
};

test("rows are keyed by nflverse game id and carry tickets and money per side", () => {
  const rows = parseActionNetwork(payload, { season: 2025, week: 14 });
  assert.equal(rows.length, 6, "one game with a splits book; the other has no book 15");
  assert.ok(rows.every((r) => r.gameId === "2025_14_DAL_DET"));
  const homeSpread = rows.find((r) => r.market === "spread" && r.side === "home");
  assert.deepEqual(
    {
      line: homeSpread.line,
      odds: homeSpread.odds,
      t: homeSpread.ticketsPct,
      m: homeSpread.moneyPct,
    },
    { line: -3.5, odds: -110, t: 28, m: 32 },
  );
});

test("Action Network abbreviations map to nflverse's", () => {
  assert.equal(nflverseAbbr("LAR"), "LA");
  assert.equal(nflverseAbbr("WSH"), "WAS");
  assert.equal(nflverseAbbr("JAC"), "JAX");
  assert.equal(nflverseAbbr("KC"), "KC");
});

test("shape groups a game's rows by market and side", () => {
  const by = shapeSplits(parseActionNetwork(payload, { season: 2025, week: 14 }));
  const g = by.get("2025_14_DAL_DET");
  assert.equal(g.spread.away.tickets, 72);
  assert.equal(g.moneyline.home.money, 36);
  assert.equal(g.total.over.tickets, 61);
});
