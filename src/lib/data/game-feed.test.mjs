import { test } from "bun:test";
import assert from "node:assert/strict";
import { drivesForLiveFeed, lastPlayText, playWhen, withLiveSnap } from "./game-feed.ts";

const play = (id, clock, period = 3) => ({
  id,
  text: id,
  type: "Rush",
  scoring: false,
  period,
  clock,
  awayScore: 3,
  homeScore: 20,
  yardage: 1,
});

const drive = (id, clocks, period = 3) => ({
  id,
  team: id.startsWith("lv") ? "LV" : "HOU",
  logo: null,
  result: "",
  description: "",
  start: "",
  plays: clocks.map((c, i) => play(`${id}-${i}`, c, period)),
});

test("Q3 8:53 is later than Q3 10:27", () => {
  assert.ok(playWhen(3, "8:53") > playWhen(3, "10:27"));
});

test("live feed puts the latest snap first", () => {
  const out = drivesForLiveFeed(
    [drive("d1", ["14:00", "13:20"]), drive("d2", ["12:44", "10:27"])],
    true,
  );
  assert.equal(out[0].id, "d2");
  assert.equal(out[0].plays[0].clock, "10:27");
  assert.equal(out[0].plays[1].clock, "12:44");
});

test("stale ESPN current (old punt) loses to a newer drive already in previous", () => {
  const hou = drive("hou", ["12:44", "10:27"]);
  const lv = drive("lv", ["10:20", "9:41"]);
  // payload order: previous chrono then a stale current appended
  const out = drivesForLiveFeed([hou, lv, hou], true);
  assert.equal(out[0].id, "lv");
  assert.equal(out[0].plays[0].clock, "9:41");
});

test("settled games stay chronological", () => {
  const src = [drive("d1", ["14:00"]), drive("d2", ["10:27"])];
  const out = drivesForLiveFeed(src, false);
  assert.equal(out[0].id, "d1");
  assert.equal(out[0].plays[0].clock, "14:00");
});

test("lastPlayText is the newest snap, not the drive start", () => {
  assert.equal(lastPlayText([drive("d1", ["12:44", "11:28", "10:27"])]), "d1-2");
});

test("lastPlayText follows recency, not array order", () => {
  const hou = drive("hou", ["12:44", "10:27"]);
  const lv = drive("lv", ["9:41"]);
  assert.equal(lastPlayText([hou, lv, hou]), "lv-0");
});

test("pins header last play on top when PBP has not caught up", () => {
  const hou = drive("hou", ["10:27"]);
  const out = withLiveSnap(
    drivesForLiveFeed([hou], true),
    "A.O'Connell pass short left to D.Thompkins.",
    "9:41 - 3rd",
  );
  assert.equal(out[0].plays[0].id, "live-snap");
  assert.equal(out[0].plays[0].clock, "9:41");
  assert.equal(out[0].plays[0].period, 3);
});

test("does not duplicate the header last play", () => {
  const lv = drive("lv", ["9:41"]);
  lv.plays[0].text = "same";
  const out = withLiveSnap(drivesForLiveFeed([lv], true), "same", "9:41 - 3rd");
  assert.equal(out[0].plays.length, 1);
});
