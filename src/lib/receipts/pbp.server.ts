import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { getSql } from "@/lib/db";
import type { TimelineEvent } from "./flip";
import { COLS, type Col, deltasFor, n, type Row, splitCsv } from "./pbp-parse";

/**
 * Play-by-play, from nflverse, turned into per-game fantasy timelines.
 *
 * nflverse publishes one CSV per season (MIT, nightly). We stream it — gunzip
 * and read line by line, never holding the file — and keep only what a flip
 * needs: for each play, the stat deltas it produced for each player involved,
 * stamped with the wall clock. Player ids are translated to Sleeper's so the
 * rest of the app never sees a GSIS id; the translation table is kept too,
 * because a public crosswalk is worth publishing on its own.
 *
 * Throttled: a season is re-read at most every twelve hours. The current season
 * grows every Tuesday; past seasons never change.
 */

const PBP_URL = (season: string) =>
  `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_${season}.csv.gz`;
const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_game_timelines (
  season text not null,
  week int not null,
  game_id text primary key,
  kickoff_at timestamptz,
  events_json text not null,
  updated_at timestamptz not null default now()
)`);
  await sql.query(
    `create index if not exists ol_game_timelines_week on ol_game_timelines (season, week)`,
  );
  await sql.query(`create table if not exists ol_player_ids (
  sleeper_id text primary key,
  gsis_id text,
  espn_id text,
  yahoo_id text,
  rotowire_id text,
  sportradar_id text,
  name text,
  team text,
  position text,
  updated_at timestamptz not null default now()
)`);
  await sql.query(`create index if not exists ol_player_ids_gsis on ol_player_ids (gsis_id)`);
  await sql.query(`create table if not exists ol_pbp_log (
  season text primary key,
  at timestamptz not null default now(),
  games int not null default 0
)`);
  ready = true;
}

/* ── crosswalk ───────────────────────────────────────────────────────── */

type SleeperPlayer = {
  player_id: string;
  gsis_id?: string | null;
  espn_id?: string | number | null;
  yahoo_id?: string | number | null;
  rotowire_id?: string | number | null;
  sportradar_id?: string | null;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
  position?: string | null;
};

/** gsis → sleeper, refreshed from Sleeper's player file and persisted. */
async function gsisMap(): Promise<Map<string, string>> {
  await ensure();
  const sql = await getSql();
  const cached = await sql<{ gsis_id: string; sleeper_id: string }>`
    select gsis_id, sleeper_id from ol_player_ids where gsis_id is not null
  `;
  if (cached.length > 1000) return new Map(cached.map((r) => [r.gsis_id, r.sleeper_id]));

  const res = await fetch(PLAYERS_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper players ${res.status}`);
  const all = (await res.json()) as Record<string, SleeperPlayer>;
  const map = new Map<string, string>();
  const rows: SleeperPlayer[] = [];
  for (const p of Object.values(all)) {
    if (!p.player_id) continue;
    if (p.gsis_id) map.set(p.gsis_id, p.player_id);
    if (p.gsis_id || p.espn_id || p.yahoo_id || p.rotowire_id || p.sportradar_id) rows.push(p);
  }
  // Persist in chunks; this is a few thousand rows once a day at most.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await Promise.all(
      chunk.map(
        (p) => sql`
          insert into ol_player_ids
            (sleeper_id, gsis_id, espn_id, yahoo_id, rotowire_id, sportradar_id, name, team, position, updated_at)
          values (
            ${p.player_id}, ${p.gsis_id ?? null}, ${p.espn_id != null ? String(p.espn_id) : null},
            ${p.yahoo_id != null ? String(p.yahoo_id) : null},
            ${p.rotowire_id != null ? String(p.rotowire_id) : null}, ${p.sportradar_id ?? null},
            ${p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || null)},
            ${p.team ?? null}, ${p.position ?? null}, now()
          )
          on conflict (sleeper_id) do update set
            gsis_id = excluded.gsis_id, espn_id = excluded.espn_id, yahoo_id = excluded.yahoo_id,
            rotowire_id = excluded.rotowire_id, sportradar_id = excluded.sportradar_id,
            name = excluded.name, team = excluded.team, position = excluded.position, updated_at = now()
        `,
      ),
    );
  }
  return map;
}

/* ── ingest ──────────────────────────────────────────────────────────── */

async function lastRun(season: string): Promise<number | null> {
  const sql = await getSql();
  const row = (await sql<{ at: string }>`select at from ol_pbp_log where season = ${season}`)[0];
  return row ? new Date(row.at).getTime() : null;
}

/**
 * Stream one season of play-by-play into per-game timelines. Idempotent;
 * throttled to twelve hours; safe to call from a request path once the throttle
 * has been checked, and cheap to call otherwise.
 */
export async function ensureTimelines(
  season: string,
  opts?: { force?: boolean },
): Promise<{ skipped: boolean; games: number }> {
  await ensure();
  if (!opts?.force) {
    const last = await lastRun(season);
    if (last != null && Date.now() - last < REFRESH_AFTER_MS) return { skipped: true, games: 0 };
  }
  const gsis = await gsisMap();

  const res = await fetch(PBP_URL(season), { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`nflverse pbp ${season} ${res.status}`);
  const lines = createInterface({
    input: Readable.fromWeb(res.body as never).pipe(createGunzip()),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  let idx: Record<Col, number> | null = null;
  const games = new Map<
    string,
    { week: number; kickoff: string | null; events: TimelineEvent[] }
  >();
  let lastT: Record<string, string> = {};

  for await (const line of lines) {
    const f = splitCsv(line);
    if (!idx) {
      const header = f;
      const map = {} as Record<Col, number>;
      for (const c of COLS) map[c] = header.indexOf(c);
      idx = map;
      continue;
    }
    const r = {} as Row;
    for (const c of COLS) r[c] = idx[c] >= 0 ? (f[idx[c]] ?? "") : "";
    if (r.season_type !== "REG" || !r.game_id) continue;

    const deltas = deltasFor(r, gsis);
    if (!deltas.length) continue;

    let g = games.get(r.game_id);
    if (!g) {
      g = { week: n(r.week), kickoff: null, events: [] };
      games.set(r.game_id, g);
    }
    // Wall clock: nflverse stamps ~96% of plays; carry the last known stamp
    // forward for the rest so ordering survives.
    const t = r.time_of_day || lastT[r.game_id] || "";
    if (!t) continue;
    lastT[r.game_id] = t;
    if (!g.kickoff) g.kickoff = t;

    const scoring = r.sp === "1" || r.interception === "1" || r.fumble_lost === "1";
    for (const { p, d } of deltas) {
      g.events.push({
        t,
        g: r.game_id,
        q: n(r.qtr),
        clock: r.time || "0:00",
        s: n(r.game_seconds_remaining),
        p,
        d,
        ...(scoring && r.desc ? { desc: r.desc.slice(0, 160) } : {}),
      });
    }
  }
  lastT = {};

  const sql = await getSql();
  for (const [gameId, g] of games) {
    await sql`
      insert into ol_game_timelines (season, week, game_id, kickoff_at, events_json, updated_at)
      values (${season}, ${g.week}, ${gameId}, ${g.kickoff}, ${JSON.stringify(g.events)}, now())
      on conflict (game_id) do update set
        week = excluded.week, kickoff_at = excluded.kickoff_at,
        events_json = excluded.events_json, updated_at = now()
    `;
  }
  await sql`
    insert into ol_pbp_log (season, at, games) values (${season}, now(), ${games.size})
    on conflict (season) do update set at = now(), games = excluded.games
  `;
  return { skipped: false, games: games.size };
}

/** Every event for a week, across games. Empty when nothing has been ingested. */
export async function timelineFor(season: string, week: number): Promise<TimelineEvent[]> {
  await ensure();
  const sql = await getSql();
  const rows = await sql<{ events_json: string }>`
    select events_json from ol_game_timelines where season = ${season} and week = ${week}
  `;
  const out: TimelineEvent[] = [];
  for (const r of rows) out.push(...(JSON.parse(r.events_json) as TimelineEvent[]));
  return out;
}

/** Has this week been ingested at all? Cheap check before a heavy fetch. */
export async function hasTimeline(season: string, week: number): Promise<boolean> {
  await ensure();
  const sql = await getSql();
  const row = (
    await sql<{ n: number }>`
      select count(*)::int as n from ol_game_timelines where season = ${season} and week = ${week}
    `
  )[0];
  return (row?.n ?? 0) > 0;
}
