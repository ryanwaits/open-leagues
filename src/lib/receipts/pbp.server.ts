import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { getSql } from "@/lib/db";
import type { TimelineEvent } from "./flip";
import { COLS, type Col, deltasFor, n, type Row, settlementFor, splitCsv, team } from "./pbp-parse";

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
/**
 * Sleeper's file carries a GSIS id for only a fraction of active players (none
 * drafted since about 2021). dynastyprocess's id table — what nflreadr ships as
 * load_ff_playerids() — maps every Sleeper id to its GSIS id, so it fills the
 * gaps. Sleeper still wins on name, team, and position, which it keeps current.
 */
const FF_PLAYERIDS_URL = "https://github.com/dynastyprocess/data/raw/master/files/db_playerids.csv";
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const CROSSWALK_AFTER_MS = 24 * 60 * 60 * 1000;
/**
 * Bump when the crosswalk's sources or the parser's stat semantics change;
 * every stored timeline re-ingests once on its next read.
 */
const INGEST_VERSION = 7;

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
  await sql.query(
    `alter table ol_pbp_log add column if not exists crosswalk int not null default 0`,
  );
  await sql.query(`create table if not exists ol_crosswalk_log (
  version int primary key,
  at timestamptz not null default now(),
  rows int not null default 0
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

type IdRow = {
  sleeper_id: string;
  gsis_id: string | null;
  espn_id: string | null;
  yahoo_id: string | null;
  rotowire_id: string | null;
  sportradar_id: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
};

function idOf(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s !== "NA" ? s : null;
}

async function crosswalkFresh(): Promise<boolean> {
  const sql = await getSql();
  const row = (
    await sql<{ at: string }>`select at from ol_crosswalk_log where version = ${INGEST_VERSION}`
  )[0];
  return row != null && Date.now() - new Date(row.at).getTime() < CROSSWALK_AFTER_MS;
}

/** Rebuild ol_player_ids from Sleeper's file plus the dynastyprocess id table. */
async function buildCrosswalk(): Promise<void> {
  const sql = await getSql();
  const [sleeperRes, ffRes] = await Promise.all([
    fetch(PLAYERS_URL, { headers: { accept: "application/json" } }),
    fetch(FF_PLAYERIDS_URL, { redirect: "follow" }),
  ]);
  if (!sleeperRes.ok) throw new Error(`Sleeper players ${sleeperRes.status}`);
  const all = (await sleeperRes.json()) as Record<string, SleeperPlayer>;

  const rows = new Map<string, IdRow>();
  for (const p of Object.values(all)) {
    if (!p.player_id) continue;
    rows.set(p.player_id, {
      sleeper_id: p.player_id,
      gsis_id: idOf(p.gsis_id),
      espn_id: idOf(p.espn_id),
      yahoo_id: idOf(p.yahoo_id),
      rotowire_id: idOf(p.rotowire_id),
      sportradar_id: idOf(p.sportradar_id),
      name: p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || null),
      team: p.team ?? null,
      position: p.position ?? null,
    });
  }

  // Fill what Sleeper leaves blank. Never overwrite a Sleeper value with one
  // from the id table; Sleeper is the authority on its own ids.
  if (ffRes.ok) {
    const text = await ffRes.text();
    const lines = text.split(/\r?\n/);
    const header = splitCsv(lines[0] ?? "");
    const col = (name: string) => header.indexOf(name);
    const c = {
      sleeper: col("sleeper_id"),
      gsis: col("gsis_id"),
      espn: col("espn_id"),
      yahoo: col("yahoo_id"),
      rotowire: col("rotowire_id"),
      sportradar: col("sportradar_id"),
      name: col("name"),
      position: col("position"),
    };
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const f = splitCsv(line);
      const sid = idOf(f[c.sleeper]);
      if (!sid) continue;
      const cur = rows.get(sid) ?? {
        sleeper_id: sid,
        gsis_id: null,
        espn_id: null,
        yahoo_id: null,
        rotowire_id: null,
        sportradar_id: null,
        name: idOf(f[c.name]),
        team: null,
        position: idOf(f[c.position]),
      };
      cur.gsis_id ??= idOf(f[c.gsis]);
      cur.espn_id ??= idOf(f[c.espn]);
      cur.yahoo_id ??= idOf(f[c.yahoo]);
      cur.rotowire_id ??= idOf(f[c.rotowire]);
      cur.sportradar_id ??= idOf(f[c.sportradar]);
      rows.set(sid, cur);
    }
  } else {
    console.warn(`[receipts] ff_playerids ${ffRes.status}; crosswalk is Sleeper-only this pass`);
  }

  const list = [...rows.values()].filter(
    (r) => r.gsis_id || r.espn_id || r.yahoo_id || r.rotowire_id || r.sportradar_id,
  );
  // Persist in chunks; this is a few thousand rows once a day at most.
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    await Promise.all(
      chunk.map(
        (p) => sql`
          insert into ol_player_ids
            (sleeper_id, gsis_id, espn_id, yahoo_id, rotowire_id, sportradar_id, name, team, position, updated_at)
          values (
            ${p.sleeper_id}, ${p.gsis_id}, ${p.espn_id}, ${p.yahoo_id}, ${p.rotowire_id},
            ${p.sportradar_id}, ${p.name}, ${p.team}, ${p.position}, now()
          )
          on conflict (sleeper_id) do update set
            gsis_id = excluded.gsis_id, espn_id = excluded.espn_id, yahoo_id = excluded.yahoo_id,
            rotowire_id = excluded.rotowire_id, sportradar_id = excluded.sportradar_id,
            name = excluded.name, team = excluded.team, position = excluded.position, updated_at = now()
        `,
      ),
    );
  }
  await sql`
    insert into ol_crosswalk_log (version, at, rows) values (${INGEST_VERSION}, now(), ${list.length})
    on conflict (version) do update set at = now(), rows = excluded.rows
  `;
}

/** gsis → sleeper, from the persisted crosswalk; rebuilt daily or on a version bump. */
async function gsisMap(): Promise<Map<string, string>> {
  await ensure();
  if (!(await crosswalkFresh())) await buildCrosswalk();
  const sql = await getSql();
  const rows = await sql<{ gsis_id: string; sleeper_id: string }>`
    select gsis_id, sleeper_id from ol_player_ids where gsis_id is not null
  `;
  return new Map(rows.map((r) => [r.gsis_id, r.sleeper_id]));
}

/** Make sure the Sleeper ↔ GSIS/ESPN/Yahoo crosswalk table is populated. */
export async function ensureCrosswalk(): Promise<void> {
  await gsisMap();
}

/* ── ingest ──────────────────────────────────────────────────────────── */

async function lastRun(season: string): Promise<{ at: number; crosswalk: number } | null> {
  const sql = await getSql();
  const row = (
    await sql<{ at: string; crosswalk: number }>`
      select at, crosswalk from ol_pbp_log where season = ${season}
    `
  )[0];
  return row ? { at: new Date(row.at).getTime(), crosswalk: row.crosswalk } : null;
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
    // A timeline built on an older crosswalk is missing players; rebuild it.
    if (
      last != null &&
      last.crosswalk === INGEST_VERSION &&
      Date.now() - last.at < REFRESH_AFTER_MS
    ) {
      return { skipped: true, games: 0 };
    }
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
    if (!g.kickoff) {
      g.kickoff = t;
      // Both defences open the game having allowed nothing, so a shutout scores
      // its top bucket from kickoff and every later delta sums from zero.
      const [, , awayAbbr, homeAbbr] = r.game_id.split("_");
      for (const abbr of [awayAbbr, homeAbbr]) {
        if (!abbr) continue;
        g.events.push({
          t,
          g: r.game_id,
          q: n(r.qtr),
          clock: r.time,
          s: n(r.game_seconds_remaining),
          p: team(abbr),
          d: { pts_allow: 0 },
        });
      }
    }

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

  await settleToBoxScore(season, games);

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
    insert into ol_pbp_log (season, at, games, crosswalk)
    values (${season}, now(), ${games.size}, ${INGEST_VERSION})
    on conflict (season) do update set
      at = now(), games = excluded.games, crosswalk = excluded.crosswalk
  `;
  return { skipped: false, games: games.size };
}

/**
 * Book the difference between the play log and Sleeper's official weekly stats
 * as one event per player at each game's final whistle. Only players who
 * appear in the game (and both DEFs) can be placed; a player the crosswalk
 * missed entirely has no game to settle into and stays a gap.
 */
async function settleToBoxScore(
  season: string,
  games: Map<string, { week: number; kickoff: string | null; events: TimelineEvent[] }>,
): Promise<void> {
  const live = await import("@/lib/data/live.server");
  const byWeek = new Map<number, string[]>();
  for (const [id, g] of games) {
    const list = byWeek.get(g.week) ?? [];
    list.push(id);
    byWeek.set(g.week, list);
  }
  for (const [week, ids] of byWeek) {
    let official: Record<string, Record<string, number>>;
    try {
      official = await live.fetchWeekStats(season, week, "regular");
    } catch {
      continue; // no box score yet; the play log stands on its own
    }
    if (!official || Object.keys(official).length === 0) continue;
    for (const id of ids) {
      const g = games.get(id);
      if (!g || g.events.length === 0) continue;
      const bags = new Map<string, Record<string, number>>();
      let last = g.events[0] as TimelineEvent;
      for (const e of g.events) {
        if (e.t > last.t) last = e;
        const bag = bags.get(e.p) ?? {};
        for (const [k, v] of Object.entries(e.d)) bag[k] = (bag[k] ?? 0) + v;
        bags.set(e.p, bag);
      }
      const [, , away, home] = id.split("_");
      for (const abbr of [away, home]) if (abbr && !bags.has(team(abbr))) bags.set(team(abbr), {});
      for (const [p, ours] of bags) {
        const d = settlementFor(ours, official[p]);
        if (Object.keys(d).length === 0) continue;
        g.events.push({
          t: last.t,
          g: id,
          q: last.q,
          clock: "0:00",
          s: 0,
          p,
          d,
          desc: "Settled on the final box score.",
          settled: true,
        });
      }
    }
  }
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
