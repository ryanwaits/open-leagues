/**
 * Bridges `projectionByClock()` — pure by-clock math — to the wall-time
 * series `<LiveLine>` draws. The live samples for a game+player live in the
 * module ring buffer from `./series` (seeded once from the by-clock samples,
 * then appended to on every later poll) so the drawer, the sheet and the
 * player page all read the same growing line for the same game.
 */
import { useEffect, useMemo, useState } from "react";
import type { GameSummary, SlimPlayer } from "@/lib/data/types";
import type { ScoringBook } from "@/lib/league/scoring";
import {
  type ClockSample,
  clockSeries,
  clockToWall,
  kickoffWallSecs,
  projectionByClock,
} from "./game-series";
import { appendSample, type LinePoint, readSeries, swing } from "./series";

/** A stable "no book" fallback — callers should pass `book ?? EMPTY_BOOK`, never `book ?? {}` inline, or the fresh object recreated every render defeats every memo below it. */
export const EMPTY_BOOK: ScoringBook = {};

export type ProjectionPhase = "pre" | "in" | "post";

export type ProjectionSeries = {
  phase: ProjectionPhase;
  baseline: number;
  /** Current league points (last sample). */
  pts: number;
  /** Current expected final (baseline pre-kick, final after). */
  expected: number;
  /** Wall-time series for the live liveline. */
  live: LinePoint[];
  /** Game-clock series for the frozen liveline. */
  final: LinePoint[];
  swing: ReturnType<typeof swing>;
  /** Unix secs. */
  kickoffWall: number;
};

function bufferKeyFor(game: GameSummary | null | undefined, playerId: string): string | null {
  return game ? `game:${game.id}:${playerId}` : null;
}

export function useProjectionSeries(args: {
  game: GameSummary | null | undefined;
  player: SlimPlayer;
  book: ScoringBook;
  baseline: number | null | undefined;
  /** Fallback when the summary has nothing: the points the row already shows. */
  points?: number | null;
}): ProjectionSeries | null {
  const { game, player, book, baseline, points } = args;
  const baselineNum = baseline ?? 0;
  const phase: ProjectionPhase = game?.state ?? "pre";

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on player.player_id (identity) on purpose — a SlimPlayer with the same id is the same player here, and callers often pass a fresh object each render.
  const samples: ClockSample[] = useMemo(
    () => (game ? projectionByClock(game, player, book, baselineNum) : []),
    [game, player.player_id, book, baselineNum],
  );

  const key = bufferKeyFor(game, player.player_id);
  // `kickoffWallSecs()` falls back to `Date.now()/1000` when `game.date` doesn't
  // parse (true for a synthetic/demo game with no real kickoff) — called fresh
  // every render, that's a value that changes every render. Pin it to once per
  // game+player so it doesn't do the same "changes every render" thing `book`
  // and `game` do below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on `key` (game+player identity), not `game` (reference) — see comment above.
  const kickoffWall = useMemo(() => (game ? kickoffWallSecs(game) : Date.now() / 1000), [key]);
  // `game` (and therefore `samples`, from the memo above) is a fresh object
  // every render for a caller that builds it inline — the demo drawer calls
  // `simulatePlayerGame()` in its render body, and a `book ?? {}` fallback
  // does the same. A dependency on either reference would re-run this effect,
  // append a sample, and `setBump` every single render — forever. Depending
  // on this content signature instead means the effect only fires when the
  // numbers actually changed, not when someone handed us an equal-but-new object.
  const samplesSig = samples.length ? JSON.stringify(samples) : "";

  // Seed the buffer once (first samples for this game+player), then append
  // the latest expected final on every later poll. No timers: this only
  // reacts to the samples' content changing. The buffer lives outside React
  // state, so writing to it alone would never repaint this component — the
  // seeded points would sit in the buffer invisibly until some unrelated
  // re-render happened to read it. `bump` closes that gap: every write
  // schedules the re-render that shows it.
  const [, setBump] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on samplesSig (content), not samples (reference) — see comment above.
  useEffect(() => {
    if (!key || samples.length === 0) return;
    const existing = readSeries(key);
    if (existing.length === 0) {
      const now = Date.now() / 1000;
      for (const p of clockToWall(samples, kickoffWall, now)) {
        appendSample(key, p.value, p.time);
      }
    } else {
      const last = samples[samples.length - 1];
      if (last) appendSample(key, last.expected);
    }
    setBump((b) => b + 1);
  }, [key, kickoffWall, samplesSig]);

  const live = key ? readSeries(key).slice() : [];
  const final = useMemo(() => clockSeries(samples), [samples]);
  const lastSample = samples[samples.length - 1] ?? null;
  const pts = phase === "pre" ? 0 : (lastSample?.pts ?? points ?? 0);
  const expected = phase === "pre" ? baselineNum : (lastSample?.expected ?? baselineNum);
  const swingValue = swing(live, 300, 0.8);

  if (baseline == null) return null;

  return {
    phase,
    baseline: baselineNum,
    pts,
    expected,
    live,
    final,
    swing: swingValue,
    kickoffWall,
  };
}
