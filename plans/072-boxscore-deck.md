# Plan 072: The box score's slate and mini-score join the deck

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `git diff --stat 6b9b68d..HEAD -- 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx'` → expected empty. (skin.test.mjs will have drifted if 071 landed first — that is expected and fine.)

## Status
P1 · Effort M · Risk MED (live-score chrome moves) · Planned at `6b9b68d`, 2026-08-24 · Independent of 071 (different files) but run after it

## Why this matters
Locked design ("The Context Rail" draft 3 §5): the box score's deck carries **game pills (replacing the top strip) and the mini-score joins the deck when the score card scrolls off**. Today both live at the top on phones — the pill strip above the score card and a sticky mini-scorebar under the app header once you scroll. Desktop (lg rail) untouched.

## Current state — verified excerpts (at `6b9b68d`, src/routes/league/$leagueId/matchup/$week/$matchupId.tsx ~850 lines)
- `sentinelRef` + `stuck` (~256–270): 1px sentinel above the score card; IO flips `stuck` when it leaves view.
- `miniScores = pairPreviewScores(pair)` and `miniHomeLeads` (~342–343).
- The sticky mini-scorebar (~382–399): `{stuck ? (<div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md lg:hidden"> <span className="font-mono text-sm tabular-nums">…abbr(pair.home.teamName) formatPts(miniScores.home,1) – …away…</span> {!decided && pair.away && miniScores.live ? <span className="microlabel text-live">● {liveStarterCount(pair.home)} v {liveStarterCount(pair.away)}</span> : null} </div>) : null}`.
- The pill strip (~404–412), first child of the lg rail column: `{slate.length > 1 ? (<div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:mb-4 lg:px-0 [&::-webkit-scrollbar]:hidden">{slate.map((p) => (<GamePill key={…} pair={p} leagueId={leagueId} week={week} active={p.matchupId === pair.matchupId} />))}</div>) : null}` — `GamePill` is local (~793): a 30px `Link` pill (`h-[30px] … rounded-pill px-2.5 font-mono text-[11px]`, active `bg-fg text-bg`, idle inset-ring) with a live dot; navigation to a sibling matchup re-anchors the page.
- Helpers local to the file: `abbr`, `liveStarterCount`, `pairPreviewScores` import, `formatPts`.

## Conventions
Deck exemplar = wire/roster/071. Focus ring recipe per 070. Tokens/`cn()`/zero easing; commits imperative, no AI attribution, no plan/sprint words.

## Commands / gate
Same as 071 (`pglite-072`). QA: `/league/lg_65h3kyr5up/matchup/1/6` at 390 + 1024 (+768 for the md band), light + dark. Demo replay if useful: seed `localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:3,running:false},version:0}))` before reload.

## Scope
**In scope**: `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`, `src/skin/skin.test.mjs` (assert add).
**Out of scope**: `deck.tsx`, `shell.tsx`, matchup-board/slot-pts/player-cell components, matchups.tsx, `plans/`.

## Steps
### Step 1: The deck — pills, and the score when it matters
Import `Deck`; mount in the loaded branch:
- When `stuck` and `pair`: a `shrink-0` mini-score chunk first — same content as the sticky bar (`font-mono text-sm tabular-nums` score span; the `● n v n` live microlabel only if it fits — if the row gets tight at 390 with pills behind it, drop the live count from the deck version and keep just the score).
- Then, when `slate.length > 1`: the pill row — `<div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{slate.map((p) => <GamePill … active={p.matchupId === pair.matchupId} />)}</div>` (same props as the top strip).
- When neither (single-game week, not stuck): render nothing inside `<Deck>` — WRONG: an empty deck row still paints padding. Instead mount `<Deck>` only when `slate.length > 1 || stuck` (conditional mount keeps `empty:hidden` honest).
**Verify**: 390 — pills at the thumb; scroll past the score card → the score appears in the deck, leading the pills; tap a pill → navigates, page re-anchors, deck follows the new pair.

### Step 2: The top strip and mini-bar step back to md
- Pill strip wrapper: `flex` → `hidden md:flex` (keep everything else) — phones use the deck, md–lg keeps the in-flow strip, lg column unchanged.
- Sticky mini-bar: `lg:hidden` → `hidden md:flex lg:hidden` (keep everything else) — phones use the deck, the md band keeps the top bar.
**Verify**: 390 — neither top strip nor sticky bar; 768 — both behave as today; 1024+ — rail layout unchanged, no sticky bar.

### Step 3: Gate + tests
skin.test.mjs, extend `"the box score speaks in counts, not clocks"`: add `assert.match(route, /<Deck>/)` and `assert.match(route, /hidden md:flex lg:hidden/)`. Full gate. Screenshots: 390 light+dark (top w/ pills-deck, scrolled w/ score-in-deck), 768 (top bar), 1024 (rail).

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new asserts
- [ ] 390: pills in the deck; mini-score joins on scroll; no top strip/sticky bar
- [ ] 768: today's top strip + sticky bar; 1024: unchanged
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts (skin.test.mjs drift from 071 excepted).
- Score + pills cannot share the 390 deck row even after dropping the live count → report with screenshot.

## Git workflow
`main`; one commit, e.g. `feat(box): the slate and the score meet the thumb`. Do NOT push.
