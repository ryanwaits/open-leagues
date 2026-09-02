import { getSql } from "@/lib/db";
import { type GameSplits, parseActionNetwork, type SplitRow, shapeSplits } from "./splits";

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

export type SplitsSource = "actionnetwork" | "off";

export function splitsSource(): SplitsSource {
  const raw = (process.env.OPENLEAGUES_SPLITS_SOURCE ?? "").trim().toLowerCase();
  return raw === "actionnetwork" ? "actionnetwork" : "off";
}

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
  if (source === "off" || season < SPLITS_FIRST_SEASON) return { skipped: true, rows: 0, source };
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
  if (splitsSource() === "off" || season < SPLITS_FIRST_SEASON) return;
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
        `
      : await sql<SplitRow & Record<string, unknown>>`
          select game_id as "gameId", season, week, market, side, line, odds,
                 tickets_pct as "ticketsPct", money_pct as "moneyPct", book
          from ol_game_splits where season = any(${seasons})
        `;
  return shapeSplits(rows);
}
