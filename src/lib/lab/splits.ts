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
        const t = o.bet_info?.tickets?.percent ?? null;
        const m = o.bet_info?.money?.percent ?? null;
        // Before a slate has volume the feed reports 0/0; that is "nothing yet", not a split.
        const empty = (t ?? 0) === 0 && (m ?? 0) === 0;
        out.push({
          gameId,
          season,
          week,
          market,
          side: o.side as Side,
          line: typeof o.value === "number" ? o.value : null,
          odds: typeof o.odds === "number" ? o.odds : null,
          ticketsPct: empty ? null : t,
          moneyPct: empty ? null : m,
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

/* ── live sources: the current slate only ────────────────────────────── */

const gameIdFor = (season: number, week: number, away: string, home: string) =>
  `${season}_${String(week).padStart(2, "0")}_${nflverseAbbr(away)}_${nflverseAbbr(home)}`;

type WgtSide = { bet?: number; handle?: number; am?: number; book?: string };
type WgtGame = {
  league?: string;
  round?: string;
  time?: number;
  away?: { init?: string };
  home?: { init?: string };
  ml?: { side1?: WgtSide; side2?: WgtSide };
  sp?: { line1?: number; line2?: number; side1?: WgtSide; side2?: WgtSide };
  tot?: { line?: number; over?: WgtSide; under?: WgtSide };
};

/**
 * WiseGuyTeam's sharp report: every NFL game on the board with bet% / handle%
 * per side and the book each number was read from. side1 is away, side2 home.
 * `round` carries the week; the season is the year the game is played in
 * (January games belong to the prior season).
 */
export function parseWiseGuyTeam(
  payload: { games?: WgtGame[] },
  opts: { season?: number } = {},
): SplitRow[] {
  const out: SplitRow[] = [];
  for (const g of payload.games ?? []) {
    if (g.league && g.league !== "FBP") continue;
    const week = Number(/Week (\d+)/.exec(g.round ?? "")?.[1]);
    const away = g.away?.init;
    const home = g.home?.init;
    if (!week || !away || !home) continue;
    const when = g.time ? new Date(g.time) : null;
    const season =
      opts.season ??
      (when ? (when.getUTCMonth() < 3 ? when.getUTCFullYear() - 1 : when.getUTCFullYear()) : 0);
    if (!season) continue;
    const gameId = gameIdFor(season, week, away, home);
    const push = (market: Market, side: Side, x: WgtSide | undefined, line: number | null) => {
      if (!x || (typeof x.bet !== "number" && typeof x.handle !== "number")) return;
      out.push({
        gameId,
        season,
        week,
        market,
        side,
        line,
        odds: typeof x.am === "number" ? x.am : null,
        ticketsPct: typeof x.bet === "number" ? x.bet : null,
        moneyPct: typeof x.handle === "number" ? x.handle : null,
        book: x.book ? `wiseguyteam:${x.book}` : "wiseguyteam",
      });
    };
    push("moneyline", "away", g.ml?.side1, null);
    push("moneyline", "home", g.ml?.side2, null);
    push("spread", "away", g.sp?.side1, g.sp?.line1 ?? null);
    push("spread", "home", g.sp?.side2, g.sp?.line2 ?? null);
    push("total", "over", g.tot?.over, g.tot?.line ?? null);
    push("total", "under", g.tot?.under, g.tot?.line ?? null);
  }
  return out;
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#8209;/g, " ");
const num = (t: string): number | null => {
  const v = Number(t.replace(/[−–]/g, "-").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(v) ? v : null;
};

/**
 * DraftKings Network's betting-splits page: DK's own handle and bet share,
 * server-rendered HTML, one block per game with Moneyline / Spread / Total
 * rows in the order Odds · % Handle · % Bets. Team abbreviations come from the
 * logo paths. Week is resolved by the caller (the page has kickoff dates only).
 */
export function parseDkNetwork(
  html: string,
  resolve: (away: string, home: string) => { season: number; week: number } | null,
): SplitRow[] {
  const out: SplitRow[] = [];
  const blocks = html.split('class="tb-market-wrap"');
  for (let i = 1; i < blocks.length; i++) {
    const head = blocks[i - 1] ?? "";
    const logos = [...head.matchAll(/logos\/teams\/nfl\/([A-Z]+)\.png/g)].map(
      (m) => m[1] as string,
    );
    const away = logos[logos.length - 2];
    const home = logos[logos.length - 1];
    if (!away || !home) continue;
    const at = resolve(nflverseAbbr(away), nflverseAbbr(home));
    if (!at) continue;
    const gameId = gameIdFor(at.season, at.week, away, home);
    const text = stripTags(blocks[i] ?? "").replace(/\s+/g, " ");
    const section = (name: string) => {
      const m = new RegExp(
        `${name} Odds % Handle % Bets(.*?)(?= Moneyline Odds| Spread Odds| Total Odds|$)`,
      ).exec(text);
      return m?.[1] ?? "";
    };
    const row = /([A-Za-z .]+?|Over|Under) ([+-−]?\d+(?:\.\d)?)? ?([+−-]\d{3}) (\d+)% (\d+)%/g;
    const emit = (market: Market, sideOf: (label: string, idx: number) => Side) => {
      const seg = section(
        market === "moneyline" ? "Moneyline" : market === "spread" ? "Spread" : "Total",
      );
      let idx = 0;
      for (const m of seg.matchAll(row)) {
        const [, label, lineTxt, oddsTxt, handle, bets] = m;
        out.push({
          gameId,
          season: at.season,
          week: at.week,
          market,
          side: sideOf(label ?? "", idx++),
          line: lineTxt ? num(lineTxt) : null,
          odds: num(oddsTxt ?? ""),
          ticketsPct: Number(bets),
          moneyPct: Number(handle),
          book: "draftkings",
        });
      }
    };
    const teamSide = (label: string) => (label.trim().startsWith(away) ? "away" : "home") as Side;
    emit("moneyline", teamSide);
    emit("spread", teamSide);
    emit("total", (label) => (label.trim().startsWith("Over") ? "over" : "under"));
  }
  return out;
}

/** Rows → per-book shapes for one game id. */
export function shapeByBook(rows: SplitRow[]): Map<string, Record<string, GameSplits>> {
  const out = new Map<string, Record<string, GameSplits>>();
  for (const r of rows) {
    const g = out.get(r.gameId) ?? {};
    const book = r.book.split(":")[0] as string;
    const b = g[book] ?? {};
    const m = b[r.market] ?? {};
    m[r.side] = { tickets: r.ticketsPct, money: r.moneyPct };
    b[r.market] = m;
    g[book] = b;
    out.set(r.gameId, g);
  }
  return out;
}
