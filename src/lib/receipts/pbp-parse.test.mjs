import assert from "node:assert/strict";
import { test } from "node:test";
import { COLS, deltasFor, fgKey, SETTLE_KEYS, settlementFor, splitCsv, team } from "./pbp-parse.ts";

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
  assert.equal(by.LAR.pts_allow, 7, "defence charged the seven it allowed");
  assert.equal(by.KC, undefined, "the scoring offence's own DEF is untouched");
});

test("a pick-six scores for the defence and counts against the offence's own DEF, as Sleeper does", () => {
  const d = deltasFor(
    row({
      play_type: "pass",
      passer_player_id: "00-0033873",
      interception: "1",
      return_touchdown: "1",
      touchdown: "1",
      td_team: "LA",
      sp: "1",
      posteam_score: "0",
      posteam_score_post: "0",
      defteam_score: "0",
      defteam_score_post: "6",
    }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by.LAR, { int: 1, def_td: 1 });
  assert.equal(by.KC, undefined, "a defensive score is not charged to the offence's DEF");
  assert.deepEqual(by["4046"], { pass_inc: 1, pass_int: 1, pass_int_td: 1 });
});

test("a kick return touchdown counts against the kicking team's DEF; a blocked kick run back is def_st_td", () => {
  const kr = deltasFor(
    row({
      play_type: "kickoff",
      posteam: "KC",
      defteam: "LA",
      kickoff_returner_player_id: "00-0036322",
      return_yards: "98",
      return_touchdown: "1",
      touchdown: "1",
      td_team: "KC",
      sp: "1",
      posteam_score: "0",
      posteam_score_post: "6",
      defteam_score: "0",
      defteam_score_post: "0",
    }),
    gsis,
  );
  const by = Object.fromEntries(kr.map((x) => [x.p, x.d]));
  assert.deepEqual(by["6794"], { kr_yd: 98, kr_td: 1 });
  assert.deepEqual(by.LAR, { pts_allow: 6 });
  assert.deepEqual(by.KC, { def_st_td: 1 }, "Sleeper pays a return TD to the DEF/ST slot too");
  const blk = deltasFor(
    row({
      play_type: "field_goal",
      posteam: "KC",
      defteam: "LA",
      kicker_player_id: "00-0031234",
      field_goal_result: "blocked",
      kick_distance: "44",
      touchdown: "1",
      return_touchdown: "1",
      td_team: "LA",
      sp: "1",
      posteam_score: "0",
      posteam_score_post: "0",
      defteam_score: "0",
      defteam_score_post: "6",
    }),
    gsis,
  );
  const b2 = Object.fromEntries(blk.map((x) => [x.p, x.d]));
  assert.deepEqual(b2.LAR, { blk_kick: 1, def_st_td: 1 });
  assert.deepEqual(b2.KC, { pts_allow: 6 }, "a special-teams score is charged, unlike a pick-six");
});

test("a two-point catch scores without a completion; special-teams plays use the st keys", () => {
  const two = deltasFor(
    row({
      play_type: "pass",
      passer_player_id: "00-0033873",
      receiver_player_id: "00-0036322",
      complete_pass: "0",
      two_point_conv_result: "success",
    }),
    gsis,
  );
  const by = Object.fromEntries(two.map((x) => [x.p, x.d]));
  assert.deepEqual(by["6794"], { rec_2pt: 1 });
  assert.deepEqual(by["4046"], { pass_2pt: 1 });
  const punt = deltasFor(
    row({
      play_type: "punt",
      fumble_lost: "1",
      fumbled_1_player_id: "00-0036322",
      fumbled_1_team: "KC",
      forced_fumble_player_1_team: "LA",
      fumble_recovery_1_team: "LA",
    }),
    gsis,
  );
  // On a punt the punting team is the offence of record, so LA's coverage
  // unit is the posteam here.
  assert.deepEqual(Object.fromEntries(punt.map((x) => [x.p, x.d])).LAR, {
    def_st_fum_rec: 1,
  });
  const cover = deltasFor(
    row({
      play_type: "punt",
      posteam: "LA",
      defteam: "KC",
      fumble_lost: "1",
      fumbled_1_player_id: "00-0036322",
      fumbled_1_team: "KC",
      forced_fumble_player_1_team: "LA",
      fumble_recovery_1_team: "LA",
    }),
    gsis,
  );
  assert.deepEqual(Object.fromEntries(cover.map((x) => [x.p, x.d])).LAR, {
    def_st_ff: 1,
    def_st_fum_rec: 1,
  });
});

test("fourth-down stops, forced fumbles, and blocked kicks credit the defence", () => {
  const d = deltasFor(
    row({
      play_type: "run",
      rusher_player_id: "00-0033873",
      rushing_yards: "1",
      fourth_down_failed: "1",
      fumble_forced: "1",
      forced_fumble_player_1_team: "LA",
      fumbled_1_team: "KC",
    }),
    gsis,
  );
  const by = Object.fromEntries(d.map((x) => [x.p, x.d]));
  assert.deepEqual(by.LAR, { def_4_and_stop: 1, ff: 1 });
  const blk = deltasFor(
    row({ kicker_player_id: "00-0031234", field_goal_result: "blocked", kick_distance: "44" }),
    gsis,
  );
  assert.deepEqual(Object.fromEntries(blk.map((x) => [x.p, x.d])).LAR, { blk_kick: 1 });
});

test("return yards count on every return, not only touchdowns", () => {
  const d = deltasFor(
    row({ play_type: "kickoff", kickoff_returner_player_id: "00-0036322", return_yards: "27" }),
    gsis,
  );
  assert.deepEqual(Object.fromEntries(d.map((x) => [x.p, x.d]))["6794"], { kr_yd: 27 });
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
  assert.equal(fgKey(57), "fgm_50_59");
  assert.equal(fgKey(61), "fgm_60p");
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
  assert.deepEqual(by["3678"], { fgm: 1, fgm_yds: 52, fgm_50_59: 1, fgm_50p: 1 });
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

test("settlement books only what the box score says the log missed, on scoreable keys", () => {
  const ours = { rec: 3, rec_yd: 57, rush_yd: 8, fum_lost: 1, fum: 1 };
  const official = {
    rec: 3,
    rec_yd: 68,
    rush_yd: 8,
    fum_lost: 1,
    fum: 1,
    rush_att: 3,
    pts_half_ppr: 7.1,
  };
  assert.deepEqual(settlementFor(ours, official), { rec_yd: 11 });
  // no official line for the player → the log stands, nothing is booked
  assert.deepEqual(settlementFor(ours, undefined), {});
  // a player the log never saw but the box score did is booked whole
  assert.deepEqual(settlementFor({}, { rec: 2, rec_yd: 14, rush_att: 1 }), { rec: 2, rec_yd: 14 });
  // tier flags and bonus markers are derived by the book, never settled
  assert.ok(!SETTLE_KEYS.has("pts_allow_14_20"));
  assert.ok(!SETTLE_KEYS.has("bonus_rec_yd_100"));
  assert.ok(SETTLE_KEYS.has("pts_allow"));
  assert.ok(SETTLE_KEYS.has("rec_yd"));
});
