import { test } from "bun:test";
import assert from "node:assert/strict";
import { shortKickoff } from "./kickoff.ts";

const sept = new Date(2026, 8, 1);

test("sunday night", () => {
  assert.equal(shortKickoff("9/13 - 8:20 PM EDT", sept), "Sun 8:20");
});

test("early window and monday", () => {
  assert.equal(shortKickoff("9/13 - 1:00 PM EDT", sept), "Sun 1:00");
  assert.equal(shortKickoff("9/14 - 8:15 PM EDT", sept), "Mon 8:15");
});

test("london morning keeps an a", () => {
  assert.equal(shortKickoff("10/4 - 9:30 AM EDT", sept), "Sun 9:30a");
});

test("january from the autumn is next year's playoffs", () => {
  // Jan 10 2027 is a Sunday.
  assert.equal(shortKickoff("1/10 - 4:30 PM EST", new Date(2026, 10, 20)), "Sun 4:30");
});

test("non-schedule details fall through", () => {
  assert.equal(shortKickoff("Final", sept), null);
  assert.equal(shortKickoff("Q3 8:53", sept), null);
  assert.equal(shortKickoff(null, sept), null);
});
