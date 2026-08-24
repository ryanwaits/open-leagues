# Plan 069: My Team's deck — section tabs that track and jump, trade at the thumb

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone; reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat <068-SHA>..HEAD -- 'src/routes/league/$leagueId/roster.tsx' src/components/lineup-board.tsx src/components/deck.tsx` → expected empty (SHA from README row 068).
>
> Spec = "The Context Rail" draft 3 §3 My Team phone — restated below.

## Status
P1 · Effort M · Risk LOW–MED (route chrome + anchors; one optional attr in lineup-board) · Depends on 068 (Deck primitive) · Planned at `<dispatch HEAD>`, 2026-08-24

## Why this matters
On phones, My Team's CTAs live at the top of the masthead and the page is five unequal sections in one long column. Locked design: the deck carries **Lineup · Bench · Activity** tabs that (a) jump-scroll on tap (instant, offset under the header) and (b) track the scroll position (the active tab always names where you are), plus the page's primary action **⇄ Trade** as the cap. "Add a player" stays in the masthead (secondary). Desktop unchanged.

## Current state — verified excerpts
`src/routes/league/$leagueId/roster.tsx` (~615): masthead section (~336–381: Avatar + h1 + `microlabel-data` seat line + two `<Button>`s "Propose a trade" (primary, links to trades) and "Add a player" (outline, links to wire) + Stat strip + Chip row); then `grid gap-5 lg:grid-cols-[1.4fr_1fr]` with left column: `<LineupBoard …/>` (lineup + bench inside one component), Shelves (IR/taxi, conditional), and right/below: Waivers section (~439), Trades section (~477), "Your moves" (~531). Section headers are `font-display text-lg font-medium tracking-[-0.02em]` h2s inside `rounded-xl bg-surface ring-card` sections.
`src/components/lineup-board.tsx`: renders the lineup card; the bench block lives inside it (find the bench header — the component uses `slot-rail` etc.). Adding ONE `data-deck-sec="Bench"` (or an `id`) wrapper/attr around its bench block is allowed; nothing else in that file.
`src/components/deck.tsx` (from 068): portal into Shell's `#deck-slot`.
Conventions: as plan 068. The page scrolls on the window.

## Commands / gate
Same as plan 068 (fresh dir `pglite-069`; baseline = whatever 068 landed + its new tests; judge by no NEW failure names). QA: `/league/lg_65h3kyr5up/roster` at 390 + 1024, light + dark.

## Scope
**In scope**: `src/routes/league/$leagueId/roster.tsx`; `src/components/lineup-board.tsx` (ONE anchor attr only); `src/skin/skin.test.mjs` (assertion add).
**Out of scope**: `shell.tsx`/`deck.tsx` (068's, consume only), wire, all other routes/components, `plans/`.

## Steps
### Step 1: Anchors
Wrap/mark three scroll targets in roster.tsx: the LineupBoard block → `data-deck-sec="Lineup"` (wrapper div), the bench block inside lineup-board.tsx → `data-deck-sec="Bench"` (the one allowed edit there), and the Waivers section → `data-deck-sec="Activity"` (Activity = Waivers + Trades + Your moves; the tab targets the first).
### Step 2: The deck
Mount on phones via `<Deck>`: three tab chips (segmented recipe: track `bg-raised rounded-pill p-0.5`, on `bg-fg text-bg`, off `text-faint`, `font-medium`, h-8) + spacer + `⇄ Trade` cap (`h-9 rounded-pill bg-fg text-bg px-3.5 text-[13px] font-medium`, `Link` to the trades route). Tab tap → `window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "auto"})` (instant; 76 ≈ header 60 + breathing room). Active tracking: window scroll listener (rAF-throttled, passive) — active = last section whose top ≤ 90px from viewport top; update chip states. No easing anywhere.
### Step 3: Masthead on phones
Hide the "Propose a trade" Button on phones (`hidden sm:inline-flex` on its wrapper or the Button) — the deck cap carries it; "Add a player" stays visible at all widths.
### Step 4: Gate + visual
Typecheck/lint/tests/build. 390: deck shows tabs + ⇄; tapping Bench lands the bench under the header; scrolling to Waivers flips the active tab to Activity; masthead shows only "Add a player". 1024: identical to today (both buttons, no deck). Screenshots light+dark both widths.

## Test plan
skin.test.mjs: `"my team's sections answer to the deck"` — roster.tsx matches `/<Deck>/` and `/data-deck-sec="Lineup"/`; lineup-board.tsx matches `/data-deck-sec="Bench"/`. `bun test src/skin` → pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new
- [ ] 390: deck tabs track + jump; ⇄ Trade navigates; masthead trade button hidden; Add a player present
- [ ] 1024: unchanged
- [ ] `git status` clean outside scope

## STOP conditions
- Drift; the bench anchor can't be added to lineup-board.tsx with a single attr (structure resists) → fall back to tabs Lineup · Waivers · Activity (drop Bench, Waivers becomes its own tab) and note it — do NOT restructure lineup-board.
- Scroll-tracking fights the window-scroll thumb-bar behaviour (it shouldn't — the bar no longer hides).

## Maintenance notes
- Third deck consumer (League page, later) triggers extracting shared deck-tab logic; not now.

## Git workflow
`main`; one commit, e.g. `feat(roster): the deck knows where you are — tabs track, trade at the thumb`. Do NOT push.
