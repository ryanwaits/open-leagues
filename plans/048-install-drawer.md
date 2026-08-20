# Plan 048: Install drawer — engagement-triggered A2HS bottom sheet

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before the next step. On any STOP
> condition, stop and report — do not improvise. When done, update this
> plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 8f04751..HEAD -- src/components/install-coach.tsx src/components/shell.tsx src/routes/join.tsx src/routes/account.tsx src/lib/push package.json`
> Any changed in-scope file → compare "Current state" excerpts against live
> code; on a mismatch, STOP. (Expected drift: plan 047 landed (`ed6cdd4`+`303e7a0`) adding an
> AppearancePanel to `account.tsx` — proceed; InstallCoach is now line 33.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive UI; PWA plumbing untouched)
- **Depends on**: plans/047-skin-system.md (ordering only — both edit
  `src/routes/account.tsx`; this plan is functional without skins)
- **Category**: dx / direction
- **Planned at**: commit `8f04751`, 2026-08-20

## Why this matters

PWA install is the primary mobile distribution path, and since web push
shipped, an installed app is also the gateway to draft-clock/waiver
notifications. Today's install nudge is a quiet card mounted ONLY on the
auth-gated `/account` page — nobody sees it. Model the fix on dartwords.com:
an engagement-triggered bottom sheet (fires after you've done something, not
on load) with the app icon and numbered steps using the browser's actual
glyphs. That UX is the reference; this plan adapts it to open-ff.

## Current state

- `src/components/install-coach.tsx` — the current card. Reuse its logic:
  `standalone()` (line 8: display-mode + navigator.standalone), `iosSafari()`
  (line 16: UA + iPad-as-MacIntel), dismiss key `open-ff-a2hs` = `"1"`
  (line 4), `beforeinstallprompt` capture with `preventDefault()` +
  `deferred.prompt()`. Its ONLY mount is `src/routes/account.tsx:33` (after 047's AppearancePanel insertion).
- `src/routes/join.tsx` — join success navigates away immediately:

  ```ts
  // src/routes/join.tsx:44-47
  onSuccess: (res) => {
    remember({ leagueId: res.leagueId, name: res.name || "My league", season: res.season });
    void navigate({ to: "/league/$leagueId", params: { leagueId: res.leagueId } });
  ```

  `remember` takes a `{ leagueId, name, season }` object — do **not**
  rewrite that call. Only insert the A2HS flag line before `navigate`.
  A drawer can NOT render from join.tsx — the trigger is a flag the
  next page reads (Step 2).
- `src/components/shell.tsx` — the layout every league/home page renders
  (header + `<main>` ~line 131 + fixed mobile `<nav>` ~line 140). The
  drawer mounts here, once, globally, after `</main>`.
- `src/components/push-register.tsx` — plan 037's worker re-attach; only
  re-registers after prior opt-in (`Notification.permission === "granted"`),
  exports `enablePushForLeague(leagueId, publicKey)`. `public/sw.js` exists
  (network-passthrough navigations). Do not touch either; the drawer only
  MENTIONS push in copy.
- `server/middleware/grok-pwa.ts` + `public/__grok/install/` — a separate
  server-rendered install tutorial (`?install=1&platform=ios`). Unrelated
  legacy surface; leave untouched; the drawer neither links to it nor removes
  it.
- Drawer primitive: `vaul@^1.1.2` is already in `package.json` — use it
  (handles focus trap, scroll lock, drag-dismiss). Do not hand-roll and do
  not add dependencies.
- Test exemplars: `src/skin/brand.test.mjs` (source assertions),
  `src/lib/push/sw.test.mjs` (pure-logic node:test). Runner:
  `bun test src scripts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | all pass |
| Build | `bun run build` | exit 0 (chains `db:migrate`; writes local `data/pglite` — expected) |
| Dev | `bun run dev` (port 8080) | serves app |

## Scope

**In scope**:
- `src/lib/a2hs.ts` (create) · `src/lib/a2hs.test.mjs` (create)
- `src/components/install-drawer.tsx` (create)
- `src/components/install-coach.tsx` (DELETE at the end)
- `src/components/shell.tsx` (one mount line)
- `src/routes/join.tsx` (one flag line in `onSuccess`)
- `src/routes/account.tsx` (replace the InstallCoach mount with a reopen row)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `public/sw.js`, `src/components/push-register.tsx`, `src/lib/push/**`
- `server/middleware/grok-pwa.ts`, `public/__grok/**`, `src/routes/__root.tsx`
- `src/lib/auth/gates.tsx` (no new avatar-menu rows in this plan)
- No new npm dependencies

## Git workflow

Current branch, commit per step, conventional messages (e.g.
`feat: install drawer with engagement triggers`). Do not push.

## Steps

### Step 1: a2hs library

Create `src/lib/a2hs.ts`. Move `standalone()` and `iosSafari()` here verbatim
from `install-coach.tsx`. Add:

```ts
export const A2HS_DISMISS_KEY = "open-ff-a2hs-2"; // v2 on purpose: people who
// dismissed the old card get ONE fresh offer from the richer drawer.
export const A2HS_JOIN_KEY = "open-ff-a2hs-join"; // set on join success
export const A2HS_DAYS_KEY = "open-ff-a2hs-days"; // JSON {last:"YYYY-MM-DD",days:n}

/** Pure: fold today's date into the stored visit record. Counts distinct days. */
export function bumpDays(raw: string | null, today: string): { raw: string; days: number }

/** Pure: the drawer opens iff not standalone, not dismissed, and
 *  (joined || days >= 2). */
export function eligibleFrom(s: {
  standalone: boolean; dismissed: boolean; joined: boolean; days: number;
}): boolean

/** Impure wrapper used by the component: reads localStorage (try/catch like
 *  install-coach), calls bumpDays with today, returns eligibility. */
export function checkAndRecordVisit(): boolean
```

"First lineup action" is NOT a trigger (operator decision) — do not add one.

**Verify**: `bun run typecheck` → exit 0.

### Step 2: join success sets the flag

In `src/routes/join.tsx` `onSuccess` (excerpt above), before the `navigate`
call: `try { localStorage.setItem(A2HS_JOIN_KEY, "1"); } catch {}` (import
from `@/lib/a2hs`).

**Verify**: `grep -n "A2HS_JOIN_KEY" src/routes/join.tsx` → 2 matches
(import + set). `bun run typecheck` → exit 0.

### Step 3: the drawer component

Create `src/components/install-drawer.tsx` using **vaul**'s `Drawer`.
Two exports:

- `<InstallDrawer />` — auto mode. On mount (client only): if viewport ≥ 768px
  (`matchMedia("(min-width: 768px)")`) render nothing; else run
  `checkAndRecordVisit()`; if eligible, open after a ~600 ms delay. Also
  capture `beforeinstallprompt` like install-coach does.
- `<InstallDrawerButton />` — manual mode for `/account`: a row-button
  labeled "Add to phone" that opens the same sheet regardless of dismissal
  or day count (still hidden when `standalone()`).

Sheet content (skin tokens/classes only — bg-surface, text-fg, rounded-*,
font-mono labels; it must look native in Ledger today and inherit Box Score
automatically once plan 047 lands):
1. `public/favicon.svg` as the icon, large, centered.
2. Title: **"Put the desk on your phone"**; dek: "One tap from your home
   screen, and the desk can ping you for the draft clock and waivers."
3. Steps — three branches:
   - iOS Safari (`iosSafari()`): classic Share-first copy (OPERATOR DEFAULT —
     see Open decision): `1. Tap Share in the toolbar` (inline SVG:
     square-with-up-arrow) · `2. Scroll and tap Add to Home Screen` (inline
     SVG: plus-in-square) · `3. Open open-ff from your home screen`. Keep the
     honesty line: "Safari only — Chrome on iOS cannot pin it."
   - captured `beforeinstallprompt`: no steps; one primary button `Install`
    → `deferred.prompt()`.
   - otherwise: "Use the browser menu → Install app or Add to Home Screen."
4. Dismiss: "Not now" sets `A2HS_DISMISS_KEY`; drag-down/scrim dismiss does
   the same. On successful join-triggered open, clear `A2HS_JOIN_KEY`.

Draw the two glyphs as inline SVGs (stroke style, ~20px grid). No emoji, no
screenshots, no fake status bar.

**Verify**: `bun run typecheck && bun run lint` → exit 0.

### Step 4: mounts

- `src/components/shell.tsx`: render `<InstallDrawer />` once, after
  `<main>` (beside the bottom `<nav>`).
- `src/routes/account.tsx`: replace `<InstallCoach />` (line 33) with
  `<InstallDrawerButton />`; fix the import.
- DELETE `src/components/install-coach.tsx`.

**Verify**: `grep -rn "InstallCoach" src` → no matches.
`bun run typecheck && bun run lint` → exit 0.

### Step 5: tests

Create `src/lib/a2hs.test.mjs` (node:test, model on
`src/lib/push/sw.test.mjs`):

- `bumpDays(null, "2026-08-20")` → days 1; same day again → still 1; next
  day → 2; malformed raw JSON → resets to 1 (no throw).
- `eligibleFrom`: standalone → false always; dismissed → false; joined+1 day
  → true; not-joined+2 days → true; not-joined+1 day → false.
- Source assertions (brand.test.mjs style): `shell.tsx` contains
  `InstallDrawer`; `join.tsx` contains `A2HS_JOIN_KEY`; the file
  `src/components/install-coach.tsx` does not exist.

**Verify**: `bun test src/lib/a2hs.test.mjs` → all pass, then full
`bun test src scripts` → all pass.

## Test plan

Automated: Step 5. Manual (required before marking DONE):
- iOS Safari, real device: join a league → land on the league page → drawer
  slides up; steps legible; Add to Home Screen works; installed launch is
  standalone (no drawer ever again).
- Android Chrome: native `Install` button path.
- Desktop ≥768px: the AUTO drawer never appears (mobile-gated). The
  `/account` button is visible at ALL sizes and opens the sheet with the
  generic browser-menu copy — desktop users may want the hint for their
  phone.
- Dismiss once → no re-offer on later visits; `/account` row still works.

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test src scripts`, `bun run build` all exit 0
- [ ] `grep -rn "InstallCoach" src` → 0 matches; `src/components/install-coach.tsx` deleted
- [ ] `grep -rn "vaul" src/components/install-drawer.tsx` ≥ 1 (no hand-rolled sheet)
- [ ] Manual device pass above completed and reported
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` row updated

## STOP conditions

- `install-coach.tsx` or `join.tsx` no longer match the Current state
  excerpts.
- `vaul` is missing from `package.json` → STOP (do not npm-install).
- The drawer requires touching `__root.tsx`, `gates.tsx`, or any push/PWA
  file → STOP and report why.
- Plan 047 is mid-execution on `account.tsx` (uncommitted changes there you
  didn't make) → STOP.

## Open decision (does not block execution)

iOS step copy ships as the CLASSIC Share-first flow (default). The operator
may later request the newer Safari bottom-bar variant (⋯ → Share → View More
→ Add) or a dual-variant sheet; that lands as a copy-only follow-up.

## Maintenance notes

- If Safari's install flow changes again, only Step 3's iOS branch copy/SVGs
  change.
- The dismiss key is versioned (`-2`); bump it only when the drawer changes
  enough to deserve a fresh offer.
- Reviewer scrutiny: no layout shift from the Shell mount; localStorage
  access always wrapped in try/catch (private mode).
- Deferred: avatar-menu "Add to phone" row (kept out to avoid touching
  gates.tsx); revisit if the /account row proves too buried.

## Decisions log (operator, 2026-08-19/20)

Triggers = join success + 2nd distinct-day visit (no lineup-action trigger) ·
iOS copy defaults to classic Share-first, variant swap awaits operator ·
drawer is also the push-notifications front door (copy only) · PWA
manifest/middleware/SW untouched.
