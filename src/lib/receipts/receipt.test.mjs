import assert from "node:assert/strict";
import { test } from "node:test";
import { publicName } from "./receipt.server.ts";

test("a real team name is shown as-is", () => {
  assert.equal(publicName("Commish is Corrupt", "millertime710", 2), "Commish is Corrupt");
});

test("a team name that is just the username becomes the roster number", () => {
  assert.equal(publicName("Jakeg22", "Jakeg22", 3), "Roster 3");
  assert.equal(publicName("  Jakeg22 ", "Jakeg22", 3), "Roster 3");
});

test("an empty team name becomes the roster number", () => {
  assert.equal(publicName("", "someone", 7), "Roster 7");
  assert.equal(publicName("   ", "someone", 7), "Roster 7");
});
