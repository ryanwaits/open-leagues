# Plan 054: The player's projection line — watch drawer, sheet, player page, lineup chip

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 69cd95b..HEAD -- src/components/player-watch.tsx src/components/player-sheet.tsx src/components/player-profile.tsx src/components/lineup-board.tsx src/components/slot-pts.tsx src/components/matchup-board.tsx src/routes/league src/lib/data/play-points.ts src/lib/data/play-tags.ts src/lib/data/game-feed.ts src/lib/league/live-proj.ts`
> Plan 053 adds `src/lib/live/*` and `src/components/live-line.tsx` after that SHA — that is expected. For every other in‑scope file, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (touches the drawer, the sheet, the lineup rows and four routes; all additive, no server changes)
- **Depends on**: plans/053-liveline-foundation.md (DONE required — `@/components/live-line` and `@/lib/live/series` must exist)
- **Category**: direction (Sprint 1 of the liveline integration)
- **Planned at**: commit `69cd95b`, 2026-08-21

## Why this matters

During a game the question a manager has about a starter is "is he going to
get there?" — the app already computes the answer every poll
(`liveProjection()`: actual so far + what's left, paced) but shows it only as
one faint number. This plan turns that number into a line: it starts at the
player's pre‑game projection at kickoff and moves up or down as the stats
come in, green at/above the dashed baseline, red below, with momentum arrows
when he's heating up or cooling off. One component, three phases, one
surface: the **player sheet / watch drawer** (the thing that opens when you
tap a name on Home, My Team, Matchups, the box score) and the player page's
"This week" card. Before kickoff the block shows the baseline and waits;
while the game is live it is a liveline; after the final whistle it is the
same liveline frozen (still scrubbable), the record of how the number
moved. Lineup rows do **not** get a canvas — they get a "Live projections"
toggle that reveals the pace number (coloured by the same rule) in the
points column. No storage: everything derives from `GameSummary` plays the
drawer already polls.

## Locked design (do not re‑decide)

| Item | Decision |
|---|---|
| Series | **One line**: the pace‑adjusted expected final (`liveProjection()` per sample). Raw points stay in the header number and captions, never a second line. |
| Baseline | One dashed `referenceLine` at the pre‑game projection, label `PROJ 14.5`. |
| Colour | `tone="brand"` when expected ≥ baseline − 0.05, `tone="alarm"` when below. Whole line recolours (state, not segments). Same rule for the lineup pace chip (`text-accent-strong` / `text-loss`). |
| Momentum | Explicit via `swing(liveSeries, 300, 0.8).dir` (5 game‑minutes ≈ 5 wall‑minutes of polls; threshold 0.8 pts). Caption says *heating up / cooling off / steady*. Never auto. |
| Window | The game. Live: `windowSecs` = seconds since kickoff + 120 (min 600). No window chips. |
| Smoothing | Wrapper default (1‑min EMA). |
| Before kickoff | Not a canvas: a still SVG placeholder — dashed baseline with `PROJ x.x`, quarter ruler, caption "kicks off Sun 8:20 · the line starts here". |
| After final | `frozen` liveline of the by‑game‑clock series; `formatTime` = game clock (`Q3 6:40`); caption `proj 12.7 → final 5.7 · frozen · scrub it`. |
| Placement | `ProjectionBlock` is the **first block** in the watch drawer body (above `GameStrip`) and the first child of the sheet's **This week** section; also the player page's "This week" card. |
| Rows | No canvas. `LineupBoard` header gets a per‑device **Live projections** Off/On toggle (default On). On → the live points column shows the pace number (`SlotPts` `expected`) coloured by the rule; Off → points only. (The still row spark is deferred to plan 055 — it needs stored per‑player series.) |
| Carry‑overs | `PlayerWatch` tab row becomes pills (`rounded-pill h-9 px-3 text-[13px] font-semibold`, active `bg-fg text-bg`, inactive `bg-raised text-muted`) and the body spacing is `space-y-3` between block / strip / tabs. `GameStrip` keeps its current markup with `rounded-md`. |
| Demo | The drawer already substitutes a simulated `GameSummary` in demo mode (`simulatePlayerGame`) — the hook takes the summary, so the line animates in demo too. No demo‑specific code. |

## Current state

- `src/components/player-watch.tsx` (343 lines) — the live drawer. `WatchTarget` (lines 17–27):
  ```ts
  export type WatchTarget = {
    player: SlimPlayer; slot: string; points: number | null; line: string | null;
    gameId: string | null; gameDetail: string | null;
    gameState: "pre" | "in" | "post" | null; club: string;
    stats?: Record<string, number> | null;
  };
  ```
  `watchFromLine(line, club, statLine, bag)` (29–47) builds one from a `StarterLine`. `WatchBody` (96–230) polls `getGameSummary` (8 s in / 20 s pre), picks `g = sim ?? q.data`, computes `his = playerPlays(g, player)`, renders header (avatar, name, microlabel, stat line, big points) then `<GameStrip>` then the tab row (lines 173–197) then `DriveList`/`PlayList`. Tabs today: `"h-10 rounded-sm px-3 text-sm"`, active `bg-accent text-accent-fg`.
- `src/components/player-sheet.tsx` — the non‑live sheet. `SheetTarget = { player, game?, context? }` (26–30). Body renders `ProfileStats` then `ProfileNews`, `ProfileThisWeek`, `ProfileSchedule`, `ProfileGameLog`, `ProfileSplits` (133–139). Does not poll games.
- `src/components/player-profile.tsx` — `ProfileThisWeek({ p, player, game })` (264–293) renders `<Section title="This week">` with `Row`s (Opponent / Game / Status / Bye). `Section` (108–128) and `Row` (130–145) are exported.
- `src/routes/league/$leagueId/player/$playerId.tsx:193` — `<ProfileThisWeek p={p} player={player} game={mine?.game} />` inside a `rounded-xl bg-surface ring-card` section.
- Who opens what: `matchups.tsx:58-73` `openPlayer(t: WatchTarget)` → `gameState === "in"` ? `setWatch(t)` : `setSheet({ player, game, context })`. `matchup/$week/$matchupId.tsx:729-735` builds `watchFromLine(side, club, line, bag)` per starter (`onWatch`). `matchup-board.tsx:244` same. `index.tsx:401-410` and `roster.tsx:63-76` open the **sheet** directly from `LineupBoard.onOpenPlayer` (never the drawer).
- Scoring book on the routes: `matchups.tsx:145` and `matchup/$week/$matchupId.tsx:173`: `const book = bookFromLeague(league.data?.league.scoring_settings);` (`src/lib/replay.ts:159`). Weekly projections: `projections` query (`["week-projections", leagueId, week]`) → `Record<playerId, Projection>` where `Projection = { points: number; reason: "bye"|"out"|"no-data"|"season-avg"|null }` (`src/lib/data/types.ts`). `index.tsx` passes `projections.data` into `LineupBoard`; `roster.tsx` likewise.
- Pricing a play: `src/lib/data/play-points.ts:48` `playCredits(play: GamePlay, segs: PlaySegment[], book: ScoringBook): PlayCredit[]` where `PlayCredit = { tracked: TrackedPlayer; bag; points }`. Segments come from `src/lib/data/play-tags.ts:96` `tagPlayText(text, tracked: TrackedPlayer[])`; `TrackedPlayer = { player: SlimPlayer; side: "mine"|"opp"; slot: string; club: string; points: number|null; stats: Record<string,number>|null }` (5–13).
- Game clock: `src/lib/data/game-feed.ts:7` `playWhen(period, clock)` → monotonic seconds elapsed (`period*900 + (900 - remaining)`).
- Expected final: `src/lib/league/live-proj.ts:58` `liveProjection({ baseline, current, game: GameChip, position })`; `fractionRemaining(game)` (`win-probability.ts`) parses `game.detail` like `"9:41 - 3rd"`, `"Halftime"`, `"End of 3rd"`. `GameChip = { state, detail, opp, gameId, possession?, situation?, redZone?, margin? }` (`types.ts:106`).
- `GameSummary` (`types.ts:333`): `{ id, date (ISO), state, detail, home: ScoreTeam, away: ScoreTeam, situation, lastPlay, scoring, drives: GameDrive[], box }`; `GamePlay = { id, text, type, scoring, period, clock, awayScore, homeScore, yardage }`.
- `src/components/lineup-board.tsx` — header (≈ lines 240–270): title, `Live/Proj total` microlabel, `Edit` pill button. `Points` (≈ 497–545) renders `<SlotPts points live expected={liveProjection({...})} className="w-14 text-sm" />` when the game has started, else the forecast. `SlotPts` (`slot-pts.tsx`) shows `expected` faintly on a second line when `live` and `expected − points > 0.25`.
- Per‑device preference pattern: `src/lib/theme.ts` (localStorage key + `useSyncExternalStore`), or zustand `persist` (`src/lib/store.ts`, key `"ledger-leagues"`). Use the zustand pattern here (simpler for a boolean).
- From plan 053 (must exist): `src/components/live-line.tsx` exporting `LiveLine` with props `{ series, value?, tone?, height, windowSecs?, referenceLine?, momentum?, smooth?, quiet?, frozen?, formatValue?, formatTime?, padding?, className?, ariaLabel? }`; `src/lib/live/series.ts` exporting `LinePoint, ema, swing, shiftToNow, clampLerp, bufferKey, appendSample, readSeries, clearSeries, fmtClockOfDay, fmtGameClock`.
- Conventions: Biome (double quotes, semicolons, width 100), `bun test`, `*.test.mjs` beside source importing TS. Component files start with a doc comment.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src scripts` | all pass |
| Lint | `bun run lint` / `bun run lint:fix` | exit 0 |
| Build | `bun run build` | exit 0 |
| Dev | `bun run dev` (8080; may already be running) | — |
| Demo replay (visual) | in the browser devtools on a league page: `localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:5,running:false},version:0}))` then reload; open a starter from Matchups → the drawer shows a simulated Q3 game | drawer shows the line |

## Scope

**In scope** (only these):
- `src/lib/live/game-series.ts` (create), `src/lib/live/game-series.test.mjs` (create)
- `src/lib/live/use-projection-series.ts` (create)
- `src/lib/live/prefs.ts` (create) — the per‑device "live projections" toggle store
- `src/components/projection-block.tsx` (create)
- `src/components/player-watch.tsx`
- `src/components/player-sheet.tsx`
- `src/components/player-profile.tsx` (only `ProfileThisWeek` + its import block)
- `src/components/lineup-board.tsx` (header toggle + `Points`)
- `src/components/slot-pts.tsx` (one optional prop: `expectedTone`)
- `src/components/matchup-board.tsx` (pass projection + book into `watchFromLine`)
- `src/routes/league/$leagueId/matchups.tsx`, `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`, `src/routes/league/$leagueId/index.tsx`, `src/routes/league/$leagueId/roster.tsx`, `src/routes/league/$leagueId/player/$playerId.tsx` (thread `projection` + `book` into targets / this‑week card)

**Out of scope**:
- `src/components/live-line.tsx`, `src/lib/live/series.ts` (053's; if you need a change there, STOP and report).
- `matchup-edge.tsx`, `matchup-card.tsx`, `book-panel.tsx` (plans 055/056).
- Any server function, migration, `src/lib/league/**` (read only), `src/lib/data/play-points.ts`, `play-tags.ts`, `game-feed.ts` (read only).
- Row sparks in lists (deferred to 055).

## Git workflow

- Current branch. Conventional commits, e.g. `feat(live): player projection line in the drawer, sheet and lineup chip`. 1–3 commits. Do NOT push.

## Steps

### Step 1: Pure series math — `src/lib/live/game-series.ts`

Exports:

```ts
import type { GamePlay, GameSummary, SlimPlayer } from "@/lib/data/types";
import type { ScoringBook } from "@/lib/league/scoring";
import type { LinePoint } from "./series";

export type ClockSample = { elapsed: number; pts: number; expected: number };

/** The player's cumulative league points and expected final after each play that credits him, by game clock. */
export function projectionByClock(
  g: Pick<GameSummary, "home" | "away" | "drives" | "scoring" | "state">,
  player: SlimPlayer,
  book: ScoringBook,
  baseline: number,
): ClockSample[];
```
Algorithm:
1. `tracked: TrackedPlayer = { player, side: "mine", slot: "", club: "", points: null, stats: null }`.
2. Collect every play across `g.drives[].plays` (dedupe by `play.id`), sort by `playWhen(period, clock)` ascending.
3. Walk the plays; for each, `segs = tagPlayText(play.text, [tracked])`; `credit = playCredits(play, segs, book).filter(c => c.tracked.player.player_id === player.player_id).reduce(sum of points)`. If `credit !== 0` (or it's the first and last play — always emit at least a kickoff sample `elapsed 0, pts 0, expected baseline` and a sample at the latest play), push a sample.
4. For each emitted sample, `expected = liveProjection({ baseline, current: pts, position: player.position, game: { state: "in", detail: chipDetail(play), opp: null, gameId: null, margin } })` where `chipDetail(play)` = `` `${play.clock} - ${ordinal(play.period)}` `` (`1st/2nd/3rd/4th`; period ≥ 5 → `"OT"`), and `margin` = player's team score minus the other team's (determine the player's team with `canonTeam(player.team)` vs `g.home.abbr`/`g.away.abbr` via `canonTeam`; if unknown, `null`).
5. If `g.state === "post"`, append a final sample `{ elapsed: max(lastElapsed, 3600), pts, expected: pts }` (the expected final **is** the final).
6. Return samples sorted by `elapsed`, never more than one per `elapsed` value (keep the last).

```ts
/** Map by‑clock samples onto wall time for a live chart: kickoff → now, linearly by elapsed share. */
export function clockToWall(samples: ClockSample[], kickoffWall: number, nowWall: number): LinePoint[];
// elapsedNow = last sample's elapsed (or 1); time = kickoffWall + (s.elapsed / elapsedNow) * (nowWall - kickoffWall); value = s.expected. Guard nowWall <= kickoffWall → all points at nowWall.

/** By‑clock samples as a liveline series whose `time` is game seconds elapsed (for frozen mode). */
export function clockSeries(samples: ClockSample[]): LinePoint[]; // { time: elapsed, value: expected }

export function projectionTone(expected: number, baseline: number): "brand" | "alarm"; // expected >= baseline - 0.05 ? "brand" : "alarm"

export function kickoffWallSecs(g: Pick<GameSummary, "date">): number; // Date.parse(g.date)/1000, NaN → Date.now()/1000
```
Imports allowed: `playCredits` from `@/lib/data/play-points`, `tagPlayText` + `TrackedPlayer` type from `@/lib/data/play-tags`, `playWhen` from `@/lib/data/game-feed`, `liveProjection` from `@/lib/league/live-proj`, `canonTeam` from `@/lib/data/teams`. No React.

**Verify**: `bun run typecheck` → 0; `bun run lint` → 0.

### Step 2: Tests — `src/lib/live/game-series.test.mjs`

Build a minimal fake `GameSummary`‑shaped object (only `home:{abbr:"LV"}`, `away:{abbr:"MIA"}`, `state`, `drives:[{id,plays:[…]}]`, `scoring:[]`) with plays whose `text` names the player the way ESPN does (e.g. `"L.Jackson pass short right to B.Bowers for 11 yards"`, `type:"Pass Reception"`, `period`, `clock`, `awayScore`, `homeScore`, `yardage`), a `SlimPlayer` `{ player_id:"p1", full_name:"Brock Bowers", first_name:"Brock", last_name:"Bowers", position:"TE", team:"LV" }`, and a PPR‑ish book `{ rec: 1, rec_yd: 0.1, rec_td: 6 }` (check `src/lib/league/scoring.ts` `SCORING_FIELDS` for the exact keys `playCredits` emits — use `bookFromPreset("ppr")` from `@/lib/league/scoring` instead of guessing). Assert:
- kickoff sample first (`elapsed 0`, `expected === baseline`);
- a reception play adds `rec + yards*0.1` to `pts` (tolerance 0.01) and `expected` moves (≠ baseline);
- plays that don't name the player don't add samples;
- `state: "post"` appends a final sample with `expected === pts`;
- `clockToWall`: 3 samples at elapsed 0/900/1800 with kickoff 1000 and now 1900 → times 1000/1450/1900; `clockSeries` keeps elapsed as time;
- `projectionTone(14.4, 14.5) === "alarm"`, `(14.5, 14.5) === "brand"`;
- `chip` detail parse: a play at `period 3, clock "6:40"` yields an `expected` strictly between `pts` and `pts + baseline` (i.e. `fractionRemaining` parsed it — not the 0.5 fallback); check by comparing against `liveProjection({baseline,current:pts,position:"TE",game:{state:"in",detail:"6:40 - 3rd",opp:null,gameId:null}})` for equality.

**Verify**: `bun test src/lib/live` → all pass.

### Step 3: The hook — `src/lib/live/use-projection-series.ts`

```ts
export type ProjectionPhase = "pre" | "in" | "post";
export type ProjectionSeries = {
  phase: ProjectionPhase;
  baseline: number;
  pts: number;          // current league points (last sample)
  expected: number;     // current expected final (baseline pre‑kick, final after)
  live: LinePoint[];    // wall‑time series for the live liveline
  final: LinePoint[];   // game‑clock series for the frozen liveline
  swing: ReturnType<typeof swing>;
  kickoffWall: number;  // unix secs
};
export function useProjectionSeries(args: {
  game: GameSummary | null | undefined;
  player: SlimPlayer;
  book: ScoringBook;
  baseline: number | null | undefined;
  /** Fallback when the summary has nothing: the points the row already shows. */
  points?: number | null;
}): ProjectionSeries | null;  // null when baseline is null/undefined (no projection → no line)
```
Behaviour:
- `phase` = `game?.state ?? "pre"`.
- `samples = useMemo(() => game ? projectionByClock(game, player, book, baseline) : [], [game, player.player_id, book, baseline])`.
- Live series lives in the module buffer (`bufferKey("game", game.id, player.player_id)` — reuse `bufferKey` with `week` = 0 or build the key `` `game:${game.id}:${player.player_id}` ``; use `appendSample`/`readSeries`). On the first render with ≥1 sample and an empty buffer, **seed** it with `clockToWall(samples, kickoffWallSecs(game), now)`. On every later change of `samples` (new poll), `appendSample(key, lastExpected)`. Return `live = readSeries(key)` (copy the array with `.slice()` so React sees a new reference per poll).
- `final = clockSeries(samples)`.
- `pts`/`expected` from the last sample (`pre` → `0`/`baseline`; no samples in‑game → `points ?? 0` / `liveProjection`‑free `baseline`).
- `swing = swing(live, 300, 0.8)`.
- Keep it pure React (`useMemo`, `useEffect` for the append); no timers.

**Verify**: typecheck + lint → 0.

### Step 4: The block — `src/components/projection-block.tsx`

```tsx
export function ProjectionBlock({ s, kickoffLabel, className }: { s: ProjectionSeries; kickoffLabel?: string | null; className?: string })
```
Renders a `rounded-md bg-raised p-3` section:
- head row: `<p className="microlabel-data">projection</p>` left; right‑side `microlabel-data` reading `starts at 14.5` (pre) / `on pace 13.2 · −1.3` coloured `text-accent-strong`/`text-loss` by `projectionTone` (in) / `final 5.7 · −7.0 v proj` (post).
- body by phase:
  - `pre`: inline SVG 300×96 (viewBox) — dashed horizontal line at mid‑height (`stroke="var(--ink-3)"`, `strokeDasharray="3 3"`), text `PROJ 14.5` above it (`microlabel-data` sized via `className="fill-faint"` — use `style={{ fill: "var(--ink-2)" }}`), four faint quarter dividers with `Q1..Q4` labels along the bottom; `role="img" aria-label="Waiting for kickoff"`.
  - `in`: `<LiveLine series={s.live} value={s.expected} tone={projectionTone(s.expected, s.baseline)} height={124} windowSecs={Math.max(600, now - s.kickoffWall + 120)} referenceLine={{ value: s.baseline, label: \`PROJ ${formatPts(s.baseline, 1)}\` }} momentum={s.swing.dir} padding={{ left: 8, right: 36, top: 10, bottom: 18 }} ariaLabel="Projection this game" />`.
  - `post`: `<LiveLine series={s.final} frozen tone={projectionTone(s.expected, s.baseline)} height={124} windowSecs={Math.max(3600, lastElapsed) + 60} referenceLine={…} formatTime={(t) => fmtGameClock(t - (mountNow - lastElapsed))} … />` where `mountNow = useRef(Date.now()/1000).current` and `lastElapsed = s.final.at(-1)?.time ?? 3600` (the wrapper shifts the series so its last sample sits at `mountNow`; inverting that shift gives game seconds).
- foot row (`meter-row` style: `flex justify-between microlabel-data mt-2`): left `kicks off ${kickoffLabel}` / `${pts} pts · ${detail}` / `proj a → final b`; right `the line starts here` / `heating up`·`cooling off`·`steady` (coloured) / `frozen · scrub it`.
- Uses `formatPts` from `@/lib/utils`. Doc comment: one line, three phases; why points aren't a second line.

**Verify**: typecheck + lint → 0.

### Step 5: Drawer — `src/components/player-watch.tsx`

1. Extend `WatchTarget` with `projection?: number | null` and `book?: ScoringBook | null` (import type from `@/lib/league/scoring`). Extend `watchFromLine(line, club, statLine, bag, extra?: { projection?: number | null; book?: ScoringBook | null })` to copy them.
2. In `WatchBody`: `const series = useProjectionSeries({ game: g, player: target.player, book: target.book ?? {}, baseline: target.projection, points: shownPts })`. Render `{series ? <ProjectionBlock s={series} kickoffLabel={shortKickoff(g?.detail)} /> : null}` as the **first** child of the scroll body (before the "No kickoff yet" microlabel and the skeleton/strip), wrapped so the body becomes `className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"` (replace the `mt-4` on the tab row and `GameStrip` follows naturally — remove the `mt-4`s that `space-y-3` now covers; keep `DriveList`/`PlayList`'s own `mt-4` or convert to the parent's spacing consistently).
3. Tab row carry‑over: buttons → `className={cn("h-9 rounded-pill px-3 text-[13px] font-semibold transition-colors duration-150", tab === id ? "bg-fg text-bg" : "bg-raised text-muted hover:text-fg")}`; row `flex gap-1.5`.
4. `GameStrip`: `rounded-lg` → `rounded-md`; everything else unchanged.

**Verify**: typecheck + lint → 0.

### Step 6: Sheet + profile + player page

1. `src/components/player-profile.tsx` — `ProfileThisWeek` gains `projection?: number | null` and `book?: ScoringBook | null`. When `projection != null` **and** `game?.gameId` exists, render the block above the rows: the sheet does not poll games, so `ProfileThisWeek` fetches the summary itself when the game is `pre` or `post`:
   ```ts
   const q = useQuery({ queryKey: ["game", game?.gameId], queryFn: () => getGameSummary({ data: { gameId: game!.gameId! } }), enabled: Boolean(game?.gameId) && projection != null, staleTime: game?.state === "post" ? Infinity : 60_000, refetchInterval: game?.state === "in" ? 8_000 : false });
   const s = useProjectionSeries({ game: q.data ?? (game ? { ...minimalPre } : null), player, book: book ?? {}, baseline: projection });
   ```
   (`["game", id]` is the same key the drawer uses, so the cache is shared.) If `q.data` is not loaded yet and `game.state === "pre"`, still render the pre placeholder: build the series from a minimal `{ state: "pre", drives: [], scoring: [], home:{abbr:""}, away:{abbr:""}, date: "" }`‑like object — simpler: when `!q.data`, pass `game: null` and let the hook return `phase: "pre"` with `expected = baseline` (make the hook treat `game == null` as `pre`). Render `<ProjectionBlock s={s} kickoffLabel={shortKickoff(game?.detail)} className="mx-5 mb-2" />` as the first child inside the `Section`.
2. `src/components/player-sheet.tsx` — `SheetTarget` gains `projection?: number | null; book?: ScoringBook | null;` and `Body` passes them to `ProfileThisWeek`.
3. Routes: wherever a `SheetTarget` or `WatchTarget` is built, thread `projection: projections.data?.[p.player_id]?.points ?? null` (skip when `reason` is `"bye"|"out"|"no-data"` → `null`) and `book`:
   - `matchups.tsx` `openPlayer` → `setSheet({..., projection: t.projection, book: t.book})`; where `WatchTarget`s are created for this page (`MatchupBoard`'s `onPlayer` → `watchFromLine` in `matchup-board.tsx:244`): `MatchupBoard` gets two new optional props `projections?: Record<string, Projection>` and `book?: ScoringBook` and passes `{ projection: proj(line.playerId), book }` as the 5th arg. Both routes that render `<MatchupBoard>` pass them (`matchups.tsx` has `projections.data` + `book`; `matchup/$week/$matchupId.tsx` has both at lines 160/173).
   - `matchup/$week/$matchupId.tsx:730` → `watchFromLine(side, club, line, bag, { projection, book })` (thread `projections` + `book` down to that row component via props).
   - `index.tsx:401` and `roster.tsx:63` `setSheet({..., projection: …, book: bookFromLeague(league.data?.league.scoring_settings)})` — `index.tsx` already has `projections.data`; `roster.tsx` has `projections` (check its query name; if it has none, STOP and report).
   - `player/$playerId.tsx:193` — pass `projection` if the page already has a weekly projection for this player (check the file for a `projections`/`week-projections` query; if none exists, pass nothing — the block simply doesn't render on the page; note it in NOTES).

**Verify**: typecheck + lint → 0; `bun run build` → 0.

### Step 7: Lineup toggle + pace chip

1. `src/lib/live/prefs.ts` — zustand persist store, key `"ledger-live-proj"`: `{ liveProjections: boolean (default true); setLiveProjections(v) }`, plus `hasHydrated` like `src/lib/store.ts`. Export `useLiveProjPref()`.
2. `src/components/slot-pts.tsx` — add optional `expectedTone?: "good" | "alarm" | null`; when set, the faint expected line uses `text-accent-strong` / `text-loss` instead of `text-faint`, and its label reads `pace` (prefix) — keep the existing behaviour when the prop is absent. Read the component first and keep its fixed‑height contract (`min-h-8`).
3. `src/components/lineup-board.tsx` — header: after the `Live/Proj total` label and before `Edit`, render a compact Off/On segmented control labelled `Live projections` (`microlabel-data` label + two `h-7 rounded-pill px-2.5 text-[12px] font-semibold` buttons, active `bg-fg text-bg`, inactive `text-muted`) — visible only when `anyStarted`. `Points`: when the pref is On, pass `expected` (as today) **and** `expectedTone={projectionTone(expected, baseline) === "brand" ? "good" : "alarm"}`; when Off, pass `expected={undefined}`.

**Verify**: typecheck + lint → 0.

### Step 8: Visual check + commit

Dev server running; enable the demo replay (command table) at `phase: 5`; open `/league/<id>/matchups`, tap a live starter → drawer shows the projection block with a moving line (or a pre/post placeholder for non‑live players via the sheet). Flip the theme; the line recolours. Then `bun run lint:fix && bun run lint && bun test src scripts && bun run typecheck && bun run build` → all 0. Commit.

## Test plan

- `src/lib/live/game-series.test.mjs` (Step 2).
- Manual: drawer live / sheet pre / sheet post (demo phases 0, 5, 8), player page unaffected when no projection, lineup toggle hides/shows the pace line, theme flip.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test src scripts`, `bun run build` all exit 0
- [ ] `src/lib/live/game-series.test.mjs` exists and passes (≥ 7 tests)
- [ ] `grep -n "ProjectionBlock" src/components/player-watch.tsx src/components/player-profile.tsx` → both render it
- [ ] `grep -n "projection" src/components/player-watch.tsx` shows `projection?: number | null` on `WatchTarget`
- [ ] `grep -rn "useLiveProjPref" src/components/lineup-board.tsx` → used
- [ ] `grep -rln 'from "liveline"' src` → still only `src/components/live-line.tsx`
- [ ] No files outside the in‑scope list modified
- [ ] `plans/README.md` row updated (unless the reviewer maintains it)

## STOP conditions

- Plan 053 is not DONE (`src/components/live-line.tsx` or `src/lib/live/series.ts` missing, or their exports differ from the names used here).
- `playCredits` / `tagPlayText` / `playWhen` / `liveProjection` signatures differ from the excerpts.
- `roster.tsx` has no weekly projections query to read a baseline from.
- The drawer's `WatchBody` structure has changed such that `g`/`shownPts` no longer exist.
- Implementing the block requires changing `live-line.tsx` or `series.ts` (report the needed change instead).

## Maintenance notes

- Plan 055 will add the still row spark once per‑player series are stored (`ff_ticks` or a sibling); the hook's `live` buffer is the interim source.
- If `liveProjection()`'s model changes, the line changes with it — that's intended; the block has no model of its own.
- Reviewer: confirm the live series is seeded once per game+player (not re‑seeded every poll), that `final` uses game seconds, and that the pre placeholder is SVG (no canvas before kickoff).
