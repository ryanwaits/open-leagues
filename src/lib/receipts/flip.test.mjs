import assert from "node:assert/strict";
import { test } from "node:test";
import { computeFlip, gameStatesAt, scoresAt } from "./flip.ts";

// Half-PPR, 6-point passing TDs — the SDIFFL book.
const BOOK = {
  rec: 0.5,
  rec_yd: 0.1,
  rec_td: 6,
  rush_yd: 0.1,
  rush_td: 6,
  pass_yd: 0.04,
  pass_td: 6,
};

const home = { rosterId: 1, name: "the guru", starters: ["h1", "h2"] };
const away = { rosterId: 10, name: "Sweet Lou", starters: ["a1"] };

const ev = (t, g, p, d, extra = {}) => ({ t, g, q: 2, clock: "10:00", s: 1800, p, d, ...extra });

test("no lead change when one side leads throughout", () => {
  const f = computeFlip({
    home,
    away,
    book: BOOK,
    events: [
      ev("2025-12-07T18:05:00Z", "g1", "h1", { rush_yd: 50 }), // home 5.0
      ev("2025-12-07T18:20:00Z", "g2", "a1", { rec: 1, rec_yd: 10 }), // away 1.5
      ev("2025-12-07T18:40:00Z", "g1", "h2", { rec: 1, rec_yd: 20 }), // home 7.5
    ],
  });
  assert.equal(f.decided, null);
  assert.deepEqual(f.final, [7.5, 1.5]);
  assert.equal(f.games, 2);
});

test("the decided flip is the last lead change, with its play and player", () => {
  const f = computeFlip({
    home,
    away,
    book: BOOK,
    events: [
      ev("2025-12-07T18:05:00Z", "g1", "h1", { rush_yd: 50 }), // home 5.0 leads
      ev("2025-12-07T18:30:00Z", "g2", "a1", { rec: 1, rec_yd: 30, rec_td: 1 }), // away 9.5 leads
      ev(
        "2025-12-07T21:07:00Z",
        "g1",
        "h2",
        { rec: 1, rec_yd: 61, rec_td: 1 },
        { desc: "61-yd TD", q: 4, clock: "3:12", s: 192 },
      ), // home 17.6 leads
    ],
  });
  assert.equal(f.changes.length, 2);
  assert.equal(f.decided.to, 1);
  assert.equal(f.decided.at, "2025-12-07T21:07:00Z");
  assert.equal(f.decided.desc, "61-yd TD");
  assert.equal(f.decided.playerId, "h2");
  assert.deepEqual(f.decided.scores, [17.6, 9.5]);
});

test("events for players who did not start are ignored", () => {
  const f = computeFlip({
    home,
    away,
    book: BOOK,
    events: [ev("2025-12-07T18:05:00Z", "g1", "bench", { rush_td: 1 })],
  });
  assert.deepEqual(f.final, [0, 0]);
  assert.equal(f.games, 0);
});

test("pts_allow deltas sum to a level the book buckets once", () => {
  const dst = { rosterId: 1, name: "h", starters: ["PHI"] };
  const f = computeFlip({
    home: dst,
    away: { rosterId: 2, name: "a", starters: [] },
    book: { pts_allow_0: 10, pts_allow_1_6: 7, pts_allow_7_13: 4 },
    events: [
      ev("2025-12-07T18:05:00Z", "g1", "PHI", { pts_allow: 0 }),
      ev("2025-12-07T18:25:00Z", "g1", "PHI", { pts_allow: 7 }),
      ev("2025-12-07T18:45:00Z", "g1", "PHI", { pts_allow: 3 }),
    ],
  });
  // kickoff seed scores the shutout bucket (10); 7 then 10 allowed lands on 7–13
  assert.deepEqual(f.final, [4, 0]);
});

test("game states at a moment: pre before kickoff, in with a readable clock, post when the clock is out", () => {
  const events = [
    ev("2025-12-07T18:05:00Z", "g1", "h1", { rush_yd: 1 }, { q: 1, clock: "14:50", s: 3590 }),
    ev("2025-12-07T21:20:00Z", "g1", "h1", { rush_yd: 1 }, { q: 4, clock: "0:00", s: 0 }),
    ev("2025-12-07T21:30:00Z", "g2", "a1", { rec: 1 }, { q: 1, clock: "13:00", s: 3480 }),
  ];
  const at = gameStatesAt(events, "2025-12-07T21:25:00Z");
  assert.equal(at.g1.state, "post");
  assert.equal(at.g2.state, "pre");
  const mid = gameStatesAt(events, "2025-12-07T18:10:00Z");
  assert.equal(mid.g1.state, "in");
  assert.equal(mid.g1.detail, "Q1 14:50");
});

test("scores at a moment replay only what had happened", () => {
  const events = [
    ev("2025-12-07T18:05:00Z", "g1", "h1", { rush_yd: 50 }),
    ev("2025-12-07T21:07:00Z", "g1", "h2", { rec_td: 1 }),
  ];
  assert.deepEqual(scoresAt({ home, away, events, book: BOOK }, "2025-12-07T20:00:00Z"), [5, 0]);
  assert.deepEqual(scoresAt({ home, away, events, book: BOOK }, "2025-12-07T22:00:00Z"), [11, 0]);
});

test("a settlement that decides the week is marked, so the receipt can say so", () => {
  const f = computeFlip({
    home,
    away,
    book: BOOK,
    events: [
      ev("2025-12-07T18:05:00Z", "g1", "h1", { rush_td: 1 }),
      ev("2025-12-07T18:25:00Z", "g1", "a1", { rec_td: 1, rec: 1 }),
      { ...ev("2025-12-07T21:20:00Z", "g1", "h1", { rush_yd: 30 }), settled: true },
    ],
  });
  assert.equal(f.changes.length, 2);
  assert.equal(f.changes[0]?.settled, false, "the catch was a play");
  assert.equal(f.decided?.settled, true, "the correction was booked at the whistle");
});
