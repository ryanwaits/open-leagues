import assert from "node:assert/strict";
import { test } from "node:test";
import { nextHidden } from "./scroll-hide.ts";

test("big down hides", () => {
  assert.equal(nextHidden(0, 200, false), true);
});

test("jitter holds", () => {
  assert.equal(nextHidden(200, 196, true), true);
});

test("up shows", () => {
  assert.equal(nextHidden(200, 150, true), false);
});

test("near top always shows", () => {
  assert.equal(nextHidden(500, 100, true), false);
});

test("small down holds", () => {
  assert.equal(nextHidden(100, 104, false), false);
});
