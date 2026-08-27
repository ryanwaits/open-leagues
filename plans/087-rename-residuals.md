# Plan 087: Rename residuals plan 086 correctly left out of scope

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 68e95a2..HEAD -- src/lib/a2hs.ts src/routes/login.tsx src/routes/league/\$leagueId/settings.tsx`
> If any diff exists, compare the "Current state" excerpts below against
> the live files before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P3
- **Effort**: S (four one-line string changes)
- **Risk**: LOW — cosmetic/identifier only, same class as plan 086. One
  side effect worth naming plainly (see Step 1): renaming the A2HS
  dismissal localStorage key resets that "already dismissed" flag for
  every returning user, the same way plan 086's Docker-volume rename
  resets local data — here the blast radius is "the install prompt shows
  one more time," not data loss.
- **Depends on**: plans/086-rename-open-leagues-safe-surface.md (landed at
  `68e95a2` — this plan picks up exactly the four spots that plan's own
  executor found via its final sweep but correctly left untouched because
  they weren't in that plan's Scope)
- **Category**: chore
- **Planned at**: commit `68e95a2`, 2026-08-26

## Why this matters

Plan 086 renamed every `open-ff`/`OPENFF`/`openff` occurrence it was
scoped to touch, and its own end-of-run sweep found four more that its
Scope section never listed: three internal localStorage key constants,
one line of **visible marketing copy on the actual login page**, and one
downloaded backup filename. Leaving the login-page line stale ("Your
open-ff account...") while the README, the title, and everything else now
says "open-leagues" would read as an inconsistency right before a visual
docs pass — this plan closes that gap.

## Current state

All excerpts read directly at commit `68e95a2`.

- **`src/lib/a2hs.ts:5-8`**:
  ```ts
  export const A2HS_DISMISS_KEY = "open-ff-a2hs-2"; // v2 on purpose: people who
  // dismissed the old card get ONE fresh offer from the richer drawer.
  export const A2HS_JOIN_KEY = "open-ff-a2hs-join"; // set on join success
  export const A2HS_DAYS_KEY = "open-ff-a2hs-days"; // JSON {last:"YYYY-MM-DD",days:n}
  ```
  The `-2` suffix and its comment describe a *previous, deliberate*
  key-bump (v1 → v2) that was used to re-show the install prompt once to
  people who'd already dismissed v1. Renaming the string today has the
  same effect again, incidentally: anyone who already dismissed
  `open-ff-a2hs-2` will see the install prompt once more after this
  change, since their stored key no longer matches. This is a one-time,
  low-stakes UX nudge (an install-prompt reappearance), not data loss —
  named here so it's a known, accepted side effect, not a surprise.

- **`src/routes/login.tsx:73-79`**:
  ```tsx
  <Link to="/" className="font-display text-3xl tracking-tight">
    {brand.name}
  </Link>
  <p className="mt-2 text-sm text-muted">
    Your open-ff account — not Sleeper, not ESPN.
    {socialCopy}
  </p>
  ```
  Note `{brand.name}` above it already resolves from `src/skin/brand.ts`
  (untouched by this plan — confirmed out of scope, see below) — only the
  hardcoded prose line changes.

- **`src/routes/league/$leagueId/settings.tsx:682`**:
  ```tsx
  a.download = `open-ff-${leagueId}.json`;
  ```
  The league-backup download filename (from plan 034's export feature).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | matches `68e95a2` baseline (10/177/6) |
| Tests | `bun test src scripts` | pass (same shape as baseline — if you hit a PGLite "corrupt WAL" error, run `bun run db:repair` once, that's a pre-existing environmental issue, not caused by this plan) |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `src/lib/a2hs.ts` (three key string literals)
- `src/routes/login.tsx` (one prose line)
- `src/routes/league/$leagueId/settings.tsx` (one filename template literal)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- `src/skin/brand.ts` / `{brand.name}` — that's the app's display name
  token, a separate system from this rename, not touched by plan 086
  either. Confirm it still reads correctly on the login page but do not
  edit it.
- The three `open-ff` mentions in skill `SKILL.md` body prose
  (`open-leagues-migrate/SKILL.md:4`, `open-leagues-lineup/SKILL.md:27`,
  `open-leagues-week/SKILL.md:32`) — plan 086 deliberately scoped the
  skill-file change to frontmatter only; leave the body prose as a
  separate, even-lower-priority cleanup, not this plan's job either
  (mention it in NOTES if you want, don't fix it).
- Any `ff_*` database identifier or the `off_` token prefix — still
  plan 088's territory (renumbered from "087" in earlier conversation
  since this residuals plan took that slot).
- Anything not explicitly listed above.

## Git workflow

Current branch; one commit, e.g.
`chore: catch the last open-ff residuals (login copy, a2hs keys, backup filename)`.
Do NOT push (same standing rule as 086 — pushes to `main` auto-deploy to
`leagues.waits.dev` via Render; land locally, pushing is the reviewer's call).

## Steps

### Step 1: `src/lib/a2hs.ts`

```ts
export const A2HS_DISMISS_KEY = "open-leagues-a2hs-2"; // v2 on purpose: people who
// dismissed the old card get ONE fresh offer from the richer drawer.
export const A2HS_JOIN_KEY = "open-leagues-a2hs-join"; // set on join success
export const A2HS_DAYS_KEY = "open-leagues-a2hs-days"; // JSON {last:"YYYY-MM-DD",days:n}
```

Keep the `-2` suffix and the existing comments exactly as they are — only
the `open-ff` → `open-leagues` substring changes.

**Verify**: `grep -c 'open-ff' src/lib/a2hs.ts` → `0`;
`grep -c 'open-leagues-a2hs' src/lib/a2hs.ts` → `3`.

### Step 2: `src/routes/login.tsx`

```tsx
<p className="mt-2 text-sm text-muted">
  Your open-leagues account — not Sleeper, not ESPN.
  {socialCopy}
</p>
```

**Verify**: `grep -n 'open-leagues account' src/routes/login.tsx` → one match.

### Step 3: `src/routes/league/$leagueId/settings.tsx`

```tsx
a.download = `open-leagues-${leagueId}.json`;
```

**Verify**: `grep -n 'open-leagues-\${leagueId}' 'src/routes/league/$leagueId/settings.tsx'` → one match.

### Step 4: full gate, then commit

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0. Commit (message above). Update the 087 row in
`plans/README.md`.

## Test plan

- No new automated tests — cosmetic string changes with no existing test
  coverage around these three files' literal values.
- Manual sanity: `grep -rn 'open-ff' src/lib/a2hs.ts src/routes/login.tsx src/routes/league/\$leagueId/settings.tsx` → no matches.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -rn 'open-ff' src/lib/a2hs.ts src/routes/login.tsx 'src/routes/league/$leagueId/settings.tsx'` → no matches
- [ ] `git diff --stat` touches only the three in-scope files

## STOP conditions

- The drift check shows any in-scope file no longer matches the excerpts
  above.
- You find yourself wanting to also fix the three `SKILL.md` body-prose
  mentions or anything `ff_`/`off_`-related — both are explicitly out of
  scope for this plan; note them in NOTES instead.

## Maintenance notes

- After this plan, the only remaining `open-ff` mentions anywhere in the
  non-`plans/` tree should be the three `SKILL.md` body-prose lines (known,
  deliberately deferred) and the `ff_*`/`off_` database-layer identifiers
  (plan 088's territory). A future cleanup pass can fold the SKILL.md prose
  fix in whenever someone's next in those files for an unrelated reason.
