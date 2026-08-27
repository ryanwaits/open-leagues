import type { StoredTick } from "@/lib/league/ticks.server";
import type { LinePoint } from "./series";

/**
 * The book's own history: `ol_ticks.spread`, home-signed, turned into a
 * plain `LinePoint[]` for `<LiveLine>`. Pulled out of `book-panel.tsx` so
 * the ticket can draw the same strip without importing the panel.
 */

function tickAtSecs(at: string): number {
  const ms = Date.parse(at);
  return ms / 1000;
}

/** Ascending by time; non-finite values (bad `at`, `NaN` spread) dropped. */
export function spreadPoints(ticks: readonly Pick<StoredTick, "at" | "spread">[]): LinePoint[] {
  return ticks
    .map((t) => ({ time: tickAtSecs(t.at), value: t.spread }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
}

export type SpreadSummary = {
  first: number;
  firstAt: number;
  last: number;
  lastAt: number;
  moved: number;
};

/** `null` when there is nothing to compare — fewer than two points. */
export function spreadSummary(points: readonly LinePoint[]): SpreadSummary | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return {
    first: first.value,
    firstAt: first.time,
    last: last.value,
    lastAt: last.time,
    moved: last.value - first.value,
  };
}

/**
 * The panel's price format: `PK` for a pick'em, otherwise a signed one
 * decimal with a true minus sign (U+2212), never `-0`.
 */
export function fmtSpread(n: number): string {
  if (Math.abs(n) < 0.005) return "PK";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
}
