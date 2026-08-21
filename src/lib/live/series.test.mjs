import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  appendSample,
  bufferKey,
  clampLerp,
  clearSeries,
  ema,
  fmtClockOfDay,
  fmtGameClock,
  readSeries,
  shiftToNow,
  swing,
} from "./series.ts";

test("ema: first point unchanged, alpha=1 returns the input values", () => {
  const pts = [
    { time: 0, value: 0 },
    { time: 1, value: 10 },
    { time: 2, value: 20 },
  ];
  const smoothed = ema(pts, 1);
  assert.equal(smoothed[0].value, 0);
  assert.deepEqual(
    smoothed.map((p) => p.value),
    [0, 10, 20],
  );
});

test("ema: step 0,0,10,10,10 at alpha 0.35 approaches 10 monotonically", () => {
  const pts = [0, 0, 10, 10, 10].map((value, i) => ({ time: i, value }));
  const smoothed = ema(pts, 0.35);
  assert.equal(smoothed[0].value, 0);
  assert.ok(Math.abs(smoothed[2].value - 3.5) < 0.001, `got ${smoothed[2].value}`);
  assert.ok(smoothed[4].value < 10, `got ${smoothed[4].value}`);
  for (let i = 2; i < smoothed.length; i++) {
    assert.ok(smoothed[i].value >= smoothed[i - 1].value, `not monotone at ${i}`);
  }
});

test("swing: fewer than 2 points is flat/0", () => {
  assert.deepEqual(swing([], 60, 1), { dir: "flat", delta: 0 });
  assert.deepEqual(swing([{ time: 0, value: 5 }], 60, 1), { dir: "flat", delta: 0 });
});

test("swing: rising past threshold is up, delta ~= 2", () => {
  const pts = [
    { time: 0, value: 10 },
    { time: 60, value: 12 },
  ];
  const result = swing(pts, 300, 1.2);
  assert.equal(result.dir, "up");
  assert.ok(Math.abs(result.delta - 2) < 0.001, `got ${result.delta}`);
});

test("swing: same delta under a higher threshold is flat", () => {
  const pts = [
    { time: 0, value: 10 },
    { time: 60, value: 12 },
  ];
  assert.equal(swing(pts, 300, 3).dir, "flat");
});

test("swing: falling past threshold is down", () => {
  const pts = [
    { time: 0, value: 10 },
    { time: 60, value: 7 },
  ];
  const result = swing(pts, 300, 1.2);
  assert.equal(result.dir, "down");
  assert.ok(result.delta < 0);
});

test("swing: walks back past intermediate points to the window boundary", () => {
  const pts = [0, 15, 30, 45, 60].map((time, i) => ({ time, value: i * 2 }));
  // last = t60 (value 8); window 30 -> reference should be t30 (value 4), not t0.
  const result = swing(pts, 30, 0);
  assert.equal(result.delta, 4);
});

test("shiftToNow: last sample lands on nowSecs, gaps preserved, input untouched", () => {
  const pts = [
    { time: 0, value: 1 },
    { time: 10, value: 2 },
    { time: 25, value: 3 },
  ];
  const shifted = shiftToNow(pts, 1000);
  assert.deepEqual(
    shifted.map((p) => p.time),
    [975, 985, 1000],
  );
  assert.deepEqual(
    pts.map((p) => p.time),
    [0, 10, 25],
  );
});

test("shiftToNow: empty in, empty out", () => {
  assert.deepEqual(shiftToNow([], 1000), []);
});

test("clampLerp clamps to [0.01, 0.6], NaN falls to 0.01", () => {
  assert.equal(clampLerp(1), 0.6);
  assert.equal(clampLerp(0.8), 0.6);
  assert.equal(clampLerp(0.12), 0.12);
  assert.equal(clampLerp(0), 0.01);
  assert.equal(clampLerp(Number.NaN), 0.01);
});

test("bufferKey joins league, week, id", () => {
  assert.equal(bufferKey("L", 3, 6), "L:3:6");
});

test("appendSample appends and returns the same array reference", () => {
  clearSeries();
  const key = bufferKey("L", 1, "p1");
  const a = appendSample(key, 10, 0);
  const b = appendSample(key, 11, 5);
  assert.equal(a, b);
  assert.deepEqual(readSeries(key), [
    { time: 0, value: 10 },
    { time: 5, value: 11 },
  ]);
});

test("appendSample de-bounces an identical value under 1s later", () => {
  clearSeries();
  const key = bufferKey("L", 1, "p2");
  appendSample(key, 5, 0);
  appendSample(key, 5, 0.5);
  assert.equal(readSeries(key).length, 1);
  appendSample(key, 5, 2);
  assert.equal(readSeries(key).length, 2);
});

test("appendSample trims to cap, oldest-first", () => {
  clearSeries();
  const key = bufferKey("L", 1, "p3");
  for (let i = 0; i < 5; i++) appendSample(key, i, i * 10, 3);
  const series = readSeries(key);
  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((p) => p.value),
    [2, 3, 4],
  );
});

test("readSeries of an unknown key is empty; clearSeries() empties everything", () => {
  clearSeries();
  assert.deepEqual(readSeries("nope"), []);
  appendSample("k1", 1, 0);
  appendSample("k2", 1, 0);
  clearSeries();
  assert.deepEqual(readSeries("k1"), []);
  assert.deepEqual(readSeries("k2"), []);
});

test("fmtClockOfDay formats local clock-of-day, minutes omitted on the hour", () => {
  const one = new Date(2026, 8, 13, 13, 0);
  const fourTwentyFive = new Date(2026, 8, 13, 16, 25);
  const twelveOhFive = new Date(2026, 8, 13, 0, 5);
  assert.equal(fmtClockOfDay(one.getTime() / 1000), "1p");
  assert.equal(fmtClockOfDay(fourTwentyFive.getTime() / 1000), "4:25p");
  assert.equal(fmtClockOfDay(twelveOhFive.getTime() / 1000), "12:05a");
});

test("fmtGameClock: quarters, OT, and pre-kickoff", () => {
  assert.equal(fmtGameClock(0), "Q1 15:00");
  assert.equal(fmtGameClock(900), "Q2 15:00");
  assert.equal(fmtGameClock(2300), "Q3 6:40");
  assert.equal(fmtGameClock(3599), "Q4 0:01");
  assert.equal(fmtGameClock(3600), "OT 10:00");
  assert.equal(fmtGameClock(-5), "Kick");
});
