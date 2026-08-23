import { test } from "bun:test";
import assert from "node:assert/strict";
import { liveProjection } from "../league/live-proj.ts";
import { bookFromPreset } from "../league/scoring.ts";
import {
  chartWindowSecs,
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

test("chartWindowSecs keeps kickoff inside liveline's 5% right-side buffer", () => {
  const span = 3600;
  const w = chartWindowSecs(span);
  assert.ok(w * 0.95 >= span + 2, `visible ${w * 0.95} < span ${span}`);
});

const PACKERS = {
  player_id: "GB",
  full_name: "Packers D/ST",
  first_name: "",
  last_name: "Packers",
  position: "DEF",
  team: "GB",
};

function dstGame(state, drives) {
  return {
    home: { abbr: "MIN" },
    away: { abbr: "GB" },
    state,
    scoring: [],
    drives,
  };
}

test("D/ST kickoff sample is at the baseline, not 0", () => {
  const samples = projectionByClock(
    dstGame("in", [{ id: "d1", team: "MIN", plays: [] }]),
    PACKERS,
    BOOK,
    4.8,
  );
  assert.equal(samples[0].elapsed, 0);
  assert.equal(samples[0].expected, 4.8);
});

test("D/ST sack on the opponent's drive scores sack points", () => {
  const samples = projectionByClock(
    dstGame("in", [
      {
        id: "d1",
        team: "MIN",
        plays: [
          {
            id: "s1",
            text: "J.McCarthy sacked at MIN 12 for -8 yards",
            type: "Sack",
            scoring: false,
            period: 1,
            clock: "10:00",
            awayScore: 0,
            homeScore: 0,
            yardage: -8,
          },
        ],
      },
    ]),
    PACKERS,
    BOOK,
    4.8,
  );
  const last = samples[samples.length - 1];
  assert.equal(last.pts, BOOK.sack);
  assert.notEqual(last.expected, 4.8);
});

test("D/ST sim-style sack (drive is the D/ST's own team, type Sack) still scores", () => {
  const samples = projectionByClock(
    dstGame("in", [
      {
        id: "d1",
        team: "GB",
        plays: [
          {
            id: "s1",
            text: "GB sacked Darnold at MIN 12 for -6 yards.",
            type: "Sack",
            scoring: false,
            period: 1,
            clock: "10:00",
            awayScore: 0,
            homeScore: 0,
            yardage: -6,
          },
        ],
      },
    ]),
    PACKERS,
    BOOK,
    4.8,
  );
  assert.equal(samples[samples.length - 1].pts, BOOK.sack);
});

test("D/ST opponent TD raises pts_allow and the line leaves baseline", () => {
  const samples = projectionByClock(
    dstGame("in", [
      {
        id: "d1",
        team: "MIN",
        plays: [
          {
            id: "td1",
            text: "J.Jefferson 14 yard pass from J.McCarthy for a TOUCHDOWN",
            type: "Passing Touchdown",
            scoring: true,
            period: 2,
            clock: "8:00",
            awayScore: 0,
            homeScore: 7,
            yardage: 14,
          },
        ],
      },
    ]),
    PACKERS,
    BOOK,
    4.8,
  );
  const last = samples[samples.length - 1];
  // Shutout bucket (10) → 7 points allowed bucket (4).
  assert.equal(last.pts, BOOK.pts_allow_7_13);
  assert.notEqual(last.expected, 4.8);
});

test("D/ST own-team rush is not a sack", () => {
  const samples = projectionByClock(
    dstGame("in", [
      {
        id: "d1",
        team: "GB",
        plays: [
          {
            id: "r1",
            text: "J.Jacobs up the middle to MIN 40 for 8 yards",
            type: "Rush",
            scoring: false,
            period: 1,
            clock: "12:00",
            awayScore: 0,
            homeScore: 0,
            yardage: 8,
          },
        ],
      },
    ]),
    PACKERS,
    BOOK,
    4.8,
  );
  // Kickoff + trailing sample at the last play (pts still 0). No sack.
  const last = samples[samples.length - 1];
  assert.equal(last.pts, 0);
});

test("D/ST post sample expected equals pts (not stuck at 0 when they scored)", () => {
  const samples = projectionByClock(
    dstGame("post", [
      {
        id: "d1",
        team: "MIN",
        plays: [
          {
            id: "s1",
            text: "J.McCarthy sacked at MIN 12 for -8 yards",
            type: "Sack",
            scoring: false,
            period: 4,
            clock: "1:10",
            awayScore: 0,
            homeScore: 0,
            yardage: -8,
          },
        ],
      },
    ]),
    PACKERS,
    BOOK,
    4.8,
  );
  const last = samples[samples.length - 1];
  assert.equal(last.expected, last.pts);
  // Final whistle applies the points-allowed bucket (shutout = 10) on top of the sack.
  assert.equal(last.pts, BOOK.sack + BOOK.pts_allow_0);
  assert.ok(last.elapsed >= 3600);
});
