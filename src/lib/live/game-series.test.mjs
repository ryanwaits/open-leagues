import { test } from "bun:test";
import assert from "node:assert/strict";
import { liveProjection } from "../league/live-proj.ts";
import { bookFromPreset } from "../league/scoring.ts";
import {
  clockSeries,
  clockToWall,
  kickoffWallSecs,
  projectionByClock,
  projectionTone,
} from "./game-series.ts";
import { fmtGameClock } from "./series.ts";

const BOOK = bookFromPreset("ppr");

const BOWERS = {
  player_id: "p1",
  full_name: "Brock Bowers",
  first_name: "Brock",
  last_name: "Bowers",
  position: "TE",
  team: "LV",
};

const BASELINE = 14.5;

function fillerPlay(id, period, clock) {
  return {
    id,
    text: "T.Tagovailoa pass complete to J.Waddle for 8 yards",
    type: "Pass Reception",
    scoring: false,
    period,
    clock,
    awayScore: 0,
    homeScore: 0,
    yardage: 8,
  };
}

function receptionPlay(id) {
  return {
    id,
    text: "G.Minshew pass short right to B.Bowers for 11 yards",
    type: "Pass Reception",
    scoring: false,
    period: 3,
    clock: "6:40",
    awayScore: 7,
    homeScore: 10,
    yardage: 11,
  };
}

function baseGame(state) {
  return {
    home: { abbr: "LV" },
    away: { abbr: "MIA" },
    state,
    scoring: [],
    drives: [
      {
        id: "d1",
        plays: [fillerPlay("f1", 1, "12:00"), fillerPlay("f2", 2, "10:00"), receptionPlay("r1")],
      },
    ],
  };
}

test("kickoff sample first: elapsed 0, expected === baseline", () => {
  const samples = projectionByClock(baseGame("in"), BOWERS, BOOK, BASELINE);
  assert.equal(samples[0].elapsed, 0);
  assert.equal(samples[0].pts, 0);
  assert.equal(samples[0].expected, BASELINE);
});

test("a reception play adds rec + yards*0.1 to pts and expected moves off baseline", () => {
  const samples = projectionByClock(baseGame("in"), BOWERS, BOOK, BASELINE);
  const last = samples[samples.length - 1];
  assert.ok(Math.abs(last.pts - 2.1) < 0.01, `got pts=${last.pts}`);
  assert.notEqual(last.expected, BASELINE);
});

test("plays that don't name the player don't add their own samples", () => {
  const samples = projectionByClock(baseGame("in"), BOWERS, BOOK, BASELINE);
  // Only two events happen: kickoff (elapsed 0) and the one play that names
  // Bowers (period 3, clock "6:40") — the two filler plays before it
  // contribute nothing on their own.
  assert.equal(samples.length, 2);
});

test("elapsed is kickoff-relative, not playWhen()'s sort-only offset — a Q3 play formats as Q3, not OT", () => {
  const samples = projectionByClock(baseGame("in"), BOWERS, BOOK, BASELINE);
  const last = samples[samples.length - 1];
  // playWhen(3, "6:40") is 3200 (its own +900-per-quarter sort convention);
  // kickoff-relative it should read 2300 — and format the same way a real
  // Q3 6:40 game-clock reads on the box score, never "OT".
  assert.equal(last.elapsed, 2300);
  assert.equal(fmtGameClock(last.elapsed), "Q3 6:40");
});

test('state "post" appends a final sample with expected === pts', () => {
  const samples = projectionByClock(baseGame("post"), BOWERS, BOOK, BASELINE);
  const last = samples[samples.length - 1];
  assert.equal(last.expected, last.pts);
  assert.ok(last.elapsed >= 3600);
});

test("clockToWall maps elapsed share onto wall time linearly", () => {
  const samples = [
    { elapsed: 0, pts: 0, expected: 10 },
    { elapsed: 900, pts: 2, expected: 11 },
    { elapsed: 1800, pts: 4, expected: 12 },
  ];
  const wall = clockToWall(samples, 1000, 1900);
  assert.deepEqual(
    wall.map((p) => p.time),
    [1000, 1450, 1900],
  );
  assert.deepEqual(
    wall.map((p) => p.value),
    [10, 11, 12],
  );
});

test("clockToWall guards nowWall <= kickoffWall: all points land at nowWall", () => {
  const samples = [
    { elapsed: 0, pts: 0, expected: 10 },
    { elapsed: 900, pts: 2, expected: 11 },
  ];
  const wall = clockToWall(samples, 2000, 1000);
  assert.deepEqual(
    wall.map((p) => p.time),
    [1000, 1000],
  );
});

test("clockSeries keeps elapsed as the series's time axis", () => {
  const samples = [
    { elapsed: 0, pts: 0, expected: 10 },
    { elapsed: 900, pts: 2, expected: 11 },
  ];
  const series = clockSeries(samples);
  assert.deepEqual(series, [
    { time: 0, value: 10 },
    { time: 900, value: 11 },
  ]);
});

test("projectionTone: below baseline - 0.05 is alarm, at/above is brand", () => {
  assert.equal(projectionTone(14.4, 14.5), "alarm");
  assert.equal(projectionTone(14.5, 14.5), "brand");
  assert.equal(projectionTone(14.46, 14.5), "brand");
});

test("chip detail parses period/clock into fractionRemaining rather than falling back to 0.5", () => {
  const samples = projectionByClock(baseGame("in"), BOWERS, BOOK, BASELINE);
  const last = samples[samples.length - 1];
  const expectedFromDirectCall = liveProjection({
    baseline: BASELINE,
    current: last.pts,
    position: "TE",
    game: { state: "in", detail: "6:40 - 3rd", opp: null, gameId: null, margin: 3 },
  });
  assert.equal(last.expected, expectedFromDirectCall);
  // And it is strictly between current points and points + baseline — proof
  // the detail parsed to a real fraction, not the unparseable-detail 0.5 default
  // colliding with a coincidentally similar number.
  assert.ok(last.expected > last.pts && last.expected < last.pts + BASELINE);
});

test("kickoffWallSecs parses an ISO date, falls back to now() when unparseable", () => {
  const t = kickoffWallSecs({ date: "2026-08-21T20:20:00.000Z" });
  assert.equal(t, Date.parse("2026-08-21T20:20:00.000Z") / 1000);
  const fallback = kickoffWallSecs({ date: "" });
  assert.ok(Math.abs(fallback - Date.now() / 1000) < 5);
});
