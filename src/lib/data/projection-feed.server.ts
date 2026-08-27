import { getSql } from "@/lib/db";

/**
 * Weekly projections from Sleeper, stored as raw component stats.
 *
 * Callers score them with the league's own book — never use the canned
 * pts_ppr total, which would be wrong in any league that is not full PPR.
 */

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

/** Sleeper asks for restraint; a weekly projection does not need hourly polling. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

type SleeperProjectionRow = {
  player_id?: string;
  stats?: Record<string, number> | null;
};

let ready = false;

async function ensureSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists ol_projections (
      season text not null,
      week int not null,
      player_id text not null,
      stats_json text not null,
      updated_at timestamptz not null default now(),
      primary key (season, week, player_id))`,
  );
  await sql.query(
    `create table if not exists ol_refresh_log (
      key text primary key,
      at timestamptz not null default now(),
      note text)`,
  );
  ready = true;
}

function refreshKey(season: string, week: number): string {
  return `projections:${season}:${week}`;
}

async function lastRunAt(key: string): Promise<number | null> {
  const sql = await getSql();
  const row = (await sql<{ at: string }>`select at from ol_refresh_log where key = ${key}`)[0];
  return row ? new Date(row.at).getTime() : null;
}

/**
 * Pull one week of projections and store the raw components.
 *
 * Only rows carrying stats.pts_ppr are real projections — the rest of the
 * payload is bench players with nothing but an ADP field. Storing the
 * components rather than pts_ppr is what lets a half-PPR league see a
 * half-PPR number.
 */
export async function refreshProjections(
  season: string,
  week: number,
  opts?: { force?: boolean },
): Promise<{ skipped: boolean; stored: number }> {
  await ensureSchema();
  const sql = await getSql();
  const key = refreshKey(season, week);

  if (!opts?.force) {
    const last = await lastRunAt(key);
    if (last != null && Date.now() - last < REFRESH_AFTER_MS) {
      return { skipped: true, stored: 0 };
    }
  }

  let stored = 0;
  for (const pos of POSITIONS) {
    const url =
      `https://api.sleeper.app/projections/nfl/${season}/${week}` +
      `?season_type=regular&position[]=${pos}&order_by=ppr`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Sleeper projections ${pos} ${res.status}`);
    const rows = (await res.json()) as SleeperProjectionRow[];

    for (const row of rows) {
      if (row.stats?.pts_ppr == null) continue;
      const playerId = row.player_id;
      if (!playerId) continue;

      await sql`
        insert into ol_projections (season, week, player_id, stats_json, updated_at)
        values (${season}, ${week}, ${playerId}, ${JSON.stringify(row.stats)}, now())
        on conflict (season, week, player_id) do update set
          stats_json = excluded.stats_json,
          updated_at = now()
      `;
      stored += 1;
    }
  }

  await sql`
    insert into ol_refresh_log (key, at, note)
    values (${key}, now(), ${`${stored} stored`})
    on conflict (key) do update set at = now(), note = excluded.note
  `;

  return { skipped: false, stored };
}

/**
 * Component stats by player id for one week, empty when the feed has not run.
 *
 * Never throws — a missing feed must degrade to the season average rather
 * than breaking a page.
 */
export async function projectionsFor(
  season: string,
  week: number,
  playerIds: string[],
): Promise<Record<string, Record<string, number>>> {
  if (playerIds.length === 0) return {};
  try {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql<{ player_id: string; stats_json: string }>`
      select player_id, stats_json
      from ol_projections
      where season = ${season} and week = ${week}
        and player_id = any(${playerIds})
    `;
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.stats_json) as Record<string, number>;
        if (parsed && typeof parsed === "object") out[r.player_id] = parsed;
      } catch {
        /* skip a corrupt row */
      }
    }
    return out;
  } catch {
    return {};
  }
}
