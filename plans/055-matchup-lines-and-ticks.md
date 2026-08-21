# Plan 055: The matchup's two lines + the home card's number — with `ff_ticks` behind them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69cd95b..HEAD -- src/components/matchup-edge.tsx src/components/matchup-card.tsx src/routes/league/\$leagueId/matchups.tsx src/routes/league/\$leagueId/matchup src/routes/league/\$leagueId/index.tsx src/lib/data/fns.ts src/lib/league/ops.server.ts src/lib/league/book.server.ts src/lib/league/win-probability.ts migrations`
> Plans 053/054 add files under `src/lib/live/`, `src/components/live-line.tsx`, `src/components/projection-block.tsx` and touch the routes listed there — expected. For the files above, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (one new append‑only table + a write‑on‑read hook in a hot server fn; UI changes are additive)
- **Depends on**: plans/053-liveline-foundation.md (DONE), plans/054-player-projection-line.md (DONE — shares `src/lib/live/prefs.ts`)
- **Category**: direction (Sprint 2 of the liveline integration)
- **Planned at**: commit `69cd95b`, 2026-08-21

## Why this matters

"Where the game is" on the matchup page already owns the win‑probability
meter — `winProbability()` rendered as a 6‑px bar, recomputed every 15 s and
thrown away. This plan gives it the last hour / three hours / day: **two
projected finals** (yours in brand green, theirs in ink) on one liveline,
with a `Finals · Win % · Margin` control in the card header, window chips,
and a caption that keeps the percentage. The home card gets the number, not
the line: a win‑probability meter where the share bar was, and a footer
`WIN PROB 74% · +3.4 YOU · PROJ 121.5 – 109.0`. Phase A needs no storage
(a per‑poll ring buffer — the line starts when you open the page, and says
so); Phase B adds `ff_ticks`, an append‑only row per matchup per minute on
game days written **on read** (whenever any client polls matchups while
scoring is live) and from the hourly tick, so the line has a real past and
survives a reload. Plan 056 (the book's line strip) reads the same table.

## Locked design (do not re‑decide)

| Item | Decision |
|---|---|
| Default view | **Finals**: two series — `you` (`tone: "brand"`, label your team name) and `them` (`tone: "muted"`, label theirs). Liveline disables badge/fill/momentum in multi‑series; the caption carries the numbers. |
| Other views | **Win %** — one series, `referenceLine {value: 50, label: "COIN FLIP"}`, `formatValue v => \`${Math.round(v)}%\``. **Margin** — one series (your projected final − theirs), `referenceLine {value: 0, label: "EVEN"}`, `formatValue` signed 1‑decimal. Both get explicit `momentum` from `swing(series, 300, 1.2)`. |
| Control | Segmented control in the card header, right side (`Finals · Win % · Margin`), per‑device pref (`src/lib/live/prefs.ts`, key `"ledger-live-proj"`, field `edgeView`), default `"finals"`. |
| Windows | `windows=[{label:"1H",secs:3600},{label:"3H",secs:10800},{label:"DAY",secs:43200}]`, default `10800`, remembered in the same pref (`edgeWindow`). |
| Caption | Row under the chart (`microlabel-data`, `flex justify-between`): left `${you} ${pct}% · live` (live word in `text-live` while live); middle momentum chip from `swing` on each side's series over 300 s / 1.2 pts: `▲ ${you} +2.4 · last 5 min` (`text-accent-strong`) / `▼ ${them} +3.0 on you · 5 min` (`text-loss`) / `quiet · 5 min`; right `proj ${a} – ${b}`. Then the existing slot bars, unchanged. |
| States | **Tue–Sat** (no ticks, nothing started): today's meter + bars, no chart. **Game day pre‑kick** (ticks exist or `pairHasStarted`): chart with flat lines. **Live / between windows**: chart. **Week final** (every starter `post`): `frozen` liveline over the stored series. |
| Smoothing | Wrapper default (1‑min EMA). Raw numbers in the caption. |
| Home card | No canvas. Once `kicked`: the share bar becomes a **win‑prob meter** (`bg-accent-deep` share = my probability) and the footer reads `WIN PROB ${pct}% · ${±d you/them} · PROJ ${a} – ${b}` (two `microlabel-data` spans, left/right). Pre‑kick and settled: unchanged. |
| One canvas per page | The matchup chart is the only liveline on a league page. |

## Current state

- `src/components/matchup-edge.tsx` (137 lines) — `MatchupEdge({ pair, leagueId, season, mine })`. Queries `["outlooks", leagueId, season, ids.join(",")]` → `getOutlooks` (`staleTime 10 min`). Builds `PlayerOutlook[]` per side via `outlookFor(line)` (lines 45–55), `wp = winProbability({ scores: [a.points, b.points], starters: [...] })`, renders header ("Where the game is" / "Margin by slot"), the meter block when `wp.live` (lines 77–92: `h-1.5` bar + `${a.teamName} ${pct}%` / `proj a – b`), the slot bars `rows` (lines 94–127), and a footnote. `flip` signs everything from the viewer's side.
- `src/components/matchup-card.tsx` (172 lines) — `MatchupCard({ leagueId, week, pair, rosterId, standings, phase, projections })`. `kicked = pairHasStarted(pair)`, `scoring = settled || kicked`, `live = scoring && !settled`. Renders two `SideRow`s then (when `known`) the share bar (`width: share%`, `bg-accent`) and a label row `{label}` / `{delta}` (lines 98–113), then the "Full box score →" footer.
- Routes: `matchups.tsx:436-441` `<MatchupEdge pair={rawShown[selected] ?? pair} leagueId season mine={mineRosterId} />`; `matchup/$week/$matchupId.tsx:335-340` `<MatchupEdge pair={livePair ?? pair} … />`; `index.tsx:376-384` and `441-449` `<MatchupCard … projections={projections.data} />` (phone copy above the lineup once started; desktop rail copy). `index.tsx` has `league` (`["league", leagueId]`, 15 s while live) with `league.data?.league.season`.
- Polling: matchups `LIVE_POLL_MS = 15_000` (`src/lib/replay.ts:5`) while `scoringLive`; Home polls matchups every 4 s while live.
- `src/lib/league/win-probability.ts` — `winProbability({ scores, starters }) → { probability, expectedMargin, marginSd, projected: [a, b], remaining, live }` (138–180). `PlayerOutlook = { playerId, team, position, mean, sd, game }`.
- `src/lib/league/book.server.ts:73-114` `quoteOne(leagueId, week, matchupId)` — server‑side pattern for the same inputs: `eng.loadMatchups(leagueId, week)`, `outlooksFor({ leagueId, season, playerIds })` from `@/lib/data/projections.server`, the `side()` mapper (lines 96–107), then `quoteFrom({...scores, starters})`.
- `src/lib/league/events.server.ts` — the append‑only precedent: `ensureEventSchema()` runs `create table if not exists ff_events (...)` + index (lines 66–85); `recordEvent()` never throws (lines 95–115); `readEvents()` reads back newest first.
- `src/lib/data/fns.ts:126-137` `getMatchups` server fn: for hosted leagues `await eng.assertLeagueViewer(...)`; `return eng.loadMatchups(data.leagueId, data.week)`.
- `src/lib/league/ops.server.ts` — `tickAllLeaguesBody()` (lines ~1250–1285) iterates leagues; `startLeagueClock()` runs `tickAllLeagues` every 120 s when `OPENFF_SELF_TICK=1`; `engine.server.ts:637` computes `scoringLive = (await weekBoard(season, current_week, "regular")).live` from `@/lib/data/live.server`.
- Migrations: `migrations/NNNN_name.sql`, applied by `scripts/migrate.mjs` during `bun run build` (Postgres) and by the PGLite fallback at startup (`src/lib/db.ts`). Latest is `0014_push.sql`. Tables created with `create table if not exists`; server modules also self‑ensure schema (events pattern) so dev works without a migration run.
- `vercel.json` cron: `/api/league/tick` at `15 * * * *` (hourly) — **do not rely on a minute cron**; Vercel hobby plans can't run one. Hence write‑on‑read.
- From 053/054 (must exist): `LiveLine` (`@/components/live-line`), `series.ts` helpers (`bufferKey, appendSample, readSeries, swing, shiftToNow, fmtClockOfDay`), `src/lib/live/prefs.ts` (zustand persist store `"ledger-live-proj"` with `liveProjections`).
- Conventions: Biome, `bun test` `.test.mjs`, doc comments; server fns validate with `zod`, hosted leagues start with `lg_`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck / lint / test / build | `bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run build` | exit 0 |
| Dev | `bun run dev` (8080) | — |
| Demo replay | browser devtools on a league page: `localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:5,running:true},version:0}))`, reload `/league/<id>/matchups` | lines move as the replay ticks |
| Inspect ticks (PGLite dev) | `bun -e "const {getSql}=await import('./src/lib/db.ts');const sql=await getSql();console.log(await sql\`select count(*) from ff_ticks\`)"` | a count |

## Scope

**In scope**:
- `src/lib/live/matchup-series.ts` (create), `src/lib/live/matchup-series.test.mjs` (create)
- `src/lib/live/prefs.ts` (extend: `edgeView`, `edgeWindow`)
- `src/components/matchup-edge.tsx`, `src/components/matchup-card.tsx`
- `src/routes/league/$leagueId/matchups.tsx`, `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`, `src/routes/league/$leagueId/index.tsx` (props only)
- `migrations/0015_ticks.sql` (create)
- `src/lib/league/ticks.server.ts` (create), `src/lib/league/ticks.test.mjs` (create, pure parts only)
- `src/lib/data/fns.ts` (add `getTicks`; add the write‑on‑read call inside `getMatchups`)
- `src/lib/league/ops.server.ts` (one call to `recordTicksForAll()` inside `tickAllLeaguesBody`)

**Out of scope**: `live-line.tsx`, `series.ts` (053), `projection-block.tsx` (054), `book-panel.tsx` / `wager-ticket.tsx` (056), `book.server.ts`, `wagers.server.ts`, `win-probability.ts`, `engine.server.ts`, `routeTree.gen.ts`, Sleeper import code.

## Git workflow

- Current branch; conventional commits, e.g. `feat(live): matchup finals chart and home win-prob meter` then `feat(live): ff_ticks — append matchup samples on read and tick`. Do NOT push.

## Steps

### Step 1: Pure sample math — `src/lib/live/matchup-series.ts`

```ts
import type { MatchupPair, MatchupSide, StarterLine } from "@/lib/data/types";
import { type PlayerOutlook, winProbability } from "@/lib/league/win-probability";
import type { LinePoint } from "./series";

export type OutlookMap = Record<string, { mean: number; sd: number }>;
export type MatchupSample = {
  at: number;            // unix secs
  youProj: number; themProj: number;   // expected finals, viewer's side first
  youPts: number; themPts: number;     // points on the board
  youPct: number;        // 0–100
  margin: number;        // youProj − themProj
  live: boolean;         // winProbability().live
};

/** Build PlayerOutlook[] for a side the way MatchupEdge/quoteOne do. */
export function outlookSide(side: MatchupSide, map: OutlookMap): PlayerOutlook[];

/** One sample from the current pair, signed from `mine`'s side (falls back to home). */
export function sampleMatchup(pair: MatchupPair, map: OutlookMap, mine: number | null, at?: number): MatchupSample | null; // null when no away side

export type TickRow = { at: string | number; homePts: number; awayPts: number; homeProj: number; awayProj: number; homePct: number };
/** Server ticks → samples signed from `mine`. */
export function samplesFromTicks(rows: TickRow[], pair: Pick<MatchupPair, "home" | "away">, mine: number | null): MatchupSample[];

/** Merge stored samples with the in‑session buffer: sort by `at`, drop exact‑duplicate timestamps (keep the later source), cap to `cap` (default 4000). */
export function mergeSamples(stored: MatchupSample[], session: MatchupSample[], cap?: number): MatchupSample[];

export const pick = {
  you: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.youProj }),
  them: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.themProj }),
  pct: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.youPct }),
  margin: (s: MatchupSample): LinePoint => ({ time: s.at, value: s.margin }),
};
export function toPoints(samples: MatchupSample[], f: (s: MatchupSample) => LinePoint): LinePoint[];

/** Everybody on both sides is `post` (or no game). */
export function pairIsFinal(pair: MatchupPair): boolean;
```
Tests (`matchup-series.test.mjs`): `sampleMatchup` with two fake sides (two starters each, `game.state "in"` detail `"9:41 - 3rd"`, outlooks mean/sd) → `youPct` in (0,100), `youProj = youPts + remaining`, flipping `mine` swaps you/them; `samplesFromTicks` signs correctly when `mine` is the away roster; `mergeSamples` sorts, dedupes equal `at` preferring `session`, caps; `pairIsFinal` true only when all starters are post.

**Verify**: `bun test src/lib/live` → pass; typecheck/lint → 0.

### Step 2: Prefs — extend `src/lib/live/prefs.ts`

Add `edgeView: "finals" | "pct" | "margin"` (default `"finals"`), `edgeWindow: number` (default `10800`), setters. Keep `persist` key `"ledger-live-proj"` and `partialize` to the three fields.

**Verify**: typecheck → 0.

### Step 3: Session buffer hook + server ticks query — in `matchup-series.ts` add the hook (React allowed in this file? **No** — keep `matchup-series.ts` pure; create `src/lib/live/use-matchup-series.ts`):

```ts
export function useMatchupSeries(args: { leagueId: string; week: number; pair: MatchupPair; outlooks: OutlookMap; mine: number | null; ticks?: TickRow[] | null }): {
  samples: MatchupSample[]; last: MatchupSample | null;
  you: LinePoint[]; them: LinePoint[]; pct: LinePoint[]; margin: LinePoint[];
  swingYou: Swing; swingThem: Swing;   // swing(you, 300, 1.2) etc.
  final: boolean; started: boolean; sinceOpened: boolean; // sinceOpened = no server ticks seeded
}
```
Behaviour: every render where `pair` changed (new poll), compute `sampleMatchup(...)` and push into a module‑level `Map<string, MatchupSample[]>` keyed `bufferKey(leagueId, week, pair.matchupId)` (de‑bounce identical consecutive samples within 1 s; cap 4000). `stored = samplesFromTicks(ticks ?? [], pair, mine)`. `samples = mergeSamples(stored, session)`. Derive the four point arrays with `toPoints`. `started = pairHasStarted(pair) || samples.length >= 2`. `final = pairIsFinal(pair)`.

**Verify**: typecheck/lint → 0.

### Step 4: `MatchupEdge` — the chart

Rewrite the top half of the card (keep the slot bars + footnote exactly as they are):

1. Props: add `week: number` (both routes have `week`) and optional `ticks?: TickRow[] | null`.
2. Query: keep the outlooks query. Add `const ticks = useQuery({ queryKey: ["ticks", leagueId, week, pair.matchupId], queryFn: () => getTicks({ data: { leagueId, week, matchupId: pair.matchupId } }), enabled: isHostedLeague(leagueId), refetchInterval: started ? 60_000 : false, staleTime: 30_000 })` (Step 7 creates `getTicks`; until then this step can stub `ticks` as `undefined` — **do Step 7 before Step 4** in practice, the order here is for reading).
3. `const s = useMatchupSeries({ leagueId, week, pair, outlooks: map, mine, ticks: ticks.data })`.
4. Header: title left; right: segmented control from `edgeView` pref (`Finals · Win % · Margin`, buttons `h-7 rounded-pill px-2.5 text-[12px] font-semibold`, active `bg-fg text-bg`, inactive `text-muted`), visible only when `s.started`.
5. Body when `s.started`:
   - Finals: `<LiveLine series={[{ id: "you", label: a.teamName, points: s.you, tone: "brand" }, { id: "them", label: b.teamName, points: s.them, tone: "muted" }]} height={196} windowSecs={edgeWindow} windows={WINDOWS} onWindowChange={setEdgeWindow} frozen={s.final} ariaLabel="Projected finals" />`
   - Win %: `<LiveLine series={s.pct} value={s.last?.youPct} height={196} windowSecs… referenceLine={{ value: 50, label: "COIN FLIP" }} momentum={swing(s.pct, 300, 3).dir} formatValue={v => \`${Math.round(v)}%\`} frozen={s.final} />`
   - Margin: `<LiveLine series={s.margin} value={s.last?.margin} … referenceLine={{ value: 0, label: "EVEN" }} momentum={s.swingYou.dir === "up" && s.swingThem.dir !== "up" ? "up" : s.swingThem.dir === "up" ? "down" : "flat"} formatValue={v => \`${v >= 0 ? "+" : ""}${v.toFixed(1)}\`} frozen={s.final} />`
   - Caption row (locked design). `pct = Math.round(s.last?.youPct ?? wp.probability*100)`. When `s.sinceOpened && !s.final` append ` · since you opened` to the left caption.
6. Body when `!s.started`: today's meter block (unchanged) — but only when `wp.live`; pre‑week shows just the bars as today.
7. Keep `flip` logic; the series are already signed by `mine` in the hook.

**Verify**: typecheck/lint → 0; visual: demo replay on `/matchups` shows two moving lines, the control switches views, window chips work, the caption updates.

### Step 5: `MatchupCard` — meter + footer

1. Props: add `season?: string` (index passes `league.data?.league.season`).
2. When `kicked && !settled`: query outlooks (same key shape as the edge: `["outlooks", leagueId, season, ids.join(",")]`, `enabled: Boolean(season) && ids.length > 0`, `staleTime 10 min`), compute `wp` with `outlookSide()` from Step 1 (`scores: [myPts, theirPts]` using the side points `sideUnofficial`), `pct = Math.round(wp.probability*100)`.
3. Replace the share bar with the meter: `<div className="flex h-1.5 overflow-hidden rounded-pill bg-raised"><span className="bg-accent-deep motion-safe:transition-[width] motion-safe:duration-500" style={{ width: \`${pct}%\` }} /></div>`; label row becomes left `WIN PROB ${pct}%` (`text-fg`), right `${delta} · PROJ ${fmt(wp.projected[0])} – ${fmt(wp.projected[1])}`. Pre‑kick (`!kicked`) and `settled`: keep today's share bar and label exactly.
4. `index.tsx`: pass `season` to both `<MatchupCard>`s.

**Verify**: typecheck/lint → 0; visual on Home during the demo replay.

### Step 6: Migration + server module — `migrations/0015_ticks.sql`, `src/lib/league/ticks.server.ts`

`0015_ticks.sql`:
```sql
-- Matchup samples on game days: the past the live line needs. Append-only,
-- never read by any mechanic. One row per matchup per ~minute while scoring
-- is live, written on read (getMatchups) and on the hourly tick.
create table if not exists ff_ticks (
  league_id text not null,
  week int not null,
  matchup_id int not null,
  at timestamptz not null default now(),
  home_pts real not null,
  away_pts real not null,
  home_proj real not null,
  away_proj real not null,
  home_pct smallint not null,
  spread real not null
);
create index if not exists ff_ticks_matchup_at on ff_ticks (league_id, week, matchup_id, at);
```
`ticks.server.ts` (model on `events.server.ts`):
- `ensureTickSchema()` — same SQL via `sql.query`, `ready` flag.
- `const MIN_GAP_MS = 55_000; const lastWrite = new Map<string, number>()` (key `leagueId:week`).
- `export async function recordTicks(leagueId: string, week: number, opts?: { force?: boolean }): Promise<number>` — never throws; returns rows written. Steps: throttle by `lastWrite`; `const row = (await sql\`select season, current_week from ff_leagues where id = ${leagueId}\`)[0]`; if `!row` return 0; `const { weekBoard } = await import("@/lib/data/live.server"); const live = (await weekBoard(row.season, week, "regular")).live; if (!live && !opts?.force) return 0;` `const pairs = await eng.loadMatchups(leagueId, week)`; outlooks via `outlooksFor({ leagueId, season: String(row.season), playerIds })` for all starters of all pairs (one call); per pair with `away`: `sample = sampleMatchup(pair, outlooks, pair.home.rosterId)` (home‑signed); insert `(league_id, week, matchup_id, home_pts, away_pts, home_proj, away_proj, home_pct, spread)` where `spread = -Math.round((homeProj - awayProj) * 2) / 2`. Set `lastWrite`. Wrap everything in try/catch → 0.
- `export async function recordTicksForAll(): Promise<number>` — `select id, current_week from ff_leagues where locked = 0 and status not in ('pre_draft','drafting')`, loop `recordTicks(id, current_week)`, sum.
- `export type StoredTick = { at: string; homePts; awayPts; homeProj; awayProj; homePct; spread }`; `export async function readTicks(leagueId, week, matchupId, limit = 4000): Promise<StoredTick[]>` ascending by `at` (select the newest `limit` then reverse).
- `ticks.test.mjs`: pure bits only — export and test `spreadFrom(homeProj, awayProj)` (`121.3, 108.7 → -12.5`; `equal → -0`→ normalise to `0`) and the throttle decision as a pure `shouldWrite(lastMs, nowMs)` function. No DB in tests.

**Verify**: typecheck/lint → 0; `bun test src/lib/league/ticks.test.mjs` → pass.

### Step 7: Wire the writer + reader — `src/lib/data/fns.ts`, `src/lib/league/ops.server.ts`

1. `getMatchups` (hosted branch): after `assertLeagueViewer`, `const pairs = await eng.loadMatchups(...)`; then `void import("@/lib/league/ticks.server").then((t) => t.recordTicks(data.leagueId, data.week)).catch(() => {});` (fire‑and‑forget, throttled inside) and `return pairs`.
2. New server fn `getTicks` in `src/lib/data/fns.ts` next to `getMatchups`: `.middleware([optionalAuthMiddleware]).validator(z.object({ leagueId: z.string(), week: z.number(), matchupId: z.number() }))`; handler: if not hosted → `[]`; `await eng.assertLeagueViewer(...)`; `return (await import("@/lib/league/ticks.server")).readTicks(...)`.
3. `ops.server.ts` `tickAllLeaguesBody`: after the projections refresh block, `try { const t = await import("./ticks.server"); await t.recordTicksForAll(); } catch { /* the line can miss a minute */ }`.

**Verify**: typecheck/lint → 0; `bun run build` → 0 (migration file picked up; with no `DATABASE_URL` it skips — fine); dev: load `/league/<id>/matchups` during the demo… note: the demo replay is client‑side, so the server won't see `scoringLive` in preseason — the write‑on‑read path can be exercised with `recordTicks(id, week, { force: true })` from a `bun -e` one‑liner against the dev DB, then the `ff_ticks` count command above shows rows.

### Step 8: Lint/test/commit

`bun run lint:fix && bun run lint && bun test src scripts && bun run typecheck && bun run build` → all 0. Commit in‑scope files only.

## Test plan

- `src/lib/live/matchup-series.test.mjs` (Step 1) — ≥ 6 tests.
- `src/lib/league/ticks.test.mjs` (Step 6) — spread + throttle.
- Manual: demo replay on `/matchups` and `/matchup/<w>/<id>` (chart, control, windows, caption, frozen at phase 8), Home card meter/footer, theme flip, `ff_ticks` rows after a forced `recordTicks`.

## Done criteria

- [ ] typecheck, lint, `bun test src scripts`, build all exit 0
- [ ] `grep -n "LiveLine" src/components/matchup-edge.tsx` → used; `grep -n "LiveLine\|liveline" src/components/matchup-card.tsx` → **no** match (no canvas on the card)
- [ ] `grep -n "recordTicks" src/lib/data/fns.ts src/lib/league/ops.server.ts` → both call it
- [ ] `ls migrations/0015_ticks.sql` exists; `grep -n "ff_ticks" src/lib/league/ticks.server.ts` → schema + insert + select
- [ ] `grep -rln 'from "liveline"' src` → only `src/components/live-line.tsx`
- [ ] No files outside the in‑scope list modified
- [ ] `plans/README.md` row updated (unless the reviewer maintains it)

## STOP conditions

- 053 or 054 not DONE / exports differ.
- `winProbability`, `loadMatchups`, `outlooksFor`, `weekBoard` signatures differ from the excerpts.
- `getMatchups` no longer has the hosted branch shown.
- `bun run build` fails on the migration (PGLite fallback) — report the error, don't edit `db.ts`.
- Implementing requires changing `live-line.tsx`/`series.ts`.

## Maintenance notes

- `ff_ticks` grows ~700 rows per matchup per Sunday; add a purge (older than the season) to a later ops plan.
- Plan 056 reads `spread`/`home_pct` from the same rows.
- Reviewer: the session buffer must dedupe against stored ticks (no double points at the same `at`); the card must stay canvas‑free; the write‑on‑read must be fire‑and‑forget and throttled (≥ 55 s per league+week).
