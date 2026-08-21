import { test } from "bun:test";
import assert from "node:assert/strict";
import { nextScoreFlash } from "./slot-pts.tsx";

test("projected / idle never flashes, even 0 → 20", () => {
  const a = nextScoreFlash(null, 0, false);
  const b = nextScoreFlash(a.prev, 20.5, false);
  assert.equal(b.delta, 0);
  assert.equal(b.prev, null);
});

test("first live unofficial is a baseline, not a notification", () => {
  const a = nextScoreFlash(null, 12, true);
  assert.equal(a.delta, 0);
  assert.equal(a.prev, 12);
});

test("a later live bump notifies", () => {
  const a = nextScoreFlash(12, 13.4, true);
  assert.ok(Math.abs(a.delta - 1.4) < 0.001);
});

test("missing data does not become a fake 0 baseline", () => {
  const a = nextScoreFlash(null, null, true);
  const b = nextScoreFlash(a.prev, 18.7, true);
  assert.equal(a.prev, null);
  assert.equal(b.delta, 0);
  assert.equal(b.prev, 18.7);
});
