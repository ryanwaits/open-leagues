import { cn, formatPts } from "@/lib/utils";

/** Points on a matchup row — unofficial, or a dimmed weekly forecast. */
export function SlotPts({
  points,
  forecast,
  bump = 0,
  align = "right",
  reserve = false,
  className,
}: {
  points: number | null | undefined;
  forecast?: "proj" | "bye" | "out";
  bump?: number;
  align?: "left" | "right";
  /** Hold the note line's height even when there is no note to put in it. */
  reserve?: boolean;
  className?: string;
}) {
  const note = forecast && forecast !== "proj" ? forecast : null;
  const gain = !note && bump > 0.04 ? `+${formatPts(bump, 1)}` : null;
  return (
    <span
      className={cn(
        "w-16 shrink-0 font-mono text-xs tabular-nums",
        align === "left" ? "text-left" : "text-right",
        forecast && "text-muted",
        className,
      )}
    >
      {formatPts(points, 1)}
      {note ? (
        <span className="block text-[10px] uppercase tracking-wide text-faint">{note}</span>
      ) : gain ? (
        <span className="block text-[10px] text-accent-strong">{gain}</span>
      ) : reserve ? (
        // The gain arrives on one poll and is gone by the next. On a board where
        // the two sides are read against each other, letting it push a row taller
        // and shorter again is worse than the second of blank space it costs.
        <span className="block text-[10px]" aria-hidden="true">
          &nbsp;
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
