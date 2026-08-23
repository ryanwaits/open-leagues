import { useEffect, useRef, useState } from "react";
import { cn, formatPts } from "@/lib/utils";

const FLASH_MS = 4500;

/** Live unofficial only. Missing data and first established score never notify. */
export function nextScoreFlash(
  last: number | null,
  points: number | null | undefined,
  active: boolean,
): { prev: number | null; delta: number } {
  if (!active) return { prev: null, delta: 0 };
  const curr = typeof points === "number" && Number.isFinite(points) ? points : null;
  if (curr == null) return { prev: last, delta: 0 };
  if (last == null) return { prev: curr, delta: 0 };
  const delta = curr - last;
  return { prev: curr, delta: Math.abs(delta) > 0.04 ? delta : 0 };
}

/** Delta since the last unofficial live total we actually painted. */
export function useScoreFlash(
  points: number | null | undefined,
  active = true,
  holdMs = FLASH_MS,
): number {
  const [flash, setFlash] = useState(0);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const step = nextScoreFlash(prev.current, points, active);
    prev.current = step.prev;
    if (!active) {
      setFlash(0);
      return;
    }
    if (Math.abs(step.delta) <= 0.04) return;
    setFlash(step.delta);
    const t = window.setTimeout(() => setFlash(0), holdMs);
    return () => window.clearTimeout(t);
  }, [points, active, holdMs]);
  return flash;
}

function signedDelta(n: number): string {
  const sign = n > 0.04 ? "+" : n < -0.04 ? "−" : "";
  return `${sign}${formatPts(Math.abs(n), 1)}`;
}

/** Points on a matchup row — unofficial, or a dimmed weekly forecast. */
export function SlotPts({
  points,
  forecast,
  bump: _bump = 0,
  align = "right",
  reserve: _reserve = false,
  expected,
  expectedTone,
  baseline,
  chipSide = "after",
  live = false,
  className,
}: {
  points: number | null | undefined;
  forecast?: "proj" | "bye" | "out";
  bump?: number;
  align?: "left" | "right";
  /** Kept so callers that reserved a note line do not have to change. */
  reserve?: boolean;
  /** Live-adjusted expected final. */
  expected?: number | null;
  /**
   * Colours the inline ± vs the pre-game projection — the lineup toggle's
   * on-state. Without a tone, `expected` is a faint remaining-pace figure.
   */
  expectedTone?: "good" | "alarm" | null;
  /** Pre-game projection. With `expectedTone`, the inline chip is expected − this. */
  baseline?: number | null;
  /**
   * Where the ± sits relative to the score. Matchup left column uses
   * `"before"` so the chip hangs away from the spine; lineup and the
   * right column keep `"after"`.
   */
  chipSide?: "before" | "after";
  /** Unofficial live scoring — never projections. */
  live?: boolean;
  className?: string;
}) {
  const note = forecast && forecast !== "proj" ? forecast : null;
  const flash = useScoreFlash(points, Boolean(live) && !note);
  const gain =
    !note && Math.abs(flash) > 0.04 ? `${flash > 0 ? "+" : ""}${formatPts(flash, 1)}` : null;

  let chip: { text: string; className: string } | null = null;
  if (gain) {
    chip = {
      text: gain,
      className: cn(
        "motion-safe:animate-[score-flash_4.5s_ease-out_forwards]",
        flash < 0 ? "text-loss" : "text-accent-strong",
      ),
    };
  } else if (!note && expected != null && expectedTone && baseline != null) {
    const d = expected - baseline;
    if (Math.abs(d) > 0.04) {
      chip = {
        text: signedDelta(d),
        className: expectedTone === "good" ? "text-accent-strong" : "text-loss",
      };
    }
  } else if (!note && expected != null && points != null && expected - points > 0.25) {
    chip = { text: formatPts(expected, 1), className: "text-faint" };
  }

  return (
    <span
      className={cn(
        // min-h-8 matches the compact avatar so a lone score sits on the same
        // midline as name + meta. The ± chip sits on that same line so a live
        // row is the same height as a pre-kick projection.
        "inline-flex min-h-8 shrink-0 items-center font-mono text-xs leading-none tabular-nums",
        align === "left" ? "justify-start text-left" : "justify-end text-right",
        forecast && "text-muted",
        className,
      )}
    >
      {note ? (
        <span
          className={cn(
            "flex flex-col justify-center",
            align === "left" ? "items-start" : "items-end",
          )}
        >
          <span className="leading-none">{formatPts(points, 1)}</span>
          <span className="mt-0.5 text-[10px] leading-[13px] uppercase tracking-wide text-faint">
            {note}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
          {chip && chipSide === "before" ? (
            <span className={cn("text-[11px] leading-none", chip.className)}>{chip.text}</span>
          ) : null}
          <span className="leading-none">{formatPts(points, 1)}</span>
          {chip && chipSide === "after" ? (
            <span className={cn("text-[11px] leading-none", chip.className)}>{chip.text}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}

/**
 * Team total: unofficial on the left, forecast parked in light gray on the right
 * until that side has actually kicked off.
 *
 * `reserve` holds the forecast's space after it goes away. The forecast is there
 * all week and gone the moment a side kicks off, so on a scoreboard that stays on
 * screen through kickoff its departure would otherwise pull the total upward.
 */
export function TeamTotal({
  live = 0,
  projected,
  showProjected = false,
  size = "lg",
  flip = false,
  reserve = false,
}: {
  live?: number;
  projected?: number | null;
  showProjected?: boolean;
  size?: "lg" | "md";
  flip?: boolean;
  reserve?: boolean;
}) {
  const forecast = showProjected && projected != null;
  if (size === "md") {
    return (
      <span className="block">
        <span className="block font-display text-2xl tabular-nums tracking-tight">
          {formatPts(live, 2)}
        </span>
        {forecast ? (
          <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-faint">
            {formatPts(projected, 1)}
            <span className="ml-1 uppercase tracking-wide">proj</span>
          </span>
        ) : reserve ? (
          <span className="mt-0.5 block font-mono text-[11px]" aria-hidden="true">
            &nbsp;
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={cn("flex w-full items-baseline justify-between gap-6", flip && "flex-row-reverse")}
    >
      <span className="font-display text-3xl tabular-nums tracking-tight">
        {formatPts(live, 2)}
      </span>
      {forecast ? (
        <span className={cn("min-w-0", flip ? "text-left" : "text-right")}>
          <span className="block font-display text-2xl tabular-nums tracking-tight text-faint">
            {formatPts(projected, 1)}
          </span>
          <span className="block microlabel-data">proj</span>
        </span>
      ) : reserve ? (
        // Same two lines, no numbers — the height comes out right without having
        // to name it, and there is no stale figure sitting behind the curtain.
        <span className="invisible min-w-0" aria-hidden="true">
          <span className="block font-display text-2xl tracking-tight">&nbsp;</span>
          <span className="block microlabel-data">proj</span>
        </span>
      ) : null}
    </span>
  );
}
