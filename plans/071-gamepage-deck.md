# Plan 071: The game page's tabs come down to the thumb

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `git diff --stat 6b9b68d..HEAD -- src/routes/scores_.\$gameId.tsx src/components/deck.tsx src/components/shell.tsx` → expected empty.

## Status
P1 · Effort M · Risk MED (the page's primary controls move; swipe/keyboard/AT paths must survive) · Planned at `6b9b68d`, 2026-08-24

## Why this matters
Locked design ("The Context Rail" draft 3 §5): on phones the game page's deck carries **Plays · Box · Scoring + the All/Scoring filter — replacing the top rail**. The rail was shipped before the deck existed; the deck has now proven itself on Players/My Team/roster (068–070). Desktop (sm+) keeps the top rail untouched.

## Current state — verified excerpts (at `6b9b68d`, src/routes/scores_.$gameId.tsx ~660 lines)
- `TABS` memo (~66): `[["plays","Plays"],["box","Box"],["scoring", scoringCount ? \`Scoring · ${scoringCount}\` : "Scoring"]]`; `idx`; `pickTab(i)` (~77) clamps, `setTab`, `window.scrollTo(0,0)`; `onTablistKeys` (~88) Arrow keys; `useSwipe` panes; `sentinelRef`/`stuck` for the rail hairline.
- The rail (~158–200): `<div className={cn("sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 mt-4 bg-bg/90 px-4 py-2 backdrop-blur-md", stuck && "border-b border-line")}>` containing (a) `<div role="tablist" aria-label="Game views" onKeyDown={onTablistKeys} className="flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5">` with `role="tab"` buttons (`aria-selected`, roving `tabIndex`, `h-8 rounded-pill px-3.5 text-sm font-medium transition-colors duration-150`, on=`bg-fg text-bg`, off=`text-faint hover:text-muted`) and (b) when `tab === "plays" && g.drives.length`: two `FilterChip`s All/Scoring bound to `filter`/`setFilter`.
- `FilterChip` local component (~266): `h-8 rounded-pill px-3 font-mono text-xs tracking-wide` + `aria-pressed`.
- The page renders `<Shell>` (line ~140) with no tabs prop — the bottom nav (and `#deck-slot`) is present on phones via the recent-league fallback; the Deck portal (src/components/deck.tsx, 068) works here unchanged.
- skin.test.mjs has `"the game page rail is a pinned tablist over snap panes"` asserting `role="tablist"`, `touch-pan-y`, `sticky top-[calc(3.75rem`, and no `bg-accent text-accent-fg`.

## Conventions
Deck consumption exemplar = wire.tsx/roster.tsx (068–070). Focus rings: `focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep` inside tight tracks (offset variant elsewhere). Tokens/utilities only; `cn()`; zero easing on high-frequency UI; commits imperative, no AI attribution, no plan/sprint words. Never edit routeTree.gen/auth/engine/grok lists.

## Commands / gate
`bun run typecheck` → 0 · scoped `bunx biome check` → 0 new · fresh dir `PGLITE_DATA_DIR=/tmp/claude-501/pglite-071 bun test src scripts` → baseline ~352–354 pass + the one pre-existing flaky `import.meta.glob` error; no NEW failure names · `bun run build:dev` → 0. QA: any game at `/scores` → tap into `/scores/<gameId>` at 390 + 1024 (light + dark; dark via `localStorage.setItem('ledger-theme','dark')`).

## Scope
**In scope**: `src/routes/scores_.$gameId.tsx`, `src/skin/skin.test.mjs`.
**Out of scope**: `deck.tsx`, `shell.tsx`, `useSwipe`/`src/lib/swipe.ts`, PlayFeed/BoxTables internals, every other route, `plans/`.

## Steps
### Step 1: The deck
Import `Deck` and mount it in the loaded branch (same level as the rail): a second tablist with IDENTICAL semantics and handlers — `role="tablist"` + `aria-label="Game views"` + `onKeyDown={onTablistKeys}`, track `flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5`, `role="tab"` buttons with `aria-selected`, roving `tabIndex`, `onClick={() => pickTab(i)}`, classes as the rail's plus the tight-track focus ring. After the tablist, when `tab === "plays" && g.drives.length`: the same two `FilterChip`s (All / Scoring) with a `shrink-0` wrapper; give the deck's row `min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` on the chip group only if it overflows 390px — check the rendered width first; if tablist + chips fit inside 390 (they should: 3 tabs + 2 chips ≈ fits), no scroll container is needed.
**Verify**: 390 — deck shows the three tabs + (on Plays) All/Scoring; tapping switches panes instantly from the top; Scoring tab count matches the rail's.

### Step 2: The rail is desktop-only
Add `hidden sm:block` to the rail's sticky wrapper (keep every other class — `stuck` hairline included). The sentinel and `stuck` effect stay (they only matter when the rail shows).
**Verify**: 390 — no top rail anywhere in the scroll; 1024 — rail identical to today (sticky, hairline on stick, filter chips).

### Step 3: Swipe + keyboard still whole
No changes to the pane transform/`useSwipe` block. Confirm: swiping panes at 390 still works; the deck tablist arrows (focus a deck tab, ArrowRight) switch panes.
**Verify**: manual at 390; also confirm only ONE tablist is visible per breakpoint (the other is `display:none`, hence unfocusable).

### Step 4: Gate + tests
Update skin.test.mjs `"the game page rail is a pinned tablist over snap panes"`: keep the existing asserts (the rail still exists for sm+) and add `assert.match(gamePage, /<Deck>/)` and `assert.match(gamePage, /hidden sm:block/)`. Full gate + screenshots: 390 light+dark (Plays w/ deck+filter, Box via deck tap), 1024 light (rail unchanged).

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests no new failure names; skin tests pass incl. updated asserts
- [ ] 390: tabs + filter live in the deck; no top rail; panes swipe; keyboard arrows work on the deck tablist
- [ ] 1024: rail byte-identical
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts.
- The deck row cannot hold tablist + chips at 390 without wrapping after one honest layout attempt → report with a screenshot (do not shrink type sizes).
- Anything requires editing deck.tsx/shell.tsx.

## Git workflow
`main`; one commit, e.g. `feat(scores): the game's tabs ride the deck`. Do NOT push.
