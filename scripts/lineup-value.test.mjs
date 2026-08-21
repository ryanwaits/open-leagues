import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillLineup, tradeDelta } from "../src/lib/league/lineup-value.ts";

/** Minimal RosterPlayer for pure fill/trade tests. */
function rp(id, position, extras = {}) {
  return {
    player_id: id,
    full_name: extras.full_name ?? id,
    position,
    team: extras.team ?? "XX",
    slot: extras.slot ?? "bench",
    weekPts: null,
    ...extras,
  };
}

function proj(map) {
  /** @type {Record<string, { points: number; reason: null }>} */
  const out = {};
  for (const [id, points] of Object.entries(map)) {
    out[id] = { points, reason: null };
  }
  return out;
}

describe("lineup-value", () => {
  it("replacement case: QB1 for WR prices the gap, not the whole score", () => {
    // QB1 21, backup QB2 13; trade QB1 for WR17 who bumps a 7-pt WR starter.
    // Naive: 17 - 21 = -4. Correct: (13 + 17) - (21 + 7) = +2.
    // (Plan prose used an 11-pt starter with those QB/WR numbers; that yields -2.
    // Done criteria asks for +2.0 vs naive -4.0, so the displaced starter is 7.)
    const rosterPositions = ["QB", "WR", "BN", "BN"];
    const players = [
      rp("qb1", "QB", { full_name: "QB1", slot: "starter", starterSlot: "QB" }),
      rp("qb2", "QB", { full_name: "QB2", slot: "bench" }),
      rp("wr7", "WR", { full_name: "WR7", slot: "starter", starterSlot: "WR" }),
    ];
    const projections = proj({ qb1: 21, qb2: 13, wr7: 7, wr17: 17 });
    const incoming = [rp("wr17", "WR", { full_name: "WR17" })];

    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: ["qb1"],
      incoming,
    });

    assert.equal(delta.change, +2.0);
    assert.notEqual(delta.change, -4.0);
    assert.equal(delta.before.total, 28);
    assert.equal(delta.after.total, 30);
  });

  it("bench case: trading a non-starter for nothing is a zero change", () => {
    const rosterPositions = ["QB", "WR"];
    const players = [
      rp("qb1", "QB", { slot: "starter", starterSlot: "QB" }),
      rp("wr1", "WR", { slot: "starter", starterSlot: "WR" }),
      rp("wr_bench", "WR", { slot: "bench" }),
    ];
    const projections = proj({ qb1: 20, wr1: 15, wr_bench: 8 });

    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: ["wr_bench"],
      incoming: [],
    });

    assert.equal(delta.change, 0);
    assert.equal(delta.changed.length, 0);
  });

  it("determinism: equal projections pick the same player across calls", () => {
    const rosterPositions = ["WR", "WR"];
    const players = [rp("wr_b", "WR"), rp("wr_a", "WR"), rp("wr_c", "WR")];
    const projections = proj({ wr_a: 10, wr_b: 10, wr_c: 10 });

    const a = fillLineup(players, rosterPositions, projections);
    const b = fillLineup([...players].reverse(), rosterPositions, projections);

    assert.deepEqual(
      a.slots.map((s) => s.player?.player_id),
      b.slots.map((s) => s.player?.player_id),
    );
    assert.deepEqual(
      a.slots.map((s) => s.player?.player_id),
      ["wr_a", "wr_b"],
    );
  });

  it("FLEX: receiver fills FLEX when WR slots are taken", () => {
    const rosterPositions = ["WR", "WR", "FLEX"];
    const players = [rp("wr1", "WR"), rp("wr2", "WR"), rp("wr3", "WR"), rp("rb1", "RB")];
    const projections = proj({ wr1: 18, wr2: 16, wr3: 14, rb1: 12 });

    const filled = fillLineup(players, rosterPositions, projections);
    const bySlot = Object.fromEntries(filled.slots.map((s) => [s.slot, s.player?.player_id]));

    assert.equal(bySlot.WR, "wr1");
    assert.equal(bySlot.WR2, "wr2");
    assert.equal(bySlot.FLX, "wr3");
  });

  it("empty slot: no tight end leaves TE as null", () => {
    const rosterPositions = ["QB", "TE"];
    const players = [rp("qb1", "QB"), rp("wr1", "WR")];
    const projections = proj({ qb1: 20, wr1: 15 });

    const filled = fillLineup(players, rosterPositions, projections);
    const te = filled.slots.find((s) => s.slot === "TE");

    assert.ok(te);
    assert.equal(te.player, null);
    assert.equal(te.points, 0);
  });
});
