import { getSql } from "@/lib/db";
import { applyBook, type ScoringBook } from "@/lib/league/scoring";
import {
  attachRemaining,
  joinSources,
  type MoveRow,
  type SleeperTx,
  seedsFromTxs,
  weekIsFrozen,
} from "./ledger";
import { asLabeled, type LabeledMove } from "./spec";

const SLEEPER = "https://api.sleeper.app/v1";
const CURRENT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HISTORY_HOPS = 1;

export const SDIFFL_2026 = "1312215005088739328";
export const SDIFFL_2025 = "1255972181892935680";
export const RYANWAITS_ROSTER_ID = 1;

type LeagueHeader = {
  league_id?: string;
  name?: string;
  season?: string;
  previous_league_id?: string | null;
  settings?: { waiver_budget?: number };
  scoring_settings?: ScoringBook;
};

type Roster = { roster_id: number; owner_id: string | null };
type User = { user_id: string; display_name?: string; metadata?: { team_name?: string } };

export type MoveLedger = {
  league: { id: string; name: string; season: string; previousLeagueId: string | null };
  seasons: { leagueId: string; season: string; budget: number; moves: number }[];
  moves: LabeledMove[];
  generatedAt: string;
};

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_move_seasons (
    league_id text not null,
    season text not null,
    payload_json text not null,
    computed_at timestamptz not null default now(),
    primary key (league_id, season)
  )`);
  ready = true;
}

async function sget<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

function teamName(users: User[], rosters: Roster[], rosterId: number): string {
  const r = rosters.find((x) => x.roster_id === rosterId);
  const u = r?.owner_id ? users.find((x) => x.user_id === r.owner_id) : undefined;
  return u?.metadata?.team_name || u?.display_name || `Roster ${rosterId}`;
}

function scoreBag(book: ScoringBook, bag: Record<string, number> | undefined): number | null {
  if (!bag) return null;
  const n = applyBook(book, bag);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

async function txsFor(leagueId: string, week: number): Promise<SleeperTx[]> {
  try {
    return await sget<SleeperTx[]>(`/league/${leagueId}/transactions/${week}`);
  } catch {
    return [];
  }
}

async function buildSeason(leagueId: string, header: LeagueHeader): Promise<LabeledMove[]> {
  const season = String(header.season ?? "");
  const budget = header.settings?.waiver_budget ?? 100;
  const book = (header.scoring_settings ?? {}) as ScoringBook;
  const [users, rosters, nfl] = await Promise.all([
    sget<User[]>(`/league/${leagueId}/users`),
    sget<Roster[]>(`/league/${leagueId}/rosters`),
    import("@/lib/data/sleeper.server").then((s) => s.fetchNflState()),
  ]);
  const throughWeek =
    String(nfl.season) === season ? Math.max(1, nfl.display_week ?? nfl.week) : 19;

  const seeds = [];
  for (let w = 1; w <= 18; w++) {
    const txs = await txsFor(leagueId, w);
    seeds.push(...seedsFromTxs(w, txs));
  }
  const rows = attachRemaining(budget, seeds);

  const { projectionsFor, refreshProjections } = await import("@/lib/data/projection-feed.server");
  const live = await import("@/lib/data/live.server");
  const ids = [...new Set(rows.map((r) => r.playerId))];
  const weeklyPts: Record<number, Record<string, number>> = {};
  const weeklyProj: Record<number, Record<string, number>> = {};
  const last = Math.min(18, throughWeek);
  for (let w = 1; w <= last; w++) {
    const stats: Record<string, Record<string, number>> = await live
      .fetchWeekStats(season, w, "regular")
      .catch(() => ({}) as Record<string, Record<string, number>>);
    const pts: Record<string, number> = {};
    for (const id of ids) {
      const n = scoreBag(book, stats[id]);
      if (n != null) pts[id] = n;
    }
    weeklyPts[w] = pts;
    const frozen = weekIsFrozen(season, w, nfl);
    if (!frozen || w === last) {
      try {
        await refreshProjections(season, w);
      } catch {
        /* feed optional */
      }
    }
    const feed = await projectionsFor(season, w, ids);
    const proj: Record<string, number> = {};
    for (const id of ids) {
      const n = scoreBag(book, feed[id]);
      if (n != null) proj[id] = n;
    }
    weeklyProj[w] = proj;
  }

  const joined = joinSources(rows, weeklyPts, weeklyProj, throughWeek);
  const sleeper = await import("@/lib/data/sleeper.server");
  return joined.map((r) => {
    const p = sleeper.getPlayer(r.playerId);
    return asLabeled(r, {
      leagueId,
      season,
      pos: p?.position ?? null,
      playerName: p?.full_name ?? null,
      teamName: teamName(users, rosters, r.rosterId),
    });
  });
}

type SeasonBlob = { moves: LabeledMove[]; budget: number; name: string; season: string };

async function loadSeason(
  leagueId: string,
  header: LeagueHeader,
  nflSeason: string,
): Promise<SeasonBlob> {
  await ensure();
  const sql = await getSql();
  const season = String(header.season ?? "");
  const cached = (
    await sql<{ payload_json: string; computed_at: string }>`
      select payload_json, computed_at from ol_move_seasons
      where league_id = ${leagueId} and season = ${season}
    `
  )[0];
  const stale =
    !cached ||
    (season >= nflSeason && Date.now() - new Date(cached.computed_at).getTime() > CURRENT_TTL_MS);
  if (cached && !stale) return JSON.parse(cached.payload_json) as SeasonBlob;

  const moves = await buildSeason(leagueId, header);
  const blob: SeasonBlob = {
    moves,
    budget: header.settings?.waiver_budget ?? 100,
    name: header.name ?? leagueId,
    season,
  };
  await sql`
    insert into ol_move_seasons (league_id, season, payload_json, computed_at)
    values (${leagueId}, ${season}, ${JSON.stringify(blob)}, now())
    on conflict (league_id, season) do update set
      payload_json = excluded.payload_json, computed_at = now()
  `;
  return blob;
}

export async function buildMoveLedger(
  leagueId: string,
  opts?: { includeHistory?: boolean; season?: string },
): Promise<MoveLedger> {
  if (leagueId.startsWith("lg_")) {
    return {
      league: { id: leagueId, name: "", season: "", previousLeagueId: null },
      seasons: [],
      moves: [],
      generatedAt: new Date().toISOString(),
    };
  }
  const header = await sget<LeagueHeader>(`/league/${leagueId}`);
  const nfl = await import("@/lib/data/sleeper.server").then((s) => s.fetchNflState());
  const includeHistory = opts?.includeHistory !== false;
  const chain: { id: string; header: LeagueHeader }[] = [{ id: leagueId, header }];
  if (includeHistory && header.previous_league_id) {
    try {
      const prev = await sget<LeagueHeader>(`/league/${header.previous_league_id}`);
      chain.push({ id: header.previous_league_id, header: prev });
    } catch {
      /* one hop, best-effort */
    }
  }
  void MAX_HISTORY_HOPS;

  const seasons: MoveLedger["seasons"] = [];
  const moves: LabeledMove[] = [];
  for (const link of chain) {
    if (opts?.season && String(link.header.season) !== String(opts.season)) continue;
    const blob = await loadSeason(link.id, link.header, String(nfl.season));
    seasons.push({
      leagueId: link.id,
      season: blob.season,
      budget: blob.budget,
      moves: blob.moves.length,
    });
    moves.push(...blob.moves);
  }
  moves.sort((a, b) => a.season.localeCompare(b.season) || a.week - b.week || a.seq - b.seq);

  return {
    league: {
      id: leagueId,
      name: header.name ?? leagueId,
      season: String(header.season ?? ""),
      previousLeagueId: header.previous_league_id ?? null,
    },
    seasons,
    moves,
    generatedAt: new Date().toISOString(),
  };
}

export async function remainingFor(
  leagueId: string,
  rosterId: number,
): Promise<{ remaining: number; budget: number }> {
  const ledger = await buildMoveLedger(leagueId, { includeHistory: false });
  const budget = ledger.seasons[0]?.budget ?? 100;
  const { spentOf } = await import("./ledger");
  const spent = spentOf(budget, ledger.moves, rosterId);
  return { remaining: Math.max(0, budget - spent), budget };
}

/** Persist classification fields onto the cached season blob. */
export async function writeLabels(
  leagueId: string,
  season: string,
  labeled: LabeledMove[],
): Promise<void> {
  await ensure();
  const sql = await getSql();
  const row = (
    await sql<{ payload_json: string }>`
      select payload_json from ol_move_seasons where league_id = ${leagueId} and season = ${season}
    `
  )[0];
  if (!row) return;
  const blob = JSON.parse(row.payload_json) as SeasonBlob;
  const byKey = new Map(labeled.map((m) => [`${m.week}:${m.txId}:${m.playerId}`, m]));
  blob.moves = blob.moves.map((m) => byKey.get(`${m.week}:${m.txId}:${m.playerId}`) ?? m);
  await sql`
    update ol_move_seasons set payload_json = ${JSON.stringify(blob)}, computed_at = now()
    where league_id = ${leagueId} and season = ${season}
  `;
}

export type { MoveRow };
