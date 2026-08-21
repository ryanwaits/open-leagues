import { liveProjection } from "@/lib/league/live-proj";
import { formatStatLine } from "./statline";
import type { GameChip, MatchupPair, MatchupSide, Projection, StarterLine } from "./types";

export function gameHasStarted(game: GameChip | null | undefined): boolean {
  return game?.state === "in" || game?.state === "post";
}

export type SlotDisplay = {
  points: number | null;
  forecast?: "proj" | "bye" | "out";
};

/** Per-player: unofficial once their game is up; weekly proj until then. */
export function slotDisplay(
  game: GameChip | null | undefined,
  livePoints: number | null | undefined,
  projection?: Projection | null,
): SlotDisplay {
  if (gameHasStarted(game)) {
    return { points: livePoints ?? 0 };
  }
  if (projection && projection.reason !== "no-data") {
    const forecast =
      projection.reason === "bye" || projection.reason === "out" ? projection.reason : "proj";
    return { points: projection.points, forecast };
  }
  if (livePoints != null && livePoints !== 0) return { points: livePoints };
  return { points: livePoints ?? null };
}

/** Stat line only after kickoff, and only when something actually happened. */
export function liveStatLine(
  pos: string | null | undefined,
  game: GameChip | null | undefined,
  bag: Record<string, number> | null | undefined,
): string | null {
  if (!gameHasStarted(game)) return null;
  return formatStatLine(pos, bag);
}

function paintLine(
  line: StarterLine,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): StarterLine {
  const started = gameHasStarted(line.game);
  const bag = started
    ? (line.stats ?? (line.playerId ? liveStats[line.playerId] : undefined))
    : undefined;
  const proj = line.playerId ? projections[line.playerId] : undefined;
  const disp = slotDisplay(line.game, line.points, proj);
  const unofficial = started ? (disp.points ?? 0) : 0;
  const baseline =
    proj && proj.reason !== "bye" && proj.reason !== "out" && proj.reason !== "no-data"
      ? proj.points
      : 0;
  const expected = liveProjection({
    baseline,
    current: unofficial,
    game: line.game,
    position: line.player?.position,
  });
  return {
    ...line,
    points: disp.points,
    forecast: disp.forecast,
    stats: bag ?? null,
    expected,
  };
}

function paintSide(
  side: MatchupSide,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupSide {
  const starters = side.starters.map((line) => paintLine(line, projections, liveStats));
  return {
    ...side,
    starters,
    points: starters.reduce((sum, line) => sum + (line.points ?? 0), 0),
  };
}

/**
 * Board-facing pair: each starter keeps last year's bag / 0.0 off the row until
 * *that* player's game starts. Team total is the sum of what the slots show.
 */
export function paintMatchup(
  pair: MatchupPair,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupPair {
  return {
    ...pair,
    home: paintSide(pair.home, projections, liveStats),
    away: pair.away ? paintSide(pair.away, projections, liveStats) : null,
  };
}

export function paintMatchups(
  pairs: MatchupPair[],
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupPair[] {
  return pairs.map((pair) => paintMatchup(pair, projections, liveStats));
}

/** True when every filled starter is still a forecast — the week has not kicked. */
export function sideIsProjected(side: MatchupSide): boolean {
  const lined = side.starters.filter((s) => s.player);
  return lined.length > 0 && lined.every((s) => Boolean(s.forecast));
}

export function pairIsProjected(pair: MatchupPair): boolean {
  if (!sideIsProjected(pair.home)) return false;
  return !pair.away || sideIsProjected(pair.away);
}

/** Unofficial scored so far — skips slots still on a weekly forecast. */
export function sideUnofficial(side: MatchupSide): number {
  return side.starters.reduce((sum, line) => sum + (line.forecast ? 0 : (line.points ?? 0)), 0);
}

/** Expected final: live-adjusted in-game, weekly proj until kickoff. */
export function sideExpected(side: MatchupSide): number {
  return side.starters.reduce((sum, line) => sum + (line.expected ?? line.points ?? 0), 0);
}

/** True while any starter still has football to play. */
export function sideStillOpen(side: MatchupSide): boolean {
  return side.starters.some((s) => {
    if (!s.player) return false;
    if (s.forecast === "bye" || s.forecast === "out") return false;
    return s.game?.state !== "post";
  });
}

export function sideHasStarted(side: MatchupSide): boolean {
  return side.starters.some((s) => Boolean(s.player && gameHasStarted(s.game)));
}

/** Either roster has a starter whose NFL game has kicked off. */
export function pairHasStarted(pair: MatchupPair): boolean {
  return sideHasStarted(pair.home) || Boolean(pair.away && sideHasStarted(pair.away));
}

/** Strip / card totals: unofficial once anyone has started, else expected. */
export function pairPreviewScores(pair: MatchupPair): {
  home: number;
  away: number;
  live: boolean;
} {
  const live = pairHasStarted(pair);
  if (live) {
    return {
      home: sideUnofficial(pair.home),
      away: pair.away ? sideUnofficial(pair.away) : 0,
      live: true,
    };
  }
  return {
    home: sideExpected(pair.home),
    away: pair.away ? sideExpected(pair.away) : 0,
    live: false,
  };
}
