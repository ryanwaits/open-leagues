import type { GameChip } from "@/lib/data/types";
import { fractionRemaining } from "./win-probability";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function role(pos: string | null | undefined): "pass" | "rush" | "kick" | "other" {
  const p = (pos ?? "").toUpperCase();
  if (p === "QB" || p === "WR" || p === "TE") return "pass";
  if (p === "RB") return "rush";
  if (p === "K") return "kick";
  return "other";
}

/**
 * Late-game script. Protect = winning and killing clock. Chase = trailing
 * and throwing. Amount is a remaining-points multiplier, not a new projection.
 */
function scriptMult(
  pos: string | null | undefined,
  remaining: number,
  margin: number | null | undefined,
): number {
  if (margin == null || remaining > 0.22) return 1;
  const abs = Math.abs(margin);
  const late = remaining <= 0.14;
  const veryLate = remaining <= 0.07;
  const blowout = (late && abs >= 16) || (veryLate && abs >= 10);
  const tilt = blowout ? (veryLate ? 0.28 : 0.18) : late && abs >= 8 ? 0.08 : 0;
  if (tilt === 0) return 1;
  const protect = margin > 0;
  const r = role(pos);
  if (protect) {
    if (r === "pass") return 1 - tilt;
    if (r === "rush") return 1 + tilt * 0.55;
    if (r === "kick") return 1 - tilt * 0.35;
    return 1;
  }
  if (r === "pass") return 1 + tilt;
  if (r === "rush") return 1 - tilt * 0.5;
  if (r === "kick") return 1 + tilt * 0.15;
  return 1;
}

export type LiveProjInput = {
  baseline: number;
  current: number;
  game: GameChip | null | undefined;
  position?: string | null;
};

/**
 * Expected final for one player: unofficial so far + remaining baseline,
 * paced by how they are tracking vs time, then tilted by the game script.
 */
export function liveProjection(input: LiveProjInput): number {
  const base = Math.max(0, input.baseline);
  const curr = Math.max(0, input.current);
  if (!input.game || input.game.state === "pre") return round1(base);
  const rem = fractionRemaining(input.game);
  if (input.game.state === "post" || rem <= 0.008) return round1(curr);

  const expectedSoFar = base * (1 - rem);
  const rawPace = expectedSoFar < 0.75 ? 1 : curr / expectedSoFar;
  const pace = clamp(rawPace, 0.4, 1.9);
  const trust = 0.22 + 0.62 * (1 - rem);
  const adjPace = 1 + (pace - 1) * trust;
  const remainingPts = base * rem * adjPace * scriptMult(input.position, rem, input.game.margin);
  return round1(curr + Math.max(0, remainingPts));
}
