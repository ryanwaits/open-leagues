import { test } from "bun:test";
import assert from "node:assert/strict";
import { denserStatBag, overlayPreLivePairs, overlayPreLiveRoster } from "./pre-live.ts";

const book = { pass_yd: 0.04, pass_td: 4, rec: 1, rec_yd: 0.1, rec_td: 6 };

const pair = {
  matchupId: 1,
  home: {
    rosterId: 1,
    teamName: "Home",
    manager: "A",
    avatar: null,
    points: 0,
    starters: [
      {
        slot: "QB",
        playerId: "qb1",
        player: {
          player_id: "qb1",
          full_name: "Geno Smith",
          position: "QB",
          team: "LV",
        },
        points: 0,
        game: null,
      },
    ],
  },
  away: {
    rosterId: 2,
    teamName: "Away",
    manager: "B",
    avatar: null,
    points: 0,
    starters: [
      {
        slot: "RB",
        playerId: "rb1",
        player: {
          player_id: "rb1",
          full_name: "Woody Marks",
          position: "RB",
          team: "HOU",
        },
        points: 0,
        game: null,
      },
    ],
  },
};

const game = {
  id: "1",
  name: "LV at HOU",
  shortName: "LV @ HOU",
  date: "",
  state: "in",
  detail: "8:24 - 3rd",
  week: 3,
  season: 2026,
  seasonType: "pre",
  home: {
    abbr: "HOU",
    name: "Houston Texans",
    logo: "",
    score: "20",
    winner: null,
    record: null,
  },
  away: {
    abbr: "LV",
    name: "Las Vegas Raiders",
    logo: "",
    score: "3",
    winner: null,
    record: null,
  },
};

test("paints live chips and book points onto starters in tonight's game", () => {
  const out = overlayPreLivePairs(
    [pair],
    [game],
    {
      qb1: { pass_yd: 100, pass_td: 1 },
      rb1: { rec: 2, rec_yd: 20, rec_td: 1 },
    },
    book,
  )[0];
  assert.equal(out.home.starters[0].game.state, "in");
  assert.equal(out.away.starters[0].game.detail, "8:24 - 3rd");
  assert.equal(out.home.starters[0].points, 8);
  assert.equal(out.away.starters[0].points, 10);
  assert.equal(out.home.points, 8);
  assert.equal(out.away.points, 10);
});

test("leaves a starter without a preseason game at zero", () => {
  const cold = {
    ...pair,
    home: {
      ...pair.home,
      starters: [
        {
          ...pair.home.starters[0],
          player: { ...pair.home.starters[0].player, team: "SEA" },
        },
      ],
    },
  };
  const out = overlayPreLivePairs([cold], [game], { qb1: { pass_td: 4 } }, book)[0];
  assert.equal(out.home.starters[0].game, null);
  assert.equal(out.home.starters[0].points, 0);
});

test("denserStatBag prefers the week with more actual lines", () => {
  const sparse = { a: { pts_ppr: 0 } };
  const dense = { a: { pts_ppr: 12 }, b: { pts_ppr: 3 } };
  assert.equal(denserStatBag(sparse, dense), dense);
});

const bowers = {
  player_id: "te1",
  full_name: "Brock Bowers",
  position: "TE",
  team: "LV",
  slot: "starter",
  starterSlot: "TE",
  weekPts: null,
  game: { state: "pre", detail: "Sun 9/13", opp: "vs MIA", gameId: null },
};

test("roster overlay paints the live chip and unofficial 0 when the bag is empty", () => {
  const out = overlayPreLiveRoster([bowers], [game], {}, book)[0];
  assert.equal(out.game.state, "in");
  assert.equal(out.game.detail, "8:24 - 3rd");
  assert.equal(out.weekPts, 0);
});

test("roster overlay scores the live bag", () => {
  const out = overlayPreLiveRoster([bowers], [game], { te1: { rec: 3, rec_yd: 40 } }, book)[0];
  assert.equal(out.weekPts, 7);
});

test("roster overlay leaves a player without a preseason game on the weekly chip", () => {
  const sea = { ...bowers, team: "SEA" };
  const out = overlayPreLiveRoster([sea], [game], {}, book)[0];
  assert.equal(out.game.state, "pre");
  assert.equal(out.weekPts, null);
});
