/**
 * Bridges the pure sample math in `matchup-series.ts` to the wall-time
 * series `<LiveLine>` draws. The live samples for a given league+week+
 * matchup live in a module-level buffer (keyed by `bufferKey`, shared
 * across every component reading this matchup) so a reload doesn't lose
 * what was seen this session, and a second panel on the same matchup reads
 * the same growing line.
 */
import { useEffect, useState } from "react";
import { pairHasStarted } from "@/lib/data/matchup-view";
import type { MatchupPair } from "@/lib/data/types";
import {
  lastPointOnly,
  type MatchupSample,
  matchupChartReady,
  mergeSamples,
  type OutlookMap,
  pairIsFinal,
  pick,
  sampleMatchup,
  samplesFromTicks,
  type TickRow,
  toPoints,
} from "./matchup-series";
import { bufferKey, type LinePoint, type Swing, swing } from "./series";

const sessionBuffers = new Map<string, MatchupSample[]>();

/** The three numbers the chart actually draws — `youPts`/`themPts` moving without these doesn't move a line. */
function sameSample(a: MatchupSample, b: MatchupSample): boolean {
  return a.youProj === b.youProj && a.themProj === b.themProj && a.youPct === b.youPct;
}

/** A flat pre-kick line polls every few seconds but should read as one dot extending, not a pile of points. */
const SESSION_DEBOUNCE_SECS = 60;

/**
 * Appends `sample` unless it's an identical repeat of the last buffered one
 * within `SESSION_DEBOUNCE_SECS` — a real change always gets through
 * immediately, regardless of timing. Returns whether it actually pushed.
 */
function pushSession(key: string, sample: MatchupSample, cap: number): boolean {
  let arr = sessionBuffers.get(key);
  if (!arr) {
    arr = [];
    sessionBuffers.set(key, arr);
  }
  const prev = arr[arr.length - 1];
  if (prev && sameSample(prev, sample) && sample.at - prev.at < SESSION_DEBOUNCE_SECS) return false;
  arr.push(sample);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
  return true;
}

export type MatchupSeries = {
  samples: MatchupSample[];
  last: MatchupSample | null;
  you: LinePoint[];
  them: LinePoint[];
  pct: LinePoint[];
  margin: LinePoint[];
  swingYou: Swing;
  swingThem: Swing;
  /** Every starter on both sides is post (or has no game). */
  final: boolean;
  /**
   * True when the canvas should show — kickoff, or stored ticks from a
   * prior session. False means "outlooks loaded but nothing has kicked
   * off yet": MatchupEdge falls back to "Margin by slot" and renders no
   * `<LiveLine>`, regardless of how many samples have been taken.
   */
  started: boolean;
  /** No server ticks came back — this line only knows what happened since the page opened. */
  sinceOpened: boolean;
};

export function useMatchupSeries(args: {
  leagueId: string;
  week: number;
  pair: MatchupPair;
  outlooks: OutlookMap;
  mine: number | null;
  ticks?: TickRow[] | null;
}): MatchupSeries {
  const { leagueId, week, pair, outlooks, mine, ticks } = args;
  const key = bufferKey(leagueId, week, pair.matchupId);
  const current = sampleMatchup(pair, outlooks, mine);

  // The buffer lives outside React state, so writing to it alone would
  // never repaint this component — the pushed sample would sit invisibly
  // until some unrelated re-render happened to read it. `bump` closes that
  // gap: every real push schedules the re-render that shows it.
  const [, setBump] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` is a fresh object every render by construction (sampleMatchup stamps `at` on each call) — depending on it directly would push every render. Re-running only when the pair/outlooks/mine identity changes (a new poll) is the intent; pushSession's own de-bounce covers the rest.
  useEffect(() => {
    if (!current) return;
    if (pushSession(key, current, 4000)) setBump((b) => b + 1);
  }, [key, pair, outlooks, mine]);

  const session = sessionBuffers.get(key) ?? [];
  const stored = samplesFromTicks(ticks ?? [], pair, mine);
  const samples = mergeSamples(stored, session);

  const youFull = toPoints(samples, pick.you);
  const themFull = toPoints(samples, pick.them);
  const pctFull = toPoints(samples, pick.pct);
  const marginFull = toPoints(samples, pick.margin);

  // Pre-kick (and no stored ticks yet), draw only the latest point per
  // series — a single pulsing dot at the projection — instead of a flat
  // line. Once the pair has started, or there's stored history, draw the
  // full series as usual.
  const preKickoff = !pairHasStarted(pair) && stored.length === 0;
  const you = preKickoff ? lastPointOnly(youFull) : youFull;
  const them = preKickoff ? lastPointOnly(themFull) : themFull;
  const pct = preKickoff ? lastPointOnly(pctFull) : pctFull;
  const margin = preKickoff ? lastPointOnly(marginFull) : marginFull;

  return {
    samples,
    last: samples[samples.length - 1] ?? null,
    you,
    them,
    pct,
    margin,
    swingYou: swing(youFull, 300, 1.2),
    swingThem: swing(themFull, 300, 1.2),
    final: pairIsFinal(pair),
    started: matchupChartReady(pair, stored.length),
    sinceOpened: stored.length === 0,
  };
}
