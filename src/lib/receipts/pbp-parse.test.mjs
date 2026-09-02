import assert from "node:assert/strict";
import { test } from "node:test";
import { COLS, deltasFor, fgKey, splitCsv, team } from "./pbp-parse.ts";

const gsis = new Map([
  ["00-0033873", "4046"], // Mahomes
  ["00-0036322", "6794"], // Chase
  ["00-0038543", "9509"], // Achane
  ["00-0031234", "3678"], // a kicker
]);

function row(over) {
  const r = {};
  for (const c of COLS) r[c] = "";
  return { ...r, posteam: "KC", defteam: "LA", ...over };
}

test("csv lines keep quoted commas inside desc", () => {
  const f = splitCsv(
    '2025_01_A_B,1,"(14:26) (Shotgun) 15-P.Mahomes pass short right to 1-X.Worthy for 12 yards, TOUCHDOWN.",x',
  );
  assert.equal(f.length, 4);
  assert.match(f[2], /for 12 yards, TOUCHDOWN/);
});

test("team aliases map nflverse to Sleeper DEF ids", () => {
  assert.equal(team("LA"), "LAR");
  assert.equal(team("WSH"), "WAS");
  assert.equal(team("KC"), "KC");
});

test("a completed touchdown pass credits passer and receiver, and the defence's points allowed", () => {
  const d = deltasFor(
    row({
      play_type: "pass",
      passer_player_id: "00-0033873",
      receiver_player_id: "00-0036322",
      complete_pass: "1",
      passing_yards: "61",
      receiving_yards: "61",
      pass_touchdown: "1",
      sp: "1",
      posteam_score_post: "7",
      defteam_score_post: "0",
    }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by["4046"], { pass_cmp: 1, pass_yd: 61, pass_td: 1 });
  assert.deepEqual(by["6794"], { rec: 1, rec_yd: 61, rec_td: 1 });
  assert.equal(by.LAR.pts_allow, 7, "defence now allowing 7");
  assert.equal(by.KC.pts_allow, 0, "offence's own DEF level stays current");
});

test("an interception charges the passer and credits the defence", () => {
  const d = deltasFor(
    row({ play_type: "pass", passer_player_id: "00-0033873", interception: "1" }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by["4046"], { pass_inc: 1, pass_int: 1 });
  assert.deepEqual(by.LAR, { int: 1 });
});

test("a sack is not an incompletion", () => {
  const d = deltasFor(row({ play_type: "pass", passer_player_id: "00-0033873", sack: "1" }), gsis);
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by["4046"], { pass_sack: 1 });
  assert.deepEqual(by.LAR, { sack: 1 });
});

test("field goals bucket by distance; misses count", () => {
  assert.equal(fgKey(19), "fgm_0_19");
  assert.equal(fgKey(29), "fgm_20_29");
  assert.equal(fgKey(39), "fgm_30_39");
  assert.equal(fgKey(49), "fgm_40_49");
  assert.equal(fgKey(57), "fgm_50p");
  const d = deltasFor(
    row({
      kicker_player_id: "00-0031234",
      field_goal_result: "made",
      kick_distance: "52",
      sp: "1",
      posteam_score_post: "3",
      defteam_score_post: "0",
    }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by["3678"], { fgm_50p: 1 });
  const miss = deltasFor(
    row({ kicker_player_id: "00-0031234", field_goal_result: "missed", kick_distance: "44" }),
    gsis,
  );
  assert.deepEqual(Object.fromEntries(miss.map((x) => [x.p, x.d]))["3678"], { fgmiss: 1 });
});

test("a player Sleeper does not know produces no event", () => {
  const d = deltasFor(row({ rusher_player_id: "00-9999999", rushing_yards: "10" }), gsis);
  assert.equal(d.length, 0);
});

test("a lost fumble charges the fumbler and credits a recovering defence", () => {
  const d = deltasFor(
    row({
      rusher_player_id: "00-0038543",
      rushing_yards: "3",
      fumble_lost: "1",
      fumbled_1_player_id: "00-0038543",
      fumble_recovery_1_team: "LA",
    }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by["9509"], { rush_yd: 3, fum_lost: 1, fum: 1 });
  assert.deepEqual(by.LAR, { fum_rec: 1 });
});
