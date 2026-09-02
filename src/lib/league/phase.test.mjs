import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seekReplacement, wirePosForSlot } from "./phase.ts";

test("wirePosForSlot maps labeled starters onto the Players filter", () => {
  assert.equal(wirePosForSlot("DST"), "DEF");
  assert.equal(wirePosForSlot("DEF"), "DEF");
  assert.equal(wirePosForSlot("D/ST"), "DEF");
  assert.equal(wirePosForSlot("QB"), "QB");
  assert.equal(wirePosForSlot("RB2"), "RB");
  assert.equal(wirePosForSlot("WR"), "WR");
  assert.equal(wirePosForSlot("K"), "K");
  assert.equal(wirePosForSlot("FLX"), "ALL");
  assert.equal(wirePosForSlot("FLEX"), "ALL");
});

test("seekReplacement names the first broken slot", () => {
  const def = seekReplacement([{ slot: "DST", kind: "bye", player: null, reason: "BYE" }]);
  assert.equal(def.pos, "DEF");
  assert.equal(def.label, "Find a defense");

  const qb = seekReplacement([{ slot: "QB", kind: "empty", player: null, reason: "No starter" }]);
  assert.equal(qb.pos, "QB");
  assert.equal(qb.label, "Find a quarterback");

  const flex = seekReplacement([
    { slot: "FLX", kind: "empty", player: null, reason: "No starter" },
  ]);
  assert.equal(flex.pos, "ALL");
  assert.equal(flex.label, "Find a replacement");
});

test("alarm CTA sends the wire a position search, not a bare Players link", () => {
  const src = readFileSync(join(import.meta.dirname, "../../components/phase-hero.tsx"), "utf8");
  assert.match(src, /seekReplacement/);
  assert.match(src, /to=["']\/league\/\$leagueId\/wire["']/);
  assert.match(src, /search=\{seek\.pos === "ALL" \? undefined : \{ pos: seek\.pos \}\}/);
  assert.match(src, /\{seek\.label\}/);
});
