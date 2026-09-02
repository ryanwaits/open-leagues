import type { ImportPack } from "./import-pack";
import { defaultPlayoffByes } from "./playoffs";
import { presetOf } from "./scoring";

async function sql() {
  return (await import("@/lib/db")).getSql();
}

function nid(prefix: string, n = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = prefix;
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 31)];
  return s;
}

function inviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * 32)];
  return s;
}

function makeSchedule(
  teams: number,
  weeks: number,
): Array<{ week: number; id: number; home: number; away: number | null }> {
  const ids = Array.from({ length: teams }, (_, i) => i + 1);
  if (ids.length % 2 === 1) ids.push(0);
  const m = ids.length;
  const rounds: Array<Array<[number | null, number | null]>> = [];
  const circle = [...ids];
  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[number | null, number | null]> = [];
    for (let i = 0; i < m / 2; i++) {
      const a = circle[i] ?? 0;
      const b = circle[m - 1 - i] ?? 0;
      if (a === 0) pairs.push([b, null]);
      else if (b === 0) pairs.push([a, null]);
      else pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const last = circle.pop() ?? 0;
    circle.splice(1, 0, last);
  }
  const out: Array<{ week: number; id: number; home: number; away: number | null }> = [];
  for (let w = 1; w <= weeks; w++) {
    const round = rounds[(w - 1) % rounds.length] ?? [];
    round.forEach((p, i) => {
      out.push({ week: w, id: i + 1, home: p[0] ?? 0, away: p[1] });
    });
  }
  return out;
}

async function ensureSnapColumns(): Promise<void> {
  const db = await sql();
  await db.query(`alter table ol_rosters add column if not exists snap_wins int`);
  await db.query(`alter table ol_rosters add column if not exists snap_losses int`);
  await db.query(`alter table ol_rosters add column if not exists snap_ties int`);
  await db.query(`alter table ol_rosters add column if not exists snap_pf real`);
  await db.query(`alter table ol_rosters add column if not exists snap_pa real`);
}

async function armAfterImport(
  leagueId: string,
  teamCount: number,
  regularWeeks: number,
  fillSchedule: boolean,
): Promise<void> {
  const ops = await import("./ops.server");
  await ops.ensureOpsSchema();
  await ops.seedRosterOps(leagueId);
  await ops.ensureDraftBoard(leagueId);
  if (!fillSchedule) return;
  const db = await sql();
  const existing = await db<{ week: number }>`
    select distinct week from ol_matchups
    where league_id = ${leagueId} and week <= ${regularWeeks}
  `;
  const have = new Set(existing.map((e) => e.week));
  for (const m of makeSchedule(teamCount, regularWeeks)) {
    if (have.has(m.week)) continue;
    await db`
      insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster, kind)
      values (${leagueId}, ${m.week}, ${m.id}, ${m.home}, ${m.away}, ${"regular"})
      on conflict do nothing
    `;
  }
}

/**
 * One SQL writer for leagues / rosters / spots / weeks.
 * Adapters own scoring conversion; this only persists the pack.
 */
export async function commitImportPack(input: {
  userId: string;
  pack: ImportPack;
  claimRosterId: number | null;
  /** Stable id for the public reference desk. Random `lg_…` otherwise. */
  leagueId?: string;
}): Promise<{ leagueId: string; inviteCode: string }> {
  const { pack, userId, claimRosterId } = input;
  if (!pack.teams.length) throw new Error("Import pack has no teams.");

  const db = await sql();
  const sourceKey = pack.sourceLeagueId || null;
  if (sourceKey) {
    const existing = await db<{ id: string; invite_code: string }>`
      select id, invite_code from ol_leagues
      where source_league_id = ${sourceKey} and commish_id = ${userId}
    `.catch(() => [] as Array<{ id: string; invite_code: string }>);
    if (existing[0]) {
      return { leagueId: existing[0].id, inviteCode: existing[0].invite_code };
    }
  }

  if (pack.teams.some((t) => t.snap)) await ensureSnapColumns();

  const id = input.leagueId ?? nid("lg_");
  let code = inviteCode();
  for (let i = 0; i < 6; i++) {
    if (!(await db`select id from ol_leagues where invite_code = ${code}`)[0]) break;
    code = inviteCode();
  }

  const preset = presetOf(pack.book);
  const hasPlayers = pack.teams.some((t) => t.players.length > 0);
  const status =
    pack.status === "pre_draft" || pack.status === "drafting"
      ? hasPlayers
        ? "in_season"
        : pack.status
      : pack.status;
  const playoffStart = pack.playoffStartWeek ?? 15;
  const regularWeeks = Math.max(8, playoffStart - 1);
  const byes = pack.playoffByes ?? defaultPlayoffByes(pack.playoffTeams);
  const draftStatus = hasPlayers || pack.source === "rebuild" ? "complete" : "pending";

  await db`
    insert into ol_leagues (
      id, name, season, invite_code, commish_id, status, team_count,
      scoring, roster_slots, playoff_teams, current_week, locked,
      scoring_json, source, source_league_id, playoff_start_week, regular_weeks, playoff_byes
    ) values (
      ${id}, ${pack.name.slice(0, 48)}, ${pack.season}, ${code}, ${userId},
      ${status}, ${pack.teams.length}, ${preset},
      ${JSON.stringify(pack.slots)}, ${pack.playoffTeams}, ${pack.currentWeek},
      ${0}, ${JSON.stringify(pack.book)}, ${pack.source}, ${sourceKey},
      ${playoffStart}, ${regularWeeks}, ${byes}
    )
  `;
  await db`
    insert into ol_draft (league_id, status, pick_no)
    values (${id}, ${draftStatus}, ${1})
  `;

  for (const t of pack.teams) {
    const claim = claimRosterId === t.rosterId ? userId : null;
    if (t.snap) {
      await db`
        insert into ol_rosters (
          league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name,
          snap_wins, snap_losses, snap_ties, snap_pf, snap_pa
        ) values (
          ${id}, ${t.rosterId}, ${t.teamName.slice(0, 40)}, ${claim}, ${t.ownerKey}, ${t.manager},
          ${t.snap.wins}, ${t.snap.losses}, ${t.snap.ties}, ${t.snap.pf}, ${t.snap.pa}
        )
      `;
    } else {
      await db`
        insert into ol_rosters (league_id, roster_id, team_name, owner_id, sleeper_owner_id, manager_name)
        values (${id}, ${t.rosterId}, ${t.teamName.slice(0, 40)}, ${claim}, ${t.ownerKey}, ${t.manager})
      `;
    }
    for (const p of t.players) {
      if (!p.playerId || p.playerId === "0") continue;
      const starter = p.starterSlot != null;
      await db`
        insert into ol_spots (league_id, roster_id, player_id, slot, starter_slot)
        values (
          ${id}, ${t.rosterId}, ${p.playerId},
          ${starter ? "starter" : "bench"}, ${p.starterSlot}
        )
        on conflict do nothing
      `;
    }
  }

  const scoredWeeks = pack.weeks.filter((w) => w.games.length || w.results.length);
  for (const week of scoredWeeks) {
    for (const g of week.games) {
      if (!g.home) continue;
      await db`
        insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${week.week}, ${g.matchupId}, ${g.home}, ${g.away})
        on conflict do nothing
      `;
    }
    for (const r of week.results) {
      await db`
        insert into ol_week_results (league_id, week, roster_id, points, starters_json)
        values (
          ${id}, ${week.week}, ${r.rosterId}, ${r.points},
          ${JSON.stringify(r.starters ?? [])}
        )
        on conflict do nothing
      `;
    }
  }

  if (!scoredWeeks.length && pack.synthesizeSchedule !== false) {
    for (const m of makeSchedule(pack.teams.length, 14)) {
      await db`
        insert into ol_matchups (league_id, week, matchup_id, home_roster, away_roster)
        values (${id}, ${m.week}, ${m.id}, ${m.home}, ${m.away})
      `;
    }
  }

  await armAfterImport(
    id,
    pack.teams.length,
    regularWeeks,
    pack.synthesizeSchedule !== false || scoredWeeks.length > 0,
  );
  return { leagueId: id, inviteCode: code };
}
