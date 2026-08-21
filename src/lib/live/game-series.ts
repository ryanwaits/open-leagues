/**
 * Turns a `GameSummary`'s plays into the player's projection line: his
 * cumulative league points and expected final (`liveProjection()`) after
 * every play that credits him, by game clock. Pure math — no React, no
 * network — so `useProjectionSeries` and any test can build a series from a
 * plain object shaped like a game summary.
 */

import { playWhen } from "@/lib/data/game-feed";
import { playCredits } from "@/lib/data/play-points";
import type { TrackedPlayer } from "@/lib/data/play-tags";
import { tagPlayText } from "@/lib/data/play-tags";
import { canonTeam } from "@/lib/data/teams";
import type { GamePlay, GameSummary, SlimPlayer } from "@/lib/data/types";
import { liveProjection } from "@/lib/league/live-proj";
import type { ScoringBook } from "@/lib/league/scoring";
import type { LinePoint } from "./series";

export type ClockSample = { elapsed: number; pts: number; expected: number };

/**
 * `playWhen()` is built for sorting, not for a kickoff-relative clock: period
 * 1 at "15:00" (the opening snap) already reads 900, so a naive read of it as
 * "seconds since kickoff" plants kickoff a full quarter late and pushes every
 * later period past `fmtGameClock()`'s quarter boundaries by the same 900s —
 * a Q3 play was landing in "OT". Shift it back so period 1 / 15:00 is 0.
 */
function elapsedOf(play: Pick<GamePlay, "period" | "clock">): number {
  return Math.max(0, playWhen(play.period, play.clock) - 900);
}

function ordinal(period: number): string {
  if (period >= 5) return "OT";
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  if (period === 3) return "3rd";
  return "4th";
}

/** `fractionRemaining`'s ESPN-detail regex expects "6:40 - 3rd" / "10:00 - OT". */
function chipDetail(play: Pick<GamePlay, "period" | "clock">): string {
  return `${play.clock} - ${ordinal(play.period)}`;
}

function marginFor(
  play: Pick<GamePlay, "homeScore" | "awayScore">,
  playerTeam: string | null,
  homeAbbr: string | null,
  awayAbbr: string | null,
): number | null {
  if (!playerTeam) return null;
  if (playerTeam === homeAbbr) return play.homeScore - play.awayScore;
  if (playerTeam === awayAbbr) return play.awayScore - play.homeScore;
  return null;
}

/** The player's cumulative league points and expected final after each play that credits him, by game clock. */
export function projectionByClock(
  g: Pick<GameSummary, "home" | "away" | "drives" | "scoring" | "state">,
  player: SlimPlayer,
  book: ScoringBook,
  baseline: number,
): ClockSample[] {
  const tracked: TrackedPlayer = {
    player,
    side: "mine",
    slot: "",
    club: "",
    points: null,
    stats: null,
  };

  const byId = new Map<string, GamePlay>();
  for (const drive of g.drives) {
    for (const play of drive.plays) byId.set(play.id, play);
  }
  const plays = [...byId.values()].sort((a, b) => elapsedOf(a) - elapsedOf(b));

  const playerTeam = canonTeam(player.team);
  const homeAbbr = canonTeam(g.home.abbr);
  const awayAbbr = canonTeam(g.away.abbr);

  const bySample = new Map<number, ClockSample>();
  const emit = (elapsed: number, pts: number, expected: number) => {
    bySample.set(elapsed, { elapsed, pts, expected });
  };

  // Kickoff: the line starts at the pre-game projection, exactly.
  emit(0, 0, liveProjection({ baseline, current: 0, position: player.position, game: null }));

  let cum = 0;
  let lastElapsed = 0;
  let lastEmittedElapsed = 0;
  for (const play of plays) {
    const segs = tagPlayText(play.text, [tracked]);
    const credits = playCredits(play, segs, book).filter(
      (c) => c.tracked.player.player_id === player.player_id,
    );
    const creditSum = credits.reduce((sum, c) => sum + c.points, 0);
    cum += creditSum;
    const elapsed = elapsedOf(play);
    lastElapsed = elapsed;

    if (creditSum !== 0) {
      const margin = marginFor(play, playerTeam, homeAbbr, awayAbbr);
      const expected = liveProjection({
        baseline,
        current: cum,
        position: player.position,
        game: { state: "in", detail: chipDetail(play), opp: null, gameId: null, margin },
      });
      emit(elapsed, cum, expected);
      lastEmittedElapsed = elapsed;
    }
  }

  // Always a sample at the latest play, even when it didn't move his total.
  const finalPlay = plays[plays.length - 1];
  if (finalPlay && lastElapsed !== lastEmittedElapsed) {
    const margin = marginFor(finalPlay, playerTeam, homeAbbr, awayAbbr);
    const expected = liveProjection({
      baseline,
      current: cum,
      position: player.position,
      game: { state: "in", detail: chipDetail(finalPlay), opp: null, gameId: null, margin },
    });
    emit(lastElapsed, cum, expected);
  }

  if (g.state === "post") {
    emit(Math.max(lastElapsed, 3600), cum, cum);
  }

  return [...bySample.values()].sort((a, b) => a.elapsed - b.elapsed);
}

/** Map by-clock samples onto wall time for a live chart: kickoff → now, linearly by elapsed share. */
export function clockToWall(
  samples: ClockSample[],
  kickoffWall: number,
  nowWall: number,
): LinePoint[] {
  if (samples.length === 0) return [];
  if (nowWall <= kickoffWall) {
    return samples.map((s) => ({ time: nowWall, value: s.expected }));
  }
  const elapsedNow = samples[samples.length - 1]?.elapsed || 1;
  return samples.map((s) => ({
    time: kickoffWall + (s.elapsed / elapsedNow) * (nowWall - kickoffWall),
    value: s.expected,
  }));
}

/** By-clock samples as a liveline series whose `time` is game seconds elapsed (for frozen mode). */
export function clockSeries(samples: ClockSample[]): LinePoint[] {
  return samples.map((s) => ({ time: s.elapsed, value: s.expected }));
}

export function projectionTone(expected: number, baseline: number): "brand" | "alarm" {
  return expected >= baseline - 0.05 ? "brand" : "alarm";
}

export function kickoffWallSecs(g: Pick<GameSummary, "date">): number {
  const t = Date.parse(g.date) / 1000;
  return Number.isFinite(t) ? t : Date.now() / 1000;
}
