# Plan 074: The League pages answer to one deck — Table · Recap

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `git diff --stat 6b9b68d..HEAD -- 'src/routes/league/$leagueId/standings.tsx' 'src/routes/league/$leagueId/recap.tsx'` → expected empty. (skin.test.mjs drift from 071–073 is expected.)

## Status
P2 · Effort S · Risk LOW · Planned at `6b9b68d`, 2026-08-24 · Run after 073

## Why this matters
Locked design ("The Context Rail" draft 3 §5): the League deck = **Table · Recap** (+ week pill). The League thumb tab lands on standings; the recap/desk lives on a sibling route reached through an inline card. On phones the deck makes the pair one thumb-tap apart from either side. NOTE (deliberate deviation, surface in your report): the artifact's week pill/sheet stays out — the week picker remains in the league header (shared layout; another pass).

## Current state — verified excerpts (at `6b9b68d`)
- `src/routes/league/$leagueId/standings.tsx` (~556): `week = search.week ?? league.data?.currentWeek ?? 1` (~50); body = `grid gap-5 lg:grid-cols-[1.5fr_1fr]`, Standings table section, right column has the recap Link card (`to="/league/$leagueId/recap"` … `search={{ week, story: undefined }}`) (~319–331).
- `src/routes/league/$leagueId/recap.tsx` (~157): route `/league/$leagueId/recap`, `validateSearch` `{week?, story?}`; `week = search.week ?? league.data?.currentWeek ?? 1`; imports `createFileRoute` (NOT `Link` — add it). Header "Recap edition"/"Prep edition".
- Segmented deck-tab recipe (roster.tsx, 069/070): track `flex items-center gap-0.5 rounded-pill bg-raised p-0.5`; item `h-8 rounded-pill px-3 text-[13px] font-medium` + active `bg-fg text-bg` / idle `text-faint` + `focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep`. Here the two items are `Link`s (route nav), `aria-current="page"` on the active one.

## Conventions
Deck exemplar = roster.tsx. Tokens/`cn()`/zero easing; commits imperative, no AI attribution, no plan/sprint words. The 10-line deck-tab markup is duplicated across the two routes on purpose (documented convention; a third League-side consumer triggers extraction).

## Commands / gate
Same as 071 (`pglite-074`). QA: `/league/lg_65h3kyr5up/standings` and `/league/lg_65h3kyr5up/recap` at 390 + 1024, light + dark.

## Scope
**In scope**: `src/routes/league/$leagueId/standings.tsx`, `src/routes/league/$leagueId/recap.tsx`, `src/skin/skin.test.mjs` (assert add).
**Out of scope**: league layout (`$leagueId.tsx`), week-picker.tsx, `deck.tsx`/`shell.tsx`, all other routes, `plans/`.

## Steps
### Step 1: Standings mounts the deck
Import `Deck`; mount in the loaded branch: segmented track with two Links — **Table** (active: `aria-current="page"`, `bg-fg text-bg`; it links to `/league/$leagueId/standings` with `search={{ week }}` for completeness) and **Recap** (idle; `to="/league/$leagueId/recap"` `params={{ leagueId }}` `search={{ week, story: undefined }}`).
**Verify**: 390 — deck shows Table (inked) · Recap; tapping Recap navigates carrying the week. 1024 — no deck.

### Step 2: Recap mounts the mirror
Add `Link` to recap.tsx's router import; mount the same `<Deck>` with Recap active and Table linking to `/league/$leagueId/standings` `search={{ week }}`.
**Verify**: 390 — deck shows Table · Recap (inked); Table returns to standings on the same week.

### Step 3: Gate + tests
skin.test.mjs, add `"the league pages share the table-recap deck"`: standings.tsx matches `/<Deck>/` and recap.tsx matches `/<Deck>/` and `/aria-current="page"/`. Full gate + screenshots: 390 light (both pages, both states), 1024 sanity.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new
- [ ] 390: both routes carry the two-tab deck; navigation preserves the week; 1024 unchanged
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts (skin.test.mjs from 071–073 excepted).
- Router types reject the standings self-link with `search={{ week }}` → drop the self-link to a non-interactive `<span aria-current="page">` and note it.

## Git workflow
`main`; one commit, e.g. `feat(league): table and recap, one thumb apart`. Do NOT push.
