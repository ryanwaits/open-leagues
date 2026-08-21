import { test } from "bun:test";
import assert from "node:assert/strict";
import { planAutoFill } from "./autofill.ts";

const chip = (state) => ({ state, detail: "", opp: null, gameId: null });

test("does not sit a starter whose game has started", () => {
  const swaps = planAutoFill({
    players: [
      {
        player_id: "a",
        full_name: "Locked TE",
        position: "TE",
        team: "LV",
        slot: "starter",
        starterSlot: "TE",
        weekPts: 0,
        game: chip("in"),
        injury_status: "out",
      },
      {
        player_id: "b",
        full_name: "Bench TE",
        position: "TE",
        team: "KC",
        slot: "bench",
        weekPts: null,
        game: chip("pre"),
      },
    ],
    rosterPositions: ["TE"],
    projections: {
      a: { points: 0, reason: "out" },
      b: { points: 10, reason: null },
    },
  });
  assert.equal(swaps.length, 0);
});

test("does not start a bench player whose game has started", () => {
  const swaps = planAutoFill({
    players: [
      {
        player_id: "a",
        full_name: "Empty? no, out unstarted",
        position: "TE",
        team: "SEA",
        slot: "starter",
        starterSlot: "TE",
        weekPts: null,
        game: chip("pre"),
        injury_status: "out",
      },
      {
        player_id: "b",
        full_name: "Locked bench",
        position: "TE",
        team: "LV",
        slot: "bench",
        weekPts: 0,
        game: chip("in"),
      },
    ],
    rosterPositions: ["TE"],
    projections: {
      a: { points: 0, reason: "out" },
      b: { points: 12, reason: null },
    },
  });
  assert.equal(swaps.length, 0);
});
