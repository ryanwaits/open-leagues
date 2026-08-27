# Plan 032: Re-run the wager script when a week has a live line

> **Executor instructions**: This is an **ops re-run**, not a feature.
> Do not restyle the ticket. Do not add markets. Follow the steps. If a
> STOP fires, report — do not invent a fake price.
>
> **Drift check (run first)**: `git diff --stat 8e660ba..HEAD -- scripts/wager-qa.mjs src/components/wager-ticket.tsx src/components/book-panel.tsx`
> (Reconciled 2026-08-20 at `8e660ba`: 049's classname codemod restyled both
> components — cosmetic only; `wager-no-price`/`wager-price` testids intact
> at book-panel.tsx:28/196; wager-qa.mjs unchanged. Finding still live.)
>
> **Reconciled again 2026-08-26 at `7a53874`**: real drift found, and it's
> not the live-line question. `bun scripts/wager-qa.mjs` was re-run against
> local dev and failed at `wait --url **/league/lg_*` after clicking "Open
> the league" — because **that button no longer exists**. `/new` was
> redesigned (independent of this plan — part of this session's migrate/
> import work, plans 045/081–088) into an import-only flow: the page now
> shows a single "Import WIFFL or a recap" card, with no more blank
> league-name/desk-name quick-create form (the old "The Backyard"/
> "Night Desk" placeholders the script fills are gone). `scripts/
> wager-qa.mjs`'s entire "no existing throwaway league → create one"
> fallback path (lines ~119–133) targets UI that doesn't exist anymore.
> **This plan cannot usefully re-run as written** — the script needs a
> rewrite to create its throwaway league via the Draft/rebuild import path
> instead of the removed blank-create form, *before* the original live-line
> question can even be tested again. That rewrite is out of scope for a
> reconcile pass (script changes need their own plan, not a status-note
> update) — flagging it here rather than silently leaving 032 looking
> re-runnable as-is.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/029-wager-ticket-qa.md (DONE `dd9bc53`)
- **Category**: tests
- **Planned at**: commit `84d684e`, 2026-08-20 (reconciled `8f04751`;
  execute that day STOPPED — throwaway league still `wager-no-price`.
  Finding live; `scripts/wager-qa.mjs` / ticket files unchanged.) —
  **re-pinned to `7a53874`, 2026-08-26**: this plan is now blocked on a
  script rewrite (see drift check above), not just a live-line wait. Needs
  a follow-up plan (`fix wager-qa.mjs's throwaway-league creation to use
  the import flow`) before this one is executable again.

## Why this matters

029 proved the book *chrome*. In preseason `LinePanel` mounts the
`wager-no-price` empty state and the script exits 0 without calling
`placeWager`. Nobody has still submitted a $1 ticket through the
dialog. The same script already has the price branch. Wait until a
week has projections (or a sim that produces a live line), then run it.

This plan writes **no new product**. It records the re-run so the
backlog stops saying "never clicked."

## Current state

- `scripts/wager-qa.mjs` — if `[data-testid=wager-price]` exists and is
  enabled: fill `wager-stake` = 1, click `wager-submit`, screenshot
  `screenshots/wager-ticket.png`. Else no-price path.
- 029 last run: `path: "no-price"`.
- Local seed: import `LOCAL_SEED` from `src/lib/auth/local-seed.ts`.
  Do **not** copy the password into this plan or README.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| App     | `curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/` | 0 |
| Script  | `bun scripts/wager-qa.mjs` | exit 0, `"path":"price"` |

## Scope

**In scope**: running `bun scripts/wager-qa.mjs` against a running app;
optional one-line note in `plans/README.md` that the $1 path landed.

**Out of scope**:
- Editing `wager-ticket.tsx` / `book-panel.tsx` except a bug that
  blocks the existing script
- New wager kinds, vig, mint
- Committing PNG binaries
- Seeding fake projections just to force a line

## Git workflow

- Branch: current
- If the script needed a bugfix: `fix: let the wager QA script submit a live line`
- If it just ran: **no code commit**. Only the index note.
- Do NOT push

## Steps

### Step 1: Confirm a live line is possible

App up on 8080. If you cannot get `[data-testid=wager-price]` on a
**throwaway** `/new` league after betting On + Save (and rebuild week
if needed), **stop**. Do not invent scores.

**Verify**: script JSON includes `"path":"price"` or you stopped.

### Step 2: Run the existing script

`bun scripts/wager-qa.mjs` → exit 0, `screenshots/wager-ticket.png`,
success toast or "Wager placed". League must be one the script just
created.

**Verify**: stdout contains `"path":"price"`.

## Done criteria

- [ ] Script exited 0 on the **price** path (not no-price)
- [ ] Screenshot under `screenshots/wager-ticket.png` (untracked)
- [ ] No password in git
- [ ] No new market code

## STOP conditions

- Still preseason / no live line — leave this TODO; do not fake it
- About to stake a league you did not create in this run
- Login fails and you would disable auth

## Maintenance notes

- Re-run anytime the ticket UI changes. Same script.
- 030 does not block this: the script signs in as commish.
