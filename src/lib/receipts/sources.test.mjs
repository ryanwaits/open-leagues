import assert from "node:assert/strict";
import { test } from "node:test";
import { agreement, agreementLine, callsFor } from "./sources.ts";

const values = {
  dike: { sleeper_proj: 9.4, last3: 11.2, season_avg: 8.8 },
  rice: { sleeper_proj: 6.1, last3: 12.0, season_avg: 9.9 },
  ghost: { sleeper_proj: null, last3: null, season_avg: null },
};

test("each source calls start or hold by comparing its own numbers", () => {
  const calls = callsFor("rice", "dike", values);
  assert.deepEqual(
    calls.map((c) => [c.source, c.pick]),
    [
      ["sleeper_proj", "start"],
      ["last3", "hold"],
      ["season_avg", "hold"],
    ],
  );
  assert.deepEqual(agreement(calls), { start: 1, hold: 2, of: 3 });
});

test("an empty slot means every source that has a number says start", () => {
  const calls = callsFor(null, "dike", values);
  assert.ok(calls.every((c) => c.pick === "start"));
});

test("a source with no number abstains and is not counted", () => {
  const calls = callsFor("rice", "ghost", values);
  assert.ok(calls.every((c) => c.pick === "none"));
  assert.deepEqual(agreement(calls), { start: 0, hold: 0, of: 0 });
  assert.equal(agreementLine(calls, "Ghost", "Rice"), null);
});

test("the card line names the sources on each side", () => {
  const line = agreementLine(callsFor("rice", "dike", values), "Dike", "Rice");
  assert.equal(
    line,
    "Sleeper projection said start Dike; Last 3 weeks and Season average said hold Rice.",
  );
});
