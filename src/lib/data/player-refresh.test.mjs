import assert from "node:assert/strict";
import { test } from "node:test";
import { paintStatus } from "./player-refresh.server.ts";

function overlay(extra = {}) {
  return {
    injuryStatus: extra.injuryStatus ?? null,
    status: extra.status ?? "Active",
    team: extra.team ?? "KC",
    newsUpdated: extra.newsUpdated ?? null,
    injuryBodyPart: extra.injuryBodyPart ?? null,
    injuryNotes: extra.injuryNotes ?? null,
    practiceParticipation: null,
    practiceDescription: null,
    depthChartOrder: extra.depthChartOrder ?? 1,
    rotowireId: null,
  };
}

test("overlay null injury clears slim Q", () => {
  const p = { player_id: "4046", injury_status: "Questionable" };
  paintStatus(p, overlay({ injuryStatus: null }));
  assert.equal(p.injury_status, null);
});

test("no overlay drops slim Q", () => {
  const p = { player_id: "4046", injury_status: "Questionable" };
  paintStatus(p, undefined);
  assert.equal(p.injury_status, null);
});

test("overlay Out replaces slim Q", () => {
  const p = { player_id: "4046", injury_status: "Questionable" };
  paintStatus(p, overlay({ injuryStatus: "Out" }));
  assert.equal(p.injury_status, "Out");
});
