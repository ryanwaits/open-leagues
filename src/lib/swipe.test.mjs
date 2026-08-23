import { test } from "bun:test";
import assert from "node:assert/strict";
import { swipeCommit } from "./swipe.ts";

test("a quarter-width drag commits in the drag direction", () => {
  assert.equal(swipeCommit(-100, 390, 0), 1); // left drag → next
  assert.equal(swipeCommit(100, 390, 0), -1); // right drag → previous
});

test("a short slow drag springs back", () => {
  assert.equal(swipeCommit(-40, 390, 0.1), 0);
  assert.equal(swipeCommit(30, 390, -0.1), 0);
});

test("a fast flick commits even when short — but only with real travel", () => {
  assert.equal(swipeCommit(-30, 390, -0.8), 1);
  assert.equal(swipeCommit(-10, 390, -2), 0); // jitter never commits
});

test("degenerate width never commits", () => {
  assert.equal(swipeCommit(-200, 0, -1), 0);
});
