import type { ScoringBook } from "@/lib/league/scoring";
import { applyBook } from "@/lib/league/scoring";

/**
 * The flip: the minute a matchup's lead changed hands, reconstructed from the
 * play log. Pure — feed it events and a scoring book, get facts back.
 *
 * An event is one play's effect on one player: a stat delta, in Sleeper stat
 * keys, stamped with the wall clock and the game clock. Cumulative bags are
 * scored with the league's own book after every event, so a 6-point passing TD
 * league and a half-PPR league see their own lead changes.
 */
export type TimelineEvent = {
  /** Wall clock, ISO. */
  t: string;
  /** nflverse game id, e.g. 2025_14_KC_LAC. */
  g: string;
  /** Quarter 1–4, 5 for OT. */
  q: number;
  /** Game clock at the play, "MM:SS". */
  clock: string;
  /** Seconds remaining in regulation at the play. */
  s: number;
  /** Sleeper player id (a team abbreviation for DEF). */
  p: string;
  /** Stat deltas in Sleeper keys. Every key is a delta, `pts_allow` included. */
  d: Record<string, number>;
  /** Play description, kept only for scoring plays. */
  desc?: string;
  /** A box-score settlement at the final whistle, not a play. */
  settled?: boolean;
};

export type FlipSide = { rosterId: number; name: string; starters: string[] };

export type LeadChange = {
  at: string;
  /** Roster id now leading. */
  to: number;
  scores: [number, number];
  desc: string | null;
  playerId: string | null;
  /** The lead moved on a stat correction booked at the final whistle, not on a play. */
  settled: boolean;
};

export type Flip = {
  /** The last lead change of the week — the one that decided it. */
  decided: LeadChange | null;
  /** Every lead change, in order. */
  changes: LeadChange[];
  /** Final scores as reconstructed from the log (home, away). */
  final: [number, number];
  /** How many distinct games contributed events. */
  games: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ReplayInput = {
  home: FlipSide;
  away: FlipSide;
  events: TimelineEvent[];
  book: ScoringBook;
};

/** A moment the matchup's score moved: the running totals just after one event. */
export type ScorePoint = {
  at: string;
  scores: [number, number];
  playerId: string;
  desc: string | null;
  settled: boolean;
  /** The lead changed hands on this event (level scores are not a change). */
  leadChange: boolean;
};

/**
 * One pass over the log: every starter event, in time order, re-scored with
 * the book. Each event that moves a score becomes a point. computeFlip and
 * scoreSeries both read this, so the flip and the series cannot disagree.
 */
function replay(input: ReplayInput): {
  points: ScorePoint[];
  final: [number, number];
  games: number;
} {
  const homeSet = new Set(input.home.starters);
  const awaySet = new Set(input.away.starters);
  const relevant = input.events
    .filter((e) => homeSet.has(e.p) || awaySet.has(e.p))
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));

  const bags = new Map<string, Record<string, number>>();
  const pts = new Map<string, number>();
  let home = 0;
  let away = 0;
  let leader: number | null = null; // rosterId, or null for level
  const points: ScorePoint[] = [];
  const games = new Set<string>();

  for (const e of relevant) {
    games.add(e.g);
    const bag = bags.get(e.p) ?? {};
    for (const [k, v] of Object.entries(e.d)) {
      bag[k] = (bag[k] ?? 0) + v;
    }
    bags.set(e.p, bag);
    const before = pts.get(e.p) ?? 0;
    const after = applyBook(input.book, bag);
    pts.set(e.p, after);
    const delta = after - before;
    if (delta === 0) continue;
    if (homeSet.has(e.p)) home = round2(home + delta);
    else away = round2(away + delta);

    const now = home > away ? input.home.rosterId : away > home ? input.away.rosterId : null;
    points.push({
      at: e.t,
      scores: [home, away],
      playerId: e.p,
      desc: e.desc ?? null,
      settled: e.settled === true,
      leadChange: now !== null && now !== leader && leader !== null,
    });
    if (now !== null) leader = now;
  }

  return { points, final: [home, away], games: games.size };
}

export function computeFlip(input: ReplayInput): Flip {
  const r = replay(input);
  const changes: LeadChange[] = r.points
    .filter((p) => p.leadChange)
    .map((p) => ({
      at: p.at,
      to: p.scores[0] > p.scores[1] ? input.home.rosterId : input.away.rosterId,
      scores: p.scores,
      desc: p.desc,
      playerId: p.playerId,
      settled: p.settled,
    }));
  return {
    decided: changes.length ? (changes[changes.length - 1] ?? null) : null,
    changes,
    final: r.final,
    games: r.games,
  };
}

/** Every moment the matchup's score moved, in time order. */
export function scoreSeries(input: ReplayInput): ScorePoint[] {
  return replay(input).points;
}

/** The score at a moment, from a series (the last point at or before it). */
export function scoreAt(points: ScorePoint[], at: string): [number, number] {
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid] as ScorePoint).at <= at) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best < 0 ? [0, 0] : (points[best] as ScorePoint).scores;
}

/**
 * When to evaluate a win-probability curve: each game's first and last event,
 * every moment a score moved on a scoring play, a settlement or a lead change,
 * and every `stepMs` while any of the matchup's games is being played. Nothing
 * between games (Friday, Saturday), where nothing can change.
 * `spans` are [first, last] event times of the games the starters play in.
 */
export function sampleTimes(input: {
  points: ScorePoint[];
  spans: Array<[string, string]>;
  stepMs: number;
}): string[] {
  const out = new Set<string>();
  for (const [a, b] of input.spans) {
    out.add(a);
    out.add(b);
    const end = new Date(b).getTime();
    for (let t = new Date(a).getTime() + input.stepMs; t < end; t += input.stepMs) {
      out.add(new Date(t).toISOString());
    }
  }
  for (const p of input.points) if (p.desc || p.settled || p.leadChange) out.add(p.at);
  return [...out].sort();
}

/**
 * The state of every game at a moment in time, for the win-probability model:
 * "pre" before its first event, "post" once the clock has run out, otherwise a
 * detail string the model already knows how to read.
 */
export function gameStatesAt(
  events: TimelineEvent[],
  at: string,
): Record<string, { state: "pre" | "in" | "post"; detail: string }> {
  const out: Record<string, { state: "pre" | "in" | "post"; detail: string }> = {};
  const seen = new Set<string>();
  for (const e of events) {
    seen.add(e.g);
    if (e.t > at) {
      if (!out[e.g]) out[e.g] = { state: "pre", detail: "" };
      continue;
    }
    out[e.g] =
      e.s <= 0 ? { state: "post", detail: "Final" } : { state: "in", detail: `Q${e.q} ${e.clock}` };
  }
  for (const g of seen) if (!out[g]) out[g] = { state: "pre", detail: "" };
  return out;
}

/** Scores for both sides at a moment, by replaying the log up to that time. */
export function scoresAt(
  input: { home: FlipSide; away: FlipSide; events: TimelineEvent[]; book: ScoringBook },
  at: string,
): [number, number] {
  const upTo = input.events.filter((e) => e.t <= at);
  return computeFlip({ ...input, events: upTo }).final;
}
