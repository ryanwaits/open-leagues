# Plan 063: Matchup page — the score card swipes through the week's slate

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Touch only in-scope files. On any STOP condition, stop and report. SKIP updating `plans/README.md` if your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat <062-SHA>..HEAD -- 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx'` → expected empty (SHA from `plans/README.md` row 062).

## Status
P2 · Effort M · Risk MED (navigation driven by scroll settle; must not loop or fight the liveline scrub) · Depends on 062 · Planned at `37ed78d`, 2026-08-23

## Why this matters

Ryan's locked call (Pocket Ledger demo B + follow-up): on phones, **only the score card row swipes** between the week's games — but when a swipe settles, the app **navigates to that matchup**, so everything below (the Where-the-game-is chart, starters, bench, book) re-anchors to the new game. Whole-page swiping was rejected because it would fight the liveline scrubber's horizontal gesture. Dots under the card + the existing prev/next NavChips are the visible twins.

## Current state (at 37ed78d)

`src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (~1000 lines):
- `slate` memo (~line 227): `paintMatchups(...)` over `matchups.data` — an array of `MatchupPair` for the whole week, same shape the `Scoreboard` consumes. Already on the page; also rendered as a "Rest of week" list (~461).
- `pair` memo: the current matchup; `matchupId` from route params.
- Render (~320–350): header row with `BackLink` + two `NavChip`s (prev/next matchupIds — see `nextNav`/`prevNav` in the surrounding code, read it), then `<Scoreboard pair={pair} week leagueId standings status live />`, then `<MatchupEdge …/>`, starters, bench.
- `Scoreboard` (~545): `<section className="rounded-xl bg-surface px-4 py-5 ring-card sm:px-6 sm:py-6">` — self-contained given a `MatchupPair`; `status`/`live` only affect the badge.
- Navigation idiom in this file: `NavChip` uses `<Link to="/league/$leagueId/matchup/$week/$matchupId" params={{ leagueId, week: String(week), matchupId: String(matchupId) }}>`. Programmatic: `useNavigate()` from `@tanstack/react-router` (check the file's imports; `Route.useNavigate()` also works).
- Demo replay props (`prevPair`, `phase`, `progress`) apply only to the current pair — neighbour cards in the row render plain `slate` data with a muted status badge; that's fine.

Conventions: tokens/utilities; `cn()`; snap-row idiom from plan 061 (copy its container classes); commits imperative, no AI attribution.

## Commands
Same table as plan 060 (typecheck / lint ≤ 10 / fresh-dir tests — this plan adds pure-fn tests, expect ≥ 337 pass / build:dev / dev). QA: demo on, `/league/lg_65h3kyr5up/matchup/1/6` at 390.

## Scope
**In scope**: `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`; `src/lib/snap-settle.ts` (new, pure helper); `src/lib/snap-settle.test.mjs` (new).
**Out of scope**: `Scoreboard` internals beyond accepting a width class, `MatchupEdge`, `matchups.tsx` board, desktop layout (row is `sm:hidden`), `NavChip`/`BackLink` (stay as-is).

## Steps

### Step 1: Pure helper — `src/lib/snap-settle.ts`

```ts
/** Index of the snap child nearest to scrollLeft. cardW includes the gap. */
export function settledIndex(scrollLeft: number, cardW: number, count: number): number {
  if (cardW <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / cardW)));
}
```

**Verify**: `bun test src/lib/snap-settle.test.mjs` (write tests first or after — see Test plan).

### Step 2: The swipeable card row (phones)

Above the existing `<Scoreboard …/>` mount, add the phone row; wrap the existing single Scoreboard in `hidden sm:block`:

```tsx
{slate.length > 1 ? (
  <div className="sm:hidden">
    <div ref={slateRef} onScroll={onSlateScroll}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {slate.map((p) => (
        <div key={p.matchupId} className="w-[calc(100%-2.75rem)] shrink-0 snap-center">
          <Scoreboard pair={p.matchupId === pair.matchupId ? pair : p} week={week} leagueId={leagueId} standings={standings}
            status={p.matchupId === pair.matchupId ? status : statusOf(p)} live={p.matchupId === pair.matchupId ? liveFlag : false} />
        </div>
      ))}
    </div>
    <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
      {slate.map((p) => (
        <span key={p.matchupId} className={cn("h-1.5 rounded-pill transition-all duration-150", p.matchupId === pair.matchupId ? "w-4 bg-fg" : "w-1.5 bg-line-strong")} />
      ))}
    </div>
  </div>
) : null}
<div className={cn(slate.length > 1 && "hidden sm:block")}>
  <Scoreboard … today's props unchanged … />
</div>
```

(`liveFlag` = the existing `live` expression passed to Scoreboard today — hoist it to a const. `statusOf` already exists in the file.)

Initial position, no animation: `useLayoutEffect` on mount and on `matchupId` change — compute `i = slate.findIndex(p => p.matchupId === matchupId)`, set `slateRef.current.scrollLeft = i * cardW` where `cardW = row.firstElementChild.offsetWidth + 12` (the gap-3). Guard a `programmatic` ref around this write so `onSlateScroll` ignores it.

### Step 3: Settle → navigate

`onSlateScroll`: debounce 160ms after the last scroll event (store a timeout ref); on settle compute `i = settledIndex(el.scrollLeft, cardW, slate.length)`; if `slate[i].matchupId !== matchupId` and not `programmatic`, `navigate({ to: "/league/$leagueId/matchup/$week/$matchupId", params: { leagueId, week: String(week), matchupId: String(slate[i].matchupId) }, replace: true })` (replace, so a browsing swipe-spree doesn't bloat history — the NavChips keep push behaviour). After navigation the effect from Step 2 re-anchors scrollLeft — because the index already matches, the write is a no-op, so no loop. `scrollend` event may be used instead of the debounce where supported, but the debounce is the required baseline (Safari).

**Verify**: at 390 with demo on: swipe the card left → after settle the URL's matchupId changes, chart + starters below re-render for the new game, dots advance; swipe back → returns; tapping NavChip still works; no navigation ping-pong (watch the console/URL for 5s after a swipe). Desktop 1440: single Scoreboard, no row.

## Test plan
- `src/lib/snap-settle.test.mjs` (node:test): settledIndex(0,346,7)→0; settledIndex(346,346,7)→1; settledIndex(500,346,7)→1; settledIndex(10000,346,7)→6; settledIndex(100,0,7)→0; settledIndex(100,346,0)→0.
- `bun test src/lib/snap-settle.test.mjs` → all pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests ≥ 337 pass, no new fails
- [ ] Swipe-settle navigates (URL changes) and page context below re-anchors — screenshots before/after in report
- [ ] No navigation loop: after one swipe, URL stable for ≥5s
- [ ] Desktop unchanged (screenshot)
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on the render-region excerpt, or `Scoreboard`'s props don't accept a plain slate pair (type error) — report, don't refactor Scoreboard.
- Route navigation remounts the component in a way that visibly flashes/resets the row after every swipe after two fix attempts — report with observations (the fallback design is local state + no navigation, but that changes URL semantics — Ryan's call, not yours).
- The row's horizontal gesture conflicts with `MatchupEdge`'s liveline scrub (they're separate elements; they shouldn't) — if observed, report.

## Maintenance notes
- `replace: true` on swipe, push on NavChips — intentional split; keep it.
- The dots are presentation-only (`aria-hidden`); NavChips remain the accessible prev/next.
- If the slate ever exceeds ~10 games, consider windowing the row; today it's ≤7 cards of light DOM.
