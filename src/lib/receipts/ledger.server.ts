import type { Projection, RosterPlayer } from "@/lib/data/types";
import { getSql } from "@/lib/db";
import { fillLineup } from "@/lib/league/lineup-value";
import { loadersFor, publicName } from "./receipt.server";
import type { SourceValues } from "./sources";

type SourceKey = keyof SourceValues;

/**
 * The season ledger: for every settled week, the lineup each open source would
 * have set — scored on what actually happened — beside the lineup the roster
 * did set. Over a season it says which source to trust in this league, about
 * this team's calls. Counts, not adjectives; labeled with how many weeks.
 *
 * Settled weeks never change, so each (league, roster, week) row is computed
 * once and kept.
 */

const SOURCES: { key: SourceKey; label: string }[] = [
  { key: "sleeper_proj", label: "Sleeper projection" },
  { key: "last3", label: "Last 3 weeks" },
  { key: "season_avg", label: "Season average" },
];

export type LedgerWeek = {
  week: number;
  /** What the roster's set lineup scored. */
  you: number;
  /** The best lineup available on the box score. */
  optimal: number;
  /** What each source's lineup would have scored; null when the source had no data. */
  sources: Record<SourceKey, number | null>;
};

export type LedgerSource = {
  source: SourceKey;
  label: string;
  /** Weeks the source had a lineup to offer. */
  weeks: number;
  total: number;
  /** Weeks the source's lineup outscored yours / matched it / fell short. */
  beat: number;
  tied: number;
  lost: number;
  /** Source total minus your total over the weeks it had data. */
  delta: number;
};

export type SourceLedger = {
  league: { id: string; name: string; season: string; hosted: boolean };
  roster: { rosterId: number; name: string };
  weeks: LedgerWeek[];
  totals: { you: number; optimal: number; left: number };
  sources: LedgerSource[];
  generatedAt: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_source_ledger (
  league_id text not null,
  roster_id int not null,
  week int not null,
  week_json text not null,
  computed_at timestamptz not null default now(),
  primary key (league_id, roster_id, week)
)`);
  ready = true;
}

function lineupPoints(
  players: RosterPlayer[],
  positions: string[],
  proj: Record<string, Projection>,
  actual: Record<string, number>,
): number {
  const lineup = fillLineup(players, positions, proj);
  let pts = 0;
  for (const s of lineup.slots) if (s.player) pts += actual[s.player.player_id] ?? 0;
  return round1(pts);
}

async function computeWeek(
  leagueId: string,
  season: string,
  positions: string[],
  rosterId: number,
  week: number,
  team: (rosterId: number, week: number) => Promise<{ players: RosterPlayer[] }>,
): Promise<LedgerWeek | null> {
  const t = await team(rosterId, week);
  const eligible = t.players.filter((p) => p.slot === "starter" || p.slot === "bench");
  const starters = t.players.filter((p) => p.slot === "starter");
  const actual: Record<string, number> = {};
  let anyPoints = false;
  for (const p of eligible) {
    actual[p.player_id] = p.weekPts ?? 0;
    if ((p.weekPts ?? 0) !== 0) anyPoints = true;
  }
  if (!anyPoints) return null; // unplayed week

  const you = round1(starters.reduce((n, p) => n + (p.weekPts ?? 0), 0));
  const actualProj: Record<string, Projection> = {};
  for (const [id, pts] of Object.entries(actual)) actualProj[id] = { points: pts, reason: null };
  const optimal = round1(fillLineup(eligible, positions, actualProj).total);

  const { sourceValues } = await import("./sources.server");
  const values = await sourceValues({
    leagueId,
    season,
    week,
    playerIds: eligible.map((p) => p.player_id),
  });

  const sources = {} as Record<SourceKey, number | null>;
  for (const { key } of SOURCES) {
    const proj: Record<string, Projection> = {};
    let known = 0;
    for (const p of eligible) {
      const v: SourceValues | undefined = values[p.player_id];
      const pts = v?.[key];
      if (typeof pts === "number") known += 1;
      proj[p.player_id] = { points: pts ?? 0, reason: null };
    }
    sources[key] = known === 0 ? null : lineupPoints(eligible, positions, proj, actual);
  }

  return { week, you, optimal, sources };
}

export async function buildSourceLedger(
  leagueId: string,
  rosterId: number,
  userId: string | null,
): Promise<SourceLedger> {
  await ensure();
  const sql = await getSql();
  const L = await loadersFor(leagueId, userId);
  const bundle = await L.bundle();
  const season = String(bundle.league.season);
  const positions = bundle.league.roster_positions ?? [];
  const last = Math.min(Math.max(0, bundle.currentWeek - 1), 18);

  const cached = await sql<{ week: number; week_json: string }>`
    select week, week_json from ol_source_ledger
    where league_id = ${leagueId} and roster_id = ${rosterId} and week <= ${last}
  `;
  const byWeek = new Map<number, LedgerWeek | null>();
  for (const r of cached) byWeek.set(r.week, JSON.parse(r.week_json) as LedgerWeek | null);

  // Sequential on purpose: each week leans on Sleeper's stats endpoint, and a
  // season is at most eighteen calls the first time anyone asks.
  for (let w = 1; w <= last; w++) {
    if (byWeek.has(w)) continue;
    let row: LedgerWeek | null = null;
    try {
      row = await computeWeek(leagueId, season, positions, rosterId, w, L.team);
    } catch {
      row = null;
    }
    byWeek.set(w, row);
    await sql`
      insert into ol_source_ledger (league_id, roster_id, week, week_json)
      values (${leagueId}, ${rosterId}, ${w}, ${JSON.stringify(row)})
      on conflict (league_id, roster_id, week) do update set
        week_json = excluded.week_json, computed_at = now()
    `;
  }

  const weeks = [...byWeek.entries()]
    .filter((e): e is [number, LedgerWeek] => e[1] !== null)
    .sort((a, b) => a[0] - b[0])
    .map(([, w]) => w);

  const totals = {
    you: round1(weeks.reduce((n, w) => n + w.you, 0)),
    optimal: round1(weeks.reduce((n, w) => n + w.optimal, 0)),
    left: 0,
  };
  totals.left = round1(Math.max(0, totals.optimal - totals.you));

  const sources: LedgerSource[] = SOURCES.map(({ key, label }) => {
    let n = 0;
    let total = 0;
    let you = 0;
    let beat = 0;
    let tied = 0;
    let lost = 0;
    for (const w of weeks) {
      const v = w.sources[key];
      if (v === null) continue;
      n += 1;
      total += v;
      you += w.you;
      if (v > w.you + 0.05) beat += 1;
      else if (v < w.you - 0.05) lost += 1;
      else tied += 1;
    }
    return {
      source: key,
      label,
      weeks: n,
      total: round1(total),
      beat,
      tied,
      lost,
      delta: round1(total - you),
    };
  });

  const teamNow = await L.team(rosterId, Math.max(1, last)).catch(() => null);
  const name = teamNow
    ? publicName(teamNow.teamName, teamNow.manager, rosterId)
    : `Roster ${rosterId}`;

  return {
    league: {
      id: leagueId,
      name: bundle.league.name,
      season,
      hosted: leagueId.startsWith("lg_"),
    },
    roster: { rosterId, name },
    weeks,
    totals,
    sources,
    generatedAt: new Date().toISOString(),
  };
}
