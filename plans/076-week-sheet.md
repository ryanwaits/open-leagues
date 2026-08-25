# Plan 076: The week comes down to the thumb — week pill + sheet on the deck pages

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `git diff --stat bb39059..HEAD -- 'src/routes/league/$leagueId.tsx' src/components/week-picker.tsx 'src/routes/league/$leagueId/matchups.tsx' 'src/routes/league/$leagueId/standings.tsx' 'src/routes/league/$leagueId/recap.tsx'` → expected empty. (Run AFTER plan 075 lands; wire/roster/player-sheet drift from 075 is expected and out of these paths anyway.)

## Status
P2 · Effort M · Risk MED (shared layout edited; three routes) · Planned at `bb39059`, 2026-08-24 · Run after 075

## Why this matters
Locked design ("The Context Rail" draft 3 §5): Matchups' sheet holds the **week picker**; League's deck carries a **week pill**. This was deferred from 073/074 as layout surgery — this is that pass. On phones, the three deck pages that are week-scoped (Matchups, Standings, Recap) get a week pill in the deck that opens a bottom sheet (near the thumb); the header's dropdown WeekPicker becomes sm+-only on exactly those routes. Roster and Activity keep the header picker at all widths (their decks/pages have no week pill).

## Current state — verified excerpts (at `bb39059`)
- `src/routes/league/$leagueId.tsx` (~240+): `const WEEKLY = ["/matchups", "/activity", "/recap", "/roster", "/standings"]`; `usesWeek = WEEKLY.some((seg) => pathname.startsWith(\`/league/${leagueId}${seg}\`))`; header `<div className="flex items-center justify-between gap-3">` with h1 + `{usesWeek ? <WeekPicker week={shownWeek} maxWeek={maxWeek} playoffStart={playoffStart} currentWeek={q.data.currentWeek} onPick={(w) => void navigate({ to: pathname, search: (prev) => ({ ...prev, week: w, focus: undefined }) })} className="shrink-0" /> : null}`.
- `src/components/week-picker.tsx`: radix dropdown; private `function label(week, playoffStart)` at the bottom (Week N / Round 1 / Semis / Final); trigger has `className` prop merged via `cn`.
- `src/routes/league/$leagueId/matchups.tsx` (post-073): `<Deck>` mounts when `shown.length > 1` with ONE child: the pill row `<div ref=… className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto …">…</div>`; route has `week`, and `league.data` (bundle) in scope.
- `src/routes/league/$leagueId/standings.tsx` / `recap.tsx` (post-074): each mounts `<Deck>` with the segmented Table·Recap track; `week` in scope; both read `league` bundle (`getLeagueBundle`) so `currentWeek` is available; playoffStart/maxWeek must be derived the same way the layout does: `playoffStart = league.data?.ops?.playoffStartWeek ?? league.data?.league.settings.playoff_week_start ?? 15`, `maxWeek = Math.max(playoffStart + 2, league.data?.ops?.regularWeeks ?? 14, league.data?.currentWeek ?? 1)`. VERIFY the bundle shape in each route before writing (roster/standings load `getLeagueBundle` under queryKey ["league", leagueId]); if `ops` is not on the bundle type in these routes, STOP and report rather than guessing.
- Vaul sheet exemplar = wire.tsx control sheet (068): Drawer.Root/Portal/Overlay `fixed inset-0 z-50 bg-fg/40`/Content `fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 outline-none ring-card` + Handle + sr-only Title/Description.

## Conventions
Week pill visual = the WeekPicker trigger voice: `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface pl-3.5 pr-2.5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-line-strong)]` + focus ring + ChevronUp icon (opens upward sheet). In the deck's tight row on matchups it may be `h-8 px-3 text-[13px]`. Tokens/`cn()`/zero easing; commits imperative, no AI attribution, no plan/sprint words.

## Commands / gate
`bun run typecheck` → 0 · scoped `bunx biome check` → 0 new · fresh dir `PGLITE_DATA_DIR=/tmp/claude-501/pglite-076 bun test src scripts` → baseline + no NEW failure names · `bun run build:dev` → 0. QA via agent-browser (Bash sandbox DISABLED, `set viewport 390 844`/`1024 800`, login prefilled, `close --all` after): `/league/lg_65h3kyr5up/matchups`, `/standings`, `/recap`, AND `/roster` + `/activity` (header picker must survive there on phones), 390 + 1024.

## Scope
**In scope**: `src/components/week-sheet.tsx` (new), `src/components/week-picker.tsx` (export `label` only — rename to `weekLabel` export, keep behavior), `src/routes/league/$leagueId.tsx` (WeekPicker className condition only), `src/routes/league/$leagueId/matchups.tsx`, `src/routes/league/$leagueId/standings.tsx`, `src/routes/league/$leagueId/recap.tsx`, `src/skin/skin.test.mjs` (assert add).
**Out of scope**: `deck.tsx`/`shell.tsx`, wire/roster routes, `WeekPicker`'s dropdown behavior, `plans/`.

## Steps
### Step 1: `WeekSheet` — one sheet, three consumers
`src/components/week-sheet.tsx`: props `{ open, onOpenChange, week, maxWeek, playoffStart, currentWeek, onPick }`. Vaul drawer (exemplar above), sr-only Title "Change week". Content: `microlabel` "Week" then a scrollable list (`max-h-[50dvh] overflow-y-auto overscroll-contain`) of week rows — button per week, `flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-sm` + `data`-free styling: active week `font-medium` + Check icon (`text-accent-strong`), current week trails a `microlabel-data` "now"; tap → `onPick(w)` then `onOpenChange(false)`. Labels via `weekLabel` imported from week-picker.tsx (Step 2). Focus ring recipe on rows.
### Step 2: Export the label
week-picker.tsx: `function label` → `export function weekLabel` (update its internal uses). No other changes.
### Step 3: The three routes
Each of matchups/standings/recap: local `const [weekOpen, setWeekOpen] = useState(false)`; derive `playoffStart`/`maxWeek`/`currentWeek` from the league bundle exactly as the layout does (excerpt above); mount `<WeekSheet … onPick={(w) => { void navigate({ … search: (prev) => ({ ...prev, week: w, focus: undefined }) }); }}/>` using each route's existing navigate; add the week pill to the deck:
- matchups: pill FIRST (`shrink-0`, compact `h-8 px-3 text-[13px]`), then the existing pill row.
- standings/recap: after the Table·Recap track, `<span className="flex-1" />`, then the pill (`h-9` voice).
Pill content: `{weekLabel(week, playoffStart)}` + `ChevronUp className="size-3.5 text-faint"`.
### Step 4: The header steps back where the deck stepped up
`$leagueId.tsx`: `const deckWeek = ["/matchups", "/standings", "/recap"].some((seg) => pathname.startsWith(\`/league/${leagueId}${seg}\`))`; WeekPicker `className={deckWeek ? "hidden shrink-0 sm:inline-flex" : "shrink-0"}`. Nothing else in the layout changes.
### Step 5: Gate + tests
skin.test.mjs: add `"the week lives at the thumb on deck pages"` — week-sheet.tsx exists and matches `/from "vaul"/`; matchups.tsx and standings.tsx match `/WeekSheet/`; `$leagueId.tsx` (path: `src/routes/league/$leagueId.tsx`) matches `/hidden shrink-0 sm:inline-flex/`. Full gate + screenshots: 390 (matchups pill+sheet open, standings pill, recap pill, roster header-picker still present), 1024 (header picker on all, no deck).

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names; skin tests pass incl. new
- [ ] 390: week pill in the three decks; sheet lists weeks w/ now/active; picking navigates and closes; header picker GONE on those three, PRESENT on roster/activity
- [ ] 1024: header picker everywhere as today; no behavior change
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts (075's files excepted).
- The league bundle in standings/recap/matchups lacks `ops`/settings needed for playoffStart/maxWeek → STOP and report (do not invent a fallback beyond the layout's own `?? 15` chain).
- The matchups deck row cannot hold week pill + slate pills at 390 → report with screenshot.

## Git workflow
`main`; one commit, e.g. `feat(league): the week answers from the deck`. Do NOT push.
