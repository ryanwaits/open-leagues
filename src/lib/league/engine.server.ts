/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — restored from the last good build; public fns below stay typed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlayer, playerName } from "@/lib/data/sleeper.server";
import { playerTeam, START_SLOTS, slotLabel } from "@/lib/data/teams";
import type {
  ActivityItem,
  LeagueBundle,
  MatchupPair,
  SlimPlayer,
  TeamBundle,
  WirePlayer,
} from "@/lib/data/types";
import { getSql } from "@/lib/db";
import { recordEvent } from "./events.server";
import { clampPlayoffByes, defaultPlayoffByes, playoffRoundLabel } from "./playoffs";
import { invertSlotKey, labeledStartSlots, normalizeSlots, slotBreakdown } from "./roster";
import {
  applyBook,
  bookFromPreset,
  fromSleeperSettings,
  isClassicPreset,
  parseBook,
  presetOf,
  scoringLabel,
} from "./scoring";
import { leagueWaiversOpen, playerAvailability } from "./waivers";

export const DEMO_HOSTED_ID = "lg_backyard";
var DEFAULT_SLOTS = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
];
var HOUSE_NAMES = [
  "Masthead",
  "Night Desk",
  "Copy Chiefs",
  "Widowmakers",
  "Jump Line",
  "The Galley",
  "Rewrite",
  "Slugline",
  "The Spike",
  "Composing Room",
  "Folio",
  "The Rim",
  "Hellbox",
  "The Slot",
];
var weeklyPpr = null;
var seasonPpr = null;
var seedPromise = null;
function nid(prefix, n = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = prefix;
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 31)];
  return s;
}
function inviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * 32)];
  return s;
}
function parseSlots(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : DEFAULT_SLOTS;
  } catch {
    return DEFAULT_SLOTS;
  }
}
function bookOf(row) {
  const preset = row.scoring === "half" || row.scoring === "std" ? row.scoring : "ppr";
  return parseBook(row.scoring_json, preset);
}
function managerOf(r) {
  if (r.manager_name?.trim()) return r.manager_name;
  if (r.owner_id) return "Member";
  return "House club";
}
function loadSeasonPpr() {
  if (seasonPpr) return seasonPpr;
  seasonPpr = JSON.parse(readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"));
  return seasonPpr;
}
function loadWeeklyPpr() {
  if (weeklyPpr) return weeklyPpr;
  weeklyPpr = JSON.parse(readFileSync(join(process.cwd(), "data/weekly-ppr-2025.json"), "utf8"));
  return weeklyPpr;
}
var pprMap = () => new Map(loadSeasonPpr().map((s) => [s.player_id, s.pts_ppr]));
function weekMap(season, week) {
  return loadWeeklyPpr()[String(week)] ?? {};
}
async function scoreWeekMap(row, week) {
  const book = bookOf(row);
  if (row.season === "2025" && isClassicPreset(book) && !row.source_league_id) {
    if (presetOf(book) === "ppr") return weekMap(row.season, week);
  }
  try {
    const { fetchWeekStats } = await import("@/lib/data/live.server");
    const raw = await fetchWeekStats(row.season, week, "regular");
    const out = {};
    for (const [id, line] of Object.entries(raw)) out[id] = applyBook(book, line);
    return out;
  } catch {
    const { fetchWeekPoints } = await import("@/lib/data/live.server");
    return fetchWeekPoints(row.season, week, presetOf(book), "regular");
  }
}
function snakeOrder(teams, rounds) {
  const out = [];
  let n = 1;
  for (let r = 1; r <= rounds; r++) {
    const ids = Array.from({ length: teams }, (_, i) => i + 1);
    if (r % 2 === 0) ids.reverse();
    for (const roster of ids)
      out.push({
        pick: n++,
        round: r,
        roster,
      });
  }
  return out;
}
function makeSchedule(teams, weeks) {
  const ids = Array.from({ length: teams }, (_, i) => i + 1);
  if (ids.length % 2 === 1) ids.push(0);
  const m = ids.length;
  const rounds = [];
  const circle = [...ids];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = circle[i];
      const b = circle[m - 1 - i];
      if (a === 0) pairs.push([b, null]);
      else if (b === 0) pairs.push([a, null]);
      else pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const last = circle.pop();
    circle.splice(1, 0, last);
  }
  const out = [];
  for (let w = 1; w <= weeks; w++)
    rounds[(w - 1) % rounds.length].forEach((p, i) => {
      out.push({
        week: w,
        id: i + 1,
        home: p[0],
        away: p[1],
      });
    });
  return out;
}
function playoffLabel(kind, round, playoffTeams, bye, playoffByes) {
  if (kind !== "playoff") return null;
  return playoffRoundLabel(
    round ?? 1,
    playoffTeams,
    playoffByes ?? defaultPlayoffByes(playoffTeams),
    Boolean(bye),
  );
}
export async function ensureRemainingSchedule(leagueId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.status === "pre_draft" || league.status === "drafting") return;
  const lastReg = Math.min(league.regular_weeks ?? 14, (league.playoff_start_week ?? 15) - 1);
  if (lastReg < 1) return;
  const sql = await getSql();
  const existing = await sql`
    select distinct week from ol_matchups where league_id = ${leagueId} and week <= ${lastReg}
  `;
  const have = new Set(existing.map((e) => e.week));
  for (const m of makeSchedule(league.team_count, lastReg)) {
    if (have.has(m.week)) continue;
    await sql`
      insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      on conflict do nothing
    `;
  }
}
async function armLeagueOps(leagueId) {
  const ops = await import("./ops.server");
  await ops.ensureOpsSchema();
  await ops.seedRosterOps(leagueId);
  await ops.ensureDraftBoard(leagueId);
  await ensureRemainingSchedule(leagueId);
}
function compatible(pos, slot) {
  if (!pos) return false;
  if (slot === pos) return true;
  if (slot === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
  if (slot === "SUPER_FLEX") return pos === "QB" || pos === "RB" || pos === "WR" || pos === "TE";
  if (slot === "WRRB_FLEX") return pos === "RB" || pos === "WR";
  if (slot === "REC_FLEX") return pos === "WR" || pos === "TE";
  return false;
}
function applyLineup(spots, slots, pts) {
  const labeled = labeledStartSlots(slots);
  const used = /* @__PURE__ */ new Set();
  const next = spots.map((s) => ({
    ...s,
    slot: "bench",
    starter_slot: null,
  }));
  const byPts = [...next].sort((a, b) => (pts.get(b.player_id) ?? 0) - (pts.get(a.player_id) ?? 0));
  for (const { key, label } of labeled) {
    const pick = byPts.find(
      (s) => !used.has(s.player_id) && compatible(getPlayer(s.player_id)?.position, key),
    );
    if (!pick) continue;
    used.add(pick.player_id);
    pick.slot = "starter";
    pick.starter_slot = label;
  }
  return next;
}
async function getLeague(id) {
  const rows = await (await getSql())`select * from ol_leagues where id = ${id}`;
  if (!rows[0]) throw new Error("League not found");
  return rows[0];
}
async function getRosters(id) {
  return (await getSql())`select * from ol_rosters where league_id = ${id} order by roster_id`;
}
export async function rosterIdOwnedBy(
  leagueId: string,
  userId: string | null,
): Promise<number | null> {
  if (!userId) return null;
  const sql = await getSql();
  const rows = await sql<{ roster_id: number }>`
		select roster_id from ol_rosters
		where league_id = ${leagueId} and owner_id = ${userId}
		limit 1
	`;
  return rows[0]?.roster_id ?? null;
}

async function loadUserEmail(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
		select email from "user" where id = ${userId} limit 1
	`;
  return rows[0]?.email ?? null;
}

async function loadAllowEmails(leagueId: string): Promise<string[]> {
  await (await import("./ops.server")).ensureOpsSchema();
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
		select email from ol_allowlist where league_id = ${leagueId} order by email
	`;
  return rows.map((r) => r.email);
}

async function assertAllowlisted(leagueId: string, userId: string): Promise<void> {
  const { emailAllowed } = await import("./allowlist");
  const allow = await loadAllowEmails(leagueId);
  if (allow.length === 0) return;
  const email = await loadUserEmail(userId);
  if (!emailAllowed(allow, email)) {
    throw new Error("Your email is not on this league's invite list.");
  }
}

/** Commish or seat holder. Unsigned / non-member → UnauthorizedError. */
export async function assertLeagueViewer(leagueId: string, userId: string | null): Promise<void> {
  const { UnauthorizedError } = await import("@/lib/auth/verify.server");
  if (!userId) throw new UnauthorizedError();
  const row = await getLeague(leagueId);
  if (row.commish_id === userId) return;
  const mine = await rosterIdOwnedBy(leagueId, userId);
  if (mine == null) throw new UnauthorizedError();
}

export async function listAllowlist(userId: string, leagueId: string): Promise<string[]> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId)
    throw new Error("Only the commissioner can manage the invite list.");
  return loadAllowEmails(leagueId);
}

export async function addAllowlistEmail(
  userId: string,
  leagueId: string,
  rawEmail: string,
): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId)
    throw new Error("Only the commissioner can manage the invite list.");
  if (row.locked) throw new Error("This desk is locked.");
  const { normEmail } = await import("./allowlist");
  const email = normEmail(rawEmail);
  if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
  await (await import("./ops.server")).ensureOpsSchema();
  const sql = await getSql();
  await sql`
		insert into ol_allowlist (league_id, email) values (${leagueId}, ${email})
		on conflict do nothing
	`;
}

export async function removeAllowlistEmail(
  userId: string,
  leagueId: string,
  rawEmail: string,
): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId)
    throw new Error("Only the commissioner can manage the invite list.");
  if (row.locked) throw new Error("This desk is locked.");
  const { normEmail } = await import("./allowlist");
  const email = normEmail(rawEmail);
  await (await import("./ops.server")).ensureOpsSchema();
  const sql = await getSql();
  await sql`delete from ol_allowlist where league_id = ${leagueId} and email = ${email}`;
}
async function getSpots(id) {
  return (await getSql())`select * from ol_spots where league_id = ${id}`;
}
export async function ensureDemo(): Promise<void> {
  (await import("./ops.server")).startLeagueClock();
  // Demo league seed is off — a local run should start empty until WIFFL is imported.
}
async function seedDemo() {
  const sql = await getSql();
  if ((await sql`select id from ol_leagues where id = ${"lg_backyard"}`)[0]) return;
  try {
    await seedDemoBody();
  } catch (err) {
    await sql`delete from ol_leagues where id = ${DEMO_HOSTED_ID}`;
    throw err;
  }
}
async function seedDemoBody() {
  const sql = await getSql();
  if ((await sql`select id from ol_leagues where id = ${"lg_backyard"}`)[0]) return;
  const slots = DEFAULT_SLOTS;
  const rounds = slots.length;
  const teams = 10;
  await sql`
    insert into ol_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked
    ) values (
      ${DEMO_HOSTED_ID}, ${"The Backyard"}, ${"2025"}, ${"YARD26"}, ${"house"},
      ${"complete"}, ${teams}, ${"ppr"}, ${JSON.stringify(slots)}, ${4}, ${14}, ${1}
    )
  `;
  await sql`
    insert into ol_draft (league_id, status, pick_no)
    values (${DEMO_HOSTED_ID}, ${"complete"}, ${teams * rounds + 1})
  `;
  for (let i = 1; i <= teams; i++)
    await sql`
      insert into ol_rosters (league_id, roster_id, team_name, owner_id)
      values (${DEMO_HOSTED_ID}, ${i}, ${HOUSE_NAMES[i - 1] ?? `Seat ${i}`}, ${null})
    `;
  const order = snakeOrder(teams, rounds);
  const ranked = rankPool();
  const taken = /* @__PURE__ */ new Set();
  const byRoster = /* @__PURE__ */ new Map();
  const now = /* @__PURE__ */ new Date().toISOString();
  for (const step of order) {
    const player = nextAutopick(step.roster, byRoster, ranked, taken);
    if (!player) break;
    taken.add(player.player_id);
    const list = byRoster.get(step.roster) ?? [];
    list.push(player.player_id);
    byRoster.set(step.roster, list);
    await sql`
      insert into ol_picks (league_id, pick_no, round, roster_id, player_id, picked_at)
      values (${DEMO_HOSTED_ID}, ${step.pick}, ${step.round}, ${step.roster}, ${player.player_id}, ${now})
    `;
  }
  const pts = pprMap();
  for (const [rosterId, ids] of byRoster) {
    const lined = applyLineup(
      ids.map((player_id) => ({
        league_id: DEMO_HOSTED_ID,
        roster_id: rosterId,
        player_id,
        slot: "bench",
        starter_slot: null,
      })),
      slots,
      pts,
    );
    for (const s of lined)
      await sql`
        insert into ol_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (${DEMO_HOSTED_ID}, ${s.roster_id}, ${s.player_id}, ${s.slot}, ${s.starter_slot})
      `;
  }
  for (const m of makeSchedule(teams, 14))
    await sql`
      insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster)
      values (${DEMO_HOSTED_ID}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
    `;
}
function rankPool() {
  const out = [];
  for (const row of loadSeasonPpr()) {
    const p = getPlayer(row.player_id);
    if (!p?.position) continue;
    if (!["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position)) continue;
    out.push({
      ...p,
      pts: row.pts_ppr,
    });
  }
  out.sort((a, b) => b.pts - a.pts);
  return out;
}
function nextAutopick(rosterId, byRoster, ranked, taken) {
  const have = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  for (const id of byRoster.get(rosterId) ?? []) {
    const pos = getPlayer(id)?.position;
    if (pos && have[pos] != null) have[pos] += 1;
  }
  const available = ranked.filter((p) => !taken.has(p.player_id));
  if (!available.length) return null;
  const needs = [];
  if (have.QB < 1) needs.push("QB");
  if (have.RB < 2) needs.push("RB");
  if (have.WR < 2) needs.push("WR");
  if (have.TE < 1) needs.push("TE");
  if (have.K < 1 && (byRoster.get(rosterId)?.length ?? 0) >= 8) needs.push("K");
  if (have.DEF < 1 && (byRoster.get(rosterId)?.length ?? 0) >= 9) needs.push("DEF");
  for (const pos of needs) {
    const idx = available.findIndex((p) => p.position === pos);
    if (idx >= 0 && idx < 28) return available[idx];
  }
  return available[0] ?? null;
}
/** Staked on unsettled wagers, or zero when the league has no book. */
async function stakedBy(leagueId, rosterId) {
  try {
    const { atRisk } = await import("./wagers.server");
    return await atRisk(leagueId, rosterId);
  } catch {
    return 0;
  }
}
function asSleeper(row) {
  const slots = parseSlots(row.roster_slots);
  return {
    league_id: row.id,
    name: row.name,
    season: row.season,
    status: row.status,
    sport: "nfl",
    season_type: "regular",
    total_rosters: row.team_count,
    roster_positions: slots,
    scoring_settings: bookOf(row),
    settings: {
      num_teams: row.team_count,
      playoff_teams: row.playoff_teams,
      playoff_week_start: row.playoff_start_week ?? 15,
      type: 0,
      last_scored_leg: row.current_week,
      leg: row.current_week,
    },
  };
}
async function scoredStandings(row, rosters, spots) {
  if (rosters.filter((r) => r.snap_wins != null).length >= Math.max(2, rosters.length - 1))
    return rosters
      .map((r) => ({
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        teamName: r.team_name,
        manager: managerOf(r),
        avatar: null,
        wins: r.snap_wins ?? 0,
        losses: r.snap_losses ?? 0,
        ties: r.snap_ties ?? 0,
        pf: r.snap_pf ?? 0,
        pa: r.snap_pa ?? 0,
        waiverPos: r.waiver_order ?? r.roster_id,
      }))
      .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
  const sql = await getSql();
  const matchups = await sql`
    select * from ol_matchups
    where league_id = ${row.id} and week <= ${row.current_week}
      and week < ${row.playoff_start_week ?? 15}
  `;
  const locked = await sql`
    select * from ol_week_results where league_id = ${row.id} and week <= ${row.current_week}
  `.catch(() => []);
  const lockedMap = /* @__PURE__ */ new Map();
  for (const r of locked) lockedMap.set(`${r.week}:${r.roster_id}`, r.points);
  const rec = /* @__PURE__ */ new Map();
  for (const r of rosters)
    rec.set(r.roster_id, {
      w: 0,
      l: 0,
      t: 0,
      pf: 0,
      pa: 0,
    });
  const byRosterSpots = /* @__PURE__ */ new Map();
  for (const s of spots) {
    const arr = byRosterSpots.get(s.roster_id) ?? [];
    arr.push(s);
    byRosterSpots.set(s.roster_id, arr);
  }
  const weeks = new Set(matchups.map((m) => m.week));
  const weekPts = /* @__PURE__ */ new Map();
  for (const w of weeks)
    if (
      matchups.some(
        (m) =>
          m.week === w &&
          (lockedMap.get(`${w}:${m.home_roster}`) == null ||
            (m.away_roster != null && lockedMap.get(`${w}:${m.away_roster}`) == null)),
      )
    )
      weekPts.set(w, await scoreWeekMap(row, w));
  function total(rosterId, week) {
    const hit = lockedMap.get(`${week}:${rosterId}`);
    if (hit != null) return hit;
    const pts = weekPts.get(week) ?? {};
    let sum = 0;
    for (const s of byRosterSpots.get(rosterId) ?? []) {
      if (s.slot !== "starter") continue;
      sum += pts[s.player_id] ?? 0;
    }
    return sum;
  }
  for (const m of matchups) {
    const hp = total(m.home_roster, m.week);
    const ap = m.away_roster != null ? total(m.away_roster, m.week) : 0;
    const lockedHome = lockedMap.get(`${m.week}:${m.home_roster}`);
    const lockedAway = m.away_roster != null ? lockedMap.get(`${m.week}:${m.away_roster}`) : null;
    // 0–0 with no prior week locked is unplayed — do not book it as a tie.
    const played =
      hp !== 0 ||
      ap !== 0 ||
      (m.week < row.current_week && (lockedHome != null || lockedAway != null));
    if (!played) continue;
    const h = rec.get(m.home_roster);
    if (h) {
      h.pf += hp;
      h.pa += ap;
      if (m.away_roster == null) {
      } else if (hp > ap) h.w += 1;
      else if (hp < ap) h.l += 1;
      else h.t += 1;
    }
    if (m.away_roster != null) {
      const a = rec.get(m.away_roster);
      if (a) {
        a.pf += ap;
        a.pa += hp;
        if (ap > hp) a.w += 1;
        else if (ap < hp) a.l += 1;
        else a.t += 1;
      }
    }
  }
  return rosters
    .map((r) => {
      const s = rec.get(r.roster_id);
      return {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        teamName: r.team_name,
        manager: managerOf(r),
        avatar: null,
        wins: s.w,
        losses: s.l,
        ties: s.t,
        pf: s.pf,
        pa: s.pa,
        waiverPos: r.waiver_order ?? r.roster_id,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
}
export async function loadLeagueBundle(
  leagueId: string,
  userId: string | null,
  opts?: { tick?: boolean },
): Promise<LeagueBundle> {
  await ensureDemo();
  let row = await getLeague(leagueId);
  if (
    opts?.tick === true &&
    row.locked !== 1 &&
    row.status !== "pre_draft" &&
    row.status !== "drafting"
  )
    try {
      await (await import("./ops.server")).tickLeague(leagueId);
      row = await getLeague(leagueId);
    } catch {}
  const rosters = await getRosters(leagueId);
  const standings = await scoredStandings(row, rosters, await getSpots(leagueId));
  const mine = userId ? (rosters.find((r) => r.owner_id === userId)?.roster_id ?? null) : null;
  const draft = (await (await getSql())`select * from ol_draft where league_id = ${leagueId}`)[0];
  const draftStatus =
    draft?.status === "live" || draft?.status === "pending" || draft?.status === "complete"
      ? draft.status
      : "pending";
  let scoringLive = false;
  try {
    const { weekBoard } = await import("@/lib/data/live.server");
    scoringLive = (await weekBoard(row.season, row.current_week, "regular")).live;
  } catch {
    scoringLive = false;
  }
  return {
    league: asSleeper(row),
    standings,
    currentWeek: row.current_week,
    scoringLabel: scoringLabel(bookOf(row)),
    formatLabel: `Redraft · ${row.team_count}-team`,
    lineup: slotBreakdown(parseSlots(row.roster_slots)),
    hosted: true,
    myRosterId: mine,
    isCommish: Boolean(userId && row.commish_id === userId),
    inviteCode: userId && row.commish_id === userId ? row.invite_code : null,
    draftStatus,
    locked: row.locked === 1,
    scoringLive,
    faabRemaining: mine
      ? (rosters.find((r) => r.roster_id === mine)?.faab_remaining ?? row.faab_budget ?? 100)
      : null,
    faabAtRisk: mine ? await stakedBy(leagueId, mine) : 0,
    ops: {
      waiverType: row.waiver_type ?? "faab",
      faabBudget: row.faab_budget ?? 100,
      tradeDeadlineWeek: row.trade_deadline_week ?? 11,
      playoffStartWeek: row.playoff_start_week ?? 15,
      regularWeeks: row.regular_weeks ?? 14,
      playoffByes: row.playoff_byes ?? defaultPlayoffByes(row.playoff_teams),
      lastWaiverWeek: row.last_waiver_week ?? 0,
      waiversOpen: leagueWaiversOpen(row.waiver_type, row.last_waiver_week ?? 0, row.current_week),
    },
  };
}
function sideFrom(roster, spots, slots, pts, games) {
  const labeled = labeledStartSlots(slots);
  const remaining = spots.filter((s) => s.roster_id === roster.roster_id && s.slot === "starter");
  const starters = labeled.map(({ key, label }) => {
    let idx = remaining.findIndex((s) => s.starter_slot === label);
    if (idx < 0) idx = remaining.findIndex((s) => invertSlotKey(s.starter_slot) === key);
    const hit = idx >= 0 ? remaining.splice(idx, 1)[0] : void 0;
    const player = hit ? getPlayer(hit.player_id) : null;
    return {
      slot: label,
      playerId: hit?.player_id ?? null,
      player,
      points: hit ? (pts[hit.player_id] ?? 0) : null,
      game: (() => {
        const team = playerTeam(player);
        return team ? (games.get(team.toUpperCase()) ?? null) : null;
      })(),
    };
  });
  return {
    rosterId: roster.roster_id,
    teamName: roster.team_name,
    manager: managerOf(roster),
    avatar: null,
    points: starters.reduce((n, s) => n + (s.points ?? 0), 0),
    starters,
  };
}
export async function loadMatchups(leagueId: string, week: number): Promise<MatchupPair[]> {
  await ensureDemo();
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  const spots = await getSpots(leagueId);
  const matchups = await (await getSql())`
    select * from ol_matchups
    where league_id = ${leagueId} and week = ${week}
    order by matchup_id
  `;
  const locked = await (await getSql())`
    select * from ol_week_results where league_id = ${leagueId} and week = ${week}
  `.catch(() => []);
  const lockedMap = new Map(locked.map((r) => [r.roster_id, r.points]));
  const pts = await scoreWeekMap(row, week);
  const slots = parseSlots(row.roster_slots);
  const byId = new Map(rosters.map((r) => [r.roster_id, r]));
  let games = /* @__PURE__ */ new Map();
  try {
    const { weekBoard } = await import("@/lib/data/live.server");
    games = (await weekBoard(row.season, week, "regular")).index;
  } catch {
    games = /* @__PURE__ */ new Map();
  }
  return matchups.map((m) => {
    const home = byId.get(m.home_roster);
    const away = m.away_roster != null ? byId.get(m.away_roster) : void 0;
    const homeSide = sideFrom(home, spots, slots, pts, games);
    const awaySide = away ? sideFrom(away, spots, slots, pts, games) : null;
    if (lockedMap.has(home.roster_id)) homeSide.points = lockedMap.get(home.roster_id);
    if (away && awaySide && lockedMap.has(away.roster_id))
      awaySide.points = lockedMap.get(away.roster_id);
    const kind = m.kind === "playoff" ? "playoff" : "regular";
    const playoffRound = m.playoff_round ?? null;
    return {
      matchupId: m.matchup_id,
      home: homeSide,
      away: awaySide,
      kind,
      playoffRound,
      label: playoffLabel(
        kind,
        playoffRound,
        row.playoff_teams,
        m.away_roster == null,
        row.playoff_byes,
      ),
    };
  });
}
export async function loadTeam(
  leagueId: string,
  rosterId: number,
  week: number,
): Promise<TeamBundle> {
  await ensureDemo();
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!roster) throw new Error("Roster not found");
  const spots = await (await getSql())`
    select * from ol_spots where league_id = ${leagueId} and roster_id = ${rosterId}
  `;
  const pts = await scoreWeekMap(row, week);
  let games = /* @__PURE__ */ new Map();
  try {
    const { weekBoard } = await import("@/lib/data/live.server");
    games = (await weekBoard(row.season, week, "regular")).index;
  } catch {
    games = /* @__PURE__ */ new Map();
  }
  const rec = (await scoredStandings(row, rosters, await getSpots(leagueId))).find(
    (s) => s.rosterId === rosterId,
  );
  const players = spots.map((s) => {
    const base = getPlayer(s.player_id) ?? {
      player_id: s.player_id,
      full_name: playerName(s.player_id),
      position: null,
      team: null,
    };
    return {
      ...base,
      slot: s.slot === "starter" ? "starter" : "bench",
      starterSlot: s.starter_slot ?? void 0,
      weekPts: pts[s.player_id] ?? null,
      game: (() => {
        const team = playerTeam(base);
        return team ? (games.get(team.toUpperCase()) ?? null) : null;
      })(),
    };
  });
  players.sort((a, b) => {
    if (a.slot !== b.slot) return a.slot === "starter" ? -1 : 1;
    return (b.weekPts ?? -1) - (a.weekPts ?? -1);
  });
  return {
    rosterId,
    teamName: roster.team_name,
    manager: managerOf(roster),
    avatar: null,
    record: {
      wins: rec?.wins ?? 0,
      losses: rec?.losses ?? 0,
      ties: rec?.ties ?? 0,
      pf: rec?.pf ?? 0,
      pa: rec?.pa ?? 0,
    },
    players,
    week,
  };
}
export async function loadWire(
  leagueId: string,
  position: string,
  query: string,
  scope = "available",
): Promise<WirePlayer[]> {
  await ensureDemo();
  const [spots, rosters, league] = await Promise.all([
    getSpots(leagueId),
    getRosters(leagueId),
    getLeague(leagueId),
  ]);
  const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  const ownerByPlayer = new Map();
  for (const s of spots) {
    ownerByPlayer.set(s.player_id, {
      rosterId: s.roster_id,
      teamName: names.get(s.roster_id) ?? `Roster ${s.roster_id}`,
    });
  }
  const waiverType = league.waiver_type ?? "faab";
  const { heldPlayerIds } = await import("./ops.server");
  const held = await heldPlayerIds(leagueId);
  const q = query.trim().toLowerCase();
  const pos = position === "ALL" ? null : position;
  const pts = pprMap();
  const seen = new Set();
  const out = [];

  function consider(p, points, rank) {
    if (!p || seen.has(p.player_id)) return;
    const ownedBy = ownerByPlayer.get(p.player_id) ?? null;
    const availability = playerAvailability({
      owned: Boolean(ownedBy),
      waiverType,
      lastWaiverWeek: league.last_waiver_week ?? 0,
      currentWeek: league.current_week,
      held: held.has(p.player_id),
    });
    if (scope === "available" && availability === "rostered") return;
    if (scope === "free_agent" && availability !== "free_agent") return;
    if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) return;
    if (
      q &&
      !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)
    )
      return;
    seen.add(p.player_id);
    out.push({
      ...p,
      pts: points ?? null,
      rank: rank ?? null,
      availability,
      ownedBy,
    });
  }

  for (const row of loadSeasonPpr()) {
    consider(getPlayer(row.player_id), row.pts_ppr, row.pos_rank_ppr ?? null);
  }
  // Rostered players missing from the season seed still belong on All.
  if (scope === "all") {
    for (const s of spots) {
      consider(getPlayer(s.player_id), pts.get(s.player_id) ?? null, null);
    }
  }
  out.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1) || a.full_name.localeCompare(b.full_name));
  return out;
}
export async function loadActivity(leagueId: string, _week: number): Promise<ActivityItem[]> {
  await ensureDemo();
  const rows = await (await getSql())`
    select * from ol_moves where league_id = ${leagueId}
    order by created_at desc
    limit 60
  `;
  const rosters = await getRosters(leagueId);
  const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  return rows.map((m) => {
    const created =
      typeof m.created_at === "string" ? Date.parse(m.created_at) : m.created_at.getTime();
    return {
      id: m.id,
      type: m.type,
      status: "complete",
      created,
      adds: m.add_player_id
        ? [
            {
              playerId: m.add_player_id,
              name: playerName(m.add_player_id),
              pos: getPlayer(m.add_player_id)?.position ?? null,
              team: getPlayer(m.add_player_id)?.team ?? null,
            },
          ]
        : [],
      drops: m.drop_player_id
        ? [
            {
              playerId: m.drop_player_id,
              name: playerName(m.drop_player_id),
              pos: getPlayer(m.drop_player_id)?.position ?? null,
              team: getPlayer(m.drop_player_id)?.team ?? null,
            },
          ]
        : [],
      rosterIds: [m.roster_id],
      teamNames: [names.get(m.roster_id) ?? `Roster ${m.roster_id}`],
      // A winning claim can be $0, so null is the only 'no bid' — not falsy.
      bid: m.bid ?? null,
    };
  });
}
export async function listMyLeagues(
  userId: string,
): Promise<{ leagueId: string; name: string; season: string; status: string; role: string }[]> {
  await ensureDemo();
  const seen = new Set<string>();
  return (
    await (await getSql())`
    select l.id, l.name, l.season, l.status, l.commish_id, r.owner_id
    from ol_leagues l
    left join ol_rosters r on r.league_id = l.id and r.owner_id = ${userId}
    where r.owner_id = ${userId} or l.commish_id = ${userId}
    order by l.created_at desc
  `
  ).flatMap((r) => {
    if (seen.has(r.id)) return [];
    seen.add(r.id);
    return [
      {
        leagueId: r.id,
        name: r.name,
        season: r.season,
        status: r.status,
        role: r.commish_id === userId ? "commish" : "member",
      },
    ];
  });
}
export async function createLeague(input: {
  userId: string;
  name: string;
  teamName: string;
  teamCount: number;
  scoring: "ppr" | "half" | "std";
  fillHouse: boolean;
}): Promise<{ leagueId: string; inviteCode: string; season: string }> {
  await ensureDemo();
  const sql = await getSql();
  const name = input.name.trim().slice(0, 40);
  const teamName = input.teamName.trim().slice(0, 28);
  if (name.length < 2) throw new Error("Name your league.");
  if (teamName.length < 2) throw new Error("Name your team.");
  const teamCount = [8, 10, 12, 14].includes(input.teamCount) ? input.teamCount : 10;
  const id = nid("lg_");
  let code = inviteCode();
  for (let i = 0; i < 6; i++) {
    if (!(await sql`select id from ol_leagues where invite_code = ${code}`)[0]) break;
    code = inviteCode();
  }
  const playoff = teamCount >= 14 ? 7 : teamCount >= 12 ? 6 : 4;
  const byes = defaultPlayoffByes(playoff);
  const book = bookFromPreset(input.scoring);
  const ops = await import("./ops.server");
  await ops.ensureOpsSchema();
  let season = String(new Date().getUTCFullYear());
  try {
    const { fetchNflState } = await import("@/lib/data/sleeper.server");
    season = String((await fetchNflState()).season);
  } catch {
    /* keep calendar year */
  }
  await sql`
    insert into ol_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked, scoring_json, source,
      playoff_byes
    ) values (
      ${id}, ${name}, ${season}, ${code}, ${input.userId}, ${"pre_draft"},
      ${teamCount}, ${input.scoring}, ${JSON.stringify(DEFAULT_SLOTS)},
      ${playoff}, ${1}, ${0}, ${JSON.stringify(book)}, ${"ledger"}, ${byes}
    )
  `;
  await sql`insert into ol_draft (league_id, status, pick_no) values (${id}, ${"pending"}, ${1})`;
  for (let i = 1; i <= teamCount; i++) {
    const isCommish = i === 1;
    const house = !isCommish && input.fillHouse;
    await sql`
      insert into ol_rosters (league_id, roster_id, team_name, owner_id)
      values (
        ${id}, ${i},
        ${isCommish ? teamName : house ? (HOUSE_NAMES[i - 1] ?? `House ${i}`) : `Open seat ${i}`},
        ${isCommish ? input.userId : null}
      )
    `;
  }
  await ops.seedRosterOps(id);
  await ops.ensureDraftBoard(id);
  // Genesis. Every dollar the league will ever hold is minted here — the
  // managers' budgets by seedRosterOps above, and the house pool now. Nothing
  // creates FAAB after this, which is what makes the ledger auditable.
  try {
    const { seedPool } = await import("./wagers.server");
    const seed = Math.max(0, Math.round(teamCount * 20));
    await sql`update ol_leagues set pool_seed = ${seed} where id = ${id}`;
    await seedPool(id, seed);
  } catch {
    /* a league without a pool simply has betting switched off */
  }
  return {
    leagueId: id,
    inviteCode: code,
    season,
  };
}

const LEAGUE_CHILD_TABLES = [
  "ol_spots",
  "ol_matchups",
  "ol_moves",
  "ol_picks",
  "ol_claims",
  "ol_week_results",
  "ol_queue",
  "ol_dispatches",
  "ol_wagers",
  "ol_pool",
  "ol_events",
  "ol_allowlist",
];

export async function deleteLeague(userId: string, leagueId: string): Promise<void> {
  await ensureDemo();
  const sql = await getSql();
  const row = (await sql`select commish_id, locked from ol_leagues where id = ${leagueId}`)[0];
  if (!row) throw new Error("No such league.");
  if (row.commish_id !== userId) throw new Error("Only the commissioner can delete this league.");
  if (row.locked === 1) throw new Error("This desk is locked.");
  try {
    const trades = await sql`select id from ol_trades where league_id = ${leagueId}`;
    for (const t of trades) {
      await sql`delete from ol_trade_assets where trade_id = ${t.id}`;
      await sql`delete from ol_trade_sides where trade_id = ${t.id}`;
    }
    await sql`delete from ol_trades where league_id = ${leagueId}`;
  } catch {
    /* trades table may not exist on a fresh desk */
  }
  for (const table of LEAGUE_CHILD_TABLES) {
    try {
      await sql.query(`delete from ${table} where league_id = $1`, [leagueId]);
    } catch {
      /* table may not exist yet */
    }
  }
  await sql`delete from ol_leagues where id = ${leagueId}`;
}

function serializeBackupRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/** Commish-only JSON snapshot of one league. Locked desks are allowed (demo copy). */
export async function exportLeague(
  userId: string,
  leagueId: string,
): Promise<{
  v: 1;
  leagueId: string;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}> {
  await ensureDemo();
  const sql = await getSql();
  const league = (await sql`select * from ol_leagues where id = ${leagueId}`)[0];
  if (!league) throw new Error("No such league.");
  if (league.commish_id !== userId) {
    throw new Error("Only the commissioner can download a backup.");
  }

  const tables: Record<string, Record<string, unknown>[]> = {
    ol_leagues: [serializeBackupRow(league)],
  };

  async function dumpByLeagueId(name: string) {
    try {
      const rows = await sql.query(`select * from ${name} where league_id = $1`, [leagueId]);
      tables[name] = rows.map(serializeBackupRow);
    } catch {
      /* table may not exist yet */
    }
  }

  await dumpByLeagueId("ol_rosters");
  for (const table of LEAGUE_CHILD_TABLES) {
    await dumpByLeagueId(table);
  }
  await dumpByLeagueId("ol_draft");
  await dumpByLeagueId("ol_waiver_holds");

  try {
    const trades = await sql.query(`select * from ol_trades where league_id = $1`, [leagueId]);
    tables.ol_trades = trades.map(serializeBackupRow);
    const sides: Record<string, unknown>[] = [];
    const assets: Record<string, unknown>[] = [];
    for (const t of trades) {
      const tradeSides = await sql`select * from ol_trade_sides where trade_id = ${t.id}`;
      for (const s of tradeSides) sides.push(serializeBackupRow(s));
      const tradeAssets = await sql`select * from ol_trade_assets where trade_id = ${t.id}`;
      for (const a of tradeAssets) assets.push(serializeBackupRow(a));
    }
    tables.ol_trade_sides = sides;
    tables.ol_trade_assets = assets;
  } catch {
    /* trades table may not exist on a fresh desk */
  }

  return {
    v: 1,
    leagueId,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function joinLeague(
  userId: string,
  code: string,
  teamName: string,
  rosterId?: number | null,
): Promise<{ leagueId: string; season: string; name: string }> {
  await ensureDemo();
  const sql = await getSql();
  const league = (
    await sql`select * from ol_leagues where invite_code = ${code.trim().toUpperCase()}`
  )[0];
  if (!league) throw new Error("No league uses that code.");
  if (league.locked) throw new Error("That league is locked.");
  if (
    (await sql`select * from ol_rosters where league_id = ${league.id} and owner_id = ${userId}`)[0]
  ) {
    return { leagueId: league.id, season: league.season, name: league.name };
  }
  await assertAllowlisted(league.id, userId);
  const seat = rosterId
    ? (
        await sql`select * from ol_rosters where league_id = ${league.id} and roster_id = ${rosterId} and owner_id is null`
      )[0]
    : (
        await sql`
      select * from ol_rosters
      where league_id = ${league.id} and owner_id is null
      order by roster_id
      limit 1
    `
      )[0];
  if (!seat) throw new Error(rosterId ? "That seat is taken." : "League is full.");
  const keepName = teamName.trim() || seat.team_name;
  await sql`
    update ol_rosters set owner_id = ${userId}, team_name = ${keepName.slice(0, 28) || `Club ${seat.roster_id}`}
    where league_id = ${league.id} and roster_id = ${seat.roster_id}
  `;
  return { leagueId: league.id, season: league.season, name: league.name };
}
/**
 * Start (or clear) the per-pick clock. Returns false when the seat should not
 * wait — autodraft on, or unowned — so the caller can flushAutodraft instead.
 * Falls back to 90s for rows written before plans/006 landed.
 */
async function stampDeadline(leagueId, pickNo, rosterId) {
  const sql = await getSql();
  const seat = (
    await sql`
    select autodraft, owner_id from ol_rosters
    where league_id = ${leagueId} and roster_id = ${rosterId}
  `
  )[0];
  if (!seat || !seat.owner_id || seat.autodraft) {
    await sql`update ol_draft set pick_deadline = null where league_id = ${leagueId}`;
    return false;
  }
  await sql`
    update ol_draft
    set pick_deadline = now() + (coalesce(pick_seconds, 90) || ' seconds')::interval
    where league_id = ${leagueId} and pick_no = ${pickNo}
  `;
  try {
    const { notifyRoster } = await import("@/lib/push/send.server");
    void notifyRoster(leagueId, rosterId, {
      kind: "clock",
      title: "You're on the clock",
      body: "It's your pick. Open the draft room.",
      url: `/league/${leagueId}/draft`,
    }).catch(() => undefined);
  } catch {
    /* never throw into the draft clock */
  }
  return true;
}

/** Re-entrancy guard so claimPick → flushAutodraft stays a flat loop. */
const autodraftFlushing = new Set<string>();

/**
 * Autopick while the seat on the clock is autodraft-flagged or unowned.
 * Bounded like flushHousePicks.
 */
async function flushAutodraft(leagueId: string): Promise<void> {
  if (autodraftFlushing.has(leagueId)) return;
  autodraftFlushing.add(leagueId);
  try {
    const sql = await getSql();
    for (let guard = 0; guard < 200; guard++) {
      const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
      if (!draft || draft.status !== "live") return;
      const pick = (
        await sql`
        select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
      `
      )[0];
      if (!pick || pick.player_id) return;
      const seat = (
        await sql`
        select autodraft, owner_id from ol_rosters
        where league_id = ${leagueId} and roster_id = ${pick.roster_id}
      `
      )[0];
      if (!seat || (seat.owner_id && !seat.autodraft)) return;
      const player = await autopickFor(leagueId, pick.roster_id);
      if (!player) return;
      await claimPick(leagueId, pick, player.player_id);
    }
  } finally {
    autodraftFlushing.delete(leagueId);
  }
}

export async function startDraft(userId: string, leagueId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.commish_id !== userId) throw new Error("Only the commissioner can open the draft.");
  if (league.locked) throw new Error("This desk is locked.");
  if (league.status !== "pre_draft") throw new Error("Draft already started.");
  await (await import("./ops.server")).ensureDraftBoard(leagueId);
  const sql = await getSql();
  await sql`update ol_draft set status = ${"live"}, pick_no = ${1} where league_id = ${leagueId}`;
  await sql`update ol_leagues set status = ${"drafting"} where id = ${leagueId}`;
  await flushHousePicks(leagueId);
  const draft = (await sql`select pick_no from ol_draft where league_id = ${leagueId}`)[0];
  if (draft) {
    const pick = (
      await sql`
      select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
    `
    )[0];
    if (pick) {
      const stamped = await stampDeadline(leagueId, pick.pick_no, pick.roster_id);
      if (!stamped) await flushAutodraft(leagueId);
    }
  }
}
export async function loadDraft(
  leagueId: string,
  userId: string | null,
  position: string,
  query: string,
): Promise<{
  status: string;
  pickNo: number;
  total: number;
  onClockRoster: number | null;
  onClockName: string | null;
  isMyPick: boolean;
  isCommish: boolean;
  locked: boolean;
  recent: {
    pick: number;
    round: number;
    rosterId: number;
    teamName: string;
    player: ReturnType<typeof getPlayer>;
  }[];
  available: (SlimPlayer & { pts: number })[];
  stock: {
    pickNo: number;
    round: number;
    label: string;
    rosterId: number;
    ownerName: string;
    via: string | null;
    used: boolean;
  }[];
  board: {
    pickNo: number;
    round: number;
    /** 1-based position within the round, after the snake is applied. */
    slot: number;
    label: string;
    rosterId: number;
    teamName: string;
    /** The seat this pick started with, when it was traded. */
    via: string | null;
    player: { playerId: string; name: string; position: string | null } | null;
  }[];
  /** Seats in board order, so the grid can render columns without a second source. */
  seats: { rosterId: number; teamName: string }[];
  pickDeadline: string | null;
  pickSeconds: number;
  /** True when the viewer's own seat is on autodraft. */
  myAutodraft: boolean;
  /** The viewer's queue, still-available entries first. Empty when no seat. */
  queue: { playerId: string; name: string; position: string | null; team: string | null }[];
}> {
  await ensureDemo();
  await (await import("./ops.server")).ensureOpsSchema();
  const league = await getLeague(leagueId);
  try {
    await expireDraftPicks(leagueId);
  } catch {
    // A stuck autopick must not make the draft page unreadable.
  }
  const sql = await getSql();
  const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
  const picks = await sql`select * from ol_picks where league_id = ${leagueId} order by pick_no`;
  const rosters = await getRosters(leagueId);
  const names = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  const taken = new Set(picks.map((p) => p.player_id).filter(Boolean));
  const current = picks.find((p) => p.pick_no === (draft?.pick_no ?? 1) && !p.player_id) ?? null;
  const mineRoster = userId ? rosters.find((r) => r.owner_id === userId) : null;
  const mine = mineRoster?.roster_id ?? null;
  const pos = position === "ALL" ? null : position;
  const q = query.trim().toLowerCase();
  const available = [];
  for (const row of loadSeasonPpr()) {
    if (taken.has(row.player_id)) continue;
    const p = getPlayer(row.player_id);
    if (!p?.position) continue;
    if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
    if (
      q &&
      !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)
    )
      continue;
    available.push({
      ...p,
      pts: row.pts_ppr,
    });
    if (available.length >= 80) break;
  }
  const recent = picks
    .filter((p) => p.player_id)
    .slice(-12)
    .reverse()
    .map((p) => ({
      pick: p.pick_no,
      round: p.round,
      rosterId: p.roster_id,
      teamName: names.get(p.roster_id) ?? `Roster ${p.roster_id}`,
      player: p.player_id ? getPlayer(p.player_id) : null,
    }));
  const nTeams = Math.max(1, rosters.length);
  const stock = picks.map((p) => {
    const orig = p.original_roster ?? p.roster_id;
    const slot = ((p.pick_no - 1) % nTeams) + 1;
    return {
      pickNo: p.pick_no,
      round: p.round,
      label: `R${p.round}.${String(slot).padStart(2, "0")}`,
      rosterId: p.roster_id,
      ownerName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
      via: orig !== p.roster_id ? (names.get(orig) ?? null) : null,
      used: Boolean(p.player_id),
    };
  });
  const board = picks.map((p) => {
    const orig = p.original_roster ?? p.roster_id;
    const slot = ((p.pick_no - 1) % nTeams) + 1;
    const player = p.player_id ? getPlayer(p.player_id) : null;
    return {
      pickNo: p.pick_no,
      round: p.round,
      slot,
      label: `${p.round}.${String(slot).padStart(2, "0")}`,
      rosterId: p.roster_id,
      teamName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
      via: orig !== p.roster_id ? (names.get(orig) ?? null) : null,
      player: player
        ? { playerId: player.player_id, name: player.full_name, position: player.position }
        : null,
    };
  });
  const seats = rosters.map((r) => ({ rosterId: r.roster_id, teamName: r.team_name }));
  const queue =
    mine != null
      ? (await loadQueue(leagueId, mine))
          .filter((q) => !taken.has(q.playerId) && q.player)
          .map((q) => ({
            playerId: q.playerId,
            name: q.player.full_name,
            position: q.player.position,
            team: q.player.team ?? null,
          }))
      : [];
  return {
    status: draft?.status ?? "pending",
    pickNo: draft?.pick_no ?? 1,
    total: picks.length,
    onClockRoster: current?.roster_id ?? null,
    onClockName: current ? (names.get(current.roster_id) ?? null) : null,
    isMyPick: Boolean(current && mine === current.roster_id),
    isCommish: Boolean(userId && league.commish_id === userId),
    locked: league.locked === 1,
    recent,
    available,
    stock,
    board,
    seats,
    pickDeadline: draft?.pick_deadline ? new Date(draft.pick_deadline).toISOString() : null,
    pickSeconds: draft?.pick_seconds ?? 90,
    myAutodraft: Boolean(mineRoster?.autodraft),
    queue,
  };
}
export async function makePick(userId: string, leagueId: string, playerId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  const sql = await getSql();
  const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
  if (!draft || draft.status !== "live") throw new Error("Draft is not live.");
  const pick = (
    await sql`select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`
  )[0];
  if (!pick) throw new Error("No pick on the clock.");
  const seat = (await getRosters(leagueId)).find((r) => r.roster_id === pick.roster_id);
  const isCommish = league.commish_id === userId;
  if (seat?.owner_id && seat.owner_id !== userId && !isCommish) throw new Error("Not your pick.");
  if (!seat?.owner_id && !isCommish) throw new Error("House pick — wait or ask the commish.");
  await claimPick(leagueId, pick, playerId);
  await flushHousePicks(leagueId);
}
async function claimPick(leagueId, pick, playerId) {
  const sql = await getSql();
  if (
    (
      await sql`select player_id from ol_picks where league_id = ${leagueId} and player_id = ${playerId}`
    )[0]
  )
    throw new Error("Already drafted.");
  if (!getPlayer(playerId)) throw new Error("Unknown player.");
  await sql`
    update ol_picks set player_id = ${playerId}, picked_at = ${(/* @__PURE__ */ new Date()).toISOString()}
    where league_id = ${leagueId} and pick_no = ${pick.pick_no}
  `;
  await sql`
    insert into ol_spots (league_id, roster_id, player_id, slot, starter_slot)
    values (${leagueId}, ${pick.roster_id}, ${playerId}, ${"bench"}, ${null})
  `;
  const next = (
    await sql`
      select * from ol_picks where league_id = ${leagueId} and player_id is null
      order by pick_no limit 1
    `
  )[0];
  if (!next) await finishDraft(leagueId);
  else {
    await sql`update ol_draft set pick_no = ${next.pick_no} where league_id = ${leagueId}`;
    const stamped = await stampDeadline(leagueId, next.pick_no, next.roster_id);
    if (!stamped) await flushAutodraft(leagueId);
  }
}
async function finishDraft(leagueId) {
  const league = await getLeague(leagueId);
  const slots = parseSlots(league.roster_slots);
  const spots = await getSpots(leagueId);
  const pts = pprMap();
  const sql = await getSql();
  const byRoster = /* @__PURE__ */ new Map();
  for (const s of spots) {
    const arr = byRoster.get(s.roster_id) ?? [];
    arr.push(s);
    byRoster.set(s.roster_id, arr);
  }
  for (const [rosterId, list] of byRoster) {
    const lined = applyLineup(list, slots, pts);
    for (const s of lined)
      await sql`
        update ol_spots set slot = ${s.slot}, starter_slot = ${s.starter_slot}
        where league_id = ${leagueId} and roster_id = ${rosterId} and player_id = ${s.player_id}
      `;
  }
  if (!(await sql`select week from ol_matchups where league_id = ${leagueId} limit 1`)[0]) {
    const weeks = Math.min(league.regular_weeks ?? 14, (league.playoff_start_week ?? 15) - 1);
    for (const m of makeSchedule(league.team_count, weeks))
      await sql`
        insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
        values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      `;
  } else await ensureRemainingSchedule(leagueId);
  await sql`update ol_draft set status = ${"complete"}, pick_deadline = null where league_id = ${leagueId}`;
  await sql`update ol_leagues set status = ${"in_season"} where id = ${leagueId}`;
}
export async function loadQueue(leagueId: string, rosterId: number) {
  await (await import("./ops.server")).ensureOpsSchema();
  const sql = await getSql();
  const rows = await sql`
    select player_id, rank from ol_queue
    where league_id = ${leagueId} and roster_id = ${rosterId}
    order by rank asc
  `;
  return rows.map((r) => ({
    playerId: r.player_id,
    rank: r.rank,
    player: getPlayer(r.player_id),
  }));
}

export async function queueAdd(userId: string, leagueId: string, playerId: string): Promise<void> {
  await (await import("./ops.server")).ensureOpsSchema();
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  if (!getPlayer(playerId)) throw new Error("Unknown player.");
  const sql = await getSql();
  const last = (
    await sql`
    select coalesce(max(rank), 0) as n from ol_queue
    where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `
  )[0];
  await sql`
    insert into ol_queue (league_id, roster_id, player_id, rank)
    values (${leagueId}, ${mine.roster_id}, ${playerId}, ${(last?.n ?? 0) + 1})
    on conflict do nothing
  `;
}

export async function queueRemove(
  userId: string,
  leagueId: string,
  playerId: string,
): Promise<void> {
  await (await import("./ops.server")).ensureOpsSchema();
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  const sql = await getSql();
  await sql`
    delete from ol_queue
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
}

export async function queueReorder(
  userId: string,
  leagueId: string,
  playerIds: string[],
): Promise<void> {
  await (await import("./ops.server")).ensureOpsSchema();
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  const sql = await getSql();
  for (let i = 0; i < playerIds.length; i++) {
    await sql`
      update ol_queue set rank = ${i + 1}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id}
        and player_id = ${playerIds[i]}
    `;
  }
}

/** Lookup used by flushHousePicks and expireDraftPicks — taken set, spots map, nextAutopick. */
async function autopickFor(leagueId, rosterId) {
  const sql = await getSql();
  const ranked = rankPool();
  const taken = new Set(
    (
      await sql`
      select player_id from ol_picks where league_id = ${leagueId} and player_id is not null
    `
    ).map((r) => r.player_id),
  );
  const spots = await getSpots(leagueId);
  const byRoster = /* @__PURE__ */ new Map();
  for (const s of spots) {
    const arr = byRoster.get(s.roster_id) ?? [];
    arr.push(s.player_id);
    byRoster.set(s.roster_id, arr);
  }
  const queued = await loadQueue(leagueId, rosterId);
  for (const q of queued) {
    if (!taken.has(q.playerId) && q.player) return q.player;
  }
  return nextAutopick(rosterId, byRoster, ranked, taken);
}
/**
 * Advance the board when a deadline exists and either it has run out, or the
 * seat is autodraft-flagged / unowned (toggle-on while on the clock — next poll
 * picks immediately; null-deadline autodraft is flushAutodraft's job).
 *
 * Always CAS via pick_deadline is not null so concurrent loadDrafts cannot
 * double-advance. Called from loadDraft and tickLeague.
 *
 * Returns the number of picks it advanced, for logging and tests.
 */
export async function expireDraftPicks(leagueId: string): Promise<number> {
  const sql = await getSql();
  let advanced = 0;
  for (let guard = 0; guard < 50; guard++) {
    const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
    if (!draft || draft.status !== "live") return advanced;
    if (draft.pick_deadline == null) return advanced;

    const pick = (
      await sql`
      select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
    `
    )[0];
    if (!pick || pick.player_id) return advanced;

    const seat = (
      await sql`
      select autodraft, owner_id from ol_rosters
      where league_id = ${leagueId} and roster_id = ${pick.roster_id}
    `
    )[0];
    const skipClock = !seat?.owner_id || Boolean(seat.autodraft);
    const expired = new Date(draft.pick_deadline).getTime() <= Date.now();
    // Live human still on the clock — wait.
    if (!expired && !skipClock) return advanced;

    const claimed = await sql`
      update ol_draft set pick_deadline = null
      where league_id = ${leagueId} and pick_no = ${draft.pick_no}
        and pick_deadline is not null
      returning pick_no
    `;
    if (!claimed[0]) return advanced;

    await sql`
      update ol_rosters set autodraft = 1
      where league_id = ${leagueId} and roster_id = ${pick.roster_id}
    `;

    const player = await autopickFor(leagueId, pick.roster_id);
    if (!player) return advanced;
    await claimPick(leagueId, pick, player.player_id);
    advanced += 1;
  }
  return advanced;
}
export async function flushHousePicks(leagueId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.locked || league.status !== "drafting") return;
  const sql = await getSql();
  const rosters = await getRosters(leagueId);
  for (let guard = 0; guard < 200; guard++) {
    const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
    if (!draft || draft.status !== "live") return;
    const pick = (
      await sql`select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`
    )[0];
    if (!pick || pick.player_id) return;
    if (rosters.find((r) => r.roster_id === pick.roster_id)?.owner_id) return;
    const player = await autopickFor(leagueId, pick.roster_id);
    if (!player) return;
    await claimPick(leagueId, pick, player.player_id);
  }
}

export async function setAutodraft(userId: string, leagueId: string, on: boolean): Promise<void> {
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  const sql = await getSql();
  await sql`
    update ol_rosters set autodraft = ${on ? 1 : 0}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `;
  if (!on) {
    const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
    if (draft?.status === "live") {
      const pick = (
        await sql`
        select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
      `
      )[0];
      if (pick && !pick.player_id && pick.roster_id === mine.roster_id) {
        await stampDeadline(leagueId, pick.pick_no, pick.roster_id);
      }
    }
  }
}

export async function autoFillDraft(userId: string, leagueId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.commish_id !== userId) throw new Error("Only the commissioner can fill the board.");
  if (league.locked) throw new Error("This desk is locked.");
  const sql = await getSql();
  const ranked = rankPool();
  for (let guard = 0; guard < 220; guard++) {
    const draft = (await sql`select * from ol_draft where league_id = ${leagueId}`)[0];
    if (!draft || draft.status !== "live") return;
    const pick = (
      await sql`select * from ol_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}`
    )[0];
    if (!pick) return;
    const taken = new Set(
      (
        await sql`
        select player_id from ol_picks where league_id = ${leagueId} and player_id is not null
      `
      ).map((r) => r.player_id),
    );
    const spots = await getSpots(leagueId);
    const byRoster = /* @__PURE__ */ new Map();
    for (const s of spots) {
      const arr = byRoster.get(s.roster_id) ?? [];
      arr.push(s.player_id);
      byRoster.set(s.roster_id, arr);
    }
    const player = nextAutopick(pick.roster_id, byRoster, ranked, taken);
    if (!player) return;
    await claimPick(leagueId, pick, player.player_id);
  }
}
function invertSlot(label) {
  return invertSlotKey(label);
}
async function idsLockedIn(league, ids) {
  const want = [...new Set(ids.filter(Boolean))];
  if (!want.length) return new Set();
  try {
    const { weekBoard, gameForTeam } = await import("@/lib/data/live.server");
    const board = await weekBoard(league.season, league.current_week, "regular");
    const out = new Set();
    for (const id of want) {
      const chip = gameForTeam(board.index, playerTeam(getPlayer(id)));
      if (chip && (chip.state === "in" || chip.state === "post")) out.add(id);
    }
    return out;
  } catch {
    return new Set();
  }
}

async function assertLineupUnlocked(league, ids) {
  const locked = await idsLockedIn(league, ids);
  if (!locked.size) return;
  const id = [...locked][0];
  throw new Error(`${playerName(id)} is locked — that game has started.`);
}

export async function startPlayer(
  userId: string,
  leagueId: string,
  playerId: string,
  replaceId?: string | null,
  slot?: string | null,
): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  const sql = await getSql();
  const spots = await sql`
    select * from ol_spots where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `;
  if (!spots.find((s) => s.player_id === playerId))
    throw new Error("Player is not on your roster.");
  const occupant = replaceId
    ? spots.find((s) => s.player_id === replaceId && s.slot === "starter")
    : slot
      ? spots.find((s) => s.slot === "starter" && s.starter_slot === slot)
      : null;
  await assertLineupUnlocked(league, [playerId, replaceId, occupant?.player_id]);
  const pos = getPlayer(playerId)?.position ?? null;
  if (replaceId) {
    const swap = spots.find((s) => s.player_id === replaceId && s.slot === "starter");
    if (!swap) throw new Error("That player is not in a start slot.");
    if (!compatible(pos, invertSlot(swap.starter_slot)))
      throw new Error("That slot does not take this position.");
    await sql`
      update ol_spots set slot = ${"bench"}, starter_slot = ${null}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${swap.player_id}
    `;
    await sql`
      update ol_spots set slot = ${"starter"}, starter_slot = ${swap.starter_slot}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
    `;
    await recordEvent({
      leagueId,
      week: league.current_week,
      kind: "lineup_set",
      actorRoster: mine.roster_id,
      playerId,
      payload: { slot: swap.starter_slot, benched: swap.player_id, via: "swap" },
    });
    return;
  }
  if (slot) {
    if (!compatible(pos, invertSlot(slot)))
      throw new Error("That slot does not take this position.");
    const occupant = spots.find((s) => s.slot === "starter" && s.starter_slot === slot);
    if (occupant) {
      await sql`
        update ol_spots set slot = ${"bench"}, starter_slot = ${null}
        where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${occupant.player_id}
      `;
    }
    await sql`
      update ol_spots set slot = ${"starter"}, starter_slot = ${slot}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
    `;
    await recordEvent({
      leagueId,
      week: league.current_week,
      kind: "lineup_set",
      actorRoster: mine.roster_id,
      playerId,
      payload: { slot, benched: occupant?.player_id ?? null, via: "slot" },
    });
    return;
  }
  const labeled = labeledStartSlots(parseSlots(league.roster_slots));
  const used = new Set(
    spots.filter((s) => s.slot === "starter" && s.starter_slot).map((s) => s.starter_slot),
  );
  let next = null;
  for (const { key, label } of labeled) {
    if (!used.has(label) && compatible(pos, key)) {
      next = label;
      break;
    }
  }
  if (!next) throw new Error("Pick a starter to replace.");
  await sql`
    update ol_spots set slot = ${"starter"}, starter_slot = ${next}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
  await recordEvent({
    leagueId,
    week: league.current_week,
    kind: "lineup_set",
    actorRoster: mine.roster_id,
    playerId,
    payload: { slot: next, benched: null, via: "auto" },
  });
}
export async function sitPlayer(userId: string, leagueId: string, playerId: string): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
  if (!mine) throw new Error("You don't have a seat.");
  await assertLineupUnlocked(league, [playerId]);
  const sql = await getSql();
  const before = (
    await sql<{ starter_slot: string | null }>`
    select starter_slot from ol_spots
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `
  )[0];
  await sql`
    update ol_spots set slot = ${"bench"}, starter_slot = ${null}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
  // The slot he vacated is the part worth keeping: an empty FLEX on Sunday is
  // a story, and after the write there is nothing left to say which one it was.
  await recordEvent({
    leagueId,
    week: league.current_week,
    kind: "lineup_benched",
    actorRoster: mine.roster_id,
    playerId,
    payload: { fromSlot: before?.starter_slot ?? null },
  });
}
export async function addDrop(
  userId: string,
  leagueId: string,
  addId: string,
  dropId: string | null,
  bid = 0,
): Promise<{ mode: "claim" | "free_agent" }> {
  return (await import("./ops.server")).requestAdd(userId, leagueId, addId, dropId, bid);
}
export async function dropPlayer(
  userId: string,
  leagueId: string,
  playerId: string,
): Promise<void> {
  return (await import("./ops.server")).requestDrop(userId, leagueId, playerId);
}
export async function previewSleeperImport(
  sleeperId: string,
  includeHistory = false,
): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  warnings: string[];
  teams: { rosterId: number; teamName: string; manager: string; players: number }[];
}> {
  const sleeper = await import("@/lib/data/sleeper.server");
  const { packFromSleeper, mergeSleeperHistory } = await import("./import-pack");
  const raw = await sleeper.loadImportPack(sleeperId.trim());
  const warnings: string[] = [];
  let canonical = packFromSleeper(raw, warnings);
  if (includeHistory) {
    const prevId = raw.league.previous_league_id?.trim();
    if (prevId) {
      try {
        const prior = await sleeper.loadImportPack(prevId);
        canonical = mergeSleeperHistory(canonical, prior);
      } catch {
        warnings.push(`Prior Sleeper league ${prevId} not found — importing current only.`);
        canonical = { ...canonical, warnings: [...(canonical.warnings ?? []), ...warnings] };
      }
    }
  }
  return {
    sleeperId: canonical.sourceLeagueId,
    name: canonical.name,
    season: canonical.season,
    status: canonical.status,
    teamCount: canonical.teams.length,
    scoringLabel: scoringLabel(canonical.book),
    warnings: canonical.warnings ?? warnings,
    teams: canonical.teams.map((t) => ({
      rosterId: t.rosterId,
      teamName: t.teamName,
      manager: t.manager,
      players: t.players.length,
    })),
  };
}
export async function importSleeperLeague(input: {
  userId: string;
  sleeperId: string;
  claimRosterId: number | null;
  includeHistory?: boolean;
}): Promise<{ leagueId: string; inviteCode: string }> {
  await ensureDemo();
  const sleeper = await import("@/lib/data/sleeper.server");
  const { packFromSleeper, mergeSleeperHistory } = await import("./import-pack");
  const { commitImportPack } = await import("./import-commit");
  const raw = await sleeper.loadImportPack(input.sleeperId.trim());
  if (!raw.rosters.length) throw new Error("That Sleeper league has no rosters.");
  const warnings: string[] = [];
  let pack = packFromSleeper(raw, warnings);
  if (input.includeHistory) {
    const prevId = raw.league.previous_league_id?.trim();
    if (prevId) {
      try {
        const prior = await sleeper.loadImportPack(prevId);
        pack = mergeSleeperHistory(pack, prior);
      } catch {
        warnings.push(`Prior Sleeper league ${prevId} not found — importing current only.`);
        pack = { ...pack, warnings: [...(pack.warnings ?? []), ...warnings] };
      }
    }
  }
  return commitImportPack({
    userId: input.userId,
    pack,
    claimRosterId: input.claimRosterId,
  });
}
export async function previewEspnImport(input: {
  leagueId: string;
  season: string;
  swid?: string;
  espnS2?: string;
}): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  teams: {
    rosterId: number;
    teamName: string;
    manager: string;
    players: number;
    unmatched?: string[];
    record?: string | null;
  }[];
}> {
  const pack = await (await import("@/lib/data/espn-ff.server")).loadEspnImportPack(input);
  const { packFromEspn } = await import("./import-pack");
  const canonical = packFromEspn(pack);
  return {
    sleeperId: canonical.sourceLeagueId,
    name: canonical.name,
    season: canonical.season,
    status: canonical.status,
    teamCount: canonical.teams.length,
    scoringLabel: scoringLabel(canonical.book),
    teams: canonical.teams.map((t) => ({
      rosterId: t.rosterId,
      teamName: t.teamName,
      manager: t.manager,
      players: t.players.length,
    })),
  };
}
export async function importEspnLeague(input: {
  userId: string;
  leagueId: string;
  season: string;
  claimRosterId: number | null;
  swid?: string;
  espnS2?: string;
}): Promise<{ leagueId: string; inviteCode: string }> {
  await ensureDemo();
  const raw = await (await import("@/lib/data/espn-ff.server")).loadEspnImportPack({
    leagueId: input.leagueId,
    season: input.season,
    swid: input.swid,
    espnS2: input.espnS2,
  });
  if (!raw.teams.length) throw new Error("That ESPN league has no teams.");
  const { packFromEspn } = await import("./import-pack");
  const { commitImportPack } = await import("./import-commit");
  return commitImportPack({
    userId: input.userId,
    pack: packFromEspn(raw),
    claimRosterId: input.claimRosterId,
  });
}
export async function previewRebuild(input: {
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: {
    teamName: string;
    manager: string;
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    names: string[];
  }[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
}): Promise<{
  sleeperId: string;
  name: string;
  season: string;
  status: string;
  teamCount: number;
  scoringLabel: string;
  format: string;
  knownId: string | null;
  warnings: string[];
  pickCount: number;
  playoffTeams: number;
  playoffByes: number;
  teams: {
    rosterId: number;
    teamName: string;
    manager: string;
    names: string[];
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    players: number;
    unmatched: string[];
    matched: { name: string; playerId: string | null; pos: string | null }[];
    record: string | null;
  }[];
}> {
  const { parseImportSource } = await import("./recap");
  const { matchPlayerName } = await import("@/lib/data/sleeper.server");
  const parsed = parseImportSource({
    paste: input.paste,
    known: input.known,
    pdfBase64: input.pdfBase64,
    teams: input.teams,
  });
  if (parsed.teams.length < 2) {
    throw new Error(parsed.warnings[0] ?? "Need at least two teams. One block per team.");
  }
  const playoffTeams = parsed.teams.length >= 14 ? 7 : parsed.teams.length >= 12 ? 6 : 4;
  return {
    sleeperId: parsed.knownId ?? "rebuild",
    name: input.name.trim() || parsed.suggestedName || "Rebuilt league",
    season: input.season || parsed.suggestedSeason || "2026",
    status: "in_season",
    teamCount: parsed.teams.length,
    scoringLabel: scoringLabel(bookFromPreset(input.scoring)),
    format: parsed.format,
    knownId: parsed.knownId,
    warnings: parsed.warnings,
    pickCount: parsed.pickCount,
    playoffTeams,
    playoffByes: defaultPlayoffByes(playoffTeams),
    teams: parsed.teams.map((t, i) => {
      const matched = t.names.map((n) => {
        const player = matchPlayerName(n);
        return {
          name: n,
          playerId: player?.player_id ?? null,
          pos: player?.position ?? null,
        };
      });
      return {
        rosterId: i + 1,
        teamName: t.teamName,
        manager: t.manager,
        names: t.names,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pf: t.pf,
        pa: t.pa,
        players: matched.filter((m) => m.playerId).length,
        unmatched: matched.filter((m) => !m.playerId).map((m) => m.name),
        matched,
        record:
          t.wins != null
            ? `${t.wins}-${t.losses ?? 0}${t.ties ? `-${t.ties}` : ""}${t.pf != null ? ` · ${t.pf.toFixed(1)} PF` : ""}`
            : null,
      };
    }),
  };
}
async function ensureSnapColumns() {
  const sql = await getSql();
  await sql.query(`alter table ol_rosters add column if not exists snap_wins int`);
  await sql.query(`alter table ol_rosters add column if not exists snap_losses int`);
  await sql.query(`alter table ol_rosters add column if not exists snap_ties int`);
  await sql.query(`alter table ol_rosters add column if not exists snap_pf real`);
  await sql.query(`alter table ol_rosters add column if not exists snap_pa real`);
}
const rebuildInflight = new Map<string, Promise<{ leagueId: string; inviteCode: string }>>();

export async function importRebuild(input: {
  userId: string;
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: {
    teamName: string;
    manager: string;
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    names: string[];
  }[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
  claimRosterId: number | null;
}): Promise<{ leagueId: string; inviteCode: string }> {
  const key = `${input.userId}:${input.known ?? `${input.name.trim().toLowerCase()}:${input.season}`}`;
  const pending = rebuildInflight.get(key);
  if (pending) return pending;
  const run = importRebuildOnce(input).finally(() => rebuildInflight.delete(key));
  rebuildInflight.set(key, run);
  return run;
}

async function importRebuildOnce(input: {
  userId: string;
  paste?: string;
  known?: string;
  pdfBase64?: string;
  teams?: {
    teamName: string;
    manager: string;
    wins: number | null;
    losses: number | null;
    ties: number | null;
    pf: number | null;
    pa: number | null;
    names: string[];
  }[];
  name: string;
  season: string;
  scoring: "ppr" | "half" | "std";
  claimRosterId: number | null;
}): Promise<{ leagueId: string; inviteCode: string }> {
  await ensureDemo();
  const { parseImportSource } = await import("./recap");
  const { packFromRebuild } = await import("./import-pack");
  const { commitImportPack } = await import("./import-commit");
  const parsed = parseImportSource({
    paste: input.paste,
    known: input.known,
    pdfBase64: input.pdfBase64,
    teams: input.teams,
  });
  if (parsed.teams.length < 2) throw new Error(parsed.warnings[0] ?? "Need at least two teams.");
  if (parsed.teams.length > 14) throw new Error("14 teams max for now.");
  const name = input.name.trim() || parsed.suggestedName || "Rebuilt league";
  const season =
    input.season === "2025" ? "2025" : parsed.suggestedSeason || input.season || "2026";
  const pack = packFromRebuild({
    teams: parsed.teams,
    name,
    season,
    scoring: input.scoring,
    knownId: input.known ?? null,
    warnings: parsed.warnings,
  });
  return commitImportPack({
    userId: input.userId,
    pack,
    claimRosterId: input.claimRosterId,
  });
}
export async function loadSettings(
  leagueId: string,
  userId: string | null,
): Promise<{
  leagueId: string;
  name: string;
  season: string;
  inviteCode: string | null;
  isCommish: boolean;
  locked: boolean;
  scoring: "ppr" | "half" | "std";
  book: ReturnType<typeof bookOf>;
  playoffTeams: number;
  currentWeek: number;
  source: string;
  sourceLeagueId: string | null;
  waiverType: string;
  faabBudget: number;
  tradeDeadlineWeek: number;
  playoffStartWeek: number;
  regularWeeks: number;
  playoffByes: number;
  lastWaiverWeek: number;
  slots: string[];
  bettingOn: boolean;
  poolSeed: number;
  wagerCap: number;
  exposureCap: number;
  teams: {
    rosterId: number;
    teamName: string;
    manager: string;
    ownerId: string | null;
    open: boolean;
    faab: number;
    waiverOrder: number;
  }[];
}> {
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  return {
    leagueId: row.id,
    name: row.name,
    season: row.season,
    inviteCode: userId && row.commish_id === userId ? row.invite_code : null,
    isCommish: Boolean(userId && row.commish_id === userId),
    locked: row.locked === 1,
    scoring: presetOf(bookOf(row)),
    book: bookOf(row),
    playoffTeams: row.playoff_teams,
    currentWeek: row.current_week,
    source: row.source ?? "ledger",
    sourceLeagueId: row.source_league_id ?? null,
    waiverType: row.waiver_type ?? "faab",
    faabBudget: row.faab_budget ?? 100,
    tradeDeadlineWeek: row.trade_deadline_week ?? 11,
    playoffStartWeek: row.playoff_start_week ?? 15,
    regularWeeks: row.regular_weeks ?? 14,
    playoffByes: row.playoff_byes ?? defaultPlayoffByes(row.playoff_teams),
    lastWaiverWeek: row.last_waiver_week ?? 0,
    slots: parseSlots(row.roster_slots),
    bettingOn: Boolean(row.betting_on),
    poolSeed: row.pool_seed ?? 200,
    wagerCap: row.wager_cap ?? 25,
    exposureCap: row.exposure_cap ?? 60,
    teams: rosters.map((r) => ({
      rosterId: r.roster_id,
      teamName: r.team_name,
      manager: managerOf(r),
      ownerId: r.owner_id,
      open: !r.owner_id,
      faab: r.faab_remaining ?? row.faab_budget ?? 100,
      waiverOrder: r.waiver_order ?? r.roster_id,
    })),
  };
}
export async function saveSettings(
  userId: string,
  leagueId: string,
  input: {
    name?: string;
    book?: Record<string, number>;
    playoffTeams?: number;
    currentWeek?: number;
    waiverType?: string;
    faabBudget?: number;
    tradeDeadlineWeek?: number;
    playoffStartWeek?: number;
    regularWeeks?: number;
    playoffByes?: number;
    slots?: string[];
  },
): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId) throw new Error("Only the commissioner can change settings.");
  if (row.locked) throw new Error("This desk is locked.");
  const sql = await getSql();
  const name = input.name?.trim().slice(0, 48) || row.name;
  const book = input.book
    ? {
        ...bookOf(row),
        ...input.book,
      }
    : bookOf(row);
  const preset = presetOf(book);
  const playoff = Math.min(8, Math.max(2, input.playoffTeams ?? row.playoff_teams));
  const week = Math.min(18, Math.max(1, input.currentWeek ?? row.current_week));
  const waiverType = input.waiverType ?? row.waiver_type ?? "faab";
  const faab = input.faabBudget ?? row.faab_budget ?? 100;
  const deadline = input.tradeDeadlineWeek ?? row.trade_deadline_week ?? 11;
  const pStart = Math.min(18, Math.max(10, input.playoffStartWeek ?? row.playoff_start_week ?? 15));
  const regular = Math.min(pStart - 1, Math.max(8, input.regularWeeks ?? row.regular_weeks ?? 14));
  const byes = clampPlayoffByes(
    playoff,
    input.playoffByes ?? row.playoff_byes ?? defaultPlayoffByes(playoff),
  );
  const slots = input.slots ? normalizeSlots(input.slots) : parseSlots(row.roster_slots);
  // The book's own settings. Genesis numbers are the league's to choose: the
  // ratio of pool seed to total manager FAAB is what decides whether a payout
  // ever has to scale down.
  try {
    const { ensureWagerSchema, seedPool } = await import("./wagers.server");
    await ensureWagerSchema();
    if (input.bettingOn != null) {
      await sql`update ol_leagues set betting_on = ${input.bettingOn ? 1 : 0} where id = ${leagueId}`;
    }
    if (input.poolSeed != null) {
      const seed = Math.max(0, Math.min(5000, Math.round(input.poolSeed)));
      await sql`update ol_leagues set pool_seed = ${seed} where id = ${leagueId}`;
      await seedPool(leagueId, seed);
    }
    if (input.wagerCap != null) {
      await sql`update ol_leagues set wager_cap = ${Math.max(1, Math.round(input.wagerCap))} where id = ${leagueId}`;
    }
    if (input.exposureCap != null) {
      await sql`update ol_leagues set exposure_cap = ${Math.max(1, Math.round(input.exposureCap))} where id = ${leagueId}`;
    }
  } catch {
    /* a league without the book tables simply has no betting */
  }
  await sql`
    update ol_leagues
    set name = ${name}, scoring = ${preset}, scoring_json = ${JSON.stringify(book)},
        playoff_teams = ${playoff}, current_week = ${week},
        waiver_type = ${waiverType}, faab_budget = ${faab},
        trade_deadline_week = ${deadline}, playoff_start_week = ${pStart},
        regular_weeks = ${regular}, playoff_byes = ${byes},
        roster_slots = ${JSON.stringify(slots)}
    where id = ${leagueId}
  `;
  if (input.slots) {
    const pts = pprMap();
    const rosters = await getRosters(leagueId);
    const allSpots = await getSpots(leagueId);
    for (const roster of rosters) {
      const mine = allSpots.filter((s) => s.roster_id === roster.roster_id);
      const lined = applyLineup(mine, slots, pts);
      for (const s of lined) {
        await sql`
          update ol_spots set slot = ${s.slot}, starter_slot = ${s.starter_slot}
          where league_id = ${leagueId} and roster_id = ${roster.roster_id} and player_id = ${s.player_id}
        `;
      }
    }
  }
  await ensureRemainingSchedule(leagueId);
}
export async function claimRoster(
  userId: string,
  leagueId: string,
  rosterId: number,
  code?: string | null,
): Promise<void> {
  const league = await getLeague(leagueId);
  if (league.locked) throw new Error("This desk is locked.");
  const isCommish = league.commish_id === userId;
  if (!isCommish) {
    const provided = (code ?? "").trim().toUpperCase();
    if (!provided || provided !== league.invite_code) {
      throw new Error("Invite code required.");
    }
  }
  await assertAllowlisted(leagueId, userId);
  const sql = await getSql();
  if (
    (await sql`select * from ol_rosters where league_id = ${leagueId} and owner_id = ${userId}`)[0]
  )
    throw new Error("You already have a seat.");
  const seat = (
    await sql`select * from ol_rosters where league_id = ${leagueId} and roster_id = ${rosterId}`
  )[0];
  if (!seat) throw new Error("No such team.");
  if (seat.owner_id) throw new Error("That seat is taken.");
  await sql`
    update ol_rosters set owner_id = ${userId}
    where league_id = ${leagueId} and roster_id = ${rosterId}
  `;
}

type SchedulePair = { matchupId: number; home: number; away: number | null };
type ScheduleWeek = { week: number; locked: boolean; pairs: SchedulePair[] };

export async function loadSchedule(
  leagueId: string,
  userId: string | null,
): Promise<{
  leagueId: string;
  isCommish: boolean;
  locked: boolean;
  currentWeek: number;
  regularWeeks: number;
  playoffStartWeek: number;
  teams: { rosterId: number; teamName: string }[];
  weeks: ScheduleWeek[];
}> {
  await ensureDemo();
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  const sql = await getSql();
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  await ensureRemainingSchedule(leagueId);
  const matchups = await sql<{
    week: number;
    matchup_id: number;
    home_roster: number;
    away_roster: number | null;
    kind: string | null;
  }>`
    select week, matchup_id, home_roster, away_roster, kind
    from ol_matchups
    where league_id = ${leagueId} and week <= ${lastReg}
      and (kind is null or kind = ${"regular"})
    order by week, matchup_id
  `;
  const scored = await sql<{ week: number; points: number }>`
    select week, points from ol_week_results where league_id = ${leagueId}
  `.catch(() => []);
  const lockedWeeks = new Set<number>();
  for (const r of scored) {
    if ((r.points ?? 0) > 0) lockedWeeks.add(r.week);
  }
  const byWeek = new Map<number, SchedulePair[]>();
  for (const m of matchups) {
    const list = byWeek.get(m.week) ?? [];
    list.push({ matchupId: m.matchup_id, home: m.home_roster, away: m.away_roster });
    byWeek.set(m.week, list);
  }
  const weeks: ScheduleWeek[] = [];
  for (let w = 1; w <= lastReg; w++) {
    weeks.push({
      week: w,
      locked: lockedWeeks.has(w),
      pairs: byWeek.get(w) ?? [],
    });
  }
  return {
    leagueId,
    isCommish: Boolean(userId && row.commish_id === userId),
    locked: row.locked === 1,
    currentWeek: row.current_week,
    regularWeeks: lastReg,
    playoffStartWeek: row.playoff_start_week ?? 15,
    teams: rosters.map((r) => ({ rosterId: r.roster_id, teamName: r.team_name })),
    weeks,
  };
}

function assertWeekPairs(teamCount: number, pairs: { home: number; away: number | null }[]) {
  const seen = new Set<number>();
  for (const p of pairs) {
    if (p.home < 1 || p.home > teamCount) throw new Error("Bad home team.");
    if (seen.has(p.home)) throw new Error("A team is listed twice this week.");
    seen.add(p.home);
    if (p.away != null) {
      if (p.away < 1 || p.away > teamCount) throw new Error("Bad away team.");
      if (seen.has(p.away)) throw new Error("A team is listed twice this week.");
      if (p.away === p.home) throw new Error("A team cannot play itself.");
      seen.add(p.away);
    }
  }
  if (seen.size !== teamCount) {
    throw new Error(`Every team needs a slot. ${seen.size} of ${teamCount} are set.`);
  }
}

export async function saveWeekSchedule(
  userId: string,
  leagueId: string,
  week: number,
  pairs: { home: number; away: number | null }[],
): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId) throw new Error("Only the commissioner can set the schedule.");
  if (row.locked) throw new Error("This desk is locked.");
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  if (week < 1 || week > lastReg) throw new Error("That week is not a regular-season week.");
  assertWeekPairs(row.team_count, pairs);
  const sql = await getSql();
  const scored = await sql<{ points: number }>`
    select points from ol_week_results where league_id = ${leagueId} and week = ${week}
  `;
  if (scored.some((r) => (r.points ?? 0) > 0)) {
    throw new Error("That week already has scores. Leave it.");
  }
  await sql`delete from ol_week_results where league_id = ${leagueId} and week = ${week}`;
  await sql`
    delete from ol_matchups
    where league_id = ${leagueId} and week = ${week} and (kind is null or kind = ${"regular"})
  `;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]!;
    await sql`
      insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${week}, ${i + 1}, ${p.home}, ${p.away}, ${"regular"})
    `;
  }
}

export async function rebuildSchedule(userId: string, leagueId: string): Promise<void> {
  const row = await getLeague(leagueId);
  if (row.commish_id !== userId) throw new Error("Only the commissioner can set the schedule.");
  if (row.locked) throw new Error("This desk is locked.");
  const lastReg = Math.min(row.regular_weeks ?? 14, (row.playoff_start_week ?? 15) - 1);
  const sql = await getSql();
  const scored = await sql<{ week: number; points: number }>`
    select week, points from ol_week_results where league_id = ${leagueId}
  `;
  const keep = new Set<number>();
  for (const r of scored) {
    if ((r.points ?? 0) > 0) keep.add(r.week);
  }
  const generated = makeSchedule(row.team_count, lastReg);
  for (let w = 1; w <= lastReg; w++) {
    if (keep.has(w)) continue;
    await sql`delete from ol_week_results where league_id = ${leagueId} and week = ${w}`;
    await sql`
      delete from ol_matchups
      where league_id = ${leagueId} and week = ${w} and (kind is null or kind = ${"regular"})
    `;
    const rows = generated.filter((m) => m.week === w);
    for (const m of rows) {
      await sql`
        insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
        values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      `;
    }
  }
}

export async function previewInvite(code: string): Promise<{
  leagueId: string;
  name: string;
  season: string;
  seats: { rosterId: number; teamName: string }[];
} | null> {
  await ensureDemo();
  const sql = await getSql();
  const league = (
    await sql`select * from ol_leagues where invite_code = ${code.trim().toUpperCase()}`
  )[0];
  if (!league || league.locked) return null;
  const seats = await sql`
    select roster_id, team_name from ol_rosters
    where league_id = ${league.id} and owner_id is null
    order by roster_id
  `;
  return {
    leagueId: league.id,
    name: league.name,
    season: league.season,
    seats: seats.map((s) => ({ rosterId: s.roster_id, teamName: s.team_name })),
  };
}

export async function loadDispatch(
  leagueId: string,
  week: number,
): Promise<import("./dispatch").DispatchArticle> {
  const desk = await loadDesk(leagueId, week);
  return desk.articles[0]!;
}

export async function loadDesk(
  leagueId: string,
  week: number,
): Promise<import("./dispatch").DeskEdition> {
  await ensureDemo();
  await (await import("./ops.server")).ensureOpsSchema();
  const sql = await getSql();
  const { parseJson } = await import("./dispatch");
  const existing = await sql`
    select * from ol_dispatches
    where league_id = ${leagueId} and week = ${week}
    order by created_at asc
  `;
  const stale =
    existing.length <= 1 &&
    existing.some((r) => /blank paper|still blank/i.test(String(r.headline)));
  if (existing.length >= 2 && !stale) {
    return {
      week,
      edition: existing.some((r) => r.kind === "recap") ? "recap" : "prep",
      kicker: existing.some((r) => r.kind === "recap") ? `Week ${week} recap` : `Week ${week} prep`,
      articles: existing.map((r) => ({
        id: r.id,
        leagueId,
        week: r.week,
        kind: r.kind,
        slug: r.slug || r.id,
        kicker:
          r.kind === "lead" || r.kind === "preview"
            ? `Week ${week} prep`
            : r.kind === "recap"
              ? `Week ${week} recap`
              : "From the draft",
        headline: r.headline,
        dek: r.dek,
        body: parseJson(r.body_json, []),
        bullets: parseJson(r.bullets_json, []),
        box: parseJson(r.box_json, []),
        focus: parseJson(r.focus_json, []),
        source: r.source === "llm" ? "llm" : "rules",
        createdAt: String(r.created_at),
      })),
    };
  }
  if (stale || existing.length) {
    await sql`delete from ol_dispatches where league_id = ${leagueId} and week = ${week}`;
  }
  const row = await getLeague(leagueId);
  const rosters = await getRosters(leagueId);
  const spots = await getSpots(leagueId);
  const standings = await scoredStandings(row, rosters, spots);
  const pairs = await loadMatchups(leagueId, week);
  const activity = await loadActivity(leagueId, week);
  const rosterCards = rosters.map((r) => ({
    team: r.team_name,
    manager: managerOf(r),
    players: spots
      .filter((s) => s.roster_id === r.roster_id)
      .map((s) => {
        const p = getPlayer(s.player_id);
        return {
          name: p?.full_name ?? playerName(s.player_id),
          pos: p?.position ?? null,
        };
      }),
  }));
  if (rosterCards.some((r) => r.players.length < 5) && /wiffl/i.test(row.name)) {
    const { WIFFL_2026 } = await import("./recaps/wiffl-2026");
    for (const card of rosterCards) {
      const known = WIFFL_2026.teams.find((t) => t.teamName === card.team);
      if (!known) continue;
      card.players = known.names.map((name) => {
        const p = matchPlayerName(name);
        return { name: p?.full_name ?? name, pos: p?.position ?? null };
      });
    }
  }
  // The week's snapshot says what happened; the facts say what it means in the
  // context of a season. Failing to load them must not stop an edition from
  // being written.
  let facts: Array<{ kind: string; teams: string[]; text: string }> = [];
  try {
    const { loadLeagueFacts } = await import("./league-facts.server");
    facts = (await loadLeagueFacts(leagueId, week)).facts;
  } catch {
    /* a desk with no memory is still a desk */
  }
  // Prefer not to repeat last week's asides: previous edition's context_json
  // carries the facts it used. Cheap one-row read; fall through on miss.
  if (facts.length && week > 1) {
    try {
      const prev = await sql`
        select context_json from ol_dispatches
        where league_id = ${leagueId} and week = ${week - 1}
        order by created_at asc
        limit 1
      `;
      const prevCtx = parseJson<{ facts?: Array<{ text?: string }> }>(
        prev[0] ? String(prev[0].context_json) : null,
        {},
      );
      const used = new Set(
        (prevCtx.facts ?? [])
          .map((f) => (typeof f.text === "string" ? f.text : ""))
          .filter(Boolean),
      );
      if (used.size) facts = facts.filter((f) => !used.has(f.text));
    } catch {
      /* selection still works without the exclude set */
    }
  }
  const { buildDispatchContext, composeDesk, selectEditionFacts } = await import("./dispatch");
  const ctx = buildDispatchContext({
    leagueId,
    leagueName: row.name,
    season: row.season,
    week,
    status: row.status,
    standings,
    pairs,
    activity,
    rosters: rosterCards,
    facts,
  });
  const desk = composeDesk(ctx);
  const selectedFacts = selectEditionFacts(ctx);
  const now = new Date().toISOString();
  const articles = [];
  for (const draft of desk.articles) {
    const id = `ds_${leagueId}_${week}_${draft.slug}`.slice(0, 64);
    await sql`
      insert into ol_dispatches (
        id, league_id, week, kind, slug, headline, dek, body_json, bullets_json, box_json, focus_json, context_json, source
      ) values (
        ${id}, ${leagueId}, ${week}, ${draft.kind}, ${draft.slug}, ${draft.headline}, ${draft.dek},
        ${JSON.stringify(draft.body)}, ${JSON.stringify(draft.bullets)}, ${JSON.stringify(draft.box)},
        ${JSON.stringify(draft.focus)}, ${JSON.stringify({ week: ctx.week, league: ctx.leagueName, facts: selectedFacts })}, ${draft.source}
      )
    `;
    articles.push({
      ...draft,
      id,
      leagueId,
      createdAt: now,
    });
  }
  return { week, edition: desk.edition, kicker: desk.kicker, articles };
}
