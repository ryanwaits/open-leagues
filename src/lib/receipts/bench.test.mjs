import assert from "node:assert/strict";
import { test } from "node:test";
import { benchReceipt } from "./bench.ts";

const POS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"];

function p(id, position, slot, weekPts, starterSlot) {
  return { player_id: id, full_name: id, position, team: "X", slot, weekPts, starterSlot };
}

test("a perfect lineup leaves nothing on the bench", () => {
  const r = benchReceipt(
    [
      p("qb1", "QB", "starter", 20, "QB"),
      p("rb1", "RB", "starter", 15, "RB1"),
      p("rb2", "RB", "starter", 12, "RB2"),
      p("wr1", "WR", "starter", 14, "WR1"),
      p("wr2", "WR", "starter", 11, "WR2"),
      p("te1", "TE", "starter", 9, "TE"),
      p("wr3", "WR", "starter", 8, "FLEX"),
      p("rb3", "RB", "bench", 5),
      p("qb2", "QB", "bench", 10), // a backup QB cannot take a FLEX
    ],
    POS,
  );
  assert.equal(r.actual, 89);
  assert.equal(r.left, 0);
  assert.deepEqual(r.misses, []);
});

test("a benched player who outscored a starter is a miss with a cost", () => {
  const r = benchReceipt(
    [
      p("qb1", "QB", "starter", 20, "QB"),
      p("rb1", "RB", "starter", 15, "RB1"),
      p("rb2", "RB", "starter", 4, "RB2"),
      p("wr1", "WR", "starter", 14, "WR1"),
      p("wr2", "WR", "starter", 11, "WR2"),
      p("te1", "TE", "starter", 9, "TE"),
      p("wr3", "WR", "starter", 8, "FLEX"),
      p("rb3", "RB", "bench", 18.2),
    ],
    POS,
  );
  assert.equal(r.actual, 81);
  assert.ok(r.optimal > r.actual);
  assert.equal(r.left, 14.2);
  assert.equal(r.misses.length, 1);
  const m = r.misses[0];
  assert.equal(m.best.playerId, "rb3");
  assert.equal(m.cost, 14.2);
  // the miss names the weakest starter, who is the one who should have sat
  assert.equal(m.started.playerId, "rb2");
  assert.equal(m.slot, "RB2");
});

test("IR and taxi players are not eligible for the optimal lineup", () => {
  const r = benchReceipt(
    [
      p("qb1", "QB", "starter", 10, "QB"),
      p("rb1", "RB", "starter", 5, "RB1"),
      p("rb2", "RB", "starter", 5, "RB2"),
      p("wr1", "WR", "starter", 5, "WR1"),
      p("wr2", "WR", "starter", 5, "WR2"),
      p("te1", "TE", "starter", 5, "TE"),
      p("wr3", "WR", "starter", 5, "FLEX"),
      p("rbIR", "RB", "ir", 40),
      p("rbTX", "RB", "taxi", 40),
    ],
    POS,
  );
  assert.equal(r.left, 0);
});

test("null points read as zero, never as missing data", () => {
  const r = benchReceipt(
    [p("qb1", "QB", "starter", null, "QB"), p("qb2", "QB", "bench", 12)],
    ["QB", "BN"],
  );
  assert.equal(r.actual, 0);
  assert.equal(r.left, 12);
  assert.equal(r.misses[0].started.points, 0);
});

test("with a FLEX, a bench RB can displace a weak WR through the shuffle a manager would make", () => {
  const r = benchReceipt(
    [
      p("qb1", "QB", "starter", 20, "QB"),
      p("rb1", "RB", "starter", 15, "RB"),
      p("rb2", "RB", "starter", 11, "RB"),
      p("wr1", "WR", "starter", 14, "WR"),
      p("wr2", "WR", "starter", 3.5, "WR"),
      p("te1", "TE", "starter", 9, "TE"),
      p("wr3", "WR", "starter", 8, "FLEX"),
      p("rbX", "RB", "bench", 16), // RB in → rb2 to FLEX → wr3 to WR → wr2 out
    ],
    POS,
  );
  assert.equal(r.misses.length, 1);
  assert.equal(r.misses[0].best.name, "rbX");
  assert.equal(r.misses[0].started.name, "wr2", "the chain ends at the WR who should have sat");
  assert.equal(r.misses[0].slot, "RB", "labelled by the slot the bench player takes");
  assert.equal(r.misses[0].cost, 12.5);
});

test("without a FLEX, a bench RB cannot reach a WR slot: no miss is invented", () => {
  const NOFLEX = ["QB", "RB", "RB", "WR", "WR", "TE", "BN", "BN"];
  const r = benchReceipt(
    [
      p("qb1", "QB", "starter", 20, "QB"),
      p("rb1", "RB", "starter", 15, "RB"),
      p("rb2", "RB", "starter", 11, "RB"),
      p("wr1", "WR", "starter", 14, "WR"),
      p("wr2", "WR", "starter", 3.5, "WR"),
      p("te1", "TE", "starter", 9, "TE"),
      p("rbX", "RB", "bench", 12), // outscored wr2, but only an RB slot could hold him
      p("wrX", "WR", "bench", 6),
    ],
    NOFLEX,
  );
  const names = r.misses.map((m) => `${m.slot}:${m.best.name}>${m.started.name}`);
  assert.deepEqual(names.sort(), ["RB:rbX>rb2", "WR:wrX>wr2"]);
  assert.equal(r.left, 3.5, "1 at RB (12 − 11) + 2.5 at WR (6 − 3.5)");
});
