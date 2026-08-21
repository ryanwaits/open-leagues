# Plan 053: Liveline foundation — one `<LiveLine>` wrapper, series utils, dev gallery

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69cd95b..HEAD -- package.json src/lib/theme.ts src/components/live-line.tsx src/lib/live src/routes/dev`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (purely additive; nothing existing imports it yet)
- **Depends on**: none
- **Category**: direction (Sprint 0 of the liveline integration; 054–056 build on it)
- **Planned at**: commit `69cd95b`, 2026-08-21

## Why this matters

Open Leagues is about to put real‑time line charts on three surfaces (the
matchup page, the player watch drawer / sheet, and the home card). The
rendering engine is the `liveline` npm package (React canvas line chart,
streaming, 60 fps). Every design decision about how those charts look and
behave — theme, colours, badge style, momentum semantics, smoothing, reduced
motion, how a finished game is frozen — was settled in a design session and
must live in **exactly one place**, so the three surfaces cannot drift from
each other and nobody has to remember liveline's gotchas. This plan adds the
package, the wrapper component that owns those decisions, the small pure
utilities the surfaces will share (EMA, swing/momentum, ring buffer,
remap‑to‑now, formatters), unit tests for the utilities, and a dev‑only
gallery route so the wrapper can be looked at in the browser before any
product surface uses it. No product page changes here.

## Design decisions this wrapper must encode (the "spec")

These were locked with the product owner. Encode them as defaults / behaviour;
do not re‑decide them.

| Decision | Value |
|---|---|
| Theme | `theme` prop to liveline = `useTheme().resolved` (`"light" \| "dark"`) from `src/lib/theme.ts`. Never hard‑code. |
| Colours | Read from CSS tokens at mount and on theme change: `--brand` (you / default), `--ink-3` (them / muted), `--alarm` (below‑baseline / negative). Never literal hex in the component. |
| Badge | `badgeVariant="minimal"`, `badgeTail={false}`. `badge` off when `quiet`. |
| Momentum | **Never auto.** liveline's `momentum` prop is always passed as an explicit `'up' \| 'down' \| 'flat'` (from the caller, typically computed with `swing()`), or `false`. Default `false`. |
| Smoothing | Optional 1‑minute EMA on the *drawn* series only (`smooth` prop, default `true`); the caller keeps the exact number for captions. Implemented with `ema()` from the utils, alpha `0.35` per sample (≈4 samples/min at a 15 s poll). |
| Motion | `lerpSpeed 0.12`; when `prefers-reduced-motion: reduce` → `lerpSpeed 0.6`, `pulse false`. **Never ≥ 0.8**: liveline adds an adaptive `+0.2` boost internally and `1 - (1-speed)^x` goes NaN — guard with `clampLerp()`. |
| Momentum arrows/glow colours | liveline hard‑codes `#22c55e` / `#ef4444`; accept for now (no override exists). Note in the wrapper's doc comment. |
| Frozen mode | For a finished game/week: shift the series so its **last sample = mount time** (`shiftToNow()`), render with `paused` from the first frame, `pulse false`, `momentum false`. Scrub still works. liveline hides the badge while paused — callers put the final number in a caption. |
| Window | `windowSecs` prop (liveline `window`), optional `windows` chips with `windowStyle="text"`. |
| Grid / scrub | On by default; both off when `quiet` (sparks). |
| Time labels | `formatTime` defaults to clock‑of‑day (`1p`, `4:25p`); callers can pass `fmtGameClock` for kickoff‑relative seconds (`Q3 6:40`). |
| Multi‑series | Supported via liveline's `series` prop; liveline disables badge/fill/momentum in that mode — that's fine. |
| Lists | No canvas in lists (that's a rule for the surfaces, not this wrapper — but the wrapper's `quiet` mode exists so a single small spark can be drawn where one is allowed). |
| SSR | The app is TanStack Start (SSR). liveline needs `canvas` + `ResizeObserver`. The wrapper renders an empty box of the requested height on the server and until mounted, then the chart. |
| Import rule | Nobody imports `liveline` except `src/components/live-line.tsx`. Enforced by a source‑assertion test. |

## Current state

- `package.json` — bun workspace (`"packageManager": "bun@1.3.10"`), React `^19` (`node_modules/react` is 19.2.8), TanStack Start/Router, Tailwind v4, Biome. Scripts (`package.json:10-22`):
  ```json
  "dev": "vite dev --host 0.0.0.0 --port 8080",
  "build": "vite build && bun run db:migrate",
  "typecheck": "tsc --noEmit",
  "test": "bun test src scripts",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  ```
  `liveline` is **not** a dependency yet. Target version: `liveline@0.0.7` (peer `react >= 18`; ESM `dist/index.js`, types `dist/index.d.ts`; exports `Liveline`, `LivelineTransition`, types `LivelinePoint {time:number; value:number}`, `LivelineSeries {id, data, value, color, label?}`, `ReferenceLine {value,label?}`, `Momentum = 'up'|'down'|'flat'`, `WindowOption {label, secs}`, `HoverPoint`).
- `src/lib/theme.ts` — theme store. `useTheme()` returns `{ pref, resolved, setPref }` where `resolved` is `"light" | "dark"` (`src/lib/theme.ts:94-110`). The `<html>` element carries `data-theme="light|dark"`.
- `src/skin/tokens.css` — raw colour tokens on `:root` / dark blocks: `--brand`, `--brand-deep`, `--brand-strong`, `--ink`, `--ink-2`, `--ink-3`, `--alarm`, `--hairline`, … (`src/skin/tokens.css:1-40`). Components read colour through Tailwind utilities (`bg-accent`, `text-faint`) — for a canvas we need the raw value, so the wrapper reads `getComputedStyle(document.documentElement).getPropertyValue("--brand")`.
- `src/lib/utils.ts` — `cn()`, `formatPts()`; general helpers live here. New *live‑series* helpers go in a new folder `src/lib/live/` (created by this plan) rather than bloating `utils.ts`.
- Test convention — `bun:test` + `node:assert/strict`, files named `*.test.mjs` next to the source, importing TS directly. Exemplar: `src/lib/league/live-proj.test.mjs:1-20`:
  ```js
  import { test } from "bun:test";
  import assert from "node:assert/strict";
  import { liveProjection } from "./live-proj.ts";
  test("pre-kickoff is the weekly baseline", () => { … assert.equal(…) });
  ```
  Source‑assertion test exemplar (reads files, asserts on text): `src/skin/skin.test.mjs:1-40`.
- Route convention — file routes under `src/routes/`, e.g. `src/routes/data.tsx:9`:
  ```ts
  export const Route = createFileRoute("/data")({ component: DataPage });
  ```
  `src/routeTree.gen.ts` is generated by the router plugin during `vite dev`/`vite build` — do not hand‑edit it; it is regenerated when a route file is added (it will show as modified after the build; commit it).
- Dev‑only gating convention — `src/lib/demo/store.ts:26`: `export const demoAvailable = import.meta.env.DEV;`.
- Code style — Biome: double quotes, semicolons, trailing commas, 2‑space indent, line width 100. Components are function components with a doc comment explaining intent (see `src/components/slot-pts.tsx` top comment).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Install dep | `bun add liveline@0.0.7` | `package.json` gains `"liveline": "0.0.7"` (or `^0.0.7`), `bun.lock` updated, exit 0 |
| Typecheck | `bun run typecheck` | exit 0, no errors |
| Tests (scoped) | `bun test src/lib/live src/components/live-line.test.mjs` | all pass |
| Tests (all) | `bun test src scripts` | all pass |
| Lint | `bun run lint` | exit 0 ("Checked N files. No fixes applied.") |
| Lint fix | `bun run lint:fix` | formats in place |
| Build (regenerates route tree) | `bun run build` | exit 0 |
| Dev server | `bun run dev` (port 8080; may already be running — check `lsof -iTCP:8080 -sTCP:LISTEN`) | serves `/dev/liveline` |

## Suggested executor toolkit

- Read `node_modules/liveline/README.md` and `node_modules/liveline/dist/index.d.ts` after install — the props table there is the authority on names/types.
- Optional visual check of the gallery with `agent-browser` (`~/.bun/bin/agent-browser open http://localhost:8080/dev/liveline`, then `screenshot`). Run it with the Bash sandbox disabled if your environment has one.

## Scope

**In scope** (the only files you should modify/create):
- `package.json`, `bun.lock` (dependency add only)
- `src/lib/live/series.ts` (create)
- `src/lib/live/series.test.mjs` (create)
- `src/components/live-line.tsx` (create)
- `src/components/live-line.test.mjs` (create)
- `src/routes/dev/liveline.tsx` (create)
- `src/routeTree.gen.ts` (regenerated by the build — commit the regenerated file, never hand‑edit)

**Out of scope** (do NOT touch):
- Any product surface: `matchup-edge.tsx`, `matchup-card.tsx`, `player-watch.tsx`, `player-sheet.tsx`, `lineup-board.tsx`, `book-panel.tsx`, routes under `src/routes/league/**`. Those are later plans (054–056).
- `src/lib/theme.ts`, `src/skin/**`, `src/styles.css` — read only.
- Any server code, migrations, `src/lib/league/**`.

## Git workflow

- Work directly on the current branch (`main` unless told otherwise).
- Conventional commits, scoped, matching `git log`: e.g. `feat(live): liveline wrapper, series utils and dev gallery`. One commit for this plan is fine; two (deps / code) also fine.
- Do NOT push.

## Steps

### Step 1: Add the dependency

Run `bun add liveline@0.0.7`.

**Verify**: `grep -n '"liveline"' package.json` → one line; `ls node_modules/liveline/dist/index.d.ts` → exists; `bun run typecheck` → exit 0.

### Step 2: Pure series utilities — `src/lib/live/series.ts`

Create the folder and file. Export exactly these (names are load‑bearing; later plans import them):

```ts
export type LinePoint = { time: number; value: number }; // time = unix seconds

/** Exponential moving average over a sample series. alpha in (0,1]; 0.35 ≈ a 1‑minute window at 4 samples/min. Returns a new array; first point unchanged. */
export function ema(points: readonly LinePoint[], alpha = 0.35): LinePoint[];

/** Momentum, defined by us: change over the last `windowSecs`, thresholded. Never the sign of the last tick. */
export type Swing = { dir: "up" | "down" | "flat"; delta: number };
export function swing(points: readonly LinePoint[], windowSecs: number, threshold: number): Swing;
// Implementation: if < 2 points → flat/0. Let last = points[n-1]; walk back to the first point with last.time - p.time >= windowSecs (or points[0] if none); delta = last.value - p.value; dir by ±threshold.

/** Frozen mode: shift a finished series so its last sample lands on `nowSecs` (default Date.now()/1000). Returns a new array. Empty → []. */
export function shiftToNow(points: readonly LinePoint[], nowSecs?: number): LinePoint[];

/** liveline adds an adaptive +0.2 speed boost; ≥0.8 → NaN. Clamp to [0.01, 0.6]. */
export function clampLerp(speed: number): number;

/** Ring buffer for per‑poll samples, module‑level, keyed by the surface. */
export function bufferKey(leagueId: string, week: number, id: string | number): string; // `${leagueId}:${week}:${id}`
export function appendSample(key: string, value: number, atSecs?: number, cap?: number): LinePoint[];
// Appends {time: atSecs ?? Date.now()/1000, value}; ignores non‑finite values; if the previous sample has the same value AND is < 1 s older, skip (de‑bounce double polls); trims to `cap` (default 3600) oldest‑first; returns the (same) array.
export function readSeries(key: string): LinePoint[];   // [] if unknown
export function clearSeries(key?: string): void;        // one key, or everything (tests)

/** Time formatters for liveline's `formatTime` (unix seconds in). */
export function fmtClockOfDay(unixSecs: number): string;
// Local time. "1p", "4:25p", "11:30a", "12p". Minutes omitted when :00.
export function fmtGameClock(secsSinceKickoff: number): string;
// 0..3600 → quarters of 900 s: "Q1 15:00" at 0, "Q3 6:40" at 1800+500; ≥3600 → "OT m:ss" (one OT period); negative → "Kick".
```

Conventions: top‑of‑file doc comment (why these exist: one place for the math the live surfaces share), no React imports, no DOM access except the `Date.now()` default. Keep `readonly` inputs; never mutate caller arrays except the buffer's own array.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 3: Unit tests — `src/lib/live/series.test.mjs`

Model after `src/lib/league/live-proj.test.mjs`. Cover at least:

- `ema`: first point unchanged; `alpha=1` returns the input values; a step `0,0,10,10,10` with alpha 0.35 yields a monotone approach to 10 with the 3rd value `3.5` (±0.001) and the 5th `< 10`.
- `swing`: `<2` points → `flat`; rising `+2` over 60 s with window 300 and threshold 1.2 → `up`, `delta ≈ 2`; same magnitude with threshold 3 → `flat`; falling → `down`; the window walks back past intermediate points (5 points, 15 s apart, window 30 → compares against the point 30 s back, not the first).
- `shiftToNow`: last point lands on `now` (pass `nowSecs = 1000`); gaps preserved (`[t:0,t:10,t:25] → [975, 985, 1000]`); empty → `[]`; input not mutated.
- `clampLerp`: `1 → 0.6`, `0.8 → 0.6`, `0.12 → 0.12`, `0 → 0.01`, `NaN → 0.01`.
- buffer: `appendSample` appends and returns the same array; de‑bounces an identical value < 1 s later; trims to `cap`; `readSeries` of an unknown key → `[]`; `clearSeries()` empties; `bufferKey("L","3",6)` → `"L:3:6"`. Use `clearSeries()` at the top of each buffer test.
- `fmtClockOfDay`: use fixed unix seconds and compare against a `Date` built in the same local TZ inside the test (e.g. build `new Date(2026, 8, 13, 13, 0)` and `new Date(2026, 8, 13, 16, 25)`) → `"1p"`, `"4:25p"`; `new Date(2026,8,13,0,5)` → `"12:05a"`.
- `fmtGameClock`: `0 → "Q1 15:00"`, `900 → "Q2 15:00"`, `2300 → "Q3 6:40"`, `3599 → "Q4 0:01"`, `3600 → "OT 10:00"` (OT = 600 s period), `-5 → "Kick"`.

**Verify**: `bun test src/lib/live` → all pass (≥ 20 assertions across ≥ 8 tests).

### Step 4: The wrapper — `src/components/live-line.tsx`

Create the component. Shape:

```tsx
import { Liveline, type LivelinePoint, type LivelineSeries, type Momentum, type ReferenceLine, type WindowOption } from "liveline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { clampLerp, ema, shiftToNow, type LinePoint } from "@/lib/live/series";
import { cn } from "@/lib/utils";

export type LineTone = "brand" | "muted" | "alarm";
export type LiveSeries = { id: string; label?: string; points: LinePoint[]; tone?: LineTone };

export type LiveLineProps = {
  /** One series (points) or several. For one series the badge/fill/momentum work; liveline disables them for 2+. */
  series: LinePoint[] | LiveSeries[];
  /** Current value for a single series; defaults to the last drawn point. */
  value?: number;
  tone?: LineTone;                 // single‑series colour, default "brand"
  height: number;                  // px; the container must have a height
  windowSecs?: number;             // default 180
  windows?: WindowOption[];        // liveline chips, windowStyle="text"
  onWindowChange?: (secs: number) => void;
  referenceLine?: ReferenceLine;
  momentum?: Momentum | false;     // default false — explicit only, never auto
  smooth?: boolean;                // default true: 1‑min EMA on drawn points
  quiet?: boolean;                 // spark mode: no grid, badge, scrub; lineWidth 1.5
  frozen?: boolean;                // finished series: shift to now + paused
  formatValue?: (v: number) => string;
  formatTime?: (t: number) => string; // default fmtClockOfDay
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  className?: string;
  ariaLabel?: string;
};
```

Behaviour (each bullet is a requirement):

1. **Mounted gate (SSR)**: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`. Until mounted, render `<div className={cn("w-full", className)} style={{ height }} aria-hidden />`.
2. **Theme**: `const { resolved } = useTheme();` pass `theme={resolved}`.
3. **Tokens**: a small hook `useTokenColor(name, resolved)` → `useMemo(() => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback, [name, resolved])` with fallbacks `brand → "#6fdc93"`, `ink-3 → "#8a8b83"`, `alarm → "#c8503a"` (only used if the token is missing). Map tone → token: brand→`--brand`, muted→`--ink-3`, alarm→`--alarm`.
4. **Reduced motion**: `matchMedia("(prefers-reduced-motion: reduce)").matches` read once on mount (state), → `lerpSpeed = clampLerp(reduced ? 0.6 : 0.12)`, `pulse = !reduced && !frozen`.
5. **Smoothing**: `const draw = (pts) => smooth ? ema(pts) : pts` applied to every series; the `value` passed to liveline is `value ?? last drawn point.value` (so the tip matches the drawn line).
6. **Frozen**: when `frozen`, compute `shiftToNow(points, mountNowRef.current)` once per series (mount time captured in a `useRef(Date.now()/1000)`), pass `paused`, `pulse={false}`, `momentum={false}`. Scrub stays on (unless `quiet`).
7. **Single vs multi**: if `series` is `LinePoint[]` → `data`/`value`/`color`. If `LiveSeries[]` → `series=[{id, label, color: tone colour, data, value}]` plus `data`/`value` from the first series (liveline requires them), `seriesToggleCompact`.
8. **Quiet**: `grid={!quiet} badge={!quiet} scrub={!quiet} lineWidth={quiet ? 1.5 : 2}`. Quiet is for single‑series sparks; in multi‑series mode liveline draws a toggle‑chip row that this plan does not try to hide (no global CSS changes) — note in the doc comment that quiet multi‑series is discouraged.
9. **Always**: `badgeVariant="minimal" badgeTail={false} windowStyle="text" fill momentum={momentum ?? false} tooltipY={12} formatTime={formatTime ?? fmtClockOfDay} formatValue={formatValue ?? (v => v.toFixed(1))}`.
10. Container: `<div className={cn("w-full", className)} style={{ height }} role="img" aria-label={ariaLabel}>` — liveline fills its parent.
11. Doc comment at the top explaining: this is the only file that imports `liveline`; the decisions table above in prose (short); the NaN lerp gotcha; the hard‑coded momentum colours.

Do not re‑export the series helpers from this file; callers import them from `@/lib/live/series` directly (keeps the component file about rendering).

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 5: Import‑rule test — `src/components/live-line.test.mjs`

Source‑assertion test (pattern: `src/skin/skin.test.mjs`): walk `src/` recursively for `.ts`/`.tsx` files; assert the only file containing `from "liveline"` is `src/components/live-line.tsx`; assert that file contains `badgeVariant="minimal"`, `useTheme(`, `clampLerp(`, and does **not** contain a literal hex colour (`/#[0-9a-fA-F]{6}\b/`) outside the three fallback strings — simplest: assert the count of 6‑digit hex literals in the file is exactly 3.

**Verify**: `bun test src/components/live-line.test.mjs` → pass.

### Step 6: Dev gallery — `src/routes/dev/liveline.tsx`

Create `src/routes/dev/liveline.tsx`:

```ts
export const Route = createFileRoute("/dev/liveline")({
  beforeLoad: () => { if (!import.meta.env.DEV) throw notFound(); },
  component: Gallery,
});
```
(`notFound` from `@tanstack/react-router`.) `Gallery` renders inside `<Shell>` (from `@/components/shell`) a vertical list of cards (use existing classes: `rounded-xl bg-surface ring-card p-5`, `microlabel` for captions) showing:

1. **Single line, live** — a random walk fed by `setInterval` 250 ms, stored via `appendSample("dev:walk", v)`, `referenceLine={{value: 50, label: "PROJ 50.0"}}`, `momentum` = `swing(points, 20, 1).dir`, `windows=[{label:"30s",secs:30},{label:"2m",secs:120}]`, height 180. Toggle buttons for `tone` (brand / alarm) and `smooth` on/off.
2. **Two series** — two walks, `tone: "brand"` and `"muted"`, height 160.
3. **Quiet spark** — same walk, `quiet`, height 44.
4. **Frozen** — a fixed 190‑point series generated once (a sine‑ish decline from 12.7 to 5.7) with `frozen`, `referenceLine={{value:12.7,label:"PROJ 12.7"}}`, `formatTime={(t) => fmtGameClock(…)}` where the series times are `kickoff + i` seconds and the formatter receives shifted unix seconds — so compute the shift the same way the wrapper does: pass `formatTime={(t) => fmtGameClock(t - (mountNow - 190))}` with `mountNow = useRef(Date.now()/1000).current`. Height 140. Caption: "scrub me — paused from frame one".
5. A caption line at the top: "Dev only · /dev/liveline · theme follows yours".

Use `useTheme` nowhere here (the wrapper handles it). Keep the page under ~150 lines.

**Verify**: `bun run build` → exit 0 and `git status --short` shows `src/routeTree.gen.ts` modified (regenerated with the new route); then with the dev server running, `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/dev/liveline` → `200`. Optional: `agent-browser` screenshot shows four charts drawing, the frozen one static with a crosshair on hover.

### Step 7: Lint, test, commit

`bun run lint:fix` then `bun run lint` → exit 0; `bun test src scripts` → all pass; `bun run typecheck` → exit 0. Commit in‑scope files only.

## Test plan

- `src/lib/live/series.test.mjs` — as listed in Step 3 (≥ 8 tests).
- `src/components/live-line.test.mjs` — import‑rule + no‑literal‑hex assertions (Step 5).
- Manual: `/dev/liveline` renders four charts in both themes (flip via the account menu's theme toggle or `document.documentElement.setAttribute("data-theme","light")` in devtools) — the lines recolour to the light‑ramp tokens.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test src scripts` exits 0; `src/lib/live/series.test.mjs` and `src/components/live-line.test.mjs` exist and pass
- [ ] `grep -rln 'from "liveline"' src` → exactly `src/components/live-line.tsx`
- [ ] `grep -n "lerpSpeed" src/components/live-line.tsx` shows it routed through `clampLerp(`
- [ ] `bun run build` exits 0; `src/routeTree.gen.ts` includes `/dev/liveline`
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/dev/liveline` → `200` with the dev server running
- [ ] `git status --short` after commit shows no files outside the in‑scope list
- [ ] `plans/README.md` status row updated (unless the reviewer maintains it)

## STOP conditions

Stop and report back (do not improvise) if:

- `bun add liveline@0.0.7` fails or resolves to a different major/minor (the API in this plan is 0.0.7's).
- `node_modules/liveline/dist/index.d.ts` does not export `Liveline`, `LivelinePoint`, `LivelineSeries`, `Momentum`, `ReferenceLine`, `WindowOption` under those names.
- `useTheme()` in `src/lib/theme.ts` no longer returns `resolved`.
- The route tree does not regenerate on `bun run build` (i.e. `/dev/liveline` 404s in dev after a restart) — report rather than hand‑editing `routeTree.gen.ts`.
- Typecheck surfaces an error inside `node_modules/liveline` itself (types mismatch with React 19) that cannot be fixed by a local cast — report.

## Maintenance notes

- Plans 054 (player projection line), 055 (matchup chart + home card) and 056 (book line strip) import **only** `@/components/live-line` and `@/lib/live/series`. If a new visual decision comes up, change the wrapper default, not the call sites.
- liveline `0.0.7` hard‑codes momentum colours; if an upstream release adds a palette hook for them, wire `--brand` / `--alarm` through here.
- The lerp guard exists because `lerpSpeed ≥ 0.8` produces NaN in `0.0.7`; re‑check if the package is bumped.
- Reviewer: confirm no literal hex outside the three fallbacks, no `liveline` import elsewhere, and that `frozen` shifts once (mount ref), not on every render.
