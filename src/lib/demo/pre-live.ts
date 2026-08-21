import { gameForTeam, indexGames } from "@/lib/data/game-index";
import { gameHasStarted } from "@/lib/data/matchup-view";
import type {
  MatchupPair,
  MatchupSide,
  Projection,
  RosterPlayer,
  ScoreGame,
  StarterLine,
} from "@/lib/data/types";
import { applyBook, type ScoringBook } from "@/lib/league/scoring";
import { payoutMultiplier } from "@/lib/league/wagers";
import { type PlayerOutlook, winProbability } from "@/lib/league/win-probability";

const SPREAD_RATIO = 0.63;

function bagPoints(book: ScoringBook, bag: Record<string, number>): number {
  const scored = applyBook(book, bag);
  if (scored !== 0) return scored;
  const canned = bag.pts_ppr ?? bag.pts_half_ppr ?? bag.pts_std;
  return typeof canned === "number" ? canned : 0;
}

function overlayStarter(
  line: StarterLine,
  chips: ReturnType<typeof indexGames>,
  bags: Record<string, Record<string, number>>,
  book: ScoringBook,
): StarterLine {
  const chip = gameForTeam(chips, line.player?.team);
  const game = chip ?? line.game;
  const bag = line.playerId ? bags[line.playerId] : undefined;
  const started = gameHasStarted(game);
  const points = started && bag ? bagPoints(book, bag) : line.points;
  return {
    ...line,
    game,
    points,
    stats: started ? (bag ?? line.stats) : line.stats,
  };
}

function overlaySide(
  side: MatchupSide,
  chips: ReturnType<typeof indexGames>,
  bags: Record<string, Record<string, number>>,
  book: ScoringBook,
): MatchupSide {
  const starters = side.starters.map((line) => overlayStarter(line, chips, bags, book));
  return {
    ...side,
    starters,
    points: starters.reduce((sum, line) => sum + (line.points ?? 0), 0),
  };
}

/** Paint ESPN pre chips + Sleeper pre bags onto a hosted matchup. Display only. */
export function overlayPreLivePairs(
  pairs: MatchupPair[],
  games: ScoreGame[],
  bags: Record<string, Record<string, number>>,
  book: ScoringBook,
): MatchupPair[] {
  const chips = indexGames(games);
  return pairs.map((pair) => ({
    ...pair,
    home: overlaySide(pair.home, chips, bags, book),
    away: pair.away ? overlaySide(pair.away, chips, bags, book) : null,
  }));
}

export function overlayPreLiveRoster(
  players: RosterPlayer[],
  games: ScoreGame[],
  bags: Record<string, Record<string, number>>,
  book: ScoringBook,
): RosterPlayer[] {
  const chips = indexGames(games);
  return players.map((p) => {
    const chip = gameForTeam(chips, p.team);
    const bag = bags[p.player_id];
    const game = chip ?? p.game ?? null;
    const started = gameHasStarted(game);
    return {
      ...p,
      game,
      // Unofficial once the ball is up — 0.0, not last week's leftover / a weekly proj.
      weekPts: started ? (bag ? bagPoints(book, bag) : 0) : p.weekPts,
    };
  });
}

export function denserStatBag(
  a: Record<string, Record<string, number>> | undefined,
  b: Record<string, Record<string, number>> | undefined,
): Record<string, Record<string, number>> {
  const left = a ?? {};
  const right = b ?? {};
  const leftN = Object.values(left).filter((row) => (row.pts_ppr ?? 0) > 0).length;
  const rightN = Object.values(right).filter((row) => (row.pts_ppr ?? 0) > 0).length;
  return rightN > leftN ? right : left;
}

function outlooksForSide(
  side: MatchupSide,
  projections: Record<string, Projection>,
): PlayerOutlook[] {
  return side.starters.map((line) => {
    const mean = line.playerId ? (projections[line.playerId]?.points ?? 0) : 0;
    return {
      playerId: line.playerId ?? "",
      team: line.player?.team ?? null,
      position: line.player?.position ?? null,
      mean,
      sd: Math.round(mean * SPREAD_RATIO * 10) / 10,
      game: line.game,
    };
  });
}

export type OverlayLine = {
  matchupId: number;
  homeRoster: number;
  awayRoster: number;
  spread: number;
  homePct: number;
  awayPct: number;
  homeMult: number;
  awayMult: number;
  live: boolean;
  homeName: string;
  awayName: string;
  locked: boolean;
  restrictedTo: number | null;
};

export function overlayBookLine(
  pair: MatchupPair,
  projections: Record<string, Projection>,
  restrictedTo: number | null,
): OverlayLine | null {
  if (!pair.away) return null;
  const wp = winProbability({
    scores: [pair.home.points, pair.away.points],
    starters: [outlooksForSide(pair.home, projections), outlooksForSide(pair.away, projections)],
  });
  const spread = Math.round(wp.expectedMargin * 2) / 2;
  const pct = Math.round(wp.probability * 100);
  return {
    matchupId: pair.matchupId,
    homeRoster: pair.home.rosterId,
    awayRoster: pair.away.rosterId,
    spread: -spread,
    homePct: pct,
    awayPct: 100 - pct,
    homeMult: payoutMultiplier(wp.probability),
    awayMult: payoutMultiplier(1 - wp.probability),
    live: wp.marginSd > 0.01,
    homeName: pair.home.teamName,
    awayName: pair.away.teamName,
    locked: false,
    restrictedTo,
  };
}
