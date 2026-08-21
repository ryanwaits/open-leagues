import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gameHasStarted,
  liveStatLine,
  paintMatchup,
  pairIsProjected,
  slotDisplay,
} from "../src/lib/data/matchup-view.ts";
import { formatStatLine } from "../src/lib/data/statline.ts";

describe("formatStatLine", () => {
  it("returns null when the bag is empty or all zeros", () => {
    assert.equal(formatStatLine("RB", {}), null);
    assert.equal(formatStatLine("RB", { rush_att: 0, rec: 0 }), null);
    assert.equal(formatStatLine("QB", { pass_yd: 0, pass_cmp: 0 }), null);
  });

  it("does not print 0 PA as the only defensive line", () => {
    assert.equal(formatStatLine("DEF", { pts_allow: 0 }), null);
    assert.equal(formatStatLine("DEF", { sack: 1, pts_allow: 0 }), "1 sack · 0 PA");
    assert.equal(formatStatLine("DEF", { pts_allow: 17 }), "17 PA");
  });

  it("prints a real rushing / receiving line", () => {
    assert.equal(
      formatStatLine("RB", { rush_att: 13, rush_yd: 44, rec: 5, rec_yd: 58, rush_td: 1 }),
      "13 car, 44 yds · 1 TD · 5 rec, 58 yds",
    );
  });
});

describe("slotDisplay", () => {
  const proj = { points: 18.4, reason: null };
  const pre = { state: "pre", detail: "Sun 1:00", opp: "@ NYG", gameId: "1" };
  const live = { state: "in", detail: "Q2 8:15", opp: "@ NYG", gameId: "1" };
  const done = { state: "post", detail: "Final", opp: "@ NYG", gameId: "1" };

  it("uses the weekly projection before kickoff", () => {
    assert.deepEqual(slotDisplay(pre, 0, proj), { points: 18.4, forecast: "proj" });
    assert.deepEqual(slotDisplay(null, 0, proj), { points: 18.4, forecast: "proj" });
  });

  it("switches that player to unofficial once the game is up", () => {
    assert.deepEqual(slotDisplay(live, 6.2, proj), { points: 6.2 });
    assert.deepEqual(slotDisplay(done, 22.1, proj), { points: 22.1 });
  });

  it("marks bye / out instead of a fake score", () => {
    assert.deepEqual(slotDisplay(pre, 0, { points: 0, reason: "bye" }), {
      points: 0,
      forecast: "bye",
    });
  });
});

describe("liveStatLine", () => {
  const bag = { rush_att: 3, rush_yd: 12 };
  const pre = { state: "pre", detail: "Sun 1:00", opp: "vs ATL", gameId: "1" };
  const live = { state: "in", detail: "Q1 12:00", opp: "vs ATL", gameId: "1" };

  it("hides last-week leftovers before kickoff", () => {
    assert.equal(liveStatLine("RB", pre, bag), null);
    assert.equal(liveStatLine("RB", null, bag), null);
  });

  it("shows a real line after the game starts", () => {
    assert.equal(liveStatLine("RB", live, bag), "3 car, 12 yds");
    assert.equal(liveStatLine("RB", live, { rush_att: 0, rec: 0 }), null);
  });
});

describe("paintMatchup", () => {
  it("keeps projections on idle players when a Thursday game is live", () => {
    const line = (id, state, points, extra = {}) => ({
      slot: "QB",
      playerId: id,
      player: { player_id: id, full_name: id, position: "QB", team: "DAL" },
      points,
      game: { state, detail: "", opp: null, gameId: "g" },
      ...extra,
    });
    const pair = {
      matchupId: 1,
      home: {
        rosterId: 1,
        teamName: "hands",
        manager: "a",
        avatar: null,
        points: 4.1,
        starters: [line("dak", "in", 4.1), line("rico", "pre", 0)],
      },
      away: {
        rosterId: 2,
        teamName: "Butterbean",
        manager: "b",
        avatar: null,
        points: 0,
        starters: [line("caleb", "pre", 0)],
      },
    };
    const painted = paintMatchup(
      pair,
      {
        dak: { points: 20, reason: null },
        rico: { points: 12.5, reason: null },
        caleb: { points: 18, reason: null },
      },
      { dak: { pass_yd: 80, pass_cmp: 8, pass_inc: 4 } },
    );
    assert.equal(painted.home.starters[0].forecast, undefined);
    assert.equal(painted.home.starters[0].points, 4.1);
    assert.equal(painted.home.starters[1].forecast, "proj");
    assert.equal(painted.home.starters[1].points, 12.5);
    assert.equal(painted.away.starters[0].forecast, "proj");
    assert.equal(painted.home.points, 16.6);
    assert.equal(
      liveStatLine("QB", painted.home.starters[0].game, painted.home.starters[0].stats),
      "8/12, 80 yds",
    );
    assert.equal(painted.home.starters[1].stats, null);
    assert.equal(pairIsProjected(painted), false);
    const idle = paintMatchup(
      {
        ...pair,
        home: { ...pair.home, starters: [line("dak", "pre", 0), line("rico", "pre", 0)] },
      },
      {
        dak: { points: 20, reason: null },
        rico: { points: 12.5, reason: null },
        caleb: { points: 18, reason: null },
      },
      {},
    );
    assert.equal(pairIsProjected(idle), true);
  });
});

describe("gameHasStarted", () => {
  it("is only in or post", () => {
    assert.equal(gameHasStarted({ state: "pre", detail: "", opp: null, gameId: null }), false);
    assert.equal(gameHasStarted({ state: "in", detail: "", opp: null, gameId: null }), true);
    assert.equal(gameHasStarted(null), false);
  });
});
