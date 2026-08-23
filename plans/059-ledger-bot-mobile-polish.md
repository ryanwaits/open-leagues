# Plan 059: Mobile polish for the Ledger·Bot cut — header, thumb bar, masthead, week picker, matchup-edge caption, dev toolbar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <058-landed SHA>..HEAD -- src/components/player-watch.tsx src/components/player-peek.tsx src/components/shell.tsx src/components/team-masthead.tsx src/components/matchup-edge.tsx src/components/demo-toolbar.tsx src/components/week-picker.tsx 'src/routes/league/$leagueId.tsx' 'src/routes/league/$leagueId/matchup/$week/$matchupId.tsx' 'src/routes/league/$leagueId/matchups.tsx'`
> (Use the SHA recorded for plan 058 in `plans/README.md`.) Excerpts below
> are from `d370e29`; 058 edits `shell.tsx:146,164–167,180–182` and
> `matchup-edge.tsx:149–161` only. On any other mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (layout/class changes on 7 files; one real bug fix — caption wrap)
- **Depends on**: plans/058-ledger-bot-primitives.md
- **Category**: direction (design polish) + bug (matchup-edge caption)
- **Planned at**: commit `d370e29`, 2026-08-22

## Why this matters

At 390px the current build has visible defects the token swap doesn't fix: the matchup chart caption is three mono spans in one `flex justify-between` row that wrap into each other; the week picker on the league header floats free of the h1; the dev toolbar's fixed rail overlaps the thumb bar and content; thumb-bar icons use two stroke widths; the league h1 shouts at 36px/800. The artifact's phone frames (https://claude.ai/code/artifact/4e0119fb-6b78-48ec-9a77-abaf4c55675e §6) are the target: 60px header, flat ringed switcher pill, round 36px Scores icon button, 30px/500 h1 with the week picker as a ringed pill on the same row, the 2×2 masthead as one ringed card with hairline dividers, a two-item caption that never wraps, and a thumb bar with a 5.5% ink active pill and 18px icons at one stroke width.

## Current state

### `src/components/shell.tsx` — header row and thumb bar (d370e29)

```tsx
// 140–141
<header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
  <div className="mx-auto flex min-h-15 max-w-6xl items-center gap-3 px-4">
// 176–192 scores link (Radio icon + label hidden on phones + live dot)
<Link to="/scores" … className={cn("relative inline-flex h-9 items-center gap-1.5 rounded-pill px-2.5 text-sm font-semibold transition-colors duration-150 sm:px-3", inScores ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg")}>
  <Radio className="size-[18px] sm:size-4" strokeWidth={1.9} />
  <span className="hidden sm:inline">Scores</span>
// 214–219 main
<main className={cn("mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 md:pb-12", center && "items-center justify-center")}>
// 225–245 thumb bar (signed-in variant)
<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden">
  <div className="mx-auto grid max-w-lg px-2 pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}>
    <Link … className={cn("mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150", t.active ? "bg-raised text-fg" : "text-faint")}>
      <t.Icon className="size-4" strokeWidth={1.9} />
// 247–299 signed-out variant: same recipe but `mx-1`, `text-[11px]`, icons strokeWidth={1.75}
```

### `src/routes/league/$leagueId.tsx:209–227` — league header

```tsx
<header className="mb-6">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">   // 058 makes this font-medium tracking-[-0.02em]
      {q.data.league.name}
    </h1>
    {usesWeek ? <WeekPicker week={shownWeek} … /> : null}
  </div>
</header>
```

`src/components/week-picker.tsx:34–41` trigger: `className={cn(<recipe>, className)}` — read the file; the trigger is a radix Select/DropdownMenu trigger with a `ChevronDown` and a `data-[state=open]:rotate-180` chevron. (Read lines 28–45 before editing; STOP if it is not a single trigger `<button>`.)

### `src/components/team-masthead.tsx` (whole file, 78 lines)

```tsx
<section className="grid grid-cols-2 overflow-hidden rounded-xl bg-surface ring-card">
  <Cell label="Record" value={…} />
  <Link … className="group min-w-0 border-b border-l border-line px-5 py-4 hover:bg-raised">
    <span className="block font-mono text-lg font-semibold tabular-nums group-hover:text-accent-strong">
      {ordinal(idx + 1)}<small className="ml-1 text-[11px] font-medium text-faint">of {standings.length}</small>
    </span>
    <span className="block microlabel-data">Rank</span>
  </Link>
  <Cell label="Week" value={String(week)} last />
  {faab != null ? <Cell label="FAAB left" value={`$${faab}`} last side /> : <Cell label="PF" … last side />}
</section>
// Cell:
<div className={cn("min-w-0 border-line px-5 py-4", !last && "border-b", side && "border-l")}>
  <span className="block truncate font-mono text-lg font-semibold tabular-nums">{value}</span>
  <span className="block microlabel-data">{label}</span>
</div>
```

### `src/components/matchup-edge.tsx:218–228` — the caption that wraps

```tsx
<div className="mt-5 flex justify-between microlabel-data">
  <span>
    {a.teamName} {pct}%{live ? <span className="text-live"> · live</span> : null}
    {s.sinceOpened && !s.final ? " · since you opened" : null}
  </span>
  <span className={chip.cls}>{chip.text}</span>
  <span>
    proj {formatPts(s.last?.youProj ?? wp.projected[0], 1)} &ndash;{" "}
    {formatPts(s.last?.themProj ?? wp.projected[1], 1)}
  </span>
</div>
```

At 390px all three spans wrap and overlap (seen in the 2026‑08‑22 screenshot: "HANDS 63% · SINCE / YOU OPENED" / "QUIET · 5 / MIN" / "PROJ 122.0 – / 110.0").

### `src/components/demo-toolbar.tsx:56–57`

```tsx
// fixed action rail above it. A dev toy must never sit on a real control.
<div className="pointer-events-none fixed right-3 bottom-36 z-40 flex items-center gap-1.5 md:bottom-20">
```

On a 390px phone `bottom-36` (144px) lands on top of page content and the three pills span nearly the full width (see the 2026‑08‑22 screenshots where PRE LIVE / SIMULATE / STATE cover the lineup rows).

### `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx:500–545`

```tsx
function BackLink(...) {  // "‹ Week N slate"
  <Link … className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg">
function NavChip(...) {   // prev/next matchup arrows
  <Link … className="inline-flex size-10 items-center justify-center rounded-sm bg-raised text-muted hover:text-fg" aria-label={label}>
```

### `src/routes/league/$leagueId/matchups.tsx:284–300` — slate strip edge arrows

```tsx
className="absolute top-1/2 left-0 z-10 grid size-8 -translate-x-1 -translate-y-1/2 place-items-center rounded-pill border border-line bg-surface text-faint shadow-[var(--shadow-lift)]"
```

(`--shadow-lift` is zero after 057, so these float edgeless.)

### Conventions

Same as 057/058: tokens/utilities only; `cn()`; Biome scoped `--write`; commit `fix(mobile): …` / `refactor(shell): …`; no push.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | 0 |
| Lint | `bun run lint` | ≤ baseline |
| Tests | `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` | ≥ 322 pass |
| Build | `bun run build:dev` | 0 |
| Dev | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 |
| Demo on (in the browser console after login) | `localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:3,running:false},version:0}))` then reload | live matchup chart + caption visible |

## Suggested executor toolkit

- `agent-browser` (sandbox disabled). Viewport `390 844 3` for phone, `1440 900 2` for desktop. Pages: `/league/lg_65h3kyr5up`, `/league/lg_65h3kyr5up/matchups`, `/league/lg_65h3kyr5up/matchup/1/6`, `/scores`.

## Scope

**In scope**:
- `src/components/shell.tsx` (header row 140–141, scores link 176–192, main 214–219, both thumb-bar variants 225–299)
- `src/routes/league/$leagueId.tsx` (header 209–227 only)
- `src/components/week-picker.tsx` (trigger recipe only)
- `src/components/team-masthead.tsx`
- `src/components/matchup-edge.tsx` (caption block 218–228 and the pre‑kick caption 236–243 only)
- `src/components/demo-toolbar.tsx` (positioning only)
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (`BackLink`, `NavChip` recipes only)
- `src/routes/league/$leagueId/matchups.tsx` (the two edge-arrow buttons only)
- `src/components/player-watch.tsx` (line 88 scrim class only), `src/components/player-peek.tsx` (line 59 scrim class only)
- `src/skin/skin.test.mjs` (assertion add)

**Out of scope**:
- Nav structure (tabs, order, switcher position) — B′ is locked.
- `src/lib/auth/gates.tsx` (UserButton) — auth do-not-edit.
- Any liveline/series logic in `matchup-edge.tsx` (only the caption markup).
- Tokens/styles.css (057), button/badge recipes (058).
- Do-not-edit list (grok PWA files, engine, routeTree).

## Git workflow

- `main`; 2 commits suggested: `fix(matchups): caption no longer wraps on phones; edge arrows get an edge` and `refactor(shell): phone header, thumb bar and masthead in the flat cut`. No push.

## Steps

### Step 1: Header — 60px, round Scores button on phones

`shell.tsx`:
- Row (141): `min-h-15` → `h-15` (fixed 60px; keep safe-area padding on the `<header>`).
- Scores link (176–192): replace the recipe with
  `"relative inline-flex h-9 items-center gap-1.5 rounded-pill text-sm font-medium transition-colors duration-150 max-sm:size-9 max-sm:justify-center max-sm:shadow-[0_0_0_1px_var(--color-line-strong)] sm:px-3"`, on‑state `inScores ? "bg-raised text-fg" : "text-fg/55 hover:bg-raised hover:text-fg"`. Icon `className="size-[18px] sm:size-4" strokeWidth={1.8}`. Keep the live dot markup; change its halo (already `color-mix` after 057) — no further change.

**Verify**: typecheck 0; at 390px the Scores control is a 36px ringed circle.

### Step 2: Thumb bar — one recipe, one stroke

Both variants in `shell.tsx` (225–299):
- `<nav>`: `fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 backdrop-blur-md md:hidden`
- item: `mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150`, active `bg-fg/6 text-fg`, inactive `text-faint`. Use this exact string in the signed‑out variant too (drop `mx-1`/`text-[11px]`).
- all icons `className="size-[18px]" strokeWidth={1.8}`.

**Verify**: `grep -c "strokeWidth={1.75}" src/components/shell.tsx` → 0; `grep -c "strokeWidth={1.8}" src/components/shell.tsx` → ≥ 5.

### Step 3: League header — h1 30px on phones, week picker pill on the row

`$leagueId.tsx:209–227`:
```tsx
<header className="mb-5">
  <div className="flex items-center justify-between gap-3">
    <h1 className="min-w-0 truncate font-display text-[30px] font-medium tracking-[-0.02em] sm:text-4xl">
      {q.data.league.name}
    </h1>
    {usesWeek ? <WeekPicker … className="shrink-0" /> : null}
  </div>
</header>
```
`week-picker.tsx` trigger recipe → `inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface pl-3.5 pr-2.5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised` (keep chevron + `data-[state=open]` rotate; keep `cn(…, className)`).

Also `main` (shell.tsx:214–219): `px-4` → `px-5 sm:px-4`? **No** — keep `px-4`; the artifact's 20px was the phone frame's inner padding plus card padding. Leave main alone.

**Verify**: typecheck 0; screenshot at 390 shows h1 and the Week pill on one line.

### Step 4: Masthead — flat card, hairline dividers, sans labels, 22px figures

`team-masthead.tsx`:
- section: `grid grid-cols-2 overflow-hidden rounded-xl bg-surface ring-card` (unchanged — the ring is the card edge in variant B).
- `Cell` and the Rank `<Link>`: value `block truncate font-mono text-[22px] font-medium leading-none tabular-nums`, label `mt-1.5 block microlabel` (sans eyebrow, per the mocks) — replace `microlabel-data` with `microlabel` in both places; the `<small>` on rank → `ml-1 text-[12px] font-normal text-faint`.
- Keep the `border-b`/`border-l border-line` divider logic exactly.

**Verify**: `grep -c "microlabel-data" src/components/team-masthead.tsx` → 0.

### Step 5: Matchup-edge caption — two items, never wraps

Replace lines 218–228 with:

```tsx
<div className="mt-5 flex items-start justify-between gap-3 microlabel-data">
  <span className="min-w-0">
    {a.teamName} {pct}%{live ? <span className="text-live"> · live</span> : null}
    {s.sinceOpened && !s.final ? " · since you opened" : null}
    {chip.text ? <span className={cn("ml-2", chip.cls)}>{chip.text}</span> : null}
  </span>
  <span className="shrink-0 whitespace-nowrap">
    proj {formatPts(s.last?.youProj ?? wp.projected[0], 1)} &ndash;{" "}
    {formatPts(s.last?.themProj ?? wp.projected[1], 1)}
  </span>
</div>
```

(Confirm `chip` is `{ cls: string; text: string }` by reading ~lines 120–140; if `chip` can be null/undefined, guard accordingly. If `cn` isn't imported in this file, import it from `@/lib/utils`.) Apply the same `gap-3` / `shrink-0 whitespace-nowrap` to the pre‑kick caption at 236–243.

**Verify**: with demo on, `/league/lg_65h3kyr5up/matchup/1/6` at 390 shows the caption on ≤2 lines with the proj on the right, nothing overlapping the time axis.

### Step 6: Dev toolbar — out of the way on phones

`demo-toolbar.tsx:57`: `pointer-events-none fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 flex items-center gap-1.5 md:bottom-20` and add `max-sm:scale-90 max-sm:origin-bottom-right`. (Sits just above the thumb bar, smaller; it is dev-only and must never cover a real control — the existing comment already says so.)

**Verify**: at 390 the rail sits above the thumb bar, not over card content.

### Step 7: Edged arrows + two leftover scrims

- `src/components/player-watch.tsx:88` (`absolute inset-0 bg-bg/50`) and `src/components/player-peek.tsx:59` (`fixed inset-0 z-40 bg-bg/50 sm:hidden`): `bg-bg/50` → `bg-fg/40` (plan 058 unified every other scrim to `bg-fg/40`; these two were outside its file list). Class string only.

- `matchups.tsx` both edge buttons: `shadow-[var(--shadow-lift)]` → `shadow-[0_0_0_1px_var(--color-line-strong)]`, drop `border border-line`.
- `$matchupId.tsx` `NavChip`: `rounded-sm bg-raised` → `rounded-pill bg-raised hover:bg-line`; `BackLink` unchanged.

**Verify**: `grep -n "shadow-\[var(--shadow-lift)\]" 'src/routes/league/$leagueId/matchups.tsx'` → none.

### Step 8: Gate + screenshots

Typecheck, lint ≤ baseline, tests ≥ 322, build:dev. Screenshots at 390×844 light+dark: league home, matchups, matchup/1/6 (demo on), scores; and 1440×900 league home to confirm desktop unchanged except weights.

## Test plan

- `src/skin/skin.test.mjs`: add `"thumb bar uses one icon stroke and the masthead uses sans eyebrows"` — assert `shell.tsx` does not match `/strokeWidth=\{1\.75\}/` and `team-masthead.tsx` does not match `/microlabel-data/`.
- `bun test src/skin` → pass.

## Done criteria

- [ ] typecheck 0; build:dev 0; tests ≥ 323 pass, no new fails
- [ ] `grep -c "strokeWidth={1.75}" src/components/shell.tsx` → 0
- [ ] `grep -c "microlabel-data" src/components/team-masthead.tsx` → 0
- [ ] `grep -rn "bg-bg/50" src` → none
- [ ] Caption screenshot at 390 shows no overlap (attach path in report)
- [ ] `git status` clean outside scope
- [ ] No change to nav tab order/labels (`git diff` of `shell.tsx` touches only class strings and `strokeWidth`)

## STOP conditions

- Drift on any excerpt; `week-picker.tsx` trigger is not a single button; `chip` shape in `matchup-edge.tsx` differs from `{cls,text}`.
- Any change would require touching `gates.tsx` or nav structure.
- The live dot/Scores control would need a new token.

## Maintenance notes

- The thumb bar and header recipes are now identical across signed-in/out; keep them in lockstep (consider extracting `thumbItemClass` const if touched again).
- Caption layout: two items only. Anything new goes inside the left span.
- Deferred: sheet unification into one component; `<Segmented>` extraction; `/account` picker layout on phones.
