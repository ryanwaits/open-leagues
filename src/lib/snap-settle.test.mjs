import assert from "node:assert/strict";
import { test } from "node:test";
import { settledIndex } from "./snap-settle.ts";

test("at rest on first card", () => {
  assert.equal(settledIndex(0, 346, 7), 0);
});

test("settled exactly on second card", () => {
  assert.equal(settledIndex(346, 346, 7), 1);
});

test("rounds to nearest card mid-scroll", () => {
  assert.equal(settledIndex(500, 346, 7), 1);
});

test("clamps to last card", () => {
  assert.equal(settledIndex(10000, 346, 7), 6);
});

test("zero cardW clamps to 0", () => {
  assert.equal(settledIndex(100, 0, 7), 0);
});

test("zero count clamps to 0", () => {
  assert.equal(settledIndex(100, 346, 0), 0);
});
