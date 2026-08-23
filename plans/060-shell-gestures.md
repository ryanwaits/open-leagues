# Plan 060: Shell gestures — thumb bar hides on scroll-down, re-tap = top

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. Touch only in-scope files. On any STOP condition, stop and report — do not improvise. SKIP updating `plans/README.md` if your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 37ed78d..HEAD -- src/components/shell.tsx src/lib` → expected empty for `shell.tsx` and no existing `src/lib/scroll-hide*`.

## Status
P1 · Effort S · Risk LOW · Depends on none (059 landed `ca770a1`) · Planned at `37ed78d`, 2026-08-23 · Category: dx/direction (mobile)

## Why this matters

Ryan locked the Pocket Ledger call: on phones the thumb bar hides fully while scrolling down and returns on any scroll up (artifact https://claude.ai/code/artifact/437db70f-5d8e-4f35-97c8-d1a4b620f961 §2, demo A), and re-tapping the active thumb tab scrolls to the top. Every long page gets the reading room; nothing is ever more than a flick away.

## Current state (at 37ed78d)

`src/components/shell.tsx` — the thumb bar `<nav>` (~line 225):

```tsx
<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 backdrop-blur-md md:hidden">
  {navTabs.length ? (
    <div className="mx-auto grid max-w-lg px-2 pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}>
      {navTabs.map((t) => (
        <Link key={t.key} to={t.to} params={t.params} search={(prev) => prev} preload="intent"
          className={cn("mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150", t.active ? "bg-fg/6 text-fg" : "text-faint")}>
          <t.Icon className="size-[18px]" strokeWidth={1.8} />
          <span className="max-w-full truncate px-1">{t.label}</span>
        </Link>
      ))}
    </div>
  ) : (
    <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
      … signed-out variant: three <Link>s with the same item recipe …
    </div>
  )}
</nav>
```

The page scrolls on the **window** (main is normal flow; header is sticky). `motion-safe:`/`motion-reduce:` variants are available (tw-animate-css + tailwind). Conventions: tokens/utilities only; `cn()` from `@/lib/utils`; tests are `*.test.mjs` run by `bun test`; never `lint:fix` bare; commits imperative, no AI attribution, no plan/sprint words.

## Commands
| Typecheck | `bun run typecheck` | 0 |
| Tests | `bun test src/lib/scroll-hide.test.mjs` then `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test-060 bun test src scripts` | new tests pass; ≥ 333 pass, same 1 fail/2 errors as baseline (332/1/2 at `37ed78d` with a fresh dir) |
| Lint | `bun run lint` | ≤ 10 errors (pre-existing, contract files) |
| Build | `bun run build:dev` | 0 |
| Dev | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 (else `nohup bun run dev >/tmp/claude-501/dev.log 2>&1 &`; on PGLite WAL error run `bun run db:repair` once) |

## Scope
**In scope**: `src/lib/scroll-hide.ts` (new), `src/lib/scroll-hide.test.mjs` (new), `src/components/shell.tsx` (thumb-bar `<nav>` + tab `<Link>` onClick only).
**Out of scope**: header, desktop nav, any route file, `src/lib/auth/**`, tokens/styles.css, do-not-edit list (grok PWA files, engine, routeTree).

## Steps

### Step 1: Pure reducer + hook — `src/lib/scroll-hide.ts` (new)

```ts
/** Pure: next hidden state from a scroll sample. Down past the fold hides; any
 * meaningful up-move, or being near the top, shows. Small jitter (<8px) is ignored. */
export function nextHidden(prevY: number, y: number, hidden: boolean): boolean {
  if (y <= 120) return false;
  const d = y - prevY;
  if (d > 8) return true;
  if (d < -8) return false;
  return hidden;
}

import { useEffect, useState } from "react";

/** Window-scroll direction → hide chrome. Always false when reduced motion. */
export function useScrollHide(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let prevY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setHidden((h) => nextHidden(prevY, y, h));
        prevY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return hidden;
}
```

(Imports at top of file, not mid-file — the shape above is the logic, order it conventionally.)

**Verify**: `bun run typecheck` → 0.

### Step 2: Wire the bar

In `shell.tsx`: `const barHidden = useScrollHide();` inside `Shell` (client component — it already uses hooks). On the thumb `<nav>` add: `"transition-transform duration-200 ease-out motion-reduce:transition-none"` and `barHidden && "translate-y-full"`. Nothing else changes; both variants (signed-in/out) share the one `<nav>`.

**Verify**: typecheck 0. With agent-browser (sandbox disabled) at viewport `390 844 3`, login (prefilled), open `/league/lg_65h3kyr5up/roster`, `eval window.scrollTo(0,600)` → wait 400ms → screenshot shows no thumb bar; `eval window.scrollBy(0,-80)` → screenshot shows the bar back.

### Step 3: Re-tap = top

On the signed-in thumb `<Link>`: `onClick={() => { if (t.active) window.scrollTo({ top: 0, behavior: motionOk() ? "smooth" : "auto" }); }}` where `motionOk` is a tiny helper (`!window.matchMedia("(prefers-reduced-motion: reduce)").matches`) — inline it or export from `scroll-hide.ts`. Keep the Link navigation as is (same-route navigate is a no-op). Apply the same to the signed-out variant's active links (`pathname === "/"` etc.).

**Verify**: on the same page scrolled down, click the active tab (My Team) via agent-browser → `eval window.scrollY` → `0`.

## Test plan
`src/lib/scroll-hide.test.mjs` (node:test + assert, model on `src/components/slot-pts-flash.test.mjs`): nextHidden(0,200,false)→true (big down); nextHidden(200,196,true)→true (jitter holds); nextHidden(200,150,true)→false (up shows); nextHidden(500,100,true)→false (near top always shows); nextHidden(100,104,false)→false.

## Done criteria
- [ ] typecheck 0; build:dev 0; full tests ≥ 333 pass, no new fails
- [ ] `grep -n "useScrollHide" src/components/shell.tsx` → 1 hit
- [ ] Screenshots: bar hidden after down-scroll, visible after up-scroll (paths in report)
- [ ] `git status` clean outside scope

## STOP conditions
- Drift on the thumb-bar excerpt.
- The bar must know about anything route-specific (it must not — window scroll only).
- Hiding the bar makes `pb-24` main padding feel wrong somewhere — note it, don't fix (that's content padding, out of scope).

## Maintenance notes
- 061 reuses `useScrollHide`'s pattern; the game-page rail does NOT hide (it pins) — do not apply this hook to it.
- Future: header large-title condense can share `nextHidden`'s sampling approach.
