# Plan 068: The context deck — shell slot + Players page (deck, control sheet, continuous list)

> **Executor instructions**: Follow step by step; run every verification; STOP conditions binding. Do not improvise. Commit only your in-scope files on the current branch; do NOT push; leave `plans/` alone. SKIP updating `plans/README.md` (reviewer maintains the index).
>
> **Drift check (run first)**: `git diff --stat <HEAD-at-dispatch noted by reviewer>..HEAD -- src/components/shell.tsx 'src/routes/league/$leagueId/wire.tsx'` → expected empty at dispatch.
>
> **Spec = the locked artifact** "The Context Rail" draft 3 (§1 system, §3 Players phone) — restated fully below; the reviewer authored it and reviews against it.

## Status
P1 · Effort L · Risk MED (new shared chrome primitive + one route restructured for mobile) · Depends on none (069 depends on this) · Planned at `<dispatch HEAD>`, 2026-08-24

## Why this matters

Locked design (2026-08-24): on phones, nothing interactive lives at the top of a page. Each page's context — its lens and its one action — sits in a **context deck**: a slim bar fused ABOVE the thumb bar (stacked posture; the unified single-bar was rejected). Swiping up on the deck (or tapping ☰) raises a **control sheet** with the full controls; search lives there, near the keyboard. The Players wire is iteration 1: its search + status + position filters currently sit at the very top (a full reach on a 6.7" phone) and scroll away; pagination is a desktop idiom (22 numbered pages). Desktop keeps today's in-flow controls.

## Current state — verified excerpts

### `src/components/shell.tsx` — the fixed bottom nav (post-`3adf750`, thumb bar does not hide)
```tsx
<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 backdrop-blur-md md:hidden">
  {navTabs.length ? (
    <div className="mx-auto grid max-w-lg px-2 pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}>
      … five <Link> tabs …
    </div>
  ) : (
    <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]"> … signed-out … </div>
  )}
</nav>
```
`main` has `pb-24 md:pb-12` bottom padding (deck pages need more on mobile — see Step 1).

### `src/routes/league/$leagueId/wire.tsx` (~364 lines)
- `POS = ["ALL","QB","RB","WR","TE","K","DEF"]`, `SCOPES` (All/Available/Free agent), `PAGE_SIZE = 10` (top of file).
- Search params: `{scope?, pos?, page?}` via `validateSearch`; loader warms `["wire", leagueId, pos, scope]`.
- `const [q, setQ] = useState("")` — client-side text filter over `rows`; `page`/`pageCount`/`pageRows = rows.slice(...)`.
- The in-flow controls block (~193–217): `<div className="mt-4 flex flex-col gap-3">` containing `<Input value={q} … placeholder="Search players" className="sm:max-w-xs"/>`, a SCOPES `Chip` row, a POS `Chip` row (local `Chip` component in this file).
- The table card (~219–305): `overflow-x-auto rounded-xl bg-surface ring-card` table with rows → `PlayerCell` + `StatusCell` + pts + `ClaimButton` (per-row Bid); footer `TablePager` gated `wire.isSuccess && rows.length > 0`, `onPage={(next) => setSearch({ scope, pos, page: next })}`.
- `ClaimDialog` mounted at the bottom, driven by `useClaim()` (`claim.setTarget(...)` from ClaimButton). The dialog REQUIRES a player target — there is no target-less claim flow.
- Claims-in list ("Pull") sits above the controls when claims exist.

### Conventions
Tokens/utilities only; `cn()`; vaul `Drawer` exemplar = `src/components/install-drawer.tsx` (`bg-fg/40` overlay, `rounded-t-xl bg-surface ring-card` content, `Drawer.Handle`); sheets are single-state, drag-down dismiss; zero easing on state changes; chips = shipped recipes (`Chip` local to wire is fine); commits imperative, no AI attribution, no plan/sprint words; `bunx biome` scoped `--write` only; tests `bun test` `.test.mjs`; skin contract in `src/skin/skin.test.mjs`.

## Commands
Typecheck `bun run typecheck` → 0 · lint: no NEW errors in your files (scoped `bunx biome check`) · fresh-dir tests `PGLITE_DATA_DIR=/tmp/claude-501/pglite-068 bun test src scripts` → no new failure names (baseline ~352 pass + 1 flaky `import.meta.glob` error) · build `bun run build:dev` → 0 · dev :8080 (login prefilled; league `lg_65h3kyr5up`; if down `nohup bun run dev >/tmp/claude-501/dev.log 2>&1 &`; PGLite WAL error → `bun run db:repair` once). agent-browser sandbox-disabled; screenshots to …/scratchpad/exec068/.

## Scope
**In scope**: `src/components/shell.tsx` (deck slot + main padding only), `src/components/deck.tsx` (new), `src/routes/league/$leagueId/wire.tsx`, `src/skin/skin.test.mjs` (assertion add).
**Out of scope**: `roster.tsx` (plan 069), `ClaimDialog`/`ClaimButton`/`useClaim` internals, `TablePager` component, any other route, tokens/styles.css, engine/auth/grok lists, `plans/`, `routeTree.gen.ts`.

## Steps

### Step 1: The deck slot in Shell + `<Deck>` portal
- `shell.tsx`: inside the fixed bottom `<nav>`, ABOVE the tab grid (both branches share the one nav — put it once, first child): `<div id="deck-slot" className="mx-auto max-w-lg empty:hidden border-b border-line" />`. Also bump `main`'s mobile padding: `pb-24` → `pb-36` (deck pages add ~46px of chrome; non-deck pages just get a little more air — acceptable; do NOT plumb conditional padding).
- `src/components/deck.tsx` (new):
```tsx
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The context deck: a page's lens + one action, docked above the thumb bar.
 * Renders into Shell's #deck-slot (phones only — the slot lives in the
 * md:hidden bottom nav). One deck per page, mounted by the route. */
export function Deck({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    setHost(document.getElementById("deck-slot"));
  }, []);
  if (!host) return null;
  return createPortal(<div className="flex items-center gap-2 px-3 py-2">{children}</div>, host);
}
```
**Verify**: typecheck 0. A page without a Deck shows no extra bar (`empty:hidden`).

### Step 2: Wire — the deck
In `wire.tsx` render (mobile chrome; desktop untouched):
```tsx
<Deck>
  <button type="button" aria-label="Filters & search" onClick={() => setSheetOpen(true)}
    className="grid size-9 shrink-0 place-items-center rounded-pill shadow-[inset_0_0_0_1px_var(--color-line-strong)] text-muted">
    <SlidersHorizontal className="size-4" strokeWidth={1.8} />
  </button>
  <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {POS.map((p) => (
      <Chip key={p} active={pos === p} onClick={() => { setSearch({ scope, pos: p }); window.scrollTo(0, 0); }}>{p}</Chip>
    ))}
  </div>
  <button type="button" aria-label="Find a player to claim" onClick={() => setSheetOpen(true)}
    className="grid size-9 shrink-0 place-items-center rounded-pill bg-fg text-bg text-base font-medium">＋</button>
</Deck>
```
(`SlidersHorizontal` from lucide-react; the ＋ opens the control sheet — claiming requires picking a player, so the sheet's search IS the claim entry; both buttons opening the sheet is intended, ☰ is the discoverable twin.) Position-chip taps also reset the window to top (house rule: filter change = start at top).
Hide the in-flow controls block on phones: the `mt-4 flex flex-col gap-3` wrapper → `mt-4 hidden sm:flex sm:flex-col gap-3` (desktop identical to today).
**Verify**: at 390 the deck renders above the thumb bar with POS chips + ☰ + ＋; at 1024 no deck (slot is inside md:hidden nav) and in-flow controls unchanged.

### Step 3: The control sheet
`const [sheetOpen, setSheetOpen] = useState(false)` + a vaul Drawer (model on install-drawer, single state, content height — do NOT use h-[94%]):
- `Drawer.Overlay` `bg-fg/40`; `Drawer.Content` `fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-surface ring-card px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3` + `Drawer.Handle`.
- Contents: microlabel "Search" + the SAME `Input` (move the existing q-input JSX here for mobile; desktop keeps its own — simplest: render the Input in both places, bound to the same `q` state), microlabel "Status" + SCOPES chips (same handlers + `window.scrollTo(0,0)` after change).
- No sort section (the wire has no sort feature — do not invent one).
- Closing: overlay tap / drag down (vaul default). Selecting a scope keeps the sheet open (you often set both); the ＋ path is identical.
**Verify**: 390 — tap ☰ → sheet rises with search + status; type in search → list filters live behind the sheet; drag down closes; keyboard overlaps the deck area (expected — no special handling needed beyond vaul's default).

### Step 4: Continuous list on phones
- Keep `TablePager` + `page` slicing for `sm+` only. On phones: ignore `page` and window client-side: `const [visible, setVisible] = useState(25)`; mobile rows = `rows.slice(0, visible)`; a 1px sentinel after the table + IntersectionObserver → `setVisible(v => v + 25)` while `visible < rows.length`; reset `setVisible(25)` when `scope/pos/q` change. Footer line on mobile instead of the pager: `microlabel` `"{rows.length} free · showing {Math.min(visible, rows.length)}"`.
- Implementation shape: one `isPhone` media-query hook (copy the 8-line `useIsPhone` from `player-sheet.tsx` — duplicated on purpose per its note) OR render both and gate with `sm:hidden`/`hidden sm:block` wrappers — prefer CSS gating for the pager/footer and a single row-source: `const shownRows = isPhone ? rows.slice(0, visible) : pageRows;` needs the hook — use the hook.
**Verify**: 390 — scroll the list; more rows load (count line updates); pager absent. 1024 — pager works exactly as today (click page 2).

### Step 5: Gate + visual
Typecheck; scoped lint; fresh-dir tests; build:dev. Screenshots 390 light+dark: wire top (deck visible, no in-flow filters), sheet open, deep scroll (rows loaded, deck still present, nothing lost); 1024: unchanged desktop. Confirm the thumb bar + deck never overlap content's last row (main padding) and `document.querySelectorAll('#deck-slot').length === 1`.

## Test plan
`src/skin/skin.test.mjs`: add `"the wire's context lives in the deck on phones"` — assert `shell.tssx`… (correct path `src/components/shell.tsx`) matches `/id="deck-slot"/`; `src/components/deck.tsx` exists and matches `/createPortal/`; `wire.tsx` matches `/<Deck>/` and `/hidden sm:flex/`. `bun test src/skin` → pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests no new failure names; skin tests pass incl. new
- [ ] 390: deck (☰ · POS chips · ＋) above the thumb bar; in-flow filters hidden; sheet opens with search+status; continuous list (no pager)
- [ ] 1024+: byte-identical behaviour to today (in-flow controls, pager)
- [ ] Filter/scope change returns the window to top
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on excerpts; the portal slot approach fails under SSR/hydration (mismatch warnings you cannot resolve with the mount-gate) — report.
- The sheet + vaul + the existing ClaimDialog (also a portal) conflict in stacking — report with screenshots, do not z-index-war past one attempt.
- Anything requires editing ClaimDialog/useClaim.

## Maintenance notes
- 069 reuses `<Deck>` as-is on roster. After 069, consider a `<DeckSheet>` wrapper if the vaul boilerplate repeats a third time.
- The shipped top rails (game page, box-score mini-bar) migrate into decks in a LATER pass — deliberately untouched here.

## Git workflow
`main`; 2 commits suggested: `feat(shell): the context deck docks above the thumb bar` + `feat(wire): filters live at your thumb — deck, sheet, endless list`. Do NOT push.
