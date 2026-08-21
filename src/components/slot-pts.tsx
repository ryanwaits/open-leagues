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

/** Points on a matchup row — unofficial, or a dimmed weekly forecast. */
export function SlotPts({
  points,
  forecast,
  bump: _bump = 0,
  align = "right",
  reserve: _reserve = false,
  expected,
  expectedTone,
  live = false,
  className,
}: {
  points: number | null | undefined;
  forecast?: "proj" | "bye" | "out";
  bump?: number;
  align?: "left" | "right";
  /** Kept so callers that reserved a note line do not have to change. */
  reserve?: boolean;
  /** Live-adjusted expected final. Shown faintly while the game is still on. */
  expected?: number | null;
  /**
   * Colours the expected line and prefixes it "pace" instead of the default
   * faint, unlabelled figure — the lineup toggle's on-state.
   */
  expectedTone?: "good" | "alarm" | null;
  /** Unofficial live scoring — never projections. */
  live?: boolean;
  className?: string;
}) {
  const note = forecast && forecast !== "proj" ? forecast : null;
  const flash = useScoreFlash(points, Boolean(live) && !note);
  const gain =
    !note && Math.abs(flash) > 0.04 ? `${flash > 0 ? "+" : ""}${formatPts(flash, 1)}` : null;
  const rest = !note && !gain && expected != null && points != null && expected - points > 0.25;
  return (
    <span
      className={cn(
        // min-h-8 matches the compact avatar so a lone score sits on the same
        // midline as name + meta, including when a bye/out/gain line is absent.
        "flex min-h-8 w-16 shrink-0 flex-col justify-center font-mono text-xs leading-none tabular-nums",
        align === "left" ? "items-start text-left" : "items-end text-right",
        forecast && "text-muted",
        className,
      )}
    >
      {formatPts(points, 1)}
      {note ? (
        <span className="mt-0.5 text-[10px] leading-tight uppercase tracking-wide text-faint">
          {note}
        </span>
      ) : gain ? (
        <span
          className={cn(
            "mt-0.5 text-[10px] leading-tight motion-safe:animate-[score-flash_4.5s_ease-out_forwards]",
            flash < 0 ? "text-loss" : "text-accent-strong",
          )}
        >
          {gain}
        </span>
      ) : rest ? (
        <span
          className={cn(
            "mt-0.5 text-[10px] leading-tight",
            expectedTone === "good"
              ? "text-accent-strong"
              : expectedTone === "alarm"
                ? "text-loss"
                : "text-faint",
          )}
        >
          {expectedTone ? "pace " : ""}
          {formatPts(expected, 1)}
        </span>
      ) : null}
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
