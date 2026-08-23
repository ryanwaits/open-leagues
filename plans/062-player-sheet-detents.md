# Plan 062: Player sheet + watch drawer on vaul — half/full detents, drag to dismiss

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Touch only in-scope files. On any STOP condition, stop and report. SKIP updating `plans/README.md` if your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat <061-SHA>..HEAD -- src/components/player-sheet.tsx src/components/player-watch.tsx src/components/install-drawer.tsx` → expected empty (SHA from `plans/README.md` row 061).

## Status
P2 · Effort M · Risk MED (vaul snapPoints + nested scroll; two components share the treatment) · Depends on 061 · Planned at `37ed78d`, 2026-08-23

## Why this matters

Ryan locked the Pocket Ledger sheet call (artifact demo C): on phones the player sheet opens at **half height** (identity + this-week projection visible), drags **up to full** (log unlocked), drags **down past half to dismiss** — with the grabber and ✕ as the visible twins. Today both `PlayerSheet` and `PlayerWatch` are hand-rolled `fixed inset-0` panels at a fixed `88vh`: tap-out or Escape only, no drag, no detents. `vaul@^1.1.2` is already a dependency and already in use (`install-drawer.tsx` imports `{ Drawer } from "vaul"`), and it supports `snapPoints`/`activeSnapPoint` and locks content scrolling until the last snap point.

## Current state (at 37ed78d)

### `src/components/player-sheet.tsx` (whole file ~175 lines)
- `PlayerSheet({ target, leagueId, onClose })`; `useEffect` adds Escape handler + `document.body.style.overflow = "hidden"` while open.
- Markup: `fixed inset-0 z-50 flex items-end justify-end sm:items-stretch` → scrim `<button class="absolute inset-0 bg-fg/40">` → `<section role="dialog" aria-modal … class="relative z-10 flex h-[min(88vh,44rem)] w-full flex-col rounded-t-xl bg-surface ring-card sm:h-full sm:w-[34rem] sm:rounded-none sm:border-l sm:border-line">` → grab bar `mx-auto mt-2 h-1.5 w-10 … sm:hidden` → `<Body …/>`.
- `Body` renders a `<header class="border-b border-line px-5 py-4">` (identity + Full profile link) then `<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">` with ProfileStats/News/ThisWeek/Schedule/GameLog/Splits.

### `src/components/player-watch.tsx` (~lines 60–105)
Identical shell: Escape+overflow effect; `fixed inset-0 z-50 …`; scrim `bg-fg/40`; `<section … h-[min(88vh,42rem)] … sm:w-[34rem] …>`; handle; `<WatchBody key={player_id} …/>` (WatchBody holds its own tabs/queries and contains the `<LiveLine>` projection block).

### `src/components/install-drawer.tsx` — the vaul exemplar in this repo
`import { Drawer } from "vaul"` → `<Drawer.Root open onOpenChange><Drawer.Portal><Drawer.Overlay className="fixed inset-0 z-40 bg-fg/40" /><Drawer.Content className="fixed inset-x-0 bottom-0 z-50 … rounded-t-xl bg-surface … ring-card outline-none"><Drawer.Handle …/>…`

Callers (do not change them): `PlayerSheet` mounted from `matchup/$week/$matchupId.tsx:496`, `roster.tsx`, `matchups.tsx`, `index.tsx`; `PlayerWatch` from the box-score route. Props stay `{ target, …, onClose }`.

Conventions: tokens/utilities only; `cn()`; desktop (`sm:`) keeps the right side-panel look; commits imperative, no AI attribution.

## Commands
Same table as plan 060 (typecheck / lint ≤ 10 / fresh-dir tests — this plan adds 1 skin assertion, expect ≥ 335 pass / build:dev / dev). QA pages: `/league/lg_65h3kyr5up` (tap a lineup row → PlayerSheet) and, with demo on (`localStorage.setItem("ledger-demo", JSON.stringify({state:{enabled:true,preLive:false,phase:3,running:false},version:0}))`), `/league/lg_65h3kyr5up/matchup/1/6` (tap a starter → PlayerWatch).

## Scope
**In scope**: `src/components/player-sheet.tsx`, `src/components/player-watch.tsx`, `src/skin/skin.test.mjs` (assertion add).
**Out of scope**: `install-drawer.tsx` (reference only), `player-peek.tsx` (popover, stays), `player-profile.tsx` internals, all callers, `Body`/`WatchBody` content markup (only their wrappers).

## Steps

### Step 1: `PlayerSheet` — vaul under `sm`, existing panel above

Shape (mobile detection with a plain matchMedia hook local to the file — do not add a dependency):

```tsx
function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
```

- Phone branch: `<Drawer.Root open={Boolean(target)} onOpenChange={(o) => { if (!o) onClose(); }} snapPoints={[0.55, 1]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} fadeFromIndex={0}>` with `const [snap, setSnap] = useState<number | string | null>(0.55)` reset to `0.55` whenever `target` changes. Portal → `Drawer.Overlay className="fixed inset-0 z-50 bg-fg/40"` → `Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[94%] flex-col rounded-t-xl bg-surface ring-card outline-none"` → `<Drawer.Handle className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />` → `<Body …/>`. Give the scrollable div inside `Body` `data-vaul-no-drag` **only if** dragging from the content fights scrolling at full — vaul's default (scroll enabled at the last snap point) should already be right; test before adding.
- Desktop branch: today's markup unchanged (scrim + fixed right panel), minus the phone-only handle.
- Keep the Escape effect for the desktop branch only; vaul handles Escape/scroll-lock itself on the phone branch (drop the `body.style.overflow` line there to avoid fighting vaul's own lock).

**Verify**: typecheck 0. At 390: tap Dak on the home lineup → sheet opens ~55% with header + stats visible; drag handle up → full, inner content scrolls; drag down → dismisses. At 1440: unchanged right panel. Screenshots of all three states.

### Step 2: `PlayerWatch` — same wrapper

Apply the identical phone/desktop split around `<WatchBody/>` (keep `key={target.player.player_id}`). WatchBody contains the `<LiveLine>`; it mounts once per open either way, so the one-canvas rule holds.

**Verify**: demo on, matchup page, tap a starter → watch drawer at half; drag to full; the projection line renders and scrubs; drag-dismiss works. Screenshots.

### Step 3: Reduced motion + a11y pass

vaul respects its own transitions; confirm `prefers-reduced-motion` (emulate via CDP or OS) still opens/closes without long animation — if vaul animates regardless, wrap `Drawer.Root` with `!motionOk` → fall back to snapPoints `[1]` (open full, no half detent) and note it. Confirm `role="dialog"`/labelling: vaul's Content accepts `aria-label` — carry `target.player.full_name` over.

## Test plan
- `src/skin/skin.test.mjs`: add `"player sheets ride vaul with detents"` — assert both `player-sheet.tsx` and `player-watch.tsx` match `/from "vaul"/` and `/snapPoints=\{\[0\.55, 1\]\}/`, and neither matches `/h-\[min\(88vh/` any more… **except** in the desktop branch — so instead assert the phone branch exists: match `/snapPoints/` in both files and `/useIsPhone|max-width: 639px/`.
- `bun test src/skin` → pass.

## Done criteria
- [ ] typecheck 0; build:dev 0; fresh-dir tests ≥ 335 pass, no new fails
- [ ] `grep -c "from \"vaul\"" src/components/player-sheet.tsx src/components/player-watch.tsx` → 1 each
- [ ] Screenshots: half, full (content scrolled), dismissed, desktop panel unchanged, watch drawer half+full — paths in report
- [ ] `git status` clean outside scope; callers untouched

## STOP conditions
- Drift on either component's excerpt.
- vaul snapPoints + the inner `overflow-y-auto` genuinely conflict (content scroll dead at full, or sheet drags when scrolling) after trying `data-vaul-no-drag` — report with what you observed; do not hand-roll a drag system.
- The desktop branch would need caller changes.

## Maintenance notes
- One sheet system: install-drawer (no detents), player-sheet + player-watch (detents). Next candidate: claim dialog → bottom sheet under 640 (deferred, note in report if trivial).
- `useIsPhone` is duplicated in two files on purpose (no new shared module for 8 lines twice); extract to `src/lib/` only when a third consumer appears.
