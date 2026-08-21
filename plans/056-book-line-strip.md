# Plan 056: The line's own line — spread movement in the book panel and the ticket, plus the in‑play wagering spec

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69cd95b..HEAD -- src/components/book-panel.tsx src/components/wager-ticket.tsx src/routes/league/\$leagueId/matchups.tsx src/lib/league/ticks.server.ts src/lib/data/fns.ts`
> Plans 053–055 touch `matchups.tsx`, `fns.ts` and create `ticks.server.ts` — expected. For `book-panel.tsx` and `wager-ticket.tsx`, compare the excerpts below against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (the strip) — the in‑play wagering section is a **spec only**, not to be built here
- **Risk**: LOW for the strip (reads an existing table; betting‑on leagues only). The in‑play section is scoped, not executed.
- **Depends on**: plans/055-matchup-lines-and-ticks.md (DONE — `ff_ticks`, `getTicks`, `useMatchupSeries`/`samplesFromTicks` must exist)
- **Category**: direction (Sprint 3 of the liveline integration)
- **Planned at**: commit `69cd95b`, 2026-08-21

## Why this matters

The book prices every matchup from the same margin as "Where the game is", so
the spread already has a history — plan 055 started keeping it. "Is −2.5 a
good number?" is unanswerable without "it opened at −6." A 64‑px strip above
the prices, showing where the spread opened and where it sits, is the one
piece of context a bettor wants before pressing a price; a 48‑px copy above
the stake field in the ticket is the same context at the moment of
commitment. **Today the book closes before the slate** (`lockWeek()` fires on
the last pre‑game status refresh, `ops.server.ts` ≈ line 1330), so during
games the strip is read‑only history; opening the book mid‑game is a separate
feature, scoped at the end of this plan and explicitly not built here.

## Locked design (do not re‑decide)

| Item | Decision |
|---|---|
| Series | One line: the **home spread** (`spread` column of `ff_ticks`, negative = home favoured), as the panel already labels it (`Spread · hands −12.5 · Butterbean +12.5`). Signed from the **home** side, not the viewer — the panel's prices are. |
| Where | `LinePanel`: between the header and the `Spread` row, in a `px-5 pt-0 pb-1` block: a `watch-chart-head`‑style row (`microlabel-data` left `${homeName} spread · today`, right `opened ${fmt(first)} at ${fmtClockOfDay(firstAt)} · now ${fmt(last)}`), then `<LiveLine height={64} quiet badge …/>` — quiet (no grid/scrub) **but with the badge on** (the current number is the product), `formatValue = fmtSpread`, `windowSecs = 43200` (the day), `padding {top: 8, right: 40, bottom: 4, left: 0}`, `frozen` when the book is `locked` **and** the week's games are all final (otherwise live). |
| Ticket | `WagerTicket`: same strip at `height 48` directly **above** the "Your stake" row, only when ≥ 2 ticks exist; caption `opened ${a} · now ${b}`. |
| Empty | Fewer than 2 ticks → render nothing (no empty chart). Pre‑game (ticks from earlier in the week are still a series — show them if ≥ 2). |
| Momentum | Off. (Direction of "the spread going up" is ambiguous for the reader; the caption states opened/now.) |
| Smoothing | Off (`smooth={false}`) — a spread moves in half‑points; smoothing would draw numbers that never existed. |
| Colours | `tone="brand"` (the book is the house's instrument, not yours vs theirs). |

## Current state

- `src/components/book-panel.tsx` — `LinePanel({ line: BookLine, onPick, className })` (lines 13–150). Header (`px-5 pt-5 pb-2`: "The line" / `suggested|closed`), then `<Row label="Spread" … />` and `<Row label="Moneyline" … />` (each `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3`), then the footnote `<p className="px-5 pt-1 pb-4 text-xs text-faint">`. `fmtSpread(n)` (bottom of file): `PK` for 0, else `±x.x` with `−` U+2212. `fmtOdds` exported. The dead‑line branch (`!line.live`) renders `data-testid="wager-no-price"`.
- `BookLine` (`src/lib/league/book.server.ts:22`): `Quote & { homeName, awayName, locked, restrictedTo }`; `Quote` has `matchupId, homeRoster, awayRoster, spread, homePct, awayPct, homeMult, awayMult, live`.
- `src/routes/league/$leagueId/matchups.tsx:415-433` renders `<LinePanel className="mt-6" line={line} onPick={setTicket} />` inside the selected pair block; the route has `leagueId`, `week`, `pair`, and (after 055) the `["ticks", leagueId, week, matchupId]` query shape via `getTicks`.
- `src/components/wager-ticket.tsx` — Radix dialog `max-w-[26rem]`; `TicketTarget` (lines 19–33) carries `matchupId, kind, sideRoster, sideName, againstName, line, mult, priceLabel, ownGame`; the body has a "Your stake" row (`<span className="microlabel-data">Your stake</span>` ≈ line 157) with stepper + input. The ticket is rendered by `matchups.tsx` with `leagueId`, `target`, `book`.
- From 055: `getTicks({ data: { leagueId, week, matchupId } })` → `StoredTick[]` ascending (`{ at, homePts, awayPts, homeProj, awayProj, homePct, spread }`); `src/lib/live/series.ts` (`fmtClockOfDay`, `LinePoint`); `LiveLine` props (`series, value, tone, height, windowSecs, quiet, frozen, smooth, formatValue, padding, ariaLabel`) — note `quiet` turns the badge off in the wrapper; this plan needs `quiet` **with** the badge: add an optional `badge?: boolean` override to the wrapper? **No — out of scope.** Instead pass `quiet={false}` and `grid={false}`‑like behaviour by… the wrapper has no `grid` prop. Decision: render with `quiet={false}` and accept the grid (it's faint) — OR, if 053 exposed `padding`, use `height 64` with `quiet` and put the current number in the caption (`now −12.5`). **Use the second: `quiet` + caption carries the number.** This keeps 053 untouched.
- Conventions: Biome, `bun test` `.test.mjs`, doc comments; hosted leagues `lg_`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck / lint / test / build | `bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run build` | exit 0 |
| Dev | `bun run dev` (8080) | — |
| Seed ticks for a league/week (dev) | `bun -e "const t=await import('./src/lib/league/ticks.server.ts'); console.log(await t.recordTicks('<leagueId>', <week>, { force: true }))"` run 3–4 times a minute apart (or temporarily lower the throttle in a scratch script — never in source) | rows > 0 |
| Betting on | League settings → betting on (commish), or `update ff_leagues set betting_on = 1 where id = '<id>'` via the `bun -e` + `getSql` one‑liner | `LinePanel` renders |

## Scope

**In scope**:
- `src/components/book-panel.tsx` (LinePanel: strip block; new optional props `leagueId`, `week`)
- `src/components/wager-ticket.tsx` (strip above the stake; new optional props `leagueId`, `week`)
- `src/routes/league/$leagueId/matchups.tsx` (pass `leagueId`/`week` to both)
- `src/lib/live/spread-series.ts` (create: `spreadPoints(ticks) → LinePoint[]`, `spreadSummary(points)`), `src/lib/live/spread-series.test.mjs` (create)
- `plans/056-book-line-strip.md` — this file's "In‑play wagering — spec" section is the deliverable for that part; **no code**.

**Out of scope**: `live-line.tsx`, `series.ts`, `ticks.server.ts` (read only), `book.server.ts`, `wagers.server.ts`, `ops.server.ts` (the `lockWeek` call stays), any schema change, any change to when the book locks.

## Git workflow

- Current branch; one commit, e.g. `feat(book): line-movement strip in the line panel and ticket`. Do NOT push.

## Steps

### Step 1: `src/lib/live/spread-series.ts` + test

```ts
import type { StoredTick } from "@/lib/league/ticks.server";
import type { LinePoint } from "./series";
export function spreadPoints(ticks: readonly Pick<StoredTick, "at" | "spread">[]): LinePoint[]; // time = Date.parse(at)/1000 (or the number), value = spread; drop NaN; ascending
export function spreadSummary(points: readonly LinePoint[]): { first: number; firstAt: number; last: number; lastAt: number; moved: number } | null; // null when < 2 points; moved = last − first
export function fmtSpread(n: number): string; // move the panel's private fmtSpread here and re‑import it in book-panel.tsx (keep behaviour: "PK" for |n| < 0.005, "−"/"+" prefix, 1 decimal)
```
Tests: ascending order from unsorted input; NaN dropped; summary null for 1 point; `fmtSpread(-12.5) === "−12.5"`, `fmtSpread(0) === "PK"`, `fmtSpread(3) === "+3.0"`.

**Verify**: `bun test src/lib/live` → pass; typecheck/lint → 0.

### Step 2: `LinePanel` strip

1. Props: `leagueId?: string; week?: number`. When both present and `isHostedLeague(leagueId)`, `useQuery({ queryKey: ["ticks", leagueId, week, line.matchupId], queryFn: () => getTicks({ data: { leagueId, week, matchupId: line.matchupId } }), staleTime: 30_000, refetchInterval: line.locked ? false : 60_000 })`.
2. `const pts = spreadPoints(ticks.data ?? []); const sum = spreadSummary(pts);` If `sum` is null → render nothing extra.
3. Insert, after the header and before the Spread `Row`: 
   ```tsx
   <div className="px-5 pb-1">
     <div className="flex items-baseline justify-between gap-3">
       <span className="microlabel-data">{line.homeName} spread · today</span>
       <span className="microlabel-data">opened {fmtSpread(sum.first)} at {fmtClockOfDay(sum.firstAt)} · now {fmtSpread(sum.last)}</span>
     </div>
     <LiveLine series={pts} value={sum.last} tone="brand" height={64} quiet smooth={false} windowSecs={43200} frozen={line.locked && weekFinal} formatValue={fmtSpread} padding={{ top: 8, right: 8, bottom: 4, left: 0 }} ariaLabel={`${line.homeName} spread today`} />
   </div>
   ```
   where `weekFinal` is a new optional prop `final?: boolean` (the route passes `pairIsFinal(pair)` from 055's `matchup-series.ts`); default `false`.
4. Import `fmtSpread` from the new module; delete the private copy.

**Verify**: typecheck/lint → 0; visual with seeded ticks.

### Step 3: `WagerTicket` strip

Props `leagueId?: string; week?: number`. Same query (same key → shared cache). When `sum` exists, render above the "Your stake" row: a `mb-3` block with the caption `opened a · now b` (`microlabel-data`) and `<LiveLine series={pts} value={sum.last} tone="brand" height={48} quiet smooth={false} windowSecs={43200} formatValue={fmtSpread} padding={{ top: 6, right: 8, bottom: 2, left: 0 }} ariaLabel="Spread today" />`.

**Verify**: typecheck/lint → 0.

### Step 4: Route wiring

`matchups.tsx`: `<LinePanel className="mt-6" line={line} onPick={setTicket} leagueId={leagueId} week={week} final={pairIsFinal(pair)} />` and `<WagerTicket … leagueId={leagueId} week={week} />` (check the existing `WagerTicket` call site props — it already receives `leagueId`; add `week`).

**Verify**: typecheck/lint/build → 0; `bun test src scripts` → pass (the existing `scripts/wager-testid.test.mjs` must still pass — the `data-testid="wager-price"` / `"wager-no-price"` markers stay).

### Step 5: Commit.

## In‑play wagering — spec (deliverable: this section, reviewed; NOT built in this plan)

What exists: quotes are re‑priced from live scores on every `loadBook()` call (display only); wagers store `line` + `payout_mult` at placement; settlement (`settleWeek`) uses the stored line; the book closes for the week when `lockWeek(leagueId, week)` runs — today from `refreshStatusAndRecord()` on the last pre‑slate designation refresh.

What in‑play needs (each a separate, reviewable change):
1. **Lock policy**: replace "lock on last status refresh" with a per‑league setting `wagers_close: "kickoff" | "in_play"` (default `kickoff` — today's behaviour). `in_play` keeps the book open while `scoringLive` and closes at the week's final whistle (`pairIsFinal` for every pair, or the hourly tick after the last game).
2. **Quote freshness**: `placeWager` already re‑quotes server‑side; in‑play must also reject when the quote moved more than a tolerance since the client displayed it (`line` in the request vs fresh quote; tolerance 0.5 pts spread / 5 pct moneyline) → return "line moved, re‑read" rather than filling at a stale price.
3. **Freeze after scoring**: a 60 s hold after any starter in the matchup scores (detect via `ff_ticks` delta or a `lastScoreAt` per matchup) — no fills during the hold; quotes keep updating.
4. **Exposure**: caps unchanged; but the pool's liability check (`payouts scale proportionally`) should consider in‑play fills the same way.
5. **UI**: `LinePanel` shows `live` instead of `suggested`, prices pulse on change (`useScoreFlash`‑style), the ticket shows the strip (done here) and the "line moved" failure.
6. **Tests**: characterization of settlement with mixed pre‑game/in‑play wagers; the freeze window; the tolerance check.
Effort: M–L. Decide after the strip ships and people have used it for a week.

## Test plan

- `src/lib/live/spread-series.test.mjs` (Step 1).
- Existing `scripts/wager-testid.test.mjs` still passes.
- Manual: betting‑on league with seeded ticks: panel strip, ticket strip, locked/final → frozen.

## Done criteria

- [ ] typecheck, lint, `bun test src scripts`, build all exit 0
- [ ] `grep -n "LiveLine" src/components/book-panel.tsx src/components/wager-ticket.tsx` → both
- [ ] `grep -n "function fmtSpread" src/components/book-panel.tsx` → no match (moved to `spread-series.ts`)
- [ ] `grep -rln 'from "liveline"' src` → only `src/components/live-line.tsx`
- [ ] No changes to `wagers.server.ts` / `ops.server.ts` (`git diff --stat` clean for them)
- [ ] `plans/README.md` row updated (unless the reviewer maintains it)

## STOP conditions

- 055 not DONE (`getTicks`/`readTicks` missing).
- `LinePanel`/`WagerTicket` structure differs from the excerpts (no "Your stake" row, no header/Row layout).
- The strip requires a change to `live-line.tsx` (e.g. badge‑on‑quiet) — report; do not edit the wrapper.

## Maintenance notes

- If the wrapper later gains a `badge` override, switch the strip to `quiet` + badge and drop the "now" caption.
- The in‑play spec above is the starting point for a future plan; nothing in this plan changes when the book locks.
