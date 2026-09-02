import { getSql } from "@/lib/db";
import { splitCsv } from "@/lib/receipts/pbp-parse";
import type { GameLine } from "./bets";

/**
 * The historical lines feed: every NFL game since 1999 with the closing
 * spread, total, moneylines, prices, result, and the context a strategy might
 * key on — from nflverse's games table (Lee Sharpe's nfldata). Free, weekly,
 * closing lines only; open lines and movement come from the live sources.
 *
 * Read once into a table, refreshed every six hours so the current week's
 * results land the morning after.
 */
const GAMES_URL = "https://github.com/nflverse/nfldata/raw/master/data/games.csv";
const REFRESH_MS = 6 * 60 * 60 * 1000;

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_game_lines (
  game_id text primary key,
  season int not null,
  week int not null,
  game_type text not null,
  home text not null,
  away text not null,
  spread real,
  total real,
  home_ml int,
  away_ml int,
  home_spread_odds int,
  away_spread_odds int,
  over_odds int,
  under_odds int,
  home_score int,
  away_score int,
  div_game boolean not null default false,
  roof text,
  surface text,
  home_rest int,
  away_rest int,
  weekday text,
  gameday text,
  gametime text,
  home_qb text,
  away_qb text,
  referee text
)`);
  await sql.query(
    `create index if not exists ol_game_lines_season on ol_game_lines (season, week)`,
  );
  await sql.query(`create table if not exists ol_game_lines_log (
  id int primary key default 1,
  at timestamptz not null default now(),
  rows int not null default 0
)`);
  ready = true;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v === "" || v === "NA") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const txt = (v: string | undefined): string | null => (v && v !== "NA" ? v : null);

/** Pull nflverse games.csv and upsert every REG/POST row. Throttled. */
export async function ensureGameLines(opts?: {
  force?: boolean;
}): Promise<{ skipped: boolean; rows: number }> {
  await ensure();
  const sql = await getSql();
  const log = (
    await sql<{ at: string; rows: number }>`select at, rows from ol_game_lines_log where id = 1`
  )[0];
  if (!opts?.force && log && Date.now() - new Date(log.at).getTime() < REFRESH_MS) {
    return { skipped: true, rows: log.rows };
  }
  const res = await fetch(GAMES_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`nflverse games ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsv(lines[0] ?? "");
  const col = (name: string) => header.indexOf(name);
  const c = {
    game_id: col("game_id"),
    season: col("season"),
    game_type: col("game_type"),
    week: col("week"),
    gameday: col("gameday"),
    weekday: col("weekday"),
    gametime: col("gametime"),
    away_team: col("away_team"),
    away_score: col("away_score"),
    home_team: col("home_team"),
    home_score: col("home_score"),
    away_rest: col("away_rest"),
    home_rest: col("home_rest"),
    away_moneyline: col("away_moneyline"),
    home_moneyline: col("home_moneyline"),
    spread_line: col("spread_line"),
    away_spread_odds: col("away_spread_odds"),
    home_spread_odds: col("home_spread_odds"),
    total_line: col("total_line"),
    under_odds: col("under_odds"),
    over_odds: col("over_odds"),
    div_game: col("div_game"),
    roof: col("roof"),
    surface: col("surface"),
    away_qb_name: col("away_qb_name"),
    home_qb_name: col("home_qb_name"),
    referee: col("referee"),
  };
  let rows = 0;
  const batch: string[][] = [];
  const flush = async () => {
    await Promise.all(
      batch.map(
        (f) => sql`
          insert into ol_game_lines
            (game_id, season, week, game_type, home, away, spread, total, home_ml, away_ml,
             home_spread_odds, away_spread_odds, over_odds, under_odds, home_score, away_score,
             div_game, roof, surface, home_rest, away_rest, weekday, gameday, gametime, home_qb, away_qb, referee)
          values (
            ${f[c.game_id]}, ${num(f[c.season])}, ${num(f[c.week])}, ${f[c.game_type]},
            ${f[c.home_team]}, ${f[c.away_team]}, ${num(f[c.spread_line])}, ${num(f[c.total_line])},
            ${num(f[c.home_moneyline])}, ${num(f[c.away_moneyline])},
            ${num(f[c.home_spread_odds])}, ${num(f[c.away_spread_odds])},
            ${num(f[c.over_odds])}, ${num(f[c.under_odds])},
            ${num(f[c.home_score])}, ${num(f[c.away_score])},
            ${f[c.div_game] === "1"}, ${txt(f[c.roof])}, ${txt(f[c.surface])},
            ${num(f[c.home_rest])}, ${num(f[c.away_rest])}, ${txt(f[c.weekday])},
            ${txt(f[c.gameday])}, ${txt(f[c.gametime])}, ${txt(f[c.home_qb_name])},
            ${txt(f[c.away_qb_name])}, ${txt(f[c.referee])}
          )
          on conflict (game_id) do update set
            spread = excluded.spread, total = excluded.total, home_ml = excluded.home_ml,
            away_ml = excluded.away_ml, home_spread_odds = excluded.home_spread_odds,
            away_spread_odds = excluded.away_spread_odds, over_odds = excluded.over_odds,
            under_odds = excluded.under_odds, home_score = excluded.home_score,
            away_score = excluded.away_score, home_rest = excluded.home_rest,
            away_rest = excluded.away_rest, weekday = excluded.weekday, gameday = excluded.gameday,
            gametime = excluded.gametime, home_qb = excluded.home_qb, away_qb = excluded.away_qb,
            referee = excluded.referee, roof = excluded.roof, surface = excluded.surface
        `,
      ),
    );
    batch.length = 0;
  };
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsv(lines[i] ?? "");
    if (!f[c.game_id] || !f[c.season]) continue;
    batch.push(f);
    rows += 1;
    if (batch.length >= 200) await flush();
  }
  if (batch.length) await flush();
  await sql`
    insert into ol_game_lines_log (id, at, rows) values (1, now(), ${rows})
    on conflict (id) do update set at = now(), rows = excluded.rows
  `;
  return { skipped: false, rows };
}

type Row = {
  game_id: string;
  season: number;
  week: number;
  game_type: string;
  home: string;
  away: string;
  spread: number | null;
  total: number | null;
  home_ml: number | null;
  away_ml: number | null;
  home_spread_odds: number | null;
  away_spread_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  home_score: number | null;
  away_score: number | null;
  div_game: boolean;
  roof: string | null;
  surface: string | null;
  home_rest: number | null;
  away_rest: number | null;
  weekday: string | null;
  gameday: string | null;
  gametime: string | null;
  home_qb: string | null;
  away_qb: string | null;
  referee: string | null;
};

function toLine(r: Row): GameLine & { gameType: string } {
  const played = r.home_score !== null && r.away_score !== null;
  return {
    gameId: r.game_id,
    gameType: r.game_type,
    season: r.season,
    week: r.week,
    home: r.home,
    away: r.away,
    spread: r.spread,
    total: r.total,
    homeMoneyline: r.home_ml,
    awayMoneyline: r.away_ml,
    homeSpreadOdds: r.home_spread_odds,
    awaySpreadOdds: r.away_spread_odds,
    overOdds: r.over_odds,
    underOdds: r.under_odds,
    result: played ? (r.home_score as number) - (r.away_score as number) : null,
    points: played ? (r.home_score as number) + (r.away_score as number) : null,
    homeScore: r.home_score,
    awayScore: r.away_score,
    divGame: r.div_game,
    roof: r.roof,
    surface: r.surface,
    homeRest: r.home_rest,
    awayRest: r.away_rest,
    weekday: r.weekday,
    gameday: r.gameday,
    gametime: r.gametime,
    homeQb: r.home_qb,
    awayQb: r.away_qb,
    referee: r.referee,
  };
}

/** Lines for a season (all weeks) or one week. Regular season by default. */
export async function gameLines(input: {
  season: number;
  week?: number;
  postseason?: boolean;
}): Promise<(GameLine & { gameType: string })[]> {
  await ensureGameLines().catch(() => undefined);
  const sql = await getSql();
  const rows =
    input.week != null
      ? await sql<Row>`select * from ol_game_lines where season = ${input.season} and week = ${input.week} order by gameday, gametime`
      : await sql<Row>`select * from ol_game_lines where season = ${input.season} order by week, gameday, gametime`;
  return rows.filter((r) => input.postseason || r.game_type === "REG").map(toLine);
}

/** Lines across a span of seasons, for backtests. */
export async function gameLinesRange(
  seasons: number[],
): Promise<(GameLine & { gameType: string })[]> {
  await ensureGameLines().catch(() => undefined);
  const sql = await getSql();
  const rows = await sql<Row>`
    select * from ol_game_lines where season = any(${seasons}) and game_type = 'REG'
    order by season, week, gameday, gametime
  `;
  return rows.map(toLine);
}

/** One game with its context, by nflverse game id. */
export async function gameLine(gameId: string): Promise<(GameLine & { gameType: string }) | null> {
  await ensureGameLines().catch(() => undefined);
  const sql = await getSql();
  const row = (await sql<Row>`select * from ol_game_lines where game_id = ${gameId}`)[0];
  return row ? toLine(row) : null;
}
