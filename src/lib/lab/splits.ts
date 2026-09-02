/**
 * Public betting splits — the share of tickets and of money on each side of a
 * market — parsed from Action Network's scoreboard payload into rows keyed by
 * nflverse game id. Pure: hand it the JSON, get rows. The server module fetches
 * and stores; this file is the part a test can pin down.
 *
 * Action Network's "Consensus" book (id 15) is their aggregate across tracked
 * books, not one sportsbook's ledger; the numbers are percentages only.
 */
import type { GameSplits, Market, Side } from "./bets";

export type SplitRow = {
  gameId: string;
  season: number;
  week: number;
  market: Market;
  side: Side;
  /** The number at the time of the read (spread is side-signed here, as the source gives it). */
  line: number | null;
  odds: number | null;
  ticketsPct: number | null;
  moneyPct: number | null;
  book: string;
};

export type { GameSplits };

/** Action Network abbreviations → nflverse's. */
const ALIAS: Record<string, string> = { LAR: "LA", WSH: "WAS", JAC: "JAX", OAK: "LV", SD: "LAC" };
export const nflverseAbbr = (abbr: string): string => ALIAS[abbr] ?? abbr;

type AnOutcome = {
  type?: string;
  side?: string;
  value?: number | null;
  odds?: number | null;
  bet_info?: {
    tickets?: { percent?: number | null } | null;
    money?: { percent?: number | null } | null;
  } | null;
};
type AnGame = {
  season?: number;
  week?: number;
  home_team_id?: number;
  away_team_id?: number;
  teams?: { id: number; abbr: string }[];
  markets?: Record<string, { event?: Record<string, AnOutcome[]> }>;
};

const MARKETS: Market[] = ["spread", "total", "moneyline"];
const SIDES = new Set<string>(["home", "away", "over", "under"]);

/** Parse one scoreboard response. Games without a splits book are skipped. */
export function parseActionNetwork(
  payload: { games?: AnGame[] },
  opts: { bookId?: string; season: number; week: number } = { season: 0, week: 0 },
): SplitRow[] {
  const bookId = opts.bookId ?? "15";
  const out: SplitRow[] = [];
  for (const g of payload.games ?? []) {
    const home = g.teams?.find((t) => t.id === g.home_team_id)?.abbr;
    const away = g.teams?.find((t) => t.id === g.away_team_id)?.abbr;
    const season = g.season ?? opts.season;
    const week = g.week ?? opts.week;
    if (!home || !away || !season || !week) continue;
    const gameId = `${season}_${String(week).padStart(2, "0")}_${nflverseAbbr(away)}_${nflverseAbbr(home)}`;
    const event = g.markets?.[bookId]?.event;
    if (!event) continue;
    for (const market of MARKETS) {
      for (const o of event[market] ?? []) {
        if (!o.side || !SIDES.has(o.side)) continue;
        out.push({
          gameId,
          season,
          week,
          market,
          side: o.side as Side,
          line: typeof o.value === "number" ? o.value : null,
          odds: typeof o.odds === "number" ? o.odds : null,
          ticketsPct: o.bet_info?.tickets?.percent ?? null,
          moneyPct: o.bet_info?.money?.percent ?? null,
          book: "actionnetwork:consensus",
        });
      }
    }
  }
  return out;
}

/** Rows → per-game shape. */
export function shapeSplits(rows: SplitRow[]): Map<string, GameSplits> {
  const out = new Map<string, GameSplits>();
  for (const r of rows) {
    const g = out.get(r.gameId) ?? {};
    const m = g[r.market] ?? {};
    m[r.side] = { tickets: r.ticketsPct, money: r.moneyPct };
    g[r.market] = m;
    out.set(r.gameId, g);
  }
  return out;
}
