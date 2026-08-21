import { getSql } from "@/lib/db";
import { sampleMatchup } from "@/lib/live/matchup-series";

/**
 * `ff_ticks`: an append-only row per matchup per minute on game days,
 * written on read (`getMatchups`, whenever any client polls matchups while
 * scoring is live) and from the hourly tick. Modeled on `events.server.ts`
 * — append-only, never read by any mechanic, never throws.
 *
 * Rows are stored home-signed (matching `spread`, the convention a
 * sportsbook line uses) so a single row means the same thing regardless of
 * which side is asking; `samplesFromTicks()` in `matchup-series.ts` flips
 * them to whichever side is "you" when they're read back.
 */

let ready = false;

export async function ensureTickSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists ff_ticks (
      league_id text not null,
      week int not null,
      matchup_id int not null,
      at timestamptz not null default now(),
      home_pts real not null,
      away_pts real not null,
      home_proj real not null,
      away_proj real not null,
      home_pct smallint not null,
      spread real not null)`,
  );
  await sql.query(
    `create index if not exists ff_ticks_matchup_at on ff_ticks (league_id, week, matchup_id, at)`,
  );
  ready = true;
}

/** A projected-final gap of exactly zero would insert as `-0`; a scoreboard shouldn't print that. */
export function spreadFrom(homeProj: number, awayProj: number): number {
  const v = -Math.round((homeProj - awayProj) * 2) / 2;
  return Object.is(v, -0) ? 0 : v;
}

const MIN_GAP_MS = 55_000;

/** Pure throttle decision: has it been at least `MIN_GAP_MS` since the last write? */
export function shouldWrite(lastMs: number | undefined, nowMs: number): boolean {
  return lastMs === undefined || nowMs - lastMs >= MIN_GAP_MS;
}

const lastWrite = new Map<string, number>();

/**
 * Sample every matchup in `leagueId`/`week` and append a tick for each one
 * that has an away side. Throttled to once per `MIN_GAP_MS` per league+week
 * unless `force`; a no-op (not an error) outside a live window unless
 * `force`. Never throws — a missed tick is a gap in a chart, not a broken
 * page. Returns the number of rows written.
 */
export async function recordTicks(
  leagueId: string,
  week: number,
  opts?: { force?: boolean },
): Promise<number> {
  try {
    const key = `${leagueId}:${week}`;
    const now = Date.now();
    if (!opts?.force && !shouldWrite(lastWrite.get(key), now)) return 0;

    const sql = await getSql();
    const row = (
      await sql<{ season: string; current_week: number }>`
        select season, current_week from ff_leagues where id = ${leagueId}
      `
    )[0];
    if (!row) return 0;

    const { weekBoard } = await import("@/lib/data/live.server");
    const live = (await weekBoard(row.season, week, "regular")).live;
    if (!live && !opts?.force) return 0;

    const eng = await import("./engine.server");
    const pairs = await eng.loadMatchups(leagueId, week);
    const withAway = pairs.filter((p) => p.away);
    if (withAway.length === 0) return 0;

    const ids = new Set<string>();
    for (const pair of withAway) {
      for (const line of pair.home.starters) if (line.playerId) ids.add(line.playerId);
      for (const line of pair.away?.starters ?? []) if (line.playerId) ids.add(line.playerId);
    }
    const { outlooksFor } = await import("@/lib/data/projections.server");
    const outlooks = ids.size
      ? await outlooksFor({ leagueId, season: String(row.season), playerIds: Array.from(ids) })
      : {};

    await ensureTickSchema();
    let written = 0;
    for (const pair of withAway) {
      // Home-signed regardless of who reads it back.
      const sample = sampleMatchup(pair, outlooks, pair.home.rosterId);
      if (!sample) continue;
      // Belt and suspenders alongside sampleMatchup's own null-return:
      // never let a 0-0 (outlooks not loaded) row reach storage.
      if (sample.youProj === 0 && sample.themProj === 0) continue;
      const spread = spreadFrom(sample.youProj, sample.themProj);
      await sql`
        insert into ff_ticks
          (league_id, week, matchup_id, home_pts, away_pts, home_proj, away_proj, home_pct, spread)
        values (
          ${leagueId}, ${week}, ${pair.matchupId},
          ${sample.youPts}, ${sample.themPts}, ${sample.youProj}, ${sample.themProj},
          ${Math.round(sample.youPct)}, ${spread}
        )
      `;
      written += 1;
    }
    lastWrite.set(key, now);
    return written;
  } catch {
    // Deliberately silent. A missed tick is a gap in a chart, not a
    // broken add/trade/waiver the way a mechanic write would be.
    return 0;
  }
}

/** One pass over every active league's current week. Never throws. */
export async function recordTicksForAll(): Promise<number> {
  try {
    const sql = await getSql();
    const rows = await sql<{ id: string; current_week: number }>`
      select id, current_week from ff_leagues
      where locked = 0 and status not in (${"pre_draft"}, ${"drafting"})
    `;
    let total = 0;
    for (const row of rows) {
      total += await recordTicks(row.id, row.current_week);
    }
    return total;
  } catch {
    return 0;
  }
}

export type StoredTick = {
  at: string;
  homePts: number;
  awayPts: number;
  homeProj: number;
  awayProj: number;
  homePct: number;
  spread: number;
};

/** Read a matchup's ticks back, ascending by time — oldest first, the way a chart wants them. */
export async function readTicks(
  leagueId: string,
  week: number,
  matchupId: number,
  limit = 4000,
): Promise<StoredTick[]> {
  await ensureTickSchema();
  const sql = await getSql();
  const rows = await sql<{
    at: string;
    home_pts: number;
    away_pts: number;
    home_proj: number;
    away_proj: number;
    home_pct: number;
    spread: number;
  }>`
    select at, home_pts, away_pts, home_proj, away_proj, home_pct, spread
    from ff_ticks
    where league_id = ${leagueId} and week = ${week} and matchup_id = ${matchupId}
    order by at desc
    limit ${limit}
  `;
  return rows
    .map((r) => ({
      at: r.at,
      homePts: r.home_pts,
      awayPts: r.away_pts,
      homeProj: r.home_proj,
      awayProj: r.away_proj,
      homePct: r.home_pct,
      spread: r.spread,
    }))
    .reverse();
}
