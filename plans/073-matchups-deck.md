# Plan 073: The matchup board's slate at the thumb

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `git diff --stat 6b9b68d..HEAD -- 'src/routes/league/$leagueId/matchups.tsx'` → expected empty. (skin.test.mjs drift from 071/072 is expected.)

## Status
P2 · Effort M · Risk LOW–MED · Planned at `6b9b68d`, 2026-08-24 · Run after 072

## Why this matters
Locked design ("The Context Rail" draft 3 §5): the Matchups deck = **game pills (current inked, live dots) — the week slate at the thumb**. Today the slate is a row of 176px-wide cards at the top of the page; on a phone that is a top-reach and a half-screen of chrome. Phones get 30px pills in the deck; sm+ keeps the card strip. NOTE (deliberate deviation, surface in your report): the artifact's sheet held a week picker — the week picker stays in the league header for now (it lives in the shared league layout; moving it is layout surgery for another pass).

## Current state — verified excerpts (at `6b9b68d`, src/routes/league/$leagueId/matchups.tsx ~483 lines)
- Selection: `const [picked, setPicked] = useState<number | null>(null)`; `selected = picked != null && picked < shown.length ? picked : defaultIndex`; `pair = shown[selected]`; `move(delta)` wraps.
- The card strip (~288+): `{shown.length > 1 ? (<div className="relative"> …edge arrow buttons… <div ref={stripRef} onScroll={syncEdges} role="tablist" aria-label="Matchups this week" onKeyDown={…} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{shown.map((p, i) => … w-44 card buttons with role="tab", onClick={() => setPicked(i)} …)}</div></div>) : null}` — inside the loaded branch's `<div className="space-y-5">`.
- Helpers in scope: `pairPreviewScores` (imported), `pairingIsLive` (imported), `formatPts`, `cn`. There is NO local `abbr` — write one (3 lines: `name.trim().slice(0, 3).toUpperCase()`, mirror matchupId.tsx ~767).
- Pill recipe to mirror (matchupId.tsx `GamePill`, ~793): `flex h-[30px] shrink-0 items-center gap-1.5 rounded-pill px-2.5 font-mono text-[11px] whitespace-nowrap`, active `bg-fg text-bg`, idle `text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]`, live dot `<span className="size-1.5 rounded-full bg-live" />` when live and not active; content `ABB 12 · ABB 8` via `abbr` + `formatPts(x, 0)`. Here they are BUTTONS (`setPicked(i)` + `window.scrollTo(0,0)`), not Links.

## Conventions
Deck exemplar = wire/roster. Focus ring per 070 (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep`). Tokens/`cn()`/zero easing; commits imperative, no AI attribution, no plan/sprint words.

## Commands / gate
Same as 071 (`pglite-073`). QA: `/league/lg_65h3kyr5up/matchups` 390 + 1024, light + dark.

## Scope
**In scope**: `src/routes/league/$leagueId/matchups.tsx`, `src/skin/skin.test.mjs` (assert add).
**Out of scope**: matchup-board.tsx, matchupId.tsx (its GamePill stays local — duplication of a 20-line pill is this codebase's documented convention until a third consumer), league layout/week-picker, `deck.tsx`/`shell.tsx`, `plans/`.

## Steps
### Step 1: The deck pills
Import `Deck`; in the loaded branch mount (only when `shown.length > 1`): `<Deck><div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{shown.map((p, i) => …pill button…)}</div></Deck>` — each pill: `type="button"`, `aria-current={i === selected ? "true" : undefined}`, onClick `{ setPicked(i); window.scrollTo(0, 0); }`, recipe + focus ring above, live dot via `pairingIsLive(p)`, scores via `pairPreviewScores(p)`.
Add a small effect: when `selected` changes, scroll the active pill into view inside the deck row (`querySelector('[aria-current="true"]')?.scrollIntoView({ inline: "center", block: "nearest" })` scoped to a ref on the pill row — guard `behavior` default auto; no smooth).
**Verify**: 390 — pills at the thumb, current inked, live dots on live games; tapping swaps the board and returns to top; the active pill stays visible in the row.

### Step 2: The card strip is sm+
The strip wrapper `<div className="relative">` → `<div className="relative hidden sm:block">` (arrows, tablist, cards untouched).
**Verify**: 390 — no card strip, board directly under the header; 1024 — strip identical to today (arrows, centering, keyboard).

### Step 3: Gate + tests
skin.test.mjs, extend `"the board compares; only the box score mounts the line"`: add `assert.match(board, /<Deck>/)` and `assert.match(board, /relative hidden sm:block/)`. Full gate + screenshots 390 light+dark (top, after tapping a far pill), 1024.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new asserts
- [ ] 390: pill slate in the deck drives the board; no card strip
- [ ] 1024: unchanged
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts (skin.test.mjs from 071/072 excepted).
- The deck pill row and the strip's selection logic fight (double-render of selection state) — they cannot: both read `selected`. If something else surfaces, report.

## Git workflow
`main`; one commit, e.g. `feat(matchups): the week slate rides the deck`. Do NOT push.
