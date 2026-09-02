/**
 * Pure parsing for the nflverse play-by-play feed: CSV lines, the columns a
 * flip needs, and the translation of one play into Sleeper stat deltas. No
 * I/O, so it is testable on its own; `pbp.server.ts` streams and stores.
 */

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
  "fumble_recovery_1_team",
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
    } else if (r.play_type === "pass" && r.sack !== "1") d.pass_inc = 1;
    if (r.pass_touchdown === "1") d.pass_td = 1;
    if (r.interception === "1") d.pass_int = 1;
    if (r.sack === "1") d.pass_sack = 1;
    if (twoPt && r.play_type === "pass") d.pass_2pt = 1;
    add(r.passer_player_id, d);
  }
  if (r.receiver_player_id && r.complete_pass === "1") {
    const d: Record<string, number> = { rec: 1, rec_yd: n(r.receiving_yards) };
    if (r.pass_touchdown === "1") d.rec_td = 1;
    if (twoPt && r.play_type === "pass") d.rec_2pt = 1;
    add(r.receiver_player_id, d);
  }
  if (r.rusher_player_id) {
    const d: Record<string, number> = { rush_yd: n(r.rushing_yards) };
    if (r.rush_touchdown === "1") d.rush_td = 1;
    if (twoPt && r.play_type === "run") d.rush_2pt = 1;
    add(r.rusher_player_id, d);
  }
  if (r.fumble_lost === "1" && r.fumbled_1_player_id)
    add(r.fumbled_1_player_id, { fum_lost: 1, fum: 1 });

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
  const kickReturn = Boolean(r.kickoff_returner_player_id || r.punt_returner_player_id);
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

  // Defence / special teams: a DEF "player" is the team abbreviation.
  if (r.defteam) {
    const d: Record<string, number> = {};
    if (r.sack === "1") d.sack = 1;
    if (r.interception === "1") d.int = 1;
    if (r.fumble_forced === "1" && r.forced_fumble_player_1_team === r.defteam) d.ff = 1;
    if (r.fumble_lost === "1" && r.fumble_recovery_1_team === r.defteam) d.fum_rec = 1;
    if (r.safety === "1") d.safe = 1;
    if (r.fourth_down_failed === "1") d.def_4_and_stop = 1;
    if (
      r.field_goal_result === "blocked" ||
      r.extra_point_result === "blocked" ||
      r.punt_blocked === "1"
    ) {
      d.blk_kick = 1;
    }
    if (r.return_touchdown === "1" && r.td_team === r.defteam && !kickReturn) d.def_td = 1;
    // Points allowed, as a delta the reader sums. Only what the offence scored
    // counts against a defence: a pick-six or a kick return is charged to no
    // DEF, which is how Sleeper's own `pts_allow` reads.
    const allowed = n(r.posteam_score_post) - n(r.posteam_score);
    if (r.sp === "1" && allowed > 0 && r.td_team !== r.defteam && !kickReturn) {
      d.pts_allow = allowed;
    }
    if (Object.keys(d).length) out.push({ p: team(r.defteam), d });
  }
  // One event per player per play: a rusher who also fumbled is one line.
  const merged = new Map<string, Record<string, number>>();
  for (const { p, d } of out) {
    const cur = merged.get(p) ?? {};
    for (const [k, v] of Object.entries(d)) cur[k] = (cur[k] ?? 0) + v;
    merged.set(p, cur);
  }
  return [...merged.entries()].map(([p, d]) => ({ p, d }));
}
