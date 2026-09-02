import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseDkNetwork, parseWiseGuyTeam, shapeByBook } from "./splits.ts";

const here = import.meta.dirname;
const wgt = JSON.parse(readFileSync(join(here, "__fixtures__/wiseguyteam.json"), "utf8"));
const dkn = readFileSync(join(here, "__fixtures__/dknetwork.html"), "utf8");

test("WiseGuyTeam: week from the round, season from the kickoff, six rows per game, book named", () => {
  const rows = parseWiseGuyTeam(wgt);
  const ne = rows.filter((r) => r.gameId === "2026_01_NE_SEA");
  assert.equal(ne.length, 6, "ml ×2, spread ×2, total ×2");
  const homeSpread = ne.find((r) => r.market === "spread" && r.side === "home");
  assert.deepEqual(
    {
      line: homeSpread.line,
      odds: homeSpread.odds,
      bets: homeSpread.ticketsPct,
      handle: homeSpread.moneyPct,
    },
    { line: -3.5, odds: 100, bets: 33, handle: 26 },
  );
  assert.match(homeSpread.book, /^wiseguyteam:/);
  const over = ne.find((r) => r.market === "total" && r.side === "over");
  assert.equal(over.line, 44.5);
  assert.equal(over.ticketsPct, 43);
});

test("DraftKings Network: odds, handle, and bets per side, resolved to a game id by the caller", () => {
  const rows = parseDkNetwork(dkn, (away, home) =>
    away === "NE" && home === "SEA" ? { season: 2026, week: 1 } : null,
  );
  const ne = rows.filter((r) => r.gameId === "2026_01_NE_SEA");
  assert.equal(ne.length, 6);
  const homeMl = ne.find((r) => r.market === "moneyline" && r.side === "home");
  assert.deepEqual(
    { odds: homeMl.odds, handle: homeMl.moneyPct, bets: homeMl.ticketsPct, book: homeMl.book },
    { odds: -175, handle: 29, bets: 52, book: "draftkings" },
  );
  const awaySpread = ne.find((r) => r.market === "spread" && r.side === "away");
  assert.equal(awaySpread.line, 3.5);
  assert.equal(awaySpread.odds, -115);
  assert.equal(awaySpread.ticketsPct, 62);
  const over = ne.find((r) => r.market === "total" && r.side === "over");
  assert.equal(over.line, 44.5);
  assert.equal(over.moneyPct, 77);
});

test("per-book shaping keeps sources apart", () => {
  const rows = [
    ...parseWiseGuyTeam(wgt),
    ...parseDkNetwork(dkn, () => ({ season: 2026, week: 1 })),
  ];
  const by = shapeByBook(rows);
  const g = by.get("2026_01_NE_SEA");
  assert.ok(g.wiseguyteam && g.draftkings, Object.keys(g).join(","));
  assert.equal(g.draftkings.moneyline.home.tickets, 52);
  assert.equal(g.wiseguyteam.moneyline.home.tickets, 51);
});
