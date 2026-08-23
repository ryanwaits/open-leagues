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
import { canonTeam, isDefense, playerTeam } from "@/lib/data/teams";
import type { GamePlay, GameSummary, SlimPlayer } from "@/lib/data/types";
import { liveProjection } from "@/lib/league/live-proj";
import { applyBook, type ScoringBook } from "@/lib/league/scoring";
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

type PlayOnDrive = GamePlay & { driveTeam: string };

function collectPlays(g: Pick<GameSummary, "drives" | "scoring">): PlayOnDrive[] {
  const byId = new Map<string, PlayOnDrive>();
  for (const drive of g.drives) {
    for (const play of drive.plays) {
      byId.set(play.id, { ...play, driveTeam: drive.team });
    }
  }
  // Scoring summaries sometimes have plays the drive list dropped (preseason
  // PBP is patchy). Keep them so D/ST points-allowed still has a clock.
  for (const s of g.scoring) {
    if (byId.has(s.id)) continue;
    byId.set(s.id, {
      id: s.id,
      text: s.text,
      type: s.type,
      scoring: true,
      period: s.period,
      clock: s.clock,
      awayScore: s.awayScore,
      homeScore: s.homeScore,
      yardage: null,
      driveTeam: s.team,
    });
  }
  return [...byId.values()].sort((a, b) => elapsedOf(a) - elapsedOf(b));
}

/**
 * Liveline's visible span is ~95% of `window` (5% right-side buffer for the
 * live badge). Size `window` so `span` seconds behind the last sample — i.e.
 * kickoff — stays inside the left edge instead of clipping. Without this the
 * line starts at the first *visible* sample, which for a kicker is already
 * above the PROJ baseline, and a two-point D/ST series falls under liveline's
 * 2-point-in-window gate and draws nothing.
 */
export function chartWindowSecs(span: number): number {
  const s = Math.max(0, span);
  return Math.max(600, Math.ceil(s / 0.9) + 30);
}

function ourDefenseOnPlay(play: PlayOnDrive, defTeam: string, oppTeam: string | null): boolean {
  const d = canonTeam(play.driveTeam);
  if (oppTeam && d === oppTeam) return true;
  const type = play.type.toLowerCase();
  if (d === defTeam && /^(sack|interception|defensive|safety|blocked)/i.test(type)) return true;
  return false;
}

function addDstPlay(
  totals: Record<string, number>,
  play: PlayOnDrive,
  defTeam: string,
  oppTeam: string | null,
  defIsHome: boolean,
  prevOurScore: number,
): { changed: boolean; ourScore: number } {
  const oppScore = defIsHome ? play.awayScore : play.homeScore;
  const ourScore = defIsHome ? play.homeScore : play.awayScore;
  const prevOpp = totals.pts_allow ?? 0;
  let changed = false;

  if (oppScore !== prevOpp) {
    totals.pts_allow = oppScore;
    changed = true;
  }

  if (!ourDefenseOnPlay(play, defTeam, oppTeam)) return { changed, ourScore };

  const type = play.type.toLowerCase();
  const text = play.text;
  const bump = (key: string) => {
    totals[key] = (totals[key] ?? 0) + 1;
    changed = true;
  };

  if (/sack/.test(type) || /\bsacked\b/i.test(text)) bump("sack");
  if (/intercept/.test(type) || /INTERCEPTED/i.test(text)) bump("int");
  if (/safety/.test(type) || /\bsafety\b/i.test(text)) bump("safe");
  if (/block/.test(type) || /BLOCKED/i.test(text)) bump("blk_kick");

  const recBy = text.match(/RECOVERED by ([A-Z]{2,4})-/i);
  if (recBy && canonTeam(recBy[1]) === defTeam) bump("fum_rec");
  else if (/fumble recovery/i.test(text)) bump("fum_rec");

  if (
    /defensive touchdown|interception return|fumble return/i.test(type) ||
    /returned for a TOUCHDOWN/i.test(text)
  ) {
    bump("def_td");
  } else if (
    play.scoring &&
    ourScore > prevOurScore &&
    !/safety/.test(type) &&
    !/\bsafety\b/i.test(text)
  ) {
    bump("def_td");
  }

  return { changed, ourScore };
}

/** The player's cumulative league points and expected final after each play that credits him, by game clock. */
export function projectionByClock(
  g: Pick<GameSummary, "home" | "away" | "drives" | "scoring" | "state">,
  player: SlimPlayer,
  book: ScoringBook,
  baseline: number,
): ClockSample[] {
  const plays = collectPlays(g);
  const defTeam = playerTeam(player);
  const homeAbbr = canonTeam(g.home.abbr);
  const awayAbbr = canonTeam(g.away.abbr);
  const skillTeam = canonTeam(player.team);
  const dst = isDefense(player.position) && Boolean(defTeam);

  const tracked: TrackedPlayer = {
    player,
    side: "mine",
    slot: "",
    club: "",
    points: null,
    stats: null,
  };

  const bySample = new Map<number, ClockSample>();
  const emit = (elapsed: number, pts: number, expected: number) => {
    bySample.set(elapsed, { elapsed, pts, expected });
  };

  // Kickoff: the line starts at the pre-game projection, exactly.
  emit(0, 0, liveProjection({ baseline, current: 0, position: player.position, game: null }));

  let cum = 0;
  let lastElapsed = 0;
  let lastEmittedElapsed = 0;
  const dstBag: Record<string, number> = {};
  let ourScore = 0;
  const oppTeam = dst ? (defTeam === homeAbbr ? awayAbbr : homeAbbr) : null;
  const defIsHome = Boolean(dst && defTeam && defTeam === homeAbbr);

  for (const play of plays) {
    const elapsed = elapsedOf(play);
    lastElapsed = elapsed;
    let moved = false;

    if (dst && defTeam) {
      const next = addDstPlay(dstBag, play, defTeam, oppTeam, defIsHome, ourScore);
      ourScore = next.ourScore;
      if (next.changed) {
        cum = applyBook(book, dstBag);
        moved = true;
      }
    } else {
      const segs = tagPlayText(play.text, [tracked]);
      const credits = playCredits(play, segs, book).filter(
        (c) => c.tracked.player.player_id === player.player_id,
      );
      const creditSum = credits.reduce((sum, c) => sum + c.points, 0);
      if (creditSum !== 0) {
        cum += creditSum;
        moved = true;
      }
    }

    if (moved) {
      const margin = marginFor(play, dst ? defTeam : skillTeam, homeAbbr, awayAbbr);
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
    const margin = marginFor(finalPlay, dst ? defTeam : skillTeam, homeAbbr, awayAbbr);
    const expected = liveProjection({
      baseline,
      current: cum,
      position: player.position,
      game: { state: "in", detail: chipDetail(finalPlay), opp: null, gameId: null, margin },
    });
    emit(lastElapsed, cum, expected);
  }

  if (g.state === "post") {
    if (dst && defTeam) {
      const last = plays[plays.length - 1];
      const headerOpp = Number.parseInt(String((defIsHome ? g.away : g.home).score ?? ""), 10);
      const playOpp = last ? (defIsHome ? last.awayScore : last.homeScore) : null;
      dstBag.pts_allow = playOpp ?? (Number.isFinite(headerOpp) ? headerOpp : 0);
      cum = applyBook(book, dstBag);
    }
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
