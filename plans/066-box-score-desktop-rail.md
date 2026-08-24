# Plan 066: Box score desktop — the pinned rail (V1)

> **Executor instructions**: Follow step by step; verify each step; STOP conditions are binding. SKIP updating `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <065-SHA>..HEAD -- 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx'` → expected empty (SHA from README row 065).
>
> Spec: artifact https://claude.ai/code/artifact/9f879d2c-915d-4bdb-bdfd-69ef2f4fb950 §3 (desktop V1) — restated below.

## Status
P1 · Effort M · Risk LOW–MED (pure layout on one route; MatchupEdge/liveline must keep exactly one canvas) · Depends on 065 · Planned at `0bf3688`, 2026-08-24

## Why this matters
Ryan picked desktop V1: on `lg+` the page becomes two columns — a 400px **pinned rail** (score card, then the Where-the-game-is card, then the book strip if this route has one) and the flowing right column (starters → bench → rest-of-week pills). The score and the line never leave the screen; the table gets real width. Below `lg` nothing changes from 065's single column.

## Current state
After 065 the route renders, in order: BackLink/NavChips row · mini-scorebar (stuck) · pill strip · Scoreboard · `<MatchupEdge …/>` · starters section · bench section · rest-of-week pills · drawers. All full-width. `MatchupEdge` is self-contained (`section.mt-6.rounded-xl…` in `src/components/matchup-edge.tsx`) — do NOT edit it; its `mt-6` may be neutralized by a wrapper (`[&>section]:mt-0` on the rail cell is acceptable).

## Scope
**In scope**: `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` only (+ `src/skin/skin.test.mjs` assertion).
**Out of scope**: every component file; mobile layout; 067's files.

## Commands / conventions
Same as plan 065 (typecheck / lint ≤ pre-existing / fresh-dir tests `PGLITE_DATA_DIR=/tmp/claude-501/pglite-066 …` / build:dev / agent-browser sandbox-disabled, screenshots to exec066/).

## Steps
### Step 1: The grid
Wrap the post-header content in:
```tsx
<div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-5">
  <div className="lg:sticky lg:top-[calc(3.75rem+env(safe-area-inset-top)+1rem)] lg:grid lg:gap-4 [&>section]:mt-0">
    {/* pill strip, Scoreboard, MatchupEdge */}
  </div>
  <div className="lg:mt-0 lg:grid lg:gap-4 [&>section]:mt-0">
    {/* starters, bench, rest-of-week */}
  </div>
</div>
```
Reorder JSX so those blocks group accordingly (mobile order inside each group must stay: strip → score → chart, then starters → bench → rest). The mini-scorebar stays OUTSIDE the grid (it's page chrome) but on `lg+` the score is always visible — gate the mini-bar to `lg:hidden`.
### Step 2: Rail behaviour checks
- The rail must not exceed viewport height with the chart open: if the stack overflows at 900px height, make the rail cell `lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto scroll-thin` and note it.
- One liveline canvas: unchanged (MatchupEdge is mounted once — confirm no duplicate mount was introduced).
### Step 3: Gate + visual
Typecheck/lint/tests/build. Screenshots 1440 pre/live/final: rail pinned while the table scrolls (capture mid-scroll), single column at 390 unchanged from 065 (comparison screenshot).

## Test plan
skin.test.mjs: add assertion to the 065 test (or a new one): route matches `/lg:grid-cols-\[400px_minmax/` and `/lg:sticky/`.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass
- [ ] 1440: two columns, rail pinned during scroll (screenshot), one canvas
- [ ] 390: identical to 065 (screenshot)
- [ ] `git status` clean outside scope

## STOP conditions
- Drift vs 065's landed structure.
- The grid forces edits inside `MatchupEdge` or `Scoreboard` beyond wrapper classes.
- Sticky + backdrop-filter/liveline interaction visibly breaks the canvas — report with screenshots.

## Maintenance notes
- If the book strip (056) ever mounts on this route, it slots into the rail below MatchupEdge.
