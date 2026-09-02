/**
 * Pure parsing for the nflverse play-by-play feed: CSV lines, the columns a
 * flip needs, and the translation of one play into Sleeper stat deltas. No
 * I/O, so it is testable on its own; `pbp.server.ts` streams and stores.
 */

import { SCORING_FIELDS } from "@/lib/league/scoring";

/** nflverse abbreviations that differ from Sleeper's DEF ids. */
const TEAM_ALIAS: Record<string, string> = {
  LA: "LAR",
  WSH: "WAS",
  JAC: "JAX",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
};
export const team = (abbr: string) => TEAM_ALIAS[abbr] ?? abbr;

/* ── csv ─────────────────────────────────────────────────────────────── */

/** One RFC 4180 line → fields. nflverse quotes `desc`, which carries commas. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export const COLS = [
  "game_id",
  "week",
  "season_type",
  "time_of_day",
  "start_time",
  "qtr",
  "time",
  "game_seconds_remaining",
  "posteam",
  "defteam",
  "desc",
  "play_type",
  "sp",
  "passer_player_id",
  "receiver_player_id",
  "rusher_player_id",
  "complete_pass",
  "passing_yards",
  "receiving_yards",
  "rushing_yards",
  "pass_touchdown",
  "rush_touchdown",
  "interception",
  "sack",
  "fumble_lost",
  "fumbled_1_player_id",
  "fumbled_1_team",
  "fumble_recovery_1_team",
  "fumbled_2_player_id",
  "fumbled_2_team",
  "fumble_recovery_2_team",
  "forced_fumble_player_2_team",
  "touchdown",
  "two_point_conv_result",
  "field_goal_result",
  "kick_distance",
  "kicker_player_id",
  "extra_point_result",
  "safety",
  "return_touchdown",
  "td_team",
  "kickoff_returner_player_id",
  "punt_returner_player_id",
  "return_yards",
  "posteam_score",
  "posteam_score_post",
  "defteam_score",
  "defteam_score_post",
  "fourth_down_failed",
  "punt_blocked",
  "fumble_forced",
  "forced_fumble_player_1_team",
] as const;
export type Col = (typeof COLS)[number];

export const n = (v: string | undefined): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * Field-goal distance → Sleeper's finest bucket key. Sleeper's stat payload
 * carries both `fgm_50_59`/`fgm_60p` and the coarser `fgm_50p`; a league's book
 * scores one of the two, so the parser emits both for a long make.
 */
export function fgKey(distance: number): string {
  if (distance < 20) return "fgm_0_19";
  if (distance < 30) return "fgm_20_29";
  if (distance < 40) return "fgm_30_39";
  if (distance < 50) return "fgm_40_49";
  if (distance < 60) return "fgm_50_59";
  return "fgm_60p";
}

export type Row = Record<Col, string>;

/** One play → the stat deltas it produced, by Sleeper id. */
export function deltasFor(
  r: Row,
  gsis: Map<string, string>,
): { p: string; d: Record<string, number> }[] {
  const out: { p: string; d: Record<string, number> }[] = [];
  const add = (gsisId: string, d: Record<string, number>) => {
    const p = gsis.get(gsisId);
    if (p && Object.keys(d).length) out.push({ p, d });
  };
  const twoPt = r.two_point_conv_result === "success";

  if (r.passer_player_id) {
    const d: Record<string, number> = {};
    if (r.complete_pass === "1") {
      d.pass_cmp = 1;
      d.pass_yd = n(r.passing_yards);
    } else if (r.play_type === "pass" && r.sack !== "1" && !twoPt) d.pass_inc = 1;
    if (r.pass_touchdown === "1") d.pass_td = 1;
    if (r.interception === "1") {
      d.pass_int = 1;
      if (r.return_touchdown === "1") d.pass_int_td = 1;
    }
    if (r.sack === "1") d.pass_sack = 1;
    if (twoPt && r.play_type === "pass") d.pass_2pt = 1;
    add(r.passer_player_id, d);
  }
  if (r.receiver_player_id) {
    const d: Record<string, number> = {};
    if (r.complete_pass === "1") {
      d.rec = 1;
      d.rec_yd = n(r.receiving_yards);
      if (r.pass_touchdown === "1") d.rec_td = 1;
    }
    // A two-point catch is not a completion in the feed; it still scores.
    if (twoPt && r.play_type === "pass") d.rec_2pt = 1;
    add(r.receiver_player_id, d);
  }
  if (r.rusher_player_id) {
    const d: Record<string, number> = { rush_yd: n(r.rushing_yards) };
    if (r.rush_touchdown === "1") d.rush_td = 1;
    if (twoPt && r.play_type === "run") d.rush_2pt = 1;
    add(r.rusher_player_id, d);
  }
  if (r.fumble_lost === "1") {
    if (r.fumbled_1_player_id) add(r.fumbled_1_player_id, { fum_lost: 1, fum: 1 });
    if (r.fumbled_2_player_id && r.fumbled_2_team !== r.fumble_recovery_2_team)
      add(r.fumbled_2_player_id, { fum_lost: 1, fum: 1 });
  }

  if (r.kicker_player_id) {
    const d: Record<string, number> = {};
    if (r.field_goal_result === "made") {
      const dist = n(r.kick_distance);
      d.fgm = 1;
      d.fgm_yds = dist;
      d[fgKey(dist)] = 1;
      if (dist >= 50) d.fgm_50p = 1;
    } else if (r.field_goal_result === "missed" || r.field_goal_result === "blocked") d.fgmiss = 1;
    if (r.extra_point_result === "good") d.xpm = 1;
    else if (r.extra_point_result && r.extra_point_result !== "good") d.xpmiss = 1;
    add(r.kicker_player_id, d);
  }
  if (r.kickoff_returner_player_id) {
    const d: Record<string, number> = { kr_yd: n(r.return_yards) };
    if (r.return_touchdown === "1") d.kr_td = 1;
    add(r.kickoff_returner_player_id, d);
  }
  if (r.punt_returner_player_id) {
    const d: Record<string, number> = { pr_yd: n(r.return_yards) };
    if (r.return_touchdown === "1") d.pr_td = 1;
    add(r.punt_returner_player_id, d);
  }

  // Defence / special teams. A DEF "player" is the team abbreviation. On a
  // kickoff, punt, or kick attempt the coverage unit's plays land on Sleeper's
  // `def_st_*` keys, which most books pay differently from the scrimmage keys.
  const st =
    r.play_type === "kickoff" ||
    r.play_type === "punt" ||
    r.play_type === "field_goal" ||
    r.play_type === "extra_point";
  const def: Record<string, Record<string, number>> = {};
  const credit = (abbr: string | undefined, key: string, v = 1) => {
    if (!abbr) return;
    const bag = def[abbr] ?? {};
    bag[key] = (bag[key] ?? 0) + v;
    def[abbr] = bag;
  };
  if (r.defteam) {
    if (r.sack === "1") credit(r.defteam, "sack");
    if (r.interception === "1") credit(r.defteam, "int");
    if (r.safety === "1") credit(r.defteam, "safe");
    if (r.fourth_down_failed === "1") credit(r.defteam, "def_4_and_stop");
    if (
      r.field_goal_result === "blocked" ||
      r.extra_point_result === "blocked" ||
      r.punt_blocked === "1"
    ) {
      credit(r.defteam, "blk_kick");
    }
  }
  // Forced fumbles belong to the unit on defence: the defence of record on a
  // scrimmage play, the coverage unit on a kick. A ball-carrier stripped by
  // the offence on an interception return is nobody's DEF stat, and Sleeper
  // credits the strip whether or not the ball was recovered.
  const unit = r.play_type === "punt" ? r.posteam : r.defteam;
  for (const t of [r.forced_fumble_player_1_team, r.forced_fumble_player_2_team]) {
    if (t && t === unit) credit(t, st ? "def_st_ff" : "ff");
  }
  const takeaway = (rec: string, fumbled: string) =>
    rec && (fumbled ? rec !== fumbled : r.fumble_lost === "1");
  if (takeaway(r.fumble_recovery_1_team, r.fumbled_1_team))
    credit(r.fumble_recovery_1_team, st ? "def_st_fum_rec" : "fum_rec");
  if (takeaway(r.fumble_recovery_2_team, r.fumbled_2_team))
    credit(r.fumble_recovery_2_team, st ? "def_st_fum_rec" : "fum_rec");
  // A touchdown by anyone but the offence of record is the defence's. On a
  // kick, every touchdown is the unit's — Sleeper pays a returner's hundred
  // yards to the DEF/ST slot as well as to him.
  if (r.touchdown === "1" && r.td_team) {
    if (st) credit(r.td_team, "def_st_td");
    else if (r.td_team !== r.posteam) credit(r.td_team, "def_td");
  }
  // Points allowed, as deltas the reader sums. Sleeper's `pts_allow` is the
  // opponent's score minus what the opponent's defence scored: a pick-six
  // against your offence is not charged to your DEF, but a kick return is.
  if (r.sp === "1") {
    const byPos = n(r.posteam_score_post) - n(r.posteam_score);
    const byDef = n(r.defteam_score_post) - n(r.defteam_score);
    if (byPos > 0) credit(r.defteam, "pts_allow", byPos);
    if (byDef > 0 && st) credit(r.posteam, "pts_allow", byDef);
  }
  for (const [abbr, d] of Object.entries(def)) out.push({ p: team(abbr), d });

  // One event per player per play: a rusher who also fumbled is one line.
  const merged = new Map<string, Record<string, number>>();
  for (const { p, d } of out) {
    const cur = merged.get(p) ?? {};
    for (const [k, v] of Object.entries(d)) cur[k] = (cur[k] ?? 0) + v;
    merged.set(p, cur);
  }
  return [...merged.entries()].map(([p, d]) => ({ p, d }));
}

/* ── settlement ──────────────────────────────────────────────────────── */

/**
 * Keys a book can score and a play log can under-count: every scoring field
 * except the tier flags and bonus markers Sleeper derives, plus the two DEF
 * levels the flip sums. `pts_allow` is settled as a delta like everything else.
 */
export const SETTLE_KEYS: ReadonlySet<string> = new Set([
  ...SCORING_FIELDS.map((f) => f.key).filter((k) => !/^(pts_allow_|yds_allow_|bonus_)/.test(k)),
  "pts_allow",
  "yds_allow",
]);

/**
 * What the official box score says the play log missed. Sleeper's weekly bag
 * is the gamebook after corrections; nflverse is one row per play. Where they
 * differ — a re-spotted catch, a Thursday stat correction — the difference is
 * booked as one settlement event at the final whistle, so finals always match
 * the box score and the play log still supplies the minute.
 */
export function settlementFor(
  ours: Record<string, number>,
  official: Record<string, number> | undefined,
  keys: ReadonlySet<string> = SETTLE_KEYS,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!official) return out; // no official line for this player: the log stands
  const all = new Set([...Object.keys(ours), ...Object.keys(official)]);
  for (const k of all) {
    if (!keys.has(k)) continue;
    const delta = Math.round(((official[k] ?? 0) - (ours[k] ?? 0)) * 100) / 100;
    if (Math.abs(delta) >= 0.005) out[k] = delta;
  }
  return out;
}
