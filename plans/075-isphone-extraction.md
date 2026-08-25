# Plan 075: One phone question, one answer — extract useIsPhone

> **Executor instructions**: Follow step by step; verify everything; STOP conditions binding. Commit only in-scope files; do NOT push; leave `plans/` alone.
>
> **Drift check (run first)**: `grep -rn "function useIsPhone" src --include='*.tsx'` → exactly 4 hits: `src/components/player-sheet.tsx`, `src/components/player-watch.tsx`, `src/routes/league/$leagueId/wire.tsx`, `src/routes/league/$leagueId/roster.tsx`.

## Status
P3 · Effort S · Risk LOW (mechanical dedup, no behavior change) · Planned at `bb39059`, 2026-08-24

## Why this matters
The 8-line matchMedia hook has been copied four times (the documented convention allowed duplication until it hurt; four copies is past the trigger recorded in plans 070/074). One canonical hook in `src/lib/` ends the drift risk — the four copies are already very slightly divergent in whitespace only; behavior must not change.

## Current state
Each copy reads (modulo formatting):
```tsx
function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
```
Verify each copy against this before replacing; if any copy differs in LOGIC (not formatting), STOP and report.

## Conventions
`src/lib/` holds shared hooks/utilities (see `src/lib/swipe.ts` for the exemplar file voice: doc comment explaining the why). Commits imperative, no AI attribution, no plan/sprint words. Never edit routeTree.gen/auth/engine/grok lists.

## Commands / gate
`bun run typecheck` → 0 · scoped `bunx biome check` → 0 new · fresh dir `PGLITE_DATA_DIR=/tmp/claude-501/pglite-075 bun test src scripts` → baseline ~352–355 pass + the one pre-existing flaky `import.meta.glob` error; no NEW failure names · `bun run build:dev` → 0. No browser QA needed (pure refactor) — but do one smoke check at 390 on `/league/lg_65h3kyr5up/wire` (deck present, sheet opens) via agent-browser (Bash sandbox DISABLED, `~/.bun/bin/agent-browser`, login http://localhost:8080/login prefilled, `set viewport 390 844`, `close --all` after).

## Scope
**In scope**: `src/lib/breakpoint.ts` (new), `src/components/player-sheet.tsx`, `src/components/player-watch.tsx`, `src/routes/league/$leagueId/wire.tsx`, `src/routes/league/$leagueId/roster.tsx`.
**Out of scope**: everything else; no call-site behavior changes; `plans/`.

## Steps
### Step 1: The hook
`src/lib/breakpoint.ts`: export the hook verbatim (imports `useEffect, useState` from react) with a doc comment: phones are `max-width: 639px` — the Tailwind `sm` boundary; SSR answers false and corrects on mount.
### Step 2: Swap the four call sites
In each file: delete the local `function useIsPhone() {…}`, add `import { useIsPhone } from "@/lib/breakpoint";`, remove now-unused react imports ONLY if truly unused elsewhere in the file (check each — most use useState/useEffect for other things; leave them).
### Step 3: Gate
Full gate + the wire smoke check. Also `grep -rn "function useIsPhone" src` → 0 hits; `grep -rln "@/lib/breakpoint" src` → the 4 files.

## Done criteria
- [ ] typecheck 0; build:dev 0; tests no new failure names
- [ ] 0 local copies remain; 4 imports of `@/lib/breakpoint`
- [ ] Wire smoke at 390: deck + sheet behave as before
- [ ] `git status` clean outside scope

## STOP conditions
- Any copy's LOGIC differs from the canonical excerpt.
- Removing a local copy breaks a subtle dependency (it cannot — the hook closes over nothing).

## Git workflow
`main`; one commit, e.g. `refactor(lib): one answer to "is this a phone"`. Do NOT push.
