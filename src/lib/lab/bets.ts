/**
 * The lab's arithmetic. Pure: hand it games with lines and results, and bets
 * against them, and it settles, grades, and summarizes. No opinions live here —
 * which games to bet and which side is the agent's job. This is the part an
 * agent cannot do reliably in prose: grading four hundred bets without an
 * arithmetic slip.
 *
 * Sign conventions follow nflverse: `spread` is the home team's line, positive
 * when the home team is favored; `result` is home score minus away score.
 * American odds; a missing price is treated as -110.
 */

export type Market = "spread" | "total" | "moneyline";
export type Side = "home" | "away" | "over" | "under";

/** Public betting splits on a game, when a box has opted into a source. */
export type GameSplits = Partial<
  Record<Market, Partial<Record<Side, { tickets: number | null; money: number | null }>>>
>;

export type GameLine = {
  gameId: string;
  season: number;
  week: number;
  home: string;
  away: string;
  /** Home team's spread; +3 means home favored by 3. Null when unlined. */
  spread: number | null;
  total: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  homeSpreadOdds: number | null;
  awaySpreadOdds: number | null;
  overOdds: number | null;
  underOdds: number | null;
  /** home − away; null until played. */
  result: number | null;
  /** home + away; null until played. */
  points: number | null;
  homeScore: number | null;
  awayScore: number | null;
  divGame: boolean;
  roof: string | null;
  surface: string | null;
  homeRest: number | null;
  awayRest: number | null;
  weekday: string | null;
  gameday: string | null;
  gametime: string | null;
  homeQb: string | null;
  awayQb: string | null;
  referee: string | null;
  /** Ticket and money percentages by market and side; absent when no source is on. */
  splits?: GameSplits;
};

export type Bet = {
  gameId: string;
  market: Market;
  side: Side;
  /** The number taken: the spread (home-signed) or the total. Ignored for moneyline. */
  line?: number | null;
  /** American odds taken. Defaults to the game's price for that side, else -110. */
  odds?: number | null;
  /** Units risked. Default 1. */
  stake?: number;
  /** Free text the agent attaches — the rule that produced this bet. */
  note?: string;
};

export type Grade = "win" | "loss" | "push" | "void";

export type GradedBet = Bet & {
  grade: Grade;
  /** Units won or lost, stake included on a loss. */
  units: number;
  oddsUsed: number;
  lineUsed: number | null;
  /** Closing-line value: points of line gained against the close (spread/total) or
   *  implied-probability edge against the closing price (moneyline). Null when unknown. */
  clv: number | null;
  season: number;
  week: number;
};

export type Summary = {
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  staked: number;
  units: number;
  /** units / staked. */
  roi: number;
  /** Win rate excluding pushes and voids. */
  winRate: number;
  /** Break-even win rate at the average odds taken. */
  breakEven: number;
  maxDrawdown: number;
  longestWin: number;
  longestLoss: number;
  avgClv: number | null;
  bySeason: Record<string, { bets: number; units: number; roi: number }>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** American odds → profit per unit staked. */
export function profitPerUnit(odds: number): number {
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
}

/** American odds → implied win probability (with the vig left in). */
export function impliedProbability(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

function priceFor(g: GameLine, b: Bet): number {
  if (typeof b.odds === "number") return b.odds;
  const p =
    b.market === "moneyline"
      ? b.side === "home"
        ? g.homeMoneyline
        : g.awayMoneyline
      : b.market === "spread"
        ? b.side === "home"
          ? g.homeSpreadOdds
          : g.awaySpreadOdds
        : b.side === "over"
          ? g.overOdds
          : g.underOdds;
  return typeof p === "number" ? p : -110;
}

/** Grade one bet against a played game. `void` when the game or the line is missing. */
export function gradeBet(g: GameLine | undefined, b: Bet): GradedBet {
  const stake = b.stake ?? 1;
  const base = {
    ...b,
    stake,
    season: g?.season ?? 0,
    week: g?.week ?? 0,
    oddsUsed: g ? priceFor(g, b) : -110,
    lineUsed: null as number | null,
    clv: null as number | null,
  };
  if (!g || g.result === null || g.points === null) return { ...base, grade: "void", units: 0 };

  let margin: number; // positive = the bet's side covered
  let lineUsed: number | null = null;
  let clv: number | null = null;

  if (b.market === "moneyline") {
    margin = b.side === "home" ? g.result : -g.result;
    const close = b.side === "home" ? g.homeMoneyline : g.awayMoneyline;
    if (typeof close === "number")
      clv = r2(impliedProbability(close) - impliedProbability(base.oddsUsed));
  } else if (b.market === "spread") {
    lineUsed = typeof b.line === "number" ? b.line : g.spread;
    if (lineUsed === null) return { ...base, grade: "void", units: 0 };
    // home covers when result > homeSpread… nflverse: spread_line is what home
    // is favored by, so home covers when result > spread_line.
    margin = b.side === "home" ? g.result - lineUsed : lineUsed - g.result;
    if (g.spread !== null) clv = r2(b.side === "home" ? g.spread - lineUsed : lineUsed - g.spread);
  } else {
    lineUsed = typeof b.line === "number" ? b.line : g.total;
    if (lineUsed === null) return { ...base, grade: "void", units: 0 };
    margin = b.side === "over" ? g.points - lineUsed : lineUsed - g.points;
    if (g.total !== null) clv = r2(b.side === "over" ? g.total - lineUsed : lineUsed - g.total);
  }

  if (margin === 0) return { ...base, lineUsed, clv, grade: "push", units: 0 };
  if (margin > 0) {
    return {
      ...base,
      lineUsed,
      clv,
      grade: "win",
      units: r2(stake * profitPerUnit(base.oddsUsed)),
    };
  }
  return { ...base, lineUsed, clv, grade: "loss", units: r2(-stake) };
}

/** Grade a list of bets against a list of games. Order is preserved. */
export function evaluateBets(games: GameLine[], bets: Bet[]): GradedBet[] {
  const byId = new Map(games.map((g) => [g.gameId, g]));
  return bets.map((b) => gradeBet(byId.get(b.gameId), b));
}

/** Record, ROI, drawdown, streaks, and per-season splits for a graded run. */
export function summarize(graded: GradedBet[]): Summary {
  const s: Summary = {
    bets: graded.length,
    wins: 0,
    losses: 0,
    pushes: 0,
    voids: 0,
    staked: 0,
    units: 0,
    roi: 0,
    winRate: 0,
    breakEven: 0,
    maxDrawdown: 0,
    longestWin: 0,
    longestLoss: 0,
    avgClv: null,
    bySeason: {},
  };
  let bank = 0;
  let peak = 0;
  let winRun = 0;
  let lossRun = 0;
  let clvSum = 0;
  let clvN = 0;
  let beSum = 0;
  let beN = 0;
  const stakedBySeason = new Map<string, number>();
  const ordered = [...graded].sort((a, b) => a.season - b.season || a.week - b.week);
  for (const g of ordered) {
    if (g.grade === "void") {
      s.voids += 1;
      continue;
    }
    const stake = g.stake ?? 1;
    s.staked += stake;
    s.units = r2(s.units + g.units);
    beSum += impliedProbability(g.oddsUsed);
    beN += 1;
    if (g.clv !== null) {
      clvSum += g.clv;
      clvN += 1;
    }
    const season = String(g.season);
    const row = s.bySeason[season] ?? { bets: 0, units: 0, roi: 0 };
    s.bySeason[season] = row;
    row.bets += 1;
    row.units = r2(row.units + g.units);
    stakedBySeason.set(season, (stakedBySeason.get(season) ?? 0) + stake);
    if (g.grade === "win") {
      s.wins += 1;
      winRun += 1;
      lossRun = 0;
    } else if (g.grade === "loss") {
      s.losses += 1;
      lossRun += 1;
      winRun = 0;
    } else {
      s.pushes += 1;
    }
    s.longestWin = Math.max(s.longestWin, winRun);
    s.longestLoss = Math.max(s.longestLoss, lossRun);
    bank += g.units;
    peak = Math.max(peak, bank);
    s.maxDrawdown = r2(Math.max(s.maxDrawdown, peak - bank));
  }
  const decided = s.wins + s.losses;
  s.roi = s.staked > 0 ? r2(s.units / s.staked) : 0;
  s.winRate = decided > 0 ? r2(s.wins / decided) : 0;
  s.breakEven = beN > 0 ? r2(beSum / beN) : 0;
  s.avgClv = clvN > 0 ? r2(clvSum / clvN) : null;
  for (const [season, row] of Object.entries(s.bySeason)) {
    const staked = stakedBySeason.get(season) ?? 0;
    row.roi = staked > 0 ? r2(row.units / staked) : 0;
  }
  return s;
}

/* ── cohorts ─────────────────────────────────────────────────────────── */

export type GameFilter = {
  seasons?: number[];
  weeks?: number[];
  /** Home team is the underdog (spread < 0). */
  homeDog?: boolean;
  /** Home team is favored (spread > 0). */
  homeFavorite?: boolean;
  /** Absolute spread within [min, max]. */
  spreadAbs?: [number, number];
  total?: [number, number];
  divGame?: boolean;
  roof?: string[];
  surface?: string[];
  weekday?: string[];
  /** Home rest minus away rest, within [min, max]. */
  restEdge?: [number, number];
  teams?: string[];
  played?: boolean;
  /** Public-betting conditions, e.g. home side of the spread holding over 50% of tickets. */
  splits?: { market: Market; side: Side; tickets?: [number, number]; money?: [number, number] }[];
};

const inRange = (v: number | null, r?: [number, number]) =>
  !r || (v !== null && v >= r[0] && v <= r[1]);

/** The cohort query: agents describe the shape of the games, code finds them. */
export function sampleGames(games: GameLine[], f: GameFilter = {}): GameLine[] {
  return games.filter((g) => {
    if (f.seasons && !f.seasons.includes(g.season)) return false;
    if (f.weeks && !f.weeks.includes(g.week)) return false;
    if (f.homeDog && !(g.spread !== null && g.spread < 0)) return false;
    if (f.homeFavorite && !(g.spread !== null && g.spread > 0)) return false;
    if (!inRange(g.spread === null ? null : Math.abs(g.spread), f.spreadAbs)) return false;
    if (!inRange(g.total, f.total)) return false;
    if (f.divGame !== undefined && g.divGame !== f.divGame) return false;
    if (f.roof && !(g.roof && f.roof.includes(g.roof))) return false;
    if (f.surface && !(g.surface && f.surface.includes(g.surface))) return false;
    if (f.weekday && !(g.weekday && f.weekday.includes(g.weekday))) return false;
    if (
      f.restEdge &&
      !inRange(
        g.homeRest !== null && g.awayRest !== null ? g.homeRest - g.awayRest : null,
        f.restEdge,
      )
    )
      return false;
    if (f.teams && !(f.teams.includes(g.home) || f.teams.includes(g.away))) return false;
    if (f.played !== undefined && (g.result !== null) !== f.played) return false;
    if (f.splits) {
      for (const c of f.splits) {
        const cell = g.splits?.[c.market]?.[c.side];
        if (!cell) return false;
        if (!inRange(cell.tickets, c.tickets)) return false;
        if (!inRange(cell.money, c.money)) return false;
      }
    }
    return true;
  });
}
