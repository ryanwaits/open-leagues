# Plan 065: Box score core — new score card, game-pill strip, quiet rows, full bench, condensing mini-score

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Touch only in-scope files. On any STOP condition, stop and report — do not improvise. SKIP updating `plans/README.md` (reviewer maintains the index).
>
> **Drift check (run first)**: `git diff --stat 0bf3688..HEAD -- 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx' src/components/player-cell.tsx` → expected empty.
>
> **The spec is the artifact**: https://claude.ai/code/artifact/9f879d2c-915d-4bdb-bdfd-69ef2f4fb950 (v2, "The Box Score") — §2 row states, §4 mobile pre/live/final phones. You cannot open it; this plan restates everything you need. Where a judgment call arises, the mock's shape wins.

## Status
P1 · Effort L · Risk MED (one 1000-line route restructured; Scoreboard is also 066's rail centrepiece) · Depends on none (066/067 depend on this) · Planned at `0bf3688`, 2026-08-24

## Why this matters

Ryan locked the Box Score redesign 2026-08-24. This plan is the core: (a) the **score card** becomes the mock's stacked block and loses its header status badge — a fantasy matchup spans many NFL games, so a single Preview/Q2/Final chip lies; status is a **count** on the card ("9 v 9 to play" / "● 7 v 7 live") with a Final treatment (W badge on the winner row, "decided by", Recap link); (b) the swipeable card carousel becomes a **game-pill strip** (30px pills, current game inked, live dots + running scores) — killing the mis-anchor bug by deletion; the score-card swipe gesture stays; (c) **rows go quiet**: no repeated red game clocks in row meta — stats or kickoff time only; at a decided final the winning side of each row is bold (NO checkmark glyph); (d) **bench** becomes full mirrored rows like starters (the truncating two-up grid goes); (e) "Rest of week" becomes a row of live pills; (f) scrolling past the score card slides a **mini-scorebar** in under the app header (instant, no easing).

## Current state (at 0bf3688) — verified excerpts

File: `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (~1080 lines). Function map: `BackLink` 572, `NavChip` 586, `Scoreboard` 615, `TeamHead` 698, `baselineOf` 744, `StarterRow` 753, `Line` 814, `BenchGrid` 880. Bench sections ~459/481, "Rest of week" ~532–565, slate pill-row area ~396–441 (the transform track + dots from commit d2b1242, swipe via `useSwipe`/`slateSwipe`, `slateIdx`, `slateDrag` — landed earlier this session), desktop single `Scoreboard` mount wrapped in `hidden sm:block` right after it.

### Scoreboard today (615–695, abridged but exact)
```tsx
function Scoreboard({ pair, week, leagueId, standings, status, live }: { … status: { label: string; tone: "live" | "muted" | "win" }; live: boolean }) {
  const away = pair.away;
  const scores = pairPreviewScores(pair);
  const preview = !scores.live;
  const decided = isDecided(pair);
  …
  return (
    <section className="rounded-xl bg-surface px-4 py-5 ring-card sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="microlabel">Week {week}{pair.label ? ` · ${pair.label}` : pair.kind === "playoff" ? " · Playoff" : ""}</p>
        <Badge tone={…}>{status.label}</Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <TeamHead side={pair.home} … align="left" />
        <div className="text-center">
          <p className="font-display text-4xl tabular-nums tracking-tight sm:text-5xl">…{formatPts(scores.home, 1)} – {formatPts(scores.away, 1)}…</p>
          {preview ? <p className="mt-1 microlabel-data">proj</p> : null}
          {tied ? <p className="mt-1 microlabel">Tie</p> : null}
          {live ? <p className="mt-1 microlabel text-live">Unofficial · {LIVE_POLL_MS / 1000}s</p> : null}
        </div>
        {away ? <TeamHead side={away} … align="right" /> : (<div className="text-right"><p className="font-display text-2xl tracking-tight text-faint">Bye</p>…</div>)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 microlabel">
        <p>{yetLabel(pair.home)}</p>
        <p className="text-right">{away ? yetLabel(away) : "Bye"}</p>
      </div>
    </section>
  );
}
```
`TeamHead` (698–740): avatar + team name + `manager · record` line, links to the team page. `yetLabel(side)` exists (find it near the top helpers) and produces the "N still to play"-style copy.

### Rest of week today (532–565, exact)
A `<ul>` of `Link` rows: `flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-sm ring-card …` with home name / mono `12.3–45.6` / away name.

### Rows today
`StarterRow` renders two `Line`s around a slot rail; `Line` (814–860) is a `<button>` with `PlayerCell player … game={side.game} line={line}` + `SlotPts`. The red clock ("Q2 9:51") comes from **`src/components/player-cell.tsx`** — read it before editing; it renders the game chip/status inside the meta line (the route passes `game` and `line`). `liveStatLine(...)` builds the stat text.

### Conventions
Tokens/utilities only; `cn()`; `Badge` from ui; `useSwipe` from `@/lib/swipe`; commits imperative, no AI attribution, no plan/sprint words; `bunx biome check --write <touched files>` only; tests `bun test` `.test.mjs`.

## Commands
Typecheck `bun run typecheck` → 0 · lint `bun run lint` → ≤ 11 pre-existing (outside src) · fresh-dir tests `PGLITE_DATA_DIR=/tmp/claude-501/pglite-065 bun test src scripts` → no NEW failure names (baseline ~354 pass, 1 flaky import.meta.glob error) · build `bun run build:dev` → 0 · dev on :8080 (login prefilled; demo live: `localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:3,running:false},version:0}))`; demo off: `localStorage.removeItem("ledger-demo")`). agent-browser with sandbox disabled; screenshots to …/scratchpad/exec065/.

## Scope
**In scope**: `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`; `src/components/player-cell.tsx` (ONLY to add an opt-out prop for the clock, default unchanged); `src/skin/skin.test.mjs` (assertion add).
**Out of scope**: `matchups.tsx` + `matchup-board.tsx` (plan 067), desktop two-column layout (plan 066 — this plan's Scoreboard must work standalone at all widths), `MatchupEdge`, `SlotPts`, `PlayerWatch/PlayerSheet`, engine/auth/grok lists, `routeTree.gen.ts`.

## Steps

### Step 1: Scoreboard → the stacked score block
Rewrite `Scoreboard` (keep name/props; `status` prop becomes unused — remove it from the signature AND from both call sites in this file; keep `live`):
- Card: `rounded-xl bg-surface ring-card px-4 py-4 sm:px-5`.
- Header row: left `microlabel` = `Week {week}` + label/playoff as today; right = status count, no Badge:
  - pre (`preview`): `<span className="microlabel">{yetLabel(pair.home)} · {away ? yetLabel(away) : "Bye"}</span>` — condense to the mock's "9 v 9 to play" shape: compute `n v m to play` from the two yet-counts if `yetLabel` exposes numbers; otherwise keep the two labels joined with " · ".
  - live: `<span className="microlabel text-live">● {liveCountHome} v {liveCountAway} live</span>` (count starters whose `game?.state === "in"` per side — tiny helper in this file).
  - final (`decided && !scores.live` — i.e. week settled; reuse `isDecided` + existing final detection): `<Badge tone="win">Final</Badge>`.
- Body: two stacked rows (winner first when decided, home first otherwise). Each row: `Avatar` (size-8) + name block (name; sub-line `microlabel` = `record · seat/rank` from `recordOf` — reuse TeamHead's data, but the row itself keeps TeamHead's Link-to-team behaviour) + right-aligned `font-mono text-[28px] sm:text-3xl tabular-nums` score. Leader ink, trailer `text-muted`. When decided, winner name gets `font-semibold` + `<Badge tone="win">W</Badge>` inline after the name.
- Footer:
  - pre/live: WP meter — `<div className="h-1.5 rounded-pill bg-fg/8 overflow-hidden"><i style={{width: pct%}} className="block h-full rounded-pill bg-accent"/></div>` + caption row `Win prob {pct}%` / `proj {a} – {b}`. WP source: this route imports nothing for WP today — compute from `pairPreviewScores`/expected via the same helper `MatchupEdge` uses IF cheaply importable (`winProbability` in `src/lib/league/win-probability.ts` needs inputs this component may not have) — if wiring WP here is not a ≤15-line lift, SKIP the meter (caption row only: `proj a – b` + counts) and note it; do NOT duplicate model code.
  - final: border-top row `Decided by {slot} · {±margin}` (slot = the row with the largest absolute pts gap between sides — small helper over `pair.*.starters`) + right `Link` to `/league/$leagueId/recap?week={week}` labelled `Recap →`.
- Bye pairs: single row + "No opponent this week" line; counts label "Bye". Keep `tied` handling as a `microlabel` "Tie" next to Final.
- Delete `TeamHead` if now unused (its Link-to-team moves onto the stacked rows).
**Verify**: typecheck 0; screenshots pre + live + final (demo off / phase3 / phase8) at 390 and 1440 match the described anatomy; `grep -n "status.label" 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx'` → none.

### Step 2: Game-pill strip replaces the card row
Delete the `sm:hidden` transform-track block (the slate row + dots, ~396–441) and the `hidden sm:block` wrapper around the desktop Scoreboard (Scoreboard now renders ONCE, all widths). In its place, ABOVE the Scoreboard, an all-widths strip (mock §4):
```tsx
{slate.length > 1 ? (
  <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {slate.map((p) => { const on = p.matchupId === pair.matchupId; const s = pairPreviewScores(p); const liveDot = [p.home, p.away].some((sd) => sd?.starters.some((st) => st.game?.state === "in"));
      return (
        <Link key={p.matchupId} to="…matchup route…" params={{ leagueId, week: String(week), matchupId: String(p.matchupId) }}
          aria-current={on ? "page" : undefined}
          className={cn("flex h-[30px] shrink-0 items-center gap-1.5 rounded-pill px-2.5 font-mono text-[11px] whitespace-nowrap", on ? "bg-fg text-bg" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]")}>
          {liveDot && !on ? <span className="size-1.5 rounded-full bg-live" /> : null}
          {abbr(p.home.teamName)} {formatPts(s.home, 0)} · {abbr(p.away?.teamName ?? "Bye")} {formatPts(s.away, 0)}
        </Link>); })}
  </div>
) : null}
```
`abbr` = first 3 letters uppercased (tiny helper; collide-safe not required). Keep `slateSwipe`/`useSwipe`: attach its handlers to the (new) Scoreboard wrapper `<div {...slateSwipe.handlers} className="touch-pan-y">` so a deliberate sideways swipe on the score card still moves between games (`replace: true` as landed); remove `slateIdx` drag transform usage but keep `slateIdx` for the swipe's neighbour lookup; delete `slateDrag`/edge-resistance (no visual drag on a card that doesn't translate — commit on release only). Also delete the dot indicators. `NavChip`s/BackLink row: unchanged.
**Verify**: pills render, current inked, tap navigates; swipe on the score card still changes game (390, demo on); `grep -c "snap-center\|slateDrag" <route>` → 0.

### Step 3: Quiet rows + winner bold
- Read `src/components/player-cell.tsx`; find where the live game clock/status text (the red `Q2 9:51`) renders in the meta line. Add a prop `clock?: boolean` (default `true` — every other caller unchanged) that, when `false`, omits ONLY the clock/status segment (keep opponent + stat line + kickoff time for pre games). Pass `clock={false}` from this route's `Line` and bench rows.
- Winner bold at final: in `Line`, accept a `won?: boolean` prop; when true add `font-semibold` to the name and pts (`SlotPts` gets `className` bold — it already takes className). In `StarterRow`, when the pair is decided (hoist `decided`/final from the page — pass down a `final: boolean` prop), compute per-row winner = side with higher `points` (skip when equal). NO glyphs.
**Verify**: live at 390 — rows show stats without red clocks; phase 8 final — each row's higher side bold; `bun run typecheck` → 0; other PlayerCell surfaces (roster page) unchanged (screenshot roster — clocks still there).

### Step 4: Bench = full mirrored rows
Replace `BenchGrid`'s two-up grid with mirrored rows reusing the same anatomy as `StarterRow`/`Line` (slot rail says `BN`): pair bench players by index (`benchOf(viewHome)[i]` vs `benchOf(viewAway)[i]`, odd tail renders one-sided). Simplest: generalise — render via the existing `Line` component with `clock={false}`; delete the old grid markup. Keep tap-to-watch/sheet behaviour identical.
**Verify**: bench shows full names both sides at 390 (no "Blake C…"); typecheck 0.

### Step 5: Rest of week → live pills
Replace the `<ul>` list with a wrap row of the SAME pill recipe as Step 2 (reuse — extract a small `GamePill` component in this file), all pills ringed (none inked), live dots as applicable, in a `card`-style section keeping the `microlabel` header.
**Verify**: section renders as pills; links navigate.

### Step 6: Condensing mini-scorebar (phones + desktop alike)
A 1px sentinel just above the Scoreboard; when it leaves the viewport (IntersectionObserver, same pattern as scores_.$gameId.tsx:129–137), show a sticky bar (`sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 px-4 py-2 bg-bg/90 backdrop-blur-md border-b border-line`) containing: `HA 28.6 – 39.9 BU` (mono, leader ink / trailer muted, abbr names) + right the live count `● 7 v 7` when live. Render it only when stuck (`stuck && <div …>`) — instant appear, no transition (house rule). Place the bar element ABOVE the pill strip in the DOM so it overlays naturally when stuck.
**Verify**: at 390 demo on, scroll to starters → mini-bar visible with both scores; scroll back to top → gone; screenshot both.

### Step 7: Gate + visual pass
Typecheck, lint, fresh-dir tests, build:dev. Screenshots at 390 + 1440 for pre/live/final. Confirm: no Preview/Q2/Final badge in the page header area; week picker (league layout h1 row) still present and functional.

## Test plan
`src/skin/skin.test.mjs`: add `"the box score speaks in counts, not clocks"` — assert the route file does NOT match `/status\.label|snap-center|BenchGrid/` and DOES match `/to play|v .*live|clock=\{false\}/` (adjust regexes to what you actually shipped — they must be meaningful, not vacuous). `bun test src/skin` → pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests no new failure names; skin tests pass incl. new
- [ ] No `Badge` with Preview/live-quarter/Final in the Scoreboard header (final's `Final` badge on the card body is allowed)
- [ ] Pill strip on all widths; carousel/dots code deleted; swipe still switches games
- [ ] Rows: no red clock text in meta on this route; winner sides bold at final, no glyphs; roster page rows unchanged
- [ ] Bench full mirrored rows; Rest-of-week pills
- [ ] Mini-scorebar appears when the score card scrolls away (both widths)
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on the excerpts; `player-cell.tsx` clock markup is shared such that an opt-out prop can't isolate it cleanly.
- `yetLabel`/WP wiring turns into >15 lines of model code — skip the meter, note it, continue.
- Bench pairing by index misrepresents the data shape (bench arrays are per-team and unordered — if pairing looks wrong, render two stacked single-sided groups with the same row anatomy instead, and note it).

## Maintenance notes
- 066 wraps this Scoreboard + MatchupEdge in the desktop rail — keep Scoreboard layout-agnostic (no width assumptions).
- 067 reuses the pill recipe on the board — keep `GamePill` exportable-ready (still local; 067 may lift it to components/).
