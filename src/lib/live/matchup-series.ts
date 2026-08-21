/**
 * Pure sample math for the matchup finals chart — turning a `MatchupPair`
 * (or a row of stored `ff_ticks`) into the same `MatchupSample` shape,
 * signed from a viewer's side, that `useMatchupSeries` draws through
 * `<LiveLine>`. No React, no network: this is the part every test and
 * every caller (the client hook, `ticks.server.ts`) can share so the chart,
 * the caption and the stored history are never three approximations of the
 * same number.
 */
import type { MatchupPair, MatchupSide } from "@/lib/data/types";
import { type PlayerOutlook, winProbability } from "@/lib/league/win-probability";
import type { LinePoint } from "./series";

export type OutlookMap = Record<string, { mean: number; sd: number }>;

export type MatchupSample = {
  /** Unix seconds. */
  at: number;
  /** Expected finals, viewer's side first. */
  youProj: number;
  themProj: number;
  /** Points on the board. */
  youPts: number;
  themPts: number;
  /** 0-100. */
  youPct: number;
  /** youProj - themProj. */
  margin: number;
  /** `winProbability().live` — false once nothing is left to model. */
  live: boolean;
};

/** Build `PlayerOutlook[]` for a side, the way `MatchupEdge`/`quoteOne` do. */
export function outlookSide(side: MatchupSide, map: OutlookMap): PlayerOutlook[] {
  return side.starters.map((line) => {
    const o = line.playerId ? map[line.playerId] : undefined;
    return {
      playerId: line.playerId ?? "",
      team: line.player?.team ?? null,
      position: line.player?.position ?? null,
      mean: o?.mean ?? 0,
      sd: o?.sd ?? 0,
      game: line.game,
    };
  });
}

/** True once every starter with a `playerId`, on both sides, has an outlook entry. */
function outlooksReady(you: MatchupSide, them: MatchupSide, map: OutlookMap): boolean {
  for (const side of [you, them]) {
    for (const line of side.starters) {
      if (line.playerId && !map[line.playerId]) return false;
    }
  }
  return true;
}

/**
 * One sample from the current pair, signed from `mine`'s side. Falls back
 * to `home` as "you" when `mine` is null or matches neither side (the
 * spectator case). `null` when there is no away side to compare against,
 * when the outlook map is still missing an entry for any starter (every
 * mean/sd would read 0 and the sample would be a fake 0-0 tick that jerks
 * the chart when the real numbers land a poll later), or when both
 * projected finals come out to exactly 0 regardless.
 */
export function sampleMatchup(
  pair: MatchupPair,
  map: OutlookMap,
  mine: number | null,
  at?: number,
): MatchupSample | null {
  const away = pair.away;
  if (!away) return null;

  const flip = mine != null && away.rosterId === mine;
  const you = flip ? away : pair.home;
  const them = flip ? pair.home : away;

  if (!outlooksReady(you, them, map)) return null;

  const wp = winProbability({
    scores: [you.points, them.points],
    starters: [outlookSide(you, map), outlookSide(them, map)],
  });

  const youProj = wp.projected[0];
  const themProj = wp.projected[1];
  if (youProj === 0 && themProj === 0) return null;

  return {
    at: at ?? Date.now() / 1000,
    youProj,
    themProj,
    youPts: you.points,
    themPts: them.points,
    youPct: wp.probability * 100,
    margin: youProj - themProj,
    live: wp.live,
  };
}

export type TickRow = {
  at: string | number;
  homePts: number;
  awayPts: number;
  homeProj: number;
  awayProj: number;
  homePct: number;
};

function tickAtSecs(at: string | number): number {
  if (typeof at === "number") return at;
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? ms / 1000 : Date.now() / 1000;
}

/**
 * Server ticks (always stored home-signed) → samples signed from `mine`,
 * the same convention `sampleMatchup` uses.
 */
export function samplesFromTicks(
  rows: TickRow[],
  pair: Pick<MatchupPair, "home" | "away">,
  mine: number | null,
): MatchupSample[] {
  const flip = mine != null && pair.away != null && pair.away.rosterId === mine;
  return rows.map((row) => {
    const youProj = flip ? row.awayProj : row.homeProj;
    const themProj = flip ? row.homeProj : row.awayProj;
    const youPts = flip ? row.awayPts : row.homePts;
    const themPts = flip ? row.homePts : row.awayPts;
    const youPct = flip ? 100 - row.homePct : row.homePct;
    return {
      at: tickAtSecs(row.at),
      youProj,
      themProj,
      youPts,
      themPts,
      youPct,
      margin: youProj - themProj,
      live: true,
    };
  });
}

/**
 * Merge stored samples with the in-session buffer: sort by `at`, drop
 * exact-duplicate timestamps (the session's sample wins over a stored one at
 * the same second), cap to `cap` most-recent entries.
 */
export function mergeSamples(
  stored: MatchupSample[],
  session: MatchupSample[],
  cap = 4000,
): MatchupSample[] {
  const byAt = new Map<number, MatchupSample>();
  for (const s of stored) byAt.set(s.at, s);
  for (const s of session) byAt.set(s.at, s);
  const merged = Array.from(byAt.values()).sort((a, b) => a.at - b.at);
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

export const pick = {
  you: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.youProj }),
  them: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.themProj }),
  pct: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.youPct }),
  margin: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.margin }),
};

export function toPoints(
  samples: MatchupSample[],
  f: (s: MatchupSample) => LinePoint,
): LinePoint[] {
  return samples.map(f);
}

/** Everybody on both sides is `post` (or has no game at all). */
export function pairIsFinal(pair: MatchupPair): boolean {
  const sides = [pair.home, pair.away].filter((s): s is MatchupSide => Boolean(s));
  if (sides.length === 0) return false;
  return sides.every((side) => side.starters.every((s) => !s.game || s.game.state === "post"));
}
