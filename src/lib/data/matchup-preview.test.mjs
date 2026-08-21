import { test } from "bun:test";
import assert from "node:assert/strict";
import { pairPreviewScores } from "./matchup-view.ts";

const starter = (id, team, pts, forecast, state) => ({
  slot: "QB",
  playerId: id,
  player: { player_id: id, full_name: id, position: "QB", team },
  points: pts,
  expected: forecast ? pts : pts + 8,
  forecast,
  game: state ? { state, detail: "", opp: null, gameId: "g" } : null,
});

const side = (rosterId, starters) => ({
  rosterId,
  teamName: String(rosterId),
  manager: "m",
  avatar: null,
  points: starters.reduce((s, l) => s + (l.points ?? 0), 0),
  starters,
});

test("nobody kicked off → weekly expected", () => {
  const pair = {
    matchupId: 1,
    home: side(1, [starter("a", "DAL", 20.5, "proj", "pre")]),
    away: side(2, [starter("b", "CHI", 19, "proj", "pre")]),
  };
  const s = pairPreviewScores(pair);
  assert.equal(s.live, false);
  assert.equal(s.home, 20.5);
  assert.equal(s.away, 19);
});

test("one live starter → unofficial for both, not remaining proj", () => {
  const pair = {
    matchupId: 1,
    home: side(1, [
      starter("a", "LV", 0, undefined, "in"),
      starter("b", "DAL", 20.5, "proj", "pre"),
    ]),
    away: side(2, [starter("c", "CHI", 19, "proj", "pre")]),
  };
  const s = pairPreviewScores(pair);
  assert.equal(s.live, true);
  assert.equal(s.home, 0);
  assert.equal(s.away, 0);
});

test("scored live starter counts, sitting proj does not", () => {
  const pair = {
    matchupId: 1,
    home: side(1, [
      starter("a", "HOU", 12, undefined, "in"),
      starter("b", "DAL", 20.5, "proj", "pre"),
    ]),
    away: side(2, [starter("c", "CHI", 19, "proj", "pre")]),
  };
  const s = pairPreviewScores(pair);
  assert.equal(s.home, 12);
  assert.equal(s.away, 0);
});
