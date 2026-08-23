# Plan 061: Game page — pinned segment rail + swipeable Plays·Box·Scoring panes

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Touch only in-scope files. On any STOP condition, stop and report. SKIP updating `plans/README.md` if your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat <060-SHA>..HEAD -- src/routes/scores_.\$gameId.tsx` → expected empty (use the SHA recorded for 060 in `plans/README.md`).

## Status
P1 · Effort M · Risk MED (restructures one 708-line route's tab body; polling every 4s must not fight the swipe) · Depends on 060 · Planned at `37ed78d`, 2026-08-23

## Why this matters

The reported pain: on `/scores/$gameId`, the Plays/Box/Scoring buttons and the All/Scoring filter sit in the page flow, so forty plays deep they're unreachable. Ryan's locked calls (Pocket Ledger artifact §3 demo A + follow-up): the switcher becomes a **rail that pins under the app header**, all **three panes are horizontally swipeable** in today's order (Plays · Box · Scoring), **re-tapping the active tab scrolls to top**, and the old buttons get the 058 voice (they still wear pre-057 classes: `bg-accent text-accent-fg rounded-sm`).

## Current state (at 37ed78d)

`src/routes/scores_.$gameId.tsx`:
- Line 23: `type Tab = "plays" | "box" | "scoring";` · line 31–32: `const [tab, setTab] = useState<Tab>("plays"); const [filter, setFilter] = useState<Filter>("all");`
- The switcher block (~74–108):

```tsx
<div className="mt-5 flex flex-wrap items-center justify-between gap-2">
  <div className="flex gap-1">
    {([["plays","Plays"],["box","Box"],["scoring", g.scoring.length ? `Scoring · ${g.scoring.length}` : "Scoring"]] as const).map(([id, label]) => (
      <button key={id} type="button" onClick={() => setTab(id)}
        className={cn("h-10 rounded-sm px-4 text-sm", tab === id ? "bg-accent text-accent-fg" : "bg-raised text-muted")}>
        {label}
      </button>
    ))}
  </div>
  {tab === "plays" && g.drives.length ? (
    <div className="flex gap-1">
      <FilterChip on={activeFilter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
      <FilterChip on={activeFilter === "scoring"} onClick={() => setFilter("scoring")}>Scoring</FilterChip>
    </div>
  ) : null}
</div>

{tab === "plays" ? (
  <PlayFeed g={g} live={live} filter={activeFilter} tracking={tracking} peek={peek} setPeek={setPeek} closePeek={closePeek} />
) : tab === "box" ? (
  <BoxTables g={g} tracked={tracked} />
) : (
  <ScoringList g={g} tracking={tracking} peek={peek} setPeek={setPeek} closePeek={closePeek} />
)}
```

- `FilterChip` (~146) is already pill-styled; the three tab buttons are not.
- The query refetches every 4s while live (line ~38) — any scroll position you keep must survive re-render.
- Shell header is `sticky top-0` with `h-15` (60px) + `pt-[env(safe-area-inset-top)]`.
- The matchups route (`src/routes/league/$leagueId/matchups.tsx:306–343`) already has the `role="tablist"` + ArrowLeft/ArrowRight keyboard pattern — reuse its shape.
- Liveline rule (repo convention): at most one live canvas per viewport. `PlayFeed`/`ScoringList`/`BoxTables` contain **no** `<LiveLine>` — the peek popover is the only canvas risk and it mounts on demand. So mounting all three panes at once is allowed.
- Conventions: tokens/utilities only; `cn()`; segmented voice from 058 = track `rounded-pill bg-raised p-0.5`, item on `bg-fg text-bg`, off `text-faint hover:text-muted`, `font-medium`.

## Commands
Same table as plan 060 (typecheck / lint ≤ 10 / fresh-dir tests ≥ 334 incl. this plan's new test / build:dev / dev server). Game with real plays for QA: `http://localhost:8080/scores/401873286` (LV 22 · HOU 20, Final).

## Scope
**In scope**: `src/routes/scores_.$gameId.tsx`; `src/skin/skin.test.mjs` (assertion add).
**Out of scope**: `Shell`/thumb bar (060), `PlayerPeek`, `getGameSummary`, any other route, tokens/styles.

## Steps

### Step 1: Restyle + rail

Wrap the switcher block in a pinned rail and give the tabs the 058 segmented voice:

```tsx
<div className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 mt-5 bg-bg/90 px-4 py-2 backdrop-blur-md [&.stuck]:border-b [&.stuck]:border-line" ref={railRef}>
  <div className="flex flex-wrap items-center justify-between gap-2">
    <div role="tablist" aria-label="Game views" className="flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5">
      {TABS.map(([id, label], i) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
          onClick={() => pickTab(i)} onKeyDown={onTablistKeys}
          className={cn("h-8 rounded-pill px-3.5 text-sm font-medium transition-colors duration-150", tab === id ? "bg-fg text-bg" : "text-faint hover:text-muted")}>
          {label}
        </button>
      ))}
    </div>
    {tab === "plays" && g.drives.length ? ( …FilterChips unchanged… ) : null}
  </div>
</div>
```

`TABS` = the existing three, same order. The "stuck" hairline: simplest reliable = an IntersectionObserver on a 1px sentinel `<div>` rendered just above the rail; when the sentinel is not intersecting, add the border classes (use state `stuck`, className `stuck && "border-b border-line"` — drop the `[&.stuck]` arbitrary variant if you use state). ArrowLeft/ArrowRight move tabs (copy the handler shape from matchups.tsx:308–316).

**Verify**: typecheck 0; at 390 viewport, scroll deep into plays → screenshot shows the rail pinned under the header with a hairline.

### Step 2: Panes become a snap row

Replace the conditional pane render with a snap container; `tab` remains the source of truth for the rail and is synced from scroll:

```tsx
<div ref={panesRef} onScroll={onPanesScroll}
  className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  style={{ height: paneH }}>
  <div className="w-full shrink-0 snap-start snap-always overflow-hidden px-4" ref={el => (paneRefs.current[0] = el)}>
    <PlayFeed … />
  </div>
  <div className="w-full shrink-0 snap-start snap-always overflow-hidden px-4" ref={el => (paneRefs.current[1] = el)}><BoxTables … /></div>
  <div className="w-full shrink-0 snap-start snap-always overflow-hidden px-4" ref={el => (paneRefs.current[2] = el)}><ScoringList … /></div>
</div>
```

Height sync (the classic snap-row problem — without it the row is as tall as the tallest pane and short panes trail empty space): keep `const [paneH, setPaneH] = useState<number | undefined>()`; `useLayoutEffect` on `[tab, g]` (and a `ResizeObserver` on the active pane) sets `paneH = paneRefs.current[activeIndex]?.scrollHeight`. While `paneH` is undefined render without the style. Inactive panes `overflow-hidden` so their clipped content can't scroll.

Scroll↔state sync, no loops:
- `pickTab(i)`: `setTab(TABS[i][0])`; `panesRef.current?.scrollTo({ left: i * panesRef.current.clientWidth, behavior: motionOk ? "smooth" : "auto" })`; if the tab was already active, also `window.scrollTo({ top: 0, … })` (re-tap = top).
- `onPanesScroll`: `const i = Math.round(el.scrollLeft / el.clientWidth); if (TABS[i] && TABS[i][0] !== tab) setTab(TABS[i][0])`.
- The 4s refetch re-renders but must not reset scrollLeft: the container is uncontrolled (no `key`, no conditional unmount) — confirm no parent `key={tab}` exists.

**Verify**: at 390 viewport with agent-browser: `eval` set `panesRef` scroll via `document.querySelector` (`el.scrollTo({left: el.clientWidth})`) → rail highlights **Box**; screenshot. Swipe back (`scrollTo({left:0})`) → **Plays**. Click **Scoring** tab → pane 3 shown. Re-click **Scoring** → `window.scrollY` → 0.

### Step 3: Desktop sanity

Same snap row at all widths (trackpad-swipeable; tabs click-scroll). Verify at 1440: clicking tabs switches panes, no horizontal scrollbar visible (`scrollbar-width:none`), page body has no x-overflow (`document.documentElement.scrollWidth === clientWidth`).

## Test plan
- `src/skin/skin.test.mjs`: add `"the game page rail is a pinned tablist over snap panes"` — assert `src/routes/scores_.$gameId.tsx` matches `/role="tablist"/`, `/snap-x snap-mandatory/`, `/sticky top-\[calc\(3\.75rem/`, and does not match `/bg-accent text-accent-fg/`.
- `bun test src/skin` → pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests ≥ 334 pass, no new fails
- [ ] `grep -c "bg-accent text-accent-fg" src/routes/scores_.\$gameId.tsx` → 0
- [ ] Screenshots at 390: rail pinned deep in plays; Box pane via swipe; Scoring via tab; and 1440 sanity — paths in report
- [ ] No page-level horizontal overflow at 390 or 1440
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on the switcher excerpt.
- `PlayFeed`/`ScoringList`/`BoxTables` turn out to mount a `<LiveLine>` (grep first) — the mount-all-panes premise breaks; report.
- Height-sync jitters visibly with the 4s live refetch after two fix attempts — report with a screen recording/screenshots rather than shipping jank.
- You need to modify `PlayerPeek` or `Shell`.

## Maintenance notes
- The rail + snap row is the reference implementation for roster/standings rails (later plans) — keep the sync logic small and copyable.
- If a pane ever gains a `<LiveLine>`, unmount it when inactive (one live canvas per viewport).
