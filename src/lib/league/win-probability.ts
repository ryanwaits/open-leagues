import type { GameChip } from "@/lib/data/types";

/**
 * Win probability, from first principles.
 *
 * There is no package for this. The fantasy-specific ones on npm are API
 * clients, and the statistics libraries would be supplying exactly one function
 * (the normal CDF), which is fifteen lines. So this is the whole model:
 *
 *   margin  = lead + (points A has left) - (points B has left)
 *   each side's remaining points is a sum of per-player random variables
 *   sums of enough independent variables go normal, so
 *   P(win) = Phi(expected margin / standard deviation of margin)
 *
 * The mean and spread per player are measured, not assumed: both come from that
 * player's own weekly series scored under this league's book. Everything hard
 * about this problem is in the inputs, not the arithmetic.
 */

export type PlayerOutlook = {
  playerId: string;
  team: string | null;
  position: string | null;
  /** Full-game expectation, this league's scoring. */
  mean: number;
  /** Standard deviation of that player's weekly scores. */
  sd: number;
  game: GameChip | null | undefined;
};

export type WinProb = {
  /** 0 to 1, from the first side's point of view. */
  probability: number;
  expectedMargin: number;
  marginSd: number;
  /** Expected final scores. */
  projected: [number, number];
  /** How much of each side's slate is still to come, 0 to 1. */
  remaining: [number, number];
  /** False when there is nothing left to model and the result is decided. */
  live: boolean;
};

/**
 * Standard normal CDF via the Abramowitz and Stegun 7.1.26 error-function
 * approximation. Absolute error under 1.5e-7, which is four orders of magnitude
 * finer than a number we round to a whole percent.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Fraction of a player's game still to be played.
 *
 * ESPN's short detail is a display string, not an API, so this parses the
 * shapes it actually emits and falls back to a whole game rather than guessing
 * wrong in the confident direction.
 */
export function fractionRemaining(game: GameChip | null | undefined): number {
  if (!game) return 1;
  if (game.state === "post") return 0;
  if (game.state === "pre") return 1;

  const d = (game.detail ?? "").toLowerCase();
  if (d.includes("half")) return 0.5;
  if (d.includes("end of")) {
    const q = Number(d.match(/(\d)/)?.[1] ?? 0);
    return q > 0 ? Math.max(0, (4 - q) / 4) : 0.5;
  }
  if (d.startsWith("ot") || d.includes("overtime") || d.includes(" - ot")) return 0.08;

  const espn = d.match(/(\d+):(\d+)\s*[-–]\s*(\d+)(?:st|nd|rd|th)?/);
  if (espn) {
    const left = Number(espn[1]) + Number(espn[2]) / 60;
    const quarter = Number(espn[3]);
    const quartersAfter = Math.max(0, 4 - quarter);
    return Math.min(1, Math.max(0, (left + quartersAfter * 15) / 60));
  }

  const m = d.match(/q(\d)\s+(\d+):(\d+)/);
  if (m) {
    const quarter = Number(m[1]);
    const left = Number(m[2]) + Number(m[3]) / 60;
    const quartersAfter = Math.max(0, 4 - quarter);
    return Math.min(1, (left + quartersAfter * 15) / 60);
  }
  // In progress but unparseable: assume most of it is gone rather than none.
  return 0.5;
}

/**
 * Same-team quarterbacks and pass catchers rise and fall together, so treating
 * them as independent understates the spread and makes every probability look
 * more certain than it is. This is the one correlation big enough to matter and
 * cheap enough to include.
 */
const STACK_RHO = 0.25;
const CATCHERS = new Set(["WR", "TE"]);

function sideVariance(players: PlayerOutlook[]): number {
  const live = players.filter((p) => fractionRemaining(p.game) > 0);
  let variance = 0;
  for (const p of live) {
    const f = fractionRemaining(p.game);
    variance += p.sd * p.sd * f;
  }
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i]!;
      const b = live[j]!;
      if (!a.team || a.team !== b.team) continue;
      const stacked =
        (a.position === "QB" && CATCHERS.has(b.position ?? "")) ||
        (b.position === "QB" && CATCHERS.has(a.position ?? ""));
      if (!stacked) continue;
      const fa = fractionRemaining(a.game);
      const fb = fractionRemaining(b.game);
      variance += 2 * STACK_RHO * a.sd * b.sd * Math.sqrt(fa * fb);
    }
  }
  return variance;
}

function sideMean(players: PlayerOutlook[]): number {
  return players.reduce((t, p) => t + p.mean * fractionRemaining(p.game), 0);
}

export function winProbability(input: {
  /** Points already on the board. */
  scores: [number, number];
  starters: [PlayerOutlook[], PlayerOutlook[]];
}): WinProb {
  const [scoreA, scoreB] = input.scores;
  const [a, b] = input.starters;

  const remA = sideMean(a);
  const remB = sideMean(b);
  const varA = sideVariance(a);
  const varB = sideVariance(b);

  const expectedMargin = scoreA + remA - (scoreB + remB);
  const marginSd = Math.sqrt(varA + varB);

  const slateA = a.length ? a.reduce((t, p) => t + fractionRemaining(p.game), 0) / a.length : 0;
  const slateB = b.length ? b.reduce((t, p) => t + fractionRemaining(p.game), 0) / b.length : 0;

  // Nothing left to play: the scoreboard is the answer, not a distribution.
  if (marginSd < 0.01) {
    return {
      probability: expectedMargin > 0 ? 1 : expectedMargin < 0 ? 0 : 0.5,
      expectedMargin,
      marginSd: 0,
      projected: [scoreA + remA, scoreB + remB],
      remaining: [slateA, slateB],
      live: false,
    };
  }

  return {
    probability: normalCdf(expectedMargin / marginSd),
    expectedMargin,
    marginSd,
    projected: [scoreA + remA, scoreB + remB],
    remaining: [slateA, slateB],
    live: true,
  };
}
