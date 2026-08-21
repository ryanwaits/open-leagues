import { test } from "bun:test";
import assert from "node:assert/strict";
import { shouldWrite, spreadFrom } from "./ticks.server.ts";

test("spreadFrom: 121.3, 108.7 -> -12.5", () => {
  assert.equal(spreadFrom(121.3, 108.7), -12.5);
});

test("spreadFrom: equal projections normalise -0 to 0", () => {
  const v = spreadFrom(100, 100);
  assert.equal(v, 0);
  assert.ok(!Object.is(v, -0), "expected +0, got -0");
});

test("spreadFrom: away favored is a positive spread", () => {
  assert.equal(spreadFrom(90, 100), 10);
});

test("shouldWrite: no prior write always writes", () => {
  assert.equal(shouldWrite(undefined, Date.now()), true);
});

test("shouldWrite: throttles within the gap, allows after it", () => {
  const last = 1_000_000;
  assert.equal(shouldWrite(last, last + 10_000), false);
  assert.equal(shouldWrite(last, last + 55_000), true);
  assert.equal(shouldWrite(last, last + 54_999), false);
});
