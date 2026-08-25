# Plan 077: One handoff line — the deck owns everything below md

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: verify each excerpt below matches at its line (±5 lines) before editing; if any does not, STOP and report.

## Status
P1 · Effort S–M · Risk LOW–MED (breakpoint semantics on six files; one logic fix) · Planned at `ab20f64`, 2026-08-24

## Why this matters
Audit of the deck rollout (plans 068–076) confirmed three defects:
1. **The week control can vanish on phones.** On `/matchups` the deck (and the week pill inside it) only mounts when `shown.length > 1`. A one-matchup week (playoff final, tiny league, or while data loads) renders no deck — and the header WeekPicker is `hidden … sm:inline-flex` on that route, so a phone has NO way to change the week.
2. **Double chrome in the 640–767px band.** The deck lives in the bottom nav, which hides at `md` (768px). But five counterpart controls come back at `sm` (640px): the wire's in-flow filters, the matchups card strip, the roster masthead's "Propose a trade", the game page's top rail, and the league header's WeekPicker. Between 640 and 767px — a real device class: iPad mini portrait is 744px — both the deck AND the top controls show, duplicating tabs/filters/CTAs/week controls. Plan 072 (box score) already used `md` as the handoff; make every page match it.
3. **A contradictory class string.** The box score's sticky mini-bar carries both `flex` and `hidden md:flex` — it only behaves because Tailwind orders `.hidden` after `.flex` in its display utilities. Drop the bare `flex`.

## Current state — verified excerpts (at `ab20f64`)
- `src/routes/league/$leagueId/matchups.tsx:314` — `{shown.length > 1 ? (` opens the `<Deck>` block; INSIDE it are (a) the "Change week" pill button (aria-label="Change week", opens `weekOpen`) and (b) the slate pill row (`ref={setRowRef}`). Line ~360: `{shown.length > 1 ? (<div className="relative hidden sm:block">` — the desktop card strip. The `<WeekSheet …/>` mounts near the bottom of the component, outside these gates. The route also has `league` (bundle query), `week`, `weekLabel`, `playoffStart` already in scope.
- `src/routes/league/$leagueId/wire.tsx:256` — `<div className="mt-4 hidden gap-3 sm:flex sm:flex-col">` (the in-flow search/status/pos controls).
- `src/routes/league/$leagueId/roster.tsx:434` — `<Button asChild size="sm" className="hidden sm:inline-flex">` (masthead "Propose a trade"; the deck carries ⇄ Trade below md).
- `src/routes/scores_.$gameId.tsx:197` — rail wrapper class starts `"hidden sm:block sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 mt-4 bg-bg/90 px-4 py-2 backdrop-blur-md"`.
- `src/routes/league/$leagueId.tsx:229` — `className={deckWeek ? "hidden shrink-0 sm:inline-flex" : "shrink-0"}` on the header WeekPicker.
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx:384` — `<div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2 backdrop-blur-md hidden md:flex lg:hidden">` (note both `flex` and `hidden md:flex`).
- `src/skin/skin.test.mjs` asserts these literals: game-page test `/hidden sm:block/`; matchups test `/relative hidden sm:block/`; week test `/hidden shrink-0 sm:inline-flex/`; box-score test `/hidden md:flex lg:hidden/`.
- Left alone by THIS plan (deliberate): the wire's pager gate `hidden border-t border-line sm:block` and `useIsPhone`'s 639px JS boundary — in the 640–767 band the list runs in paged mode with the pager visible at the card's foot; that is chrome at the bottom, not a duplicate of the deck's filters. Also the roster deck's scroll-tracking is gated on `useIsPhone` (639px), so in the band the tabs won't self-track but tap-jumps still work — accepted, note it, do not change `useIsPhone`.

## Conventions
Tokens/utilities only; `cn()` from `@/lib/utils`; commits imperative, no AI attribution, no plan/sprint words. Never edit routeTree.gen/auth/engine/grok lists.

## Commands / gate
`bun run typecheck` → 0 · scoped `bunx biome check` → 0 new · fresh dir `PGLITE_DATA_DIR=/tmp/claude-501/pglite-077 bun test src scripts` → baseline ~353 pass + the one pre-existing flaky `import.meta.glob` error; no NEW failure names · `bun run build:dev` → 0. QA via agent-browser (Bash sandbox DISABLED, `~/.bun/bin/agent-browser`, login http://localhost:8080/login prefilled, league `lg_65h3kyr5up`, screenshots to scratchpad exec077/, `close --all` after) at THREE widths: `set viewport 390 844`, `set viewport 744 1133` (the band), `set viewport 1024 800`.

## Scope
**In scope**: `src/routes/league/$leagueId/matchups.tsx`, `src/routes/league/$leagueId/wire.tsx`, `src/routes/league/$leagueId/roster.tsx`, `src/routes/scores_.$gameId.tsx`, `src/routes/league/$leagueId.tsx`, `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (one class string), `src/skin/skin.test.mjs`.
**Out of scope**: `deck.tsx`/`shell.tsx`/`week-sheet.tsx`/`breakpoint.ts`, `useIsPhone`'s boundary, the wire pager/list gating, all other routes, `plans/`.

## Steps
### Step 1: The week pill survives a one-game slate (matchups.tsx)
Restructure so `<Deck>` mounts whenever the loaded branch renders (not inside `shown.length > 1`): the week pill is ALWAYS its first child; the slate pill row stays gated `{shown.length > 1 ? (<div ref={setRowRef} …>…</div>) : null}` INSIDE the deck. The desktop card strip gate at ~360 keeps its own `shown.length > 1`.
**Verify**: typecheck 0. In the browser at 390, `/matchups?week=1` shows pill+slate; then pick a hypothetical empty/1-game state if reachable (playoff week beyond data) — at minimum assert in the DOM that the deck row exists with the week pill when the board area shows "no matchups"/single-card content. If no such week is reachable in the seed data, verify by code-reading and note it.

### Step 2: The handoff moves to md (four class edits)
- wire.tsx:256 → `"mt-4 hidden gap-3 md:flex md:flex-col"`
- roster.tsx:434 → `className="hidden md:inline-flex"`
- scores_.$gameId.tsx:197 → `"hidden md:block sticky …"` (only `sm:`→`md:`; rest of the string untouched)
- matchups.tsx card strip → `"relative hidden md:block"`
- $leagueId.tsx:229 → `deckWeek ? "hidden shrink-0 md:inline-flex" : "shrink-0"`
**Verify**: 744×1133 on `/wire`, `/roster`, `/matchups`, `/standings`, a game page: exactly ONE set of controls — the deck (bottom) — no in-flow filters/strip/trade-button/top-rail/header-picker. 1024: all desktop controls back, no deck. 390: unchanged from today.

### Step 3: The mini-bar says one thing (matchupId.tsx:384)
Remove the single word `flex ` (the bare display class) from the class string, leaving `… -mx-4 items-center justify-between … hidden md:flex lg:hidden`.
**Verify**: 744 on `/matchup/1/6` scrolled: mini-bar shows, laid out as before (flex from `md:flex`); 390 scrolled: absent (deck carries the score); 1024: absent.

### Step 4: Tests + gate
skin.test.mjs updates (keep every other assert): game-page test `/hidden sm:block/` → `/hidden md:block/`; matchups test `/relative hidden sm:block/` → `/relative hidden md:block/`; week test `/hidden shrink-0 sm:inline-flex/` → `/hidden shrink-0 md:inline-flex/`; box-score test `/hidden md:flex lg:hidden/` unchanged (still matches). Add to the matchups assert group: the week pill mounts outside the slate gate — assert matchups.tsx does NOT match `/shown\.length > 1 \? \(\s*<Deck>/` (adjust whitespace in the regex to the shipped code so the assert is meaningful, e.g. check that `<Deck>` appears before the first `shown.length > 1` occurrence by index comparison in the test). Full gate + screenshots at 390/744/1024 for wire, roster, matchups, game page, box score.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. updated asserts
- [ ] 744: single chrome set on all five surfaces; 390 + 1024 unchanged from today
- [ ] Matchups week pill present regardless of slate size (code-verified at minimum)
- [ ] `git status` clean outside scope

## STOP conditions
- Any excerpt drifted.
- Moving the Deck mount in matchups breaks the callback-ref pill centering (it shouldn't — the ref lives on the gated row) → report, don't improvise.
- The 744 check reveals a page where hiding the sm control leaves NO working control in the band → report with screenshot.

## Maintenance notes
- The rule after this plan: **the deck owns <768; in-flow/top controls own ≥768.** Any future deck page must return its counterpart controls at `md:`, not `sm:`.
- Accepted in-band quirks (documented, not bugs): wire list is paged (pager at card foot) in 640–767; roster deck tabs don't scroll-track there (tap-jump works).

## Git workflow
`main`; one commit, e.g. `fix(deck): one handoff line at md — and the week pill never leaves`. Do NOT push.
