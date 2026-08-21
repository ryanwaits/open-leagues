import { test } from "bun:test";
import assert from "node:assert/strict";
import { liveProjection } from "./live-proj.ts";
import { fractionRemaining } from "./win-probability.ts";

const chip = (detail, extra = {}) => ({
  state: "in",
  detail,
  opp: "@ HOU",
  gameId: "1",
  ...extra,
});

test("parses ESPN 7:45 - 4th as almost over", () => {
  const rem = fractionRemaining(chip("7:45 - 4th"));
  assert.ok(rem > 0.1 && rem < 0.16, `got ${rem}`);
});

test("2:00 left in the 4th is a sliver of the game", () => {
  const rem = fractionRemaining(chip("2:00 - 4th"));
  assert.ok(Math.abs(rem - 2 / 60) < 0.005, `got ${rem}`);
});

test("underperforming WR in garbage time keeps most of what he has, little left", () => {
  const n = liveProjection({
    baseline: 12,
    current: 6,
    position: "WR",
    game: chip("2:00 - 4th", { margin: -17 }),
  });
  assert.ok(n >= 6 && n < 7.2, `got ${n}`);
});

test("pre-kickoff is the weekly baseline", () => {
  assert.equal(
    liveProjection({
      baseline: 18.7,
      current: 0,
      position: "QB",
      game: { state: "pre", detail: "Sun 1:00", opp: "@ NYG", gameId: "x" },
    }),
    18.7,
  );
});

test("final is unofficial, not the weekly number", () => {
  assert.equal(
    liveProjection({
      baseline: 18.7,
      current: 9.2,
      position: "QB",
      game: { state: "post", detail: "Final", opp: "@ NYG", gameId: "x" },
    }),
    9.2,
  );
});

test("trailing late lifts pass-catcher remaining vs a RB", () => {
  const game = chip("3:00 - 4th", { margin: -21 });
  const wr = liveProjection({ baseline: 12, current: 4, position: "WR", game });
  const rb = liveProjection({ baseline: 12, current: 4, position: "RB", game });
  assert.ok(wr > rb, `WR ${wr} RB ${rb}`);
});
