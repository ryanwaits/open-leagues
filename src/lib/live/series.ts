/**
 * Pure math and formatting shared by every live-line surface — the matchup
 * chart, the player watch drawer/sheet, and the home card. No React, no
 * canvas: just the sample smoothing, momentum, frozen-series shift, motion
 * clamp, ring buffer, and time formatters that `<LiveLine>` and its callers
 * build on. Keeping this here (instead of in the component or in
 * `src/lib/utils.ts`) means the three surfaces read the same numbers off the
 * same math, not three approximations of it.
 */

export type LinePoint = { time: number; value: number }; // time = unix seconds

/**
 * Exponential moving average over a sample series. `alpha` in (0,1]; 0.35 is
 * roughly a 1-minute window at 4 samples/min (a 15s poll). Returns a new
 * array; the first point is unchanged (nothing to smooth against yet).
 */
export function ema(points: readonly LinePoint[], alpha = 0.35): LinePoint[] {
  const out: LinePoint[] = [];
  let prev: number | null = null;
  for (const p of points) {
    const value: number = prev == null ? p.value : alpha * p.value + (1 - alpha) * prev;
    out.push({ time: p.time, value });
    prev = value;
  }
  return out;
}

/**
 * Momentum, defined by us: change over the last `windowSecs`, thresholded.
 * Never the sign of the last tick — a single noisy sample should not flip
 * the arrow.
 */
export type Swing = { dir: "up" | "down" | "flat"; delta: number };

export function swing(points: readonly LinePoint[], windowSecs: number, threshold: number): Swing {
  const n = points.length;
  if (n < 2) return { dir: "flat", delta: 0 };
  const last = points[n - 1]!;
  let ref = points[0]!;
  for (let i = n - 2; i >= 0; i--) {
    const p = points[i]!;
    if (last.time - p.time >= windowSecs) {
      ref = p;
      break;
    }
  }
  const delta = last.value - ref.value;
  const dir = delta > threshold ? "up" : delta < -threshold ? "down" : "flat";
  return { dir, delta };
}

/**
 * Frozen mode: shift a finished series so its last sample lands on
 * `nowSecs` (default `Date.now()/1000`), preserving the gaps between
 * samples. Returns a new array; the input is never mutated. Empty in,
 * empty out.
 */
export function shiftToNow(points: readonly LinePoint[], nowSecs?: number): LinePoint[] {
  if (points.length === 0) return [];
  const now = nowSecs ?? Date.now() / 1000;
  const last = points[points.length - 1]!;
  const shift = now - last.time;
  return points.map((p) => ({ time: p.time + shift, value: p.value }));
}

/**
 * liveline adds an adaptive +0.2 speed boost internally; at `lerpSpeed`
 * >= 0.8 the interpolation formula goes NaN. Clamp every value routed to
 * liveline's `lerpSpeed` through here.
 */
export function clampLerp(speed: number): number {
  if (!Number.isFinite(speed)) return 0.01;
  return Math.min(0.6, Math.max(0.01, speed));
}

/** Ring buffer for per-poll samples, module-level, keyed by the surface. */
export function bufferKey(leagueId: string, week: number, id: string | number): string {
  return `${leagueId}:${week}:${id}`;
}

const buffers = new Map<string, LinePoint[]>();

/**
 * Appends `{ time, value }` to the buffer at `key`, ignoring non-finite
 * values. De-bounces a double poll: if the previous sample has the same
 * value and is less than 1s older, the new sample is dropped. Trims to
 * `cap` (default 3600) oldest-first. Returns the buffer's own array (same
 * reference across calls for a given key).
 */
export function appendSample(key: string, value: number, atSecs?: number, cap = 3600): LinePoint[] {
  let arr = buffers.get(key);
  if (!arr) {
    arr = [];
    buffers.set(key, arr);
  }
  if (!Number.isFinite(value)) return arr;
  const time = atSecs ?? Date.now() / 1000;
  const prev = arr[arr.length - 1];
  if (prev && prev.value === value && time - prev.time < 1) return arr;
  arr.push({ time, value });
  if (arr.length > cap) arr.splice(0, arr.length - cap);
  return arr;
}

/** Buffer contents for `key`, or `[]` if nothing has been appended yet. */
export function readSeries(key: string): LinePoint[] {
  return buffers.get(key) ?? [];
}

/** Clears one buffer, or every buffer when `key` is omitted (tests). */
export function clearSeries(key?: string): void {
  if (key === undefined) buffers.clear();
  else buffers.delete(key);
}

/**
 * Time label for liveline's `formatTime`: local clock-of-day, minutes
 * omitted on the hour. "1p", "4:25p", "11:30a", "12p", "12:05a".
 */
export function fmtClockOfDay(unixSecs: number): string {
  const d = new Date(unixSecs * 1000);
  const mins = d.getMinutes();
  const suffix = d.getHours() >= 12 ? "p" : "a";
  const hours12 = d.getHours() % 12 || 12;
  const minsPart = mins === 0 ? "" : `:${String(mins).padStart(2, "0")}`;
  return `${hours12}${minsPart}${suffix}`;
}

function clockDigits(totalSecs: number): string {
  // Round first: callers often pass fractional unix-second deltas (Date.now()/1000
  // arithmetic), and a fractional remainder here would leak into the seconds digits.
  const whole = Math.max(0, Math.round(totalSecs));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Time label for `formatTime` when the x-axis is kickoff-relative seconds
 * rather than wall time: quarters of 900s, then one 600s OT period.
 * "Q1 15:00" at 0, "Q3 6:40" at 2300, "OT 10:00" at 3600. Before kickoff:
 * "Kick".
 */
export function fmtGameClock(secsSinceKickoff: number): string {
  if (secsSinceKickoff < 0) return "Kick";
  if (secsSinceKickoff < 3600) {
    const quarter = Math.floor(secsSinceKickoff / 900) + 1;
    const remaining = 900 - (secsSinceKickoff % 900);
    return `Q${quarter} ${clockDigits(remaining)}`;
  }
  const otElapsed = (secsSinceKickoff - 3600) % 600;
  return `OT ${clockDigits(600 - otElapsed)}`;
}
