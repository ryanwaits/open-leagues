# Plan 067: The board goes shallow — /matchups compares, the box score follows

> **Executor instructions**: Follow step by step; verify each step; STOP conditions binding. SKIP updating `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat <066-SHA>..HEAD -- 'src/routes/league/$leagueId/matchups.tsx' src/components/matchup-board.tsx src/components/matchup-edge.tsx` → expected empty for the first two; matchup-edge must be untouched by you.
>
> Spec: artifact https://claude.ai/code/artifact/9f879d2c-915d-4bdb-bdfd-69ef2f4fb950 §5 (the page contract) — restated below.

## Status
P2 · Effort M · Risk MED (removes a mounted feature from a page; prefs/state cleanup) · Depends on 066 · Planned at `0bf3688`, 2026-08-24

## Why this matters
Locked contract: **/matchups = compare** (scan the week, flip fast), **/matchup/:id = follow** (depth). Today the board duplicates the deep surface: it mounts `MatchupEdge` (the liveline chart card) and full stat rows. After this plan the board keeps: week strip (tablist), condensed score header per selected game, a **compact** starters mirror (name + pts only — no stat/meta line), the one-line WP meter, and the "Full box score →" link. The chart, stat lines, book and bench live only on the box score. Board liveline canvases: 0.

## Current state (at 0bf3688)
`src/routes/league/$leagueId/matchups.tsx` (~491): week strip `role="tablist"` ~306–343; selected pair board `<MatchupBoard …/>` ~400 with a "Full box score" link ~413; **`<MatchupEdge …/>` mounted ~456** — this leaves. `src/components/matchup-board.tsx` (~300): `MatchupBoard` 70, band header with `TeamTotal` ~186–234, `Half` rows 235+ rendering `PlayerCell` (with meta/stat line) + `SlotPts`. Read both files fully before editing.

## Scope
**In scope**: `src/routes/league/$leagueId/matchups.tsx`; `src/components/matchup-board.tsx`; `src/skin/skin.test.mjs`.
**Out of scope**: `matchup-edge.tsx` (not deleted, not edited — it remains the box score's), the matchup detail route, `slot-pts.tsx`, `player-cell.tsx`, prefs keys in `src/lib/live/prefs.ts` (leave; note if now orphaned).

## Steps
### Step 1: Unmount the chart from the board
Remove the `<MatchupEdge …/>` mount + its import from `matchups.tsx`. If `edgeView`/`edgeWindow` prefs or props were threaded only for it here, remove that threading (route-local only — do not touch `prefs.ts`). Where the chart card sat, nothing replaces it (the board header's WP meter already exists — verify; if the board has no WP line, add the one-line meter + `Win prob N%` caption to the board band using the same data `MatchupEdge` consumed, ONLY if ≤15 lines; else note).
### Step 2: Compact mirror
In `matchup-board.tsx`, make rows name + pts only on the board: `PlayerCell` already supports a quiet/compact mode (`compact quiet` props are used elsewhere) — additionally drop the stat/meta `line` prop (pass nothing) so the row is a single line: avatar · name | slot | pts. Keep tap-to-watch. Row height shrinks — keep `min-h` consistent so live deltas don't shift (SlotPts already reserves inline).
### Step 3: Link out
Ensure the "Full box score →" link is prominent on the band header (right side, `text-accent-strong microlabel` as on the detail page's FULL BOX SCORE). Keep the tablist/strip untouched.
### Step 4: Gate + visual
Typecheck/lint/fresh-dir tests (`pglite-067`)/build:dev. agent-browser: board at 390 + 1440, demo live — confirm 0 `<canvas>` on /matchups (`document.querySelectorAll('canvas').length` → 0), compact single-line rows, link navigates to the detail page. Detail page unchanged.

## Test plan
skin.test.mjs: `"the board compares; only the box score mounts the line"` — assert `matchups.tsx` does NOT match `/MatchupEdge/` and `matchup-board.tsx` does not pass a `line=` prop (regex to your shipped shape, meaningful not vacuous).

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new
- [ ] `grep -c "MatchupEdge" 'src/routes/league/$leagueId/matchups.tsx'` → 0
- [ ] /matchups mounts 0 canvases (live demo, measured)
- [ ] Board rows single-line (screenshot 390 + 1440); "Full box score →" present
- [ ] `git status` clean outside scope

## STOP conditions
- Drift; `MatchupBoard` is consumed by another route where the compact change would leak (grep consumers first — if any besides matchups.tsx, gate compactness behind a prop instead and note it).
- Removing the chart orphans state that other code reads (beyond route-local) — report, don't chase.

## Maintenance notes
- `useLiveProjPref`'s `edgeView/edgeWindow` now serve only the box score — fine.
- If a future home-card wants a spark, it reads ticks, not MatchupEdge.
