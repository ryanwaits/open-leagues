import { TEAMS } from "@/lib/data/teams";
import type { GameChip, MatchupPair, MatchupSide } from "@/lib/data/types";
import { applyBook, fromSleeperSettings, type ScoringBook } from "@/lib/league/scoring";

export const REPLAY_TICK_MS = 12_000;
export const LIVE_POLL_MS = 15_000;

export type ReplayPhase = {
  key: string;
  label: string;
  detail: string;
  state: GameChip["state"];
};

export const REPLAY_PHASES: ReplayPhase[] = [
  { key: "ko", label: "Kickoff", detail: "Sun 1:00", state: "pre" },
  { key: "q1a", label: "Q1 11:04", detail: "Q1 11:04", state: "in" },
  { key: "q1b", label: "Q1 3:22", detail: "Q1 3:22", state: "in" },
  { key: "q2a", label: "Q2 9:51", detail: "Q2 9:51", state: "in" },
  { key: "ht", label: "Halftime", detail: "Halftime", state: "in" },
  { key: "q3", label: "Q3 6:40", detail: "Q3 6:40", state: "in" },
  { key: "q4a", label: "Q4 8:15", detail: "Q4 8:15", state: "in" },
  { key: "q4b", label: "Q4 1:12", detail: "Q4 1:12", state: "in" },
  { key: "fin", label: "Final", detail: "Final", state: "post" },
];

const COUNT_KEYS = new Set([
  "pass_td",
  "pass_int",
  "pass_cmp",
  "pass_inc",
  "pass_2pt",
  "pass_att",
  "pass_sack",
  "rush_att",
  "rush_td",
  "rush_2pt",
  "rec",
  "rec_td",
  "rec_2pt",
  "rec_tgt",
  "fum",
  "fum_lost",
  "kr",
  "pr",
  "kr_td",
  "pr_td",
  "st_td",
  "fgm",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
  "xpm",
  "fgmiss",
  "xpmiss",
  "sack",
  "int",
  "fum_rec",
  "def_td",
  "safe",
  "blk_kick",
]);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pairingIsLive(pair: MatchupPair): boolean {
  return [pair.home, pair.away].some((side) =>
    side?.starters.some((line) => line.game?.state === "in"),
  );
}

export function pairingHasScores(pair: MatchupPair): boolean {
  return pair.home.points > 0 || (pair.away?.points ?? 0) > 0;
}

function unit(playerId: string, week: number, salt: number): number {
  return (hash(`${playerId}:${week}:d${salt}`) % 1000) / 1000;
}

/** Same idea as `unit`, namespaced separately for the event-schedule draws below. */
function eunit(playerId: string, week: number, salt: number): number {
  return (hash(`${playerId}:${week}:e${salt}`) % 1000) / 1000;
}

/** D/ST rows use the team abbreviation as their player id (see `playerTeam`). */
function looksLikeDst(playerId: string): boolean {
  return Object.hasOwn(TEAMS, playerId.toUpperCase());
}

type ReplayCredit = { progress: number; raw: number };

/**
 * A deterministic per-player event schedule: a handful of small, irregularly
 * timed "credits" that sum (before scaling) to roughly `finalPts`, standing
 * in for the small play-sized chunks real unofficial scoring arrives in.
 *
 * Ordinary credits land 8-20 times for most players (a busy WR/RB/QB game),
 * 3-6 times for D/ST-shaped ids (sacks/INTs/TDs are rare, discrete events,
 * not a steady trickle). Players trending toward a real final of 12+ points
 * also get one or two bigger "TD" lumps, so the accumulated line shows an
 * occasional jump on top of its many small steps instead of only ever
 * crawling.
 *
 * Progress values are kept off the exact 0/1 edges (`[0.02, 0.98]`) so no
 * credit is mistaken for "already happened at kickoff" or double-counted
 * against the exact-final short-circuit in `replayPts`.
 *
 * Raw magnitudes are *not* final point values — `replayPts` sums and rescales
 * them so the total lands on `finalPts` exactly. They only set the relative
 * shape: many small steps, occasionally one bigger jump.
 */
function eventCredits(playerId: string, finalPts: number, week: number): ReplayCredit[] {
  const dst = looksLikeDst(playerId);
  const [lo, hi] = dst ? [3, 6] : [8, 20];
  const count = lo + (hash(`${playerId}:${week}:ecount`) % (hi - lo + 1));

  const credits: ReplayCredit[] = [];
  for (let i = 0; i < count; i++) {
    credits.push({
      progress: 0.02 + eunit(playerId, week, 100 + i) * 0.96,
      raw: 0.3 + eunit(playerId, week, 300 + i) * 2.2,
    });
  }

  if (finalPts >= 12) {
    const lumps = eunit(playerId, week, 940) < 0.55 ? 1 : 2;
    for (let j = 0; j < lumps; j++) {
      credits.push({
        progress: 0.02 + eunit(playerId, week, 700 + j) * 0.96,
        raw: 5.5 + eunit(playerId, week, 800 + j) * 1,
      });
    }
  }

  return credits;
}

/** Plausible week bag when this season has no unofficial line yet. */
export function demoStatBag(
  playerId: string,
  pos: string | null | undefined,
  week: number,
): Record<string, number> {
  const p = (pos ?? "").toUpperCase();
  const u = (i: number) => unit(playerId, week, i);
  if (p === "QB") {
    const att = 26 + Math.floor(u(1) * 18);
    const cmp = Math.min(att, Math.round(att * (0.58 + u(2) * 0.2)));
    return {
      pass_cmp: cmp,
      pass_inc: att - cmp,
      pass_yd: 190 + Math.round(u(3) * 200),
      pass_td: Math.floor(u(4) * 4),
      pass_int: u(5) < 0.35 ? 1 : u(5) < 0.12 ? 2 : 0,
      rush_yd: Math.round(u(6) * 55),
      rush_td: u(7) < 0.22 ? 1 : 0,
    };
  }
  if (p === "RB") {
    return {
      rush_att: 8 + Math.floor(u(1) * 16),
      rush_yd: 25 + Math.round(u(2) * 95),
      rush_td: u(3) < 0.38 ? 1 : u(3) < 0.08 ? 2 : 0,
      rec: Math.floor(u(4) * 6),
      rec_yd: Math.round(u(5) * 55),
      rec_td: u(6) < 0.12 ? 1 : 0,
    };
  }
  if (p === "WR" || p === "TE") {
    const rec = 2 + Math.floor(u(1) * (p === "TE" ? 6 : 8));
    return {
      rec,
      rec_yd: rec * (8 + Math.round(u(2) * 10)),
      rec_td: u(3) < (p === "WR" ? 0.32 : 0.22) ? 1 : 0,
      rush_yd: p === "WR" && u(4) < 0.2 ? Math.round(u(5) * 18) : 0,
    };
  }
  if (p === "K") {
    const fg = 1 + Math.floor(u(1) * 3);
    return {
      fgm: fg,
      fgm_30_39: Math.min(fg, 1),
      fgm_40_49: Math.max(0, fg - 1),
      xpm: 1 + Math.floor(u(2) * 3),
    };
  }
  if (p === "DEF" || p === "DST") {
    return {
      sack: Math.floor(u(1) * 5),
      int: u(2) < 0.4 ? 1 : 0,
      fum_rec: u(3) < 0.25 ? 1 : 0,
      def_td: u(4) < 0.08 ? 1 : 0,
      pts_allow: 10 + Math.floor(u(5) * 24),
    };
  }
  return {
    rec: Math.floor(u(1) * 5),
    rec_yd: Math.round(u(2) * 50),
    rush_yd: Math.round(u(3) * 30),
  };
}

export function mergeStatBags(
  primary: Record<string, Record<string, number>>,
  fallback: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = { ...fallback };
  for (const [id, row] of Object.entries(primary)) {
    if (row && Object.keys(row).length) out[id] = row;
  }
  return out;
}

export function bookFromLeague(settings?: Record<string, number> | null): ScoringBook {
  return fromSleeperSettings(settings);
}

export function seedSideForReplay(
  side: MatchupSide,
  week: number,
  finals: Record<string, Record<string, number>>,
  book: ScoringBook,
): { side: MatchupSide; finals: Record<string, Record<string, number>> } {
  const nextFinals = { ...finals };
  const starters = side.starters.map((line) => {
    if (!line.playerId) return line;
    let bag = nextFinals[line.playerId];
    if (!bag || !Object.keys(bag).length) {
      bag = demoStatBag(line.playerId, line.player?.position, week);
      nextFinals[line.playerId] = bag;
    }
    const points = (line.points ?? 0) > 0 ? line.points : applyBook(book, bag);
    return { ...line, points, stats: bag };
  });
  return {
    side: {
      ...side,
      starters,
      points: starters.reduce((s, l) => s + (l.points ?? 0), 0),
    },
    finals: nextFinals,
  };
}

export function seedPairForReplay(
  pair: MatchupPair,
  week: number,
  finals: Record<string, Record<string, number>>,
  book: ScoringBook,
): { pair: MatchupPair; finals: Record<string, Record<string, number>> } {
  if (pairingHasScores(pair)) return { pair, finals };
  const home = seedSideForReplay(pair.home, week, finals, book);
  const away = pair.away
    ? seedSideForReplay(pair.away, week, home.finals, book)
    : { side: null, finals: home.finals };
  return {
    pair: { ...pair, home: home.side, away: away.side },
    finals: away.finals,
  };
}

export function seedPairsForReplay(
  pairs: MatchupPair[],
  week: number,
  finals: Record<string, Record<string, number>>,
  book: ScoringBook,
): { pairs: MatchupPair[]; finals: Record<string, Record<string, number>> } {
  let bags = finals;
  const next = pairs.map((pair) => {
    const seeded = seedPairForReplay(pair, week, bags, book);
    bags = seeded.finals;
    return seeded.pair;
  });
  return { pairs: next, finals: bags };
}

/**
 * `pts / final` — the fraction of a player's final that's been earned so
 * far, 0 at kickoff and 1 at the final. Reuses `replayPts`'s own event
 * schedule with `finalPts = 1` so it's the same irregular, soft-staircase
 * shape as points, just normalized to a fraction — this is what
 * `replayStats` scales a raw stat bag by.
 *
 * `phaseIndex` may be fractional — see `replayPts`.
 */
export function replayProgress(playerId: string, phaseIndex: number, week: number): number {
  return replayPts(playerId, 1, phaseIndex, week);
}

/**
 * Cumulative unofficial points at this phase. Last phase always equals the
 * real final, exactly (see `eventCredits` — the short-circuit below never
 * has to round a sum of scaled credits back onto `finalPts`).
 *
 * `phaseIndex` may be fractional (e.g. 2.5, halfway between phase 2 and
 * phase 3, or any real number from `useSimProgress()`'s wall-clock
 * interpolation) — it maps onto continuous game progress `p = phaseIndex /
 * last` and sums every event credit whose (also continuous, irregular)
 * progress has already passed. Because credits land at arbitrary points
 * in `[0.02, 0.98]` rather than at phase boundaries, sampling this on a
 * timer draws a soft, irregular staircase instead of nine flats-and-cliffs.
 */
export function replayPts(
  playerId: string,
  finalPts: number,
  phaseIndex: number,
  week: number,
): number {
  if (finalPts <= 0 || phaseIndex <= 0) return 0;
  const last = REPLAY_PHASES.length - 1;
  if (phaseIndex >= last) return finalPts;

  const p = phaseIndex / last;
  const credits = eventCredits(playerId, finalPts, week);
  const rawSum = credits.reduce((s, c) => s + c.raw, 0) || 1;
  const scale = finalPts / rawSum;

  let acc = 0;
  for (const c of credits) {
    if (c.progress <= p) acc += c.raw * scale;
  }
  return Math.round(acc * 10) / 10;
}

/**
 * Unfold a Sleeper week-stat bag to this phase. Last phase is the real
 * final. `phaseIndex` may be fractional — see `replayProgress`.
 */
export function replayStats(
  playerId: string,
  final: Record<string, number> | null | undefined,
  phaseIndex: number,
  week: number,
): Record<string, number> {
  if (!final) return {};
  if (phaseIndex <= 0) return {};
  const last = REPLAY_PHASES.length - 1;
  if (phaseIndex >= last) return final;
  const p = replayProgress(playerId, phaseIndex, week);
  if (p <= 0) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(final)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value === 0) continue;
    if (key.startsWith("pts_") || key === "gp" || key.startsWith("pos_rank")) continue;
    const scaled = value * p;
    out[key] =
      COUNT_KEYS.has(key) || Number.isInteger(value)
        ? Math.round(scaled)
        : Math.round(scaled * 10) / 10;
  }
  return out;
}

/** Maps `replayStats` over a whole finals table. `phaseIndex` may be fractional. */
export function replayStatMap(
  finals: Record<string, Record<string, number>>,
  phaseIndex: number,
  week: number,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [id, row] of Object.entries(finals)) {
    out[id] = replayStats(id, row, phaseIndex, week);
  }
  return out;
}

/**
 * `phaseIndex` may be fractional for smooth points/stats — the play-by-play
 * facing bits (`GameChip.state`/`detail`, drawn from `REPLAY_PHASES`) always
 * floor it first, so the clock/label still steps discretely one phase at a
 * time even while the painted totals climb continuously toward it.
 */
export function applyReplaySide(
  side: MatchupSide,
  week: number,
  phaseIndex: number,
  finals?: Record<string, Record<string, number>>,
): MatchupSide {
  const phase = REPLAY_PHASES[Math.floor(phaseIndex)] ?? REPLAY_PHASES[0]!;
  const starters = side.starters.map((line) => {
    const final = line.points ?? 0;
    const points = line.playerId ? replayPts(line.playerId, final, phaseIndex, week) : null;
    const game: GameChip | null = line.player
      ? {
          state: phase.state,
          detail: phase.detail,
          opp: line.game?.opp ?? null,
          gameId: line.game?.gameId ?? null,
        }
      : null;
    const stats = line.playerId
      ? replayStats(line.playerId, finals?.[line.playerId], phaseIndex, week)
      : undefined;
    return { ...line, points, game, stats };
  });
  return {
    ...side,
    starters,
    points: starters.reduce((s, l) => s + (l.points ?? 0), 0),
  };
}

export function applyReplayPairs(
  pairs: MatchupPair[],
  week: number,
  phaseIndex: number,
  finals?: Record<string, Record<string, number>>,
): MatchupPair[] {
  return pairs.map((pair) => ({
    ...pair,
    home: applyReplaySide(pair.home, week, phaseIndex, finals),
    away: pair.away ? applyReplaySide(pair.away, week, phaseIndex, finals) : null,
  }));
}
