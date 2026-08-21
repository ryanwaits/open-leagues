import { test } from "bun:test";
import assert from "node:assert/strict";
import { formatPlayPts, playCredits } from "./play-points.ts";
import { tagPlayText } from "./play-tags.ts";

const book = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -1,
  rush_yd: 0.1,
  rush_td: 6,
  rec: 1,
  rec_yd: 0.1,
  rec_td: 6,
  fum_lost: -2,
  xpm: 1,
  fgm_40_49: 4,
  fgm_50p: 5,
  fgmiss: -1,
  pr_yd: 0.05,
};

const mk = (id, first, last, team, position) => ({
  player: { player_id: id, full_name: `${first} ${last}`, first_name: first, last_name: last, team, position },
  side: "mine",
  slot: position,
  club: "Me",
  points: 0,
  stats: null,
});
const stroud = mk("1", "C.J.", "Stroud", "HOU", "QB");
const collins = mk("2", "Nico", "Collins", "HOU", "WR");
const marks = mk("3", "Woody", "Marks", "HOU", "RB");
const wilson = mk("4", "Tavierre", "Wilson", "LV", "DB");
const fairbairn = mk("5", "Ka'imi", "Fairbairn", "HOU", "K");
const all = [stroud, collins, marks, wilson, fairbairn];

const play = (text, type, yardage = null, scoring = false) => ({
  id: text,
  text,
  type,
  scoring,
  period: 1,
  clock: "10:00",
  awayScore: 0,
  homeScore: 0,
  yardage,
});
const credits = (p) => playCredits(p, tagPlayText(p.text, all), book);
const by = (cs, id) => cs.find((c) => c.tracked.player.player_id === id);

test("completion credits passer yards and receiver PPR + yards", () => {
  const p = play("(Shotgun) C.Stroud pass short right to N.Collins to LV 38 for 11 yards (J.Bennett).", "Pass Reception", 11);
  const cs = credits(p);
  assert.equal(by(cs, "1").points, 0.44);
  assert.equal(by(cs, "2").points, 2.1);
});

test("rushing touchdown", () => {
  const p = play("W.Marks left tackle for 20 yards, TOUCHDOWN. K.Fairbairn extra point is GOOD, Center-J.Weeks.", "Rushing Touchdown", 20, true);
  const cs = credits(p);
  assert.equal(by(cs, "3").points, 8);
  assert.equal(by(cs, "5").points, 1);
});

test("incompletion and interception", () => {
  assert.equal(by(credits(play("C.Stroud pass incomplete deep left to N.Collins.", "Pass Incompletion", 0)), "1").points, 0);
  assert.equal(by(credits(play("C.Stroud pass incomplete deep left to N.Collins.", "Pass Incompletion", 0)), "2").points, 0);
  assert.equal(
    by(credits(play("C.Stroud pass deep middle intended for N.Collins INTERCEPTED by T.Wilson at LV 20.", "Pass Interception Return", 0)), "1").points,
    -1,
  );
});

test("tackler in parentheses is not credited", () => {
  const cs = credits(play("W.Marks up the middle to HOU 43 for 3 yards (T.Wilson).", "Rush", 3));
  assert.equal(by(cs, "4"), undefined);
  assert.equal(by(cs, "3").points, 0.3);
});

test("fumble lost to the other team", () => {
  const cs = credits(play("W.Marks right end to HOU 40 for 2 yards. W.Marks FUMBLES (T.Wilson), RECOVERED by LV-J.Hummel at HOU 40.", "Fumble Recovery (Opponent)", 2));
  assert.equal(by(cs, "3").points, -1.8);
});

test("field goals by distance", () => {
  assert.equal(by(credits(play("K.Fairbairn 57 yard field goal is GOOD, Center-J.Weeks, Holder-T.Townsend.", "Field Goal Good", 0, true)), "5").points, 5);
  assert.equal(by(credits(play("K.Fairbairn 44 yard field goal is No Good, Wide Right.", "Field Goal Missed", 0)), "5").points, -1);
});

test("punt returner yards, punter nothing", () => {
  const jackson = mk("9", "Justin", "Jackson", "HOU", "RB");
  const p = play("A.Cole punts 45 yards to HOU 32, Center-T.Duzansky. J.Jackson pushed ob at HOU 40 for 8 yards (C.McGrone).", "Punt", null);
  const cs = playCredits(p, tagPlayText(p.text, [jackson]), book);
  assert.equal(by(cs, "9").points, 0.4);
});

test("formatPlayPts keeps real decimals", () => {
  assert.equal(formatPlayPts(2.1), "+2.1");
  assert.equal(formatPlayPts(0.44), "+0.44");
  assert.equal(formatPlayPts(8), "+8.0");
  assert.equal(formatPlayPts(-1), "−1.0");
});
