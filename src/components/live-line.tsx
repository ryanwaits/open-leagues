/**
 * The one place every real-time line chart on Open Leagues goes through —
 * the matchup chart, the player watch drawer/sheet, and the home card meter
 * all render through `<LiveLine>`, and this is the only file in the repo
 * that imports `liveline` (enforced by live-line.test.mjs). Every design
 * decision about how those charts look and behave lives here, not at the
 * call sites:
 *
 * - Theme tracks `useTheme().resolved`, never a hard-coded mode.
 * - Colour comes from the CSS tokens (`--brand`, `--ink-3`, `--alarm`),
 *   read at mount and re-read on theme change — never a literal hex, except
 *   the three fallbacks below if a token is somehow missing.
 * - `momentum` is never inferred here — callers pass an explicit
 *   'up' | 'down' | 'flat' (typically from `swing()`), or `false`.
 * - Smoothing is an optional 1-minute EMA (`ema()`, alpha 0.35) on the
 *   *drawn* series only; captions should keep the exact number.
 * - Motion: `lerpSpeed` is always routed through `clampLerp()`. liveline
 *   0.0.7 adds an adaptive +0.2 speed boost internally, so a `lerpSpeed`
 *   >= 0.8 makes its interpolation go NaN — never pass an unclamped value.
 * - Momentum arrow/glow colours are hard-coded green/red inside liveline
 *   0.0.7 with no override hook; accepted for now.
 * - `frozen` (a finished game/week) shifts the series so the last sample
 *   lands on mount time (`shiftToNow()`, computed once against a mount-time
 *   ref) and renders paused from the first frame, with no pulse or
 *   momentum. liveline hides its badge while paused — callers should put
 *   the final number in a caption.
 * - SSR: the app renders on the server, and liveline needs canvas +
 *   ResizeObserver, so this renders an empty box until mounted.
 */
import {
  Liveline,
  type LivelinePoint,
  type LivelineSeries,
  type Momentum,
  type ReferenceLine,
  type WindowOption,
} from "liveline";
import { useEffect, useMemo, useRef, useState } from "react";
import { clampLerp, ema, fmtClockOfDay, type LinePoint, shiftToNow } from "@/lib/live/series";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type LineTone = "brand" | "muted" | "alarm";

export type LiveSeries = {
  id: string;
  label?: string;
  points: LinePoint[];
  tone?: LineTone;
};

export type LiveLineProps = {
  /** One series, or several. liveline disables the badge/fill/momentum once there is more than one. */
  series: LinePoint[] | LiveSeries[];
  /** Current value for a single series; defaults to the last drawn point. */
  value?: number;
  /** Single-series colour. Default "brand". */
  tone?: LineTone;
  /** px — the container needs an explicit height. */
  height: number;
  windowSecs?: number;
  windows?: WindowOption[];
  onWindowChange?: (secs: number) => void;
  referenceLine?: ReferenceLine;
  /** Explicit only — never inferred here. Default false. */
  momentum?: Momentum | false;
  /** 1-minute EMA on the drawn series. Default true. */
  smooth?: boolean;
  /** Spark mode: no grid/badge/scrub, thinner line. Discouraged for multi-series (liveline still draws its chip row). */
  quiet?: boolean;
  /** Finished series: shift to mount time and render paused from the first frame. */
  frozen?: boolean;
  formatValue?: (v: number) => string;
  formatTime?: (t: number) => string;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  className?: string;
  ariaLabel?: string;
};

const TOKEN_FALLBACK: Record<string, string> = {
  "--brand": "#6fdc93",
  "--ink-3": "#8a8b83",
  "--alarm": "#c8503a",
};

function useTokenColor(name: keyof typeof TOKEN_FALLBACK, resolved: string): string {
  // biome-ignore lint/correctness/useExhaustiveDependencies: resolved retriggers the token re-read on theme change even though the memo body doesn't reference it directly.
  return useMemo(() => {
    if (typeof document === "undefined") return TOKEN_FALLBACK[name];
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return raw || TOKEN_FALLBACK[name];
  }, [name, resolved]);
}

function drawPoints(points: LinePoint[], smooth: boolean): LivelinePoint[] {
  return smooth ? ema(points) : points;
}

function isMultiSeries(series: LinePoint[] | LiveSeries[]): series is LiveSeries[] {
  return series.length > 0 && "points" in series[0]!;
}

export function LiveLine({
  series,
  value,
  tone = "brand",
  height,
  windowSecs = 180,
  windows,
  onWindowChange,
  referenceLine,
  momentum = false,
  smooth = true,
  quiet = false,
  frozen = false,
  formatValue,
  formatTime,
  padding,
  className,
  ariaLabel,
}: LiveLineProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { resolved } = useTheme();
  const brand = useTokenColor("--brand", resolved);
  const muted = useTokenColor("--ink-3", resolved);
  const alarm = useTokenColor("--alarm", resolved);
  const toneColor: Record<LineTone, string> = { brand, muted, alarm };

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const mountNowRef = useRef(Date.now() / 1000);

  if (!mounted) {
    return <div className={cn("w-full", className)} style={{ height }} aria-hidden />;
  }

  const lerpSpeed = clampLerp(reduced ? 0.6 : 0.12);
  const pulse = !reduced && !frozen;
  const effectiveMomentum: Momentum | false = frozen ? false : (momentum ?? false);

  const shiftAndDraw = (points: LinePoint[]): LivelinePoint[] => {
    const shifted = frozen ? shiftToNow(points, mountNowRef.current) : points;
    return drawPoints(shifted, smooth);
  };

  let data: LivelinePoint[];
  let seriesProp: LivelineSeries[] | undefined;
  let color: string;
  let resolvedValue: number;

  if (isMultiSeries(series)) {
    const drawn = series.map((s) => ({
      id: s.id,
      label: s.label,
      color: toneColor[s.tone ?? "brand"],
      drawn: shiftAndDraw(s.points),
    }));
    const first = drawn[0];
    data = first?.drawn ?? [];
    color = first?.color ?? brand;
    resolvedValue = value ?? data[data.length - 1]?.value ?? 0;
    seriesProp = drawn.map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      data: s.drawn,
      value: s.drawn[s.drawn.length - 1]?.value ?? 0,
    }));
  } else {
    data = shiftAndDraw(series);
    color = toneColor[tone];
    resolvedValue = value ?? data[data.length - 1]?.value ?? 0;
  }

  return (
    <div className={cn("w-full", className)} style={{ height }} role="img" aria-label={ariaLabel}>
      <Liveline
        data={data}
        value={resolvedValue}
        series={seriesProp}
        seriesToggleCompact={seriesProp ? true : undefined}
        theme={resolved}
        color={color}
        window={windowSecs}
        windows={windows}
        onWindowChange={onWindowChange}
        windowStyle="text"
        grid={!quiet}
        badge={!quiet}
        badgeVariant="minimal"
        badgeTail={false}
        scrub={!quiet}
        fill
        momentum={effectiveMomentum}
        paused={frozen}
        pulse={pulse}
        lineWidth={quiet ? 1.5 : 2}
        lerpSpeed={lerpSpeed}
        tooltipY={12}
        referenceLine={referenceLine}
        formatTime={formatTime ?? fmtClockOfDay}
        formatValue={formatValue ?? ((v: number) => v.toFixed(1))}
        padding={padding}
      />
    </div>
  );
}
