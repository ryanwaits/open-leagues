import { test } from "bun:test";
import assert from "node:assert/strict";
import { fmtSpread, spreadPoints, spreadSummary } from "./spread-series.ts";

function tick(at, spread) {
  return { at, spread };
}

test("spreadPoints sorts ascending from unsorted input", () => {
  const pts = spreadPoints([
    tick("2026-08-21T13:00:00Z", -6),
    tick("2026-08-21T11:00:00Z", -3),
    tick("2026-08-21T12:00:00Z", -4.5),
  ]);
  assert.deepEqual(
    pts.map((p) => p.value),
    [-3, -4.5, -6],
  );
  assert.ok(pts[0].time < pts[1].time && pts[1].time < pts[2].time);
});

test("spreadPoints drops NaN / unparsable entries", () => {
  const pts = spreadPoints([
    tick("2026-08-21T11:00:00Z", -3),
    tick("not-a-date", -4),
    tick("2026-08-21T12:00:00Z", Number.NaN),
  ]);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].value, -3);
});

test("spreadSummary is null under two points", () => {
  assert.equal(spreadSummary([]), null);
  assert.equal(spreadSummary([{ time: 1, value: -3 }]), null);
});

test("spreadSummary carries first/last and the move between them", () => {
  const sum = spreadSummary([
    { time: 1, value: -6 },
    { time: 2, value: -4 },
    { time: 3, value: -2.5 },
  ]);
  assert.deepEqual(sum, { first: -6, firstAt: 1, last: -2.5, lastAt: 3, moved: 3.5 });
});

test("fmtSpread", () => {
  assert.equal(fmtSpread(-12.5), "−12.5");
  assert.equal(fmtSpread(0), "PK");
  assert.equal(fmtSpread(3), "+3.0");
});
