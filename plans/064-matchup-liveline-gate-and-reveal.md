# Plan 064: Gate the matchup liveline until kickoff; stop the tab-switch reveal flicker

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 01439f9..HEAD -- src/components/matchup-edge.tsx src/components/live-line.tsx src/lib/live/use-matchup-series.ts src/lib/live/matchup-series.ts src/lib/live/matchup-series.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (UI gate + one React `key`; no schema, no server)
- **Depends on**: plans/063-matchup-slate-swipe.md (sequencing only — 063 owns the matchup *page* swipe; this plan does not edit that route. Wait until 063 is DONE so review does not collide.)
- **Category**: bug (pre-game chart chrome + load/tab flicker)
- **Planned at**: commit `01439f9`, 2026-08-23

## Why this matters

Plan 055 locked: **Tue–Sat (nothing started, no ticks) = meter + slot bars, no chart.** The live code treats "outlooks returned one sample" as started, so the 196px liveline, the Finals/Win %/Margin tabs, and the 1H/3H/DAY chip row all appear in preseason. Liveline then plays its `chartReveal` intro: a faint center wave that expands into the (still-flat) series. Switching Finals ↔ Win % ↔ Margin remounts three separate `<LiveLine>`s, so that intro **replays on every tab**. The faded strip under the tabs is liveline's own window-chip row (and, on Finals, the compact green/grey series dots). Hide the canvas until kickoff (or stored ticks), and keep one canvas for Win % ↔ Margin so the reveal does not fire again.

## Locked design (do not re-decide)

| Item | Decision |
|---|---|
| When the chart shows | `pairHasStarted(pair) \|\| storedTicks.length > 0`. **Not** `samples.length >= 1`. Outlooks loading is not kickoff. |
| Pre (gate false) | Header right = `Margin by slot`. No Finals/Win %/Margin control. No `<LiveLine>`. Existing `wp.live` meter (the 6px bar) if `wp.live`, else nothing above the slot bars. Slot bars + footnote unchanged. |
| Game day / live / final | Chart as today: tabs, windows, caption, slot bars. |
| Tab remounts | **Two** `<LiveLine>` identities, not three: `key="multi"` for Finals (two series — badge/fill/momentum stay off, which is liveline's multi-series rule), `key="single"` for Win % **and** Margin (one `LinePoint[]` series — badge/momentum/referenceLine stay on). Win % ↔ Margin must **not** remount. |
| Ghost series dots | Do **not** pass a length-1 `LiveSeries[]` for Win %/Margin — liveline treats any `series` prop with `length > 0` as multi-series and kills badge/momentum. Do **not** leave one instance that goes from 2 series to `series={undefined}` — liveline keeps `lastSeriesPropRef` and leaves the dots in the DOM at `opacity: 0`. The `key="multi" \| "single"` split is how we avoid both. |
| chartReveal intro | liveline 0.0.7 has **no** skip-reveal prop. Do **not** patch `node_modules/liveline`. First mount on a live week may still breathe once; that is accepted. The gate stops it firing on preseason load. The `key` split stops it firing on Win % ↔ Margin. Finals ↔ other still remounts (unavoidable without losing single-series badge). |
| Windows | Still passed when the chart is showing (hide on sim as today). Not passed when the chart is hidden. |
| Player projection block | Out of scope. The empty-wave skeleton there is intentional (plan 054 follow-up already shipped). |

## Current state

- `src/lib/live/use-matchup-series.ts:65-71, 128` — `started` is the gate `MatchupEdge` uses:

```ts
  /**
   * Enough to draw the liveline: the pair has started, or there's at least
   * one sample (pre-kick this draws as a single pulsing dot per series at
   * the projection). False only when there's no sample at all yet
   * (outlooks not loaded) — the panel falls back to the plain meter then.
   */
  started: boolean;
  // ...
  started: pairHasStarted(pair) || samples.length >= 1,
```

  `preKickoff` at line 112 already uses the *correct* test (`!pairHasStarted(pair) && stored.length === 0`) to collapse the series to `lastPointOnly`. The gate that *shows the canvas* does not.

- `src/lib/data/matchup-view.ts:145-148` — `pairHasStarted(pair)` is "either roster has a starter whose NFL game is `in` or `post`".

- `src/lib/live/matchup-series.ts:185-189` — `lastPointOnly` duplicates the last point 1s earlier so liveline's `points.length >= 2` empty-check does not fire. Keep it; it still matters on game-day pre-kick *with ticks* and for the first live sample.

- `src/components/matchup-edge.tsx:148-216` — `s.started` shows the tab pill **and** three ternary `<LiveLine>`s (finals / pct / margin), each `height={196}`, `windows={simOn ? undefined : WINDOWS}`. Caption and slot bars follow.

- `src/components/live-line.tsx:128-146, 186-198` — client: empty `height` box until `mounted`; then if series is empty, another empty box; otherwise `<Liveline>`. First canvas frame always runs liveline's `chartReveal` from 0 (internal `useRef(0)` in `node_modules/liveline/dist/index.js` ~2331, 2561–2571). Morph: line Y is pulled to the chart midline until reveal completes (~391–451). That is the "shadow that expands up."

- liveline series-toggle (do not edit): `node_modules/liveline/dist/index.js` ~3548–3558, 3881–3889. `lastSeriesPropRef` is kept when `series` becomes undefined; the chip row stays in the tree at `opacity: 0`. Window chips live in the same flex row (`1H 3H DAY`, ~3695).

- Conventions: `bun:test` + `node:assert/strict`, `*.test.mjs` next to source (exemplar: `src/lib/live/matchup-series.test.mjs`). Biome, double quotes, width 100. `LiveLine` is the only file that imports `"liveline"` (`src/components/live-line.test.mjs`). Commits: conventional, imperative, no AI attribution (`fix(live): hide the matchup chart until kickoff`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/live` | all pass (13 existing + the new ones in this plan) |
| Full tests | `bun test src scripts` | all pass |
| Lint (scoped) | `bunx biome check src/components/matchup-edge.tsx src/lib/live/use-matchup-series.ts src/lib/live/matchup-series.ts src/lib/live/matchup-series.test.mjs` | exit 0 (warnings that already exist on untouched lines are fine) |
| Build | `bun run build` | exit 0 |
| Dev | `bun run dev` (already 8080) | — |

## Scope

**In scope**:
- `src/lib/live/matchup-series.ts`
- `src/lib/live/matchup-series.test.mjs`
- `src/lib/live/use-matchup-series.ts`
- `src/components/matchup-edge.tsx`

**Out of scope**:
- `src/components/live-line.tsx` and `node_modules/liveline` — no skip-reveal, no CSS to hide liveline's chrome.
- `src/components/projection-block.tsx` — player pre-kick empty wave is a different surface.
- `src/components/matchup-card.tsx` — home card meter is already gated on `kicked`.
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` — 063's swipe. Do not edit.
- `src/routes/league/$leagueId/matchups.tsx` — only mounts `<MatchupEdge>`; no change unless a STOP forces it (it should not).
- Prefs, ticks writer, scoring, migrations.

## Git workflow

- Current branch. Do not make a worktree. Do not push.
- 1–2 conventional commits. Example: `fix(live): hide the matchup chart until kickoff`.
- Do not mention sprint/phase/plans in the commit message.

## Steps

### Step 1: Pure gate — `matchupChartReady`

In `src/lib/live/matchup-series.ts`, next to `pairIsFinal`:

```ts
import { pairHasStarted } from "@/lib/data/matchup-view";

/** Canvas + Finals/Win%/Margin tabs. Kickoff or stored ticks — not "outlooks loaded." */
export function matchupChartReady(
  pair: MatchupPair,
  storedTickCount: number,
): boolean {
  return pairHasStarted(pair) || storedTickCount > 0;
}
```

Add tests in `src/lib/live/matchup-series.test.mjs` (reuse the existing `pair()` / `starter()` helpers). Cover:

1. all games `pre`, `storedTickCount = 0` → `false`
2. all games `pre`, `storedTickCount = 3` → `true` (game-day ticks before the local client saw kickoff)
3. one starter `in` or `post`, `storedTickCount = 0` → `true`

**Verify**: `bun test src/lib/live/matchup-series.test.mjs` → all pass, including the 3 new ones.

### Step 2: Hook uses the gate

In `src/lib/live/use-matchup-series.ts`:

- Import `matchupChartReady`.
- Rewrite the `started` field comment to match 055: true when the canvas should show (kickoff or stored ticks). False → `MatchupEdge` shows "Margin by slot" and no `<LiveLine>`.
- Change the assignment to:

```ts
started: matchupChartReady(pair, stored.length),
```

Leave `preKickoff` / `lastPointOnly` as they are. Leave `sinceOpened`.

**Verify**: `bun run typecheck` → 0. `grep -n "samples.length >= 1" src/lib/live/use-matchup-series.ts` → no match.

### Step 3: One multi canvas, one single canvas

In `src/components/matchup-edge.tsx`, replace the three-way ternary (`edgeView === "finals" ? <LiveLine…> : edgeView === "pct" ? <LiveLine…> : <LiveLine…>`) with **one** `<LiveLine>` whose `key` is `"multi"` or `"single"`:

```tsx
const multi = edgeView === "finals";
<LiveLine
  key={multi ? "multi" : "single"}
  series={
    multi
      ? [
          { id: "you", label: a.teamName, points: s.you, tone: "brand" },
          { id: "them", label: b.teamName, points: s.them, tone: "muted" },
        ]
      : edgeView === "pct"
        ? s.pct
        : s.margin
  }
  value={multi ? undefined : edgeView === "pct" ? s.last?.youPct : s.last?.margin}
  height={196}
  windowSecs={simOn ? 150 : edgeWindow}
  windows={simOn ? undefined : WINDOWS}
  onWindowChange={setEdgeWindow}
  referenceLine={
    multi
      ? undefined
      : edgeView === "pct"
        ? { value: 50, label: "COIN FLIP" }
        : { value: 0, label: "EVEN" }
  }
  momentum={
    multi ? false : edgeView === "pct" ? swing(s.pct, 300, 3).dir : marginMomentum
  }
  formatValue={
    multi
      ? undefined
      : edgeView === "pct"
        ? (v) => `${Math.round(v)}%`
        : (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`
  }
  frozen={s.final}
  padding={{ top: 8, right: 8, bottom: 26, left: 0 }}
  ariaLabel={multi ? "Projected finals" : edgeView === "pct" ? "Win probability" : "Projected margin"}
/>
```

Keep the existing `s.started` / `wp.live` branches — they now mean the new gate. Do not add a fourth state.

**Verify**: `bun run typecheck` → 0. `grep -c "<LiveLine" src/components/matchup-edge.tsx` → **1**. `grep -n 'key={multi' src/components/matchup-edge.tsx` → a hit.

### Step 4: Lint, tests, build

```sh
bunx biome check src/components/matchup-edge.tsx src/lib/live/use-matchup-series.ts src/lib/live/matchup-series.ts src/lib/live/matchup-series.test.mjs
bun test src/lib/live
bun run typecheck
bun run build
```

All exit 0. Then `grep -rln 'from "liveline"' src` → still only `src/components/live-line.tsx`.

### Step 5: Visual (preseason + live)

Dev server on 8080. League `lg_65h3kyr5up`.

1. **Pre, demo off.** `/league/lg_65h3kyr5up/matchups` — "Where the game is" has **no** Finals/Win %/Margin pill, **no** 1H/3H/DAY row, **no** canvas. Slot bars still there. Reloading must not grow a 196px hole then shrink it.
2. **Demo pre-live on** (`localStorage` `ledger-demo` `{enabled:true,preLive:true}` — same shape as plan 055). Games that are `Final` count as started → chart **does** show. That is correct.
3. **Chart showing:** click Win %, then Margin. The canvas must **not** replay the center-wave intro (same `key="single"`). Click Finals: a remount is OK. Window chips only when the chart is up.

If (1) still shows the chart, STOP — `pairHasStarted` is true for week-1 preseason games (pre-live feed leaking into the real pair). Report; do not paper over it by also requiring `wp.live`.

## Test plan

- New: `matchupChartReady` cases in `src/lib/live/matchup-series.test.mjs` (model after `pairIsFinal` in the same file).
- No React test for the `key`. The grep in step 3 is the machine check; step 5 is the visual check.
- `bun test src/lib/live` — 13 existing + ≥3 new, all pass.

## Done criteria

- [ ] `bun run typecheck`, `bun test src scripts`, `bun run build` exit 0
- [ ] `grep -n "samples.length >= 1" src/lib/live/use-matchup-series.ts` → no match
- [ ] `grep -c "<LiveLine" src/components/matchup-edge.tsx` → 1
- [ ] `matchupChartReady` is exported and tested (pre+0 ticks false; pre+ticks true; in/post true)
- [ ] `grep -rln 'from "liveline"' src` → only `src/components/live-line.tsx`
- [ ] No files outside the in-scope list (`git status`)
- [ ] Preseason matchups: no canvas, no window chips, no view tabs (visual)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Drift check on the in-scope paths does not match the excerpts.
- `pairHasStarted` is true for WIFFL week 1 with demo **off** (pre-live leaking). Report; do not AND extra flags.
- The only way to keep Win % badge/momentum is to pass a length-1 `series` array — that is wrong (see Locked design). Use `key="single"` + `LinePoint[]`, not `LiveSeries[]`.
- You feel you must edit `live-line.tsx` or `node_modules/liveline` to skip `chartReveal`. Stop and report instead.
- 063 is still IN PROGRESS and you also need to edit `$matchupId.tsx`. You should not; if you do, stop.

## Maintenance notes

- Reviewer: confirm preseason `/matchups` does not mount a canvas (React scan / view source of the card). Confirm Win % ↔ Margin does not replay the wave.
- If liveline later grows a `skipReveal` / `reveal={false}` prop, wire it in `live-line.tsx` (053's wrapper) — not at this call site.
- `lastPointOnly` stays for the first live frames and for stored-tick pre-kick. Do not delete it because the canvas is now gated.
- Home `MatchupCard` already uses `pairHasStarted`; leave it.
