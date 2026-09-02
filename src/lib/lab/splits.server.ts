import { getSql } from "@/lib/db";
import {
  type GameSplits,
  parseActionNetwork,
  parseDkNetwork,
  parseWiseGuyTeam,
  type SplitRow,
  shapeByBook,
  shapeSplits,
} from "./splits";

/**
 * Public betting splits, stored per game and market. Opt-in: the only free
 * source is Action Network's undocumented web endpoint, so a box has to say
 * it wants it with OPENLEAGUES_SPLITS_SOURCE=actionnetwork. Every response is
 * kept — a settled week never needs to be fetched twice, and if the source
 * ever closes, what was pulled stays.
 *
 * History reaches back to the 2023 season; earlier weeks return no book.
 */
const AN_URL = (season: number, week: number) =>
  `https://api.actionnetwork.com/web/v2/scoreboard/nfl?bookIds=15&period=game&season=${season}&week=${week}`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const CURRENT_TTL_MS = 60 * 60 * 1000;
export const SPLITS_FIRST_SEASON = 2023;

/**
 * Sources, comma-separated in OPENLEAGUES_SPLITS_SOURCE:
 *   actionnetwork — consensus, the only one with history (2023 season on)
 *   dknetwork     — DraftKings' own handle and bet share, current slate only
 *   wiseguyteam   — multi-book aggregate with the book named, current slate only
 */
export type SplitsSource = "actionnetwork" | "dknetwork" | "wiseguyteam" | "off";
const KNOWN = new Set<SplitsSource>(["actionnetwork", "dknetwork", "wiseguyteam"]);

export function splitsSources(): Exclude<SplitsSource, "off">[] {
  const raw = (process.env.OPENLEAGUES_SPLITS_SOURCE ?? "").trim().toLowerCase();
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is Exclude<SplitsSource, "off"> => KNOWN.has(x as SplitsSource));
}

/** The historical source, or "off". Kept for callers that report one status word. */
export function splitsSource(): SplitsSource {
  const all = splitsSources();
  return all.includes("actionnetwork") ? "actionnetwork" : (all[0] ?? "off");
}

const DKN_URL = "https://dknetwork.draftkings.com/draftkings-sportsbook-betting-splits/?tb_eg=NFL";
const WGT_URL = "https://inngest-worker.memberservice.workers.dev/sharp-report?sport=nfl";
const LIVE_TTL_MS = 60 * 60 * 1000;

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_game_splits (
  game_id text not null,
  season int not null,
  week int not null,
  market text not null,
  side text not null,
  line real,
  odds int,
  tickets_pct real,
  money_pct real,
  book text not null,
  fetched_at timestamptz not null default now(),
  primary key (game_id, market, side, book)
)`);
  await sql.query(
    `create index if not exists ol_game_splits_week on ol_game_splits (season, week)`,
  );
  await sql.query(`create table if not exists ol_game_splits_log (
  season int not null,
  week int not null,
  at timestamptz not null default now(),
  rows int not null default 0,
  primary key (season, week)
)`);
  await sql.query(`create table if not exists ol_live_splits_log (
  source text primary key,
  at timestamptz not null default now(),
  rows int not null default 0
)`);
  ready = true;
}

function isSettledWeek(season: number, week: number): boolean {
  // A week is settled once its Monday night is behind us; approximate by season.
  const now = new Date();
  const seasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  if (season < seasonYear) return true;
  if (season > seasonYear) return false;
  // Current season: weeks well behind the calendar are settled. Week 1 ≈ second
  // Thursday of September; each week adds seven days.
  const kickoff = new Date(Date.UTC(season, 8, 4));
  const weekEnd = new Date(kickoff.getTime() + (week + 0.5) * 7 * 86_400_000);
  return now > weekEnd;
}

/** Fetch and store one week's splits. No-op when the source is off or the week is kept. */
export async function ensureSplits(
  season: number,
  week: number,
): Promise<{ skipped: boolean; rows: number; source: SplitsSource }> {
  const source = splitsSource();
  if (!splitsSources().includes("actionnetwork") || season < SPLITS_FIRST_SEASON)
    return { skipped: true, rows: 0, source };
  await ensure();
  const sql = await getSql();
  const log = (
    await sql<{ at: string; rows: number }>`
      select at, rows from ol_game_splits_log where season = ${season} and week = ${week}
    `
  )[0];
  if (log) {
    const age = Date.now() - new Date(log.at).getTime();
    if (log.rows > 0 && (isSettledWeek(season, week) || age < CURRENT_TTL_MS)) {
      return { skipped: true, rows: log.rows, source };
    }
  }
  const res = await fetch(AN_URL(season, week), {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`splits ${season} w${week}: ${res.status}`);
  const rows = parseActionNetwork((await res.json()) as Parameters<typeof parseActionNetwork>[0], {
    season,
    week,
  });
  for (let i = 0; i < rows.length; i += 100) {
    await Promise.all(
      rows.slice(i, i + 100).map(
        (r: SplitRow) => sql`
          insert into ol_game_splits (game_id, season, week, market, side, line, odds, tickets_pct, money_pct, book, fetched_at)
          values (${r.gameId}, ${r.season}, ${r.week}, ${r.market}, ${r.side}, ${r.line}, ${r.odds},
                  ${r.ticketsPct}, ${r.moneyPct}, ${r.book}, now())
          on conflict (game_id, market, side, book) do update set
            line = excluded.line, odds = excluded.odds, tickets_pct = excluded.tickets_pct,
            money_pct = excluded.money_pct, fetched_at = now()
        `,
      ),
    );
  }
  await sql`
    insert into ol_game_splits_log (season, week, at, rows) values (${season}, ${week}, now(), ${rows.length})
    on conflict (season, week) do update set at = now(), rows = excluded.rows
  `;
  return { skipped: false, rows: rows.length, source };
}

/** Every stored week of a season, fetched first where missing. Sequential; ≤18 calls. */
export async function ensureSeasonSplits(season: number): Promise<void> {
  await ensureLiveSplits().catch(() => undefined);
  if (!splitsSources().includes("actionnetwork") || season < SPLITS_FIRST_SEASON) return;
  for (let w = 1; w <= 18; w++) {
    try {
      await ensureSplits(season, w);
    } catch {
      /* a missing week is a gap, not a failure */
    }
  }
}

/** Splits for a set of seasons, shaped per game id, from what is stored. */
export async function splitsFor(
  seasons: number[],
  week?: number,
): Promise<Map<string, GameSplits>> {
  await ensure();
  const sql = await getSql();
  const rows =
    week != null
      ? await sql<SplitRow & Record<string, unknown>>`
          select game_id as "gameId", season, week, market, side, line, odds,
                 tickets_pct as "ticketsPct", money_pct as "moneyPct", book
          from ol_game_splits where season = any(${seasons}) and week = ${week}
            and book = 'actionnetwork:consensus'
        `
      : await sql<SplitRow & Record<string, unknown>>`
          select game_id as "gameId", season, week, market, side, line, odds,
                 tickets_pct as "ticketsPct", money_pct as "moneyPct", book
          from ol_game_splits where season = any(${seasons}) and book = 'actionnetwork:consensus'
        `;
  return shapeSplits(rows);
}

async function upsertRows(rows: SplitRow[]): Promise<void> {
  const sql = await getSql();
  for (let i = 0; i < rows.length; i += 100) {
    await Promise.all(
      rows.slice(i, i + 100).map(
        (r) => sql`
          insert into ol_game_splits (game_id, season, week, market, side, line, odds, tickets_pct, money_pct, book, fetched_at)
          values (${r.gameId}, ${r.season}, ${r.week}, ${r.market}, ${r.side}, ${r.line}, ${r.odds},
                  ${r.ticketsPct}, ${r.moneyPct}, ${r.book}, now())
          on conflict (game_id, market, side, book) do update set
            line = excluded.line, odds = excluded.odds, tickets_pct = excluded.tickets_pct,
            money_pct = excluded.money_pct, fetched_at = now()
        `,
      ),
    );
  }
}

/** The nearest unplayed game between two teams this season, from the lines table. */
async function resolveGame(
  away: string,
  home: string,
): Promise<{ season: number; week: number } | null> {
  const sql = await getSql();
  const row = (
    await sql<{ season: number; week: number }>`
      select season, week from ol_game_lines
      where away = ${away} and home = ${home} and home_score is null and game_type = 'REG'
      order by season, week limit 1
    `
  )[0];
  return row ?? null;
}

/**
 * Pull the live sources for the current slate. Each keeps its rows under its
 * own book, so a week can carry DraftKings' numbers beside the consensus.
 * Refreshed hourly; a source that is down is skipped, not fatal.
 */
export async function ensureLiveSplits(): Promise<Record<string, number>> {
  const wanted = splitsSources().filter((s) => s !== "actionnetwork");
  const out: Record<string, number> = {};
  if (wanted.length === 0) return out;
  await ensure();
  const sql = await getSql();
  const { ensureGameLines } = await import("./lines.server");
  await ensureGameLines().catch(() => undefined);
  for (const source of wanted) {
    const log = (
      await sql<{
        at: string;
        rows: number;
      }>`select at, rows from ol_live_splits_log where source = ${source}`
    )[0];
    if (log && Date.now() - new Date(log.at).getTime() < LIVE_TTL_MS) {
      out[source] = log.rows;
      continue;
    }
    let rows: SplitRow[] = [];
    try {
      if (source === "wiseguyteam") {
        const res = await fetch(WGT_URL, {
          headers: { "user-agent": UA, accept: "application/json" },
        });
        if (res.ok)
          rows = parseWiseGuyTeam((await res.json()) as Parameters<typeof parseWiseGuyTeam>[0]);
      } else if (source === "dknetwork") {
        const res = await fetch(DKN_URL, { headers: { "user-agent": UA, accept: "text/html" } });
        if (res.ok) {
          const html = await res.text();
          // Resolve each game against the lines table; async, so collect first.
          const pairs = new Map<string, { season: number; week: number } | null>();
          for (const m of html.matchAll(
            /logos\/teams\/nfl\/([A-Z]+)\.png[\s\S]{0,600}?logos\/teams\/nfl\/([A-Z]+)\.png/g,
          )) {
            const { nflverseAbbr } = await import("./splits");
            const key = `${nflverseAbbr(m[1] as string)}_${nflverseAbbr(m[2] as string)}`;
            if (!pairs.has(key))
              pairs.set(
                key,
                await resolveGame(nflverseAbbr(m[1] as string), nflverseAbbr(m[2] as string)),
              );
          }
          rows = parseDkNetwork(html, (away, home) => pairs.get(`${away}_${home}`) ?? null);
        }
      }
    } catch {
      rows = [];
    }
    if (rows.length) await upsertRows(rows);
    await sql`
      insert into ol_live_splits_log (source, at, rows) values (${source}, now(), ${rows.length})
      on conflict (source) do update set at = now(), rows = excluded.rows
    `;
    out[source] = rows.length;
  }
  return out;
}

/** Per-book splits for a set of seasons (optionally one week), from what is stored. */
export async function splitsByBookFor(
  seasons: number[],
  week?: number,
): Promise<Map<string, Record<string, GameSplits>>> {
  await ensure();
  const sql = await getSql();
  const rows =
    week != null
      ? await sql<SplitRow & Record<string, unknown>>`
          select game_id as "gameId", season, week, market, side, line, odds,
                 tickets_pct as "ticketsPct", money_pct as "moneyPct", book
          from ol_game_splits where season = any(${seasons}) and week = ${week}
        `
      : await sql<SplitRow & Record<string, unknown>>`
          select game_id as "gameId", season, week, market, side, line, odds,
                 tickets_pct as "ticketsPct", money_pct as "moneyPct", book
          from ol_game_splits where season = any(${seasons})
        `;
  return shapeByBook(rows);
}
