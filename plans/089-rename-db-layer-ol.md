# Plan 089: Rename the `ff_*` schema and `off_` token prefix to `ol_`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This is the plan's third dispatch.** The first two both correctly
> self-stopped on real problems the plan itself had: attempt 1 caught a
> "21 vs 22 tables" prose inconsistency; attempt 2 caught that this plan's
> original inventory was incomplete — 5 tables and 2 indexes are created
> directly in app code (an idempotent `create table/index if not exists`
> pattern, separate from the tracked `migrations/*.sql` pipeline) and were
> never in the original table/index list. Both are now fixed throughout
> this version. If you find a *third* inconsistency, stop and report it the
> same way — do not guess past it.
>
> **Drift check (run first)**:
> ```sh
> git rev-parse --short HEAD   # expect deb93f2, or a descendant with no
>                               # changes to the files listed in Step 2's
>                               # table below
> grep -rhoE '\bff_[a-z_]+\b' src scripts --include='*.ts' --include='*.mjs' \
>   --include='*.tsx' | wc -l   # expect 416
> ```
> If the count differs from 416, or HEAD has diverged in a way that touches
> any file in Step 2's table, STOP and report — do not proceed on stale
> numbers.
>
> **If a previous attempt left files on disk**: check for
> `migrations/0016_rename_open_leagues.sql` and `scripts/_rename-ff-to-ol.mjs`
> before writing them. If either exists, diff its content against this
> version of the plan (table/index counts below) — if it matches, skip
> rewriting it and move on; if it doesn't match (e.g. it's an older,
> incomplete version from a prior attempt), overwrite it with this version.

## Status

- **Priority**: P1 (blocks the "open-leagues" rename from being complete —
  it's the last place the old `open-ff`/`ff_`/`off_` identity still lives)
- **Effort**: L — mechanical but 416 code occurrences across 24 files plus a
  41-statement schema migration (27 table renames + 14 index renames)
- **Risk**: HIGH by blast radius (touches the physical schema of the live
  `open-leagues-pg` Postgres backing `leagues.waits.dev`), LOW by mechanism
  (every step below is either a straight rename or a scripted, word-boundary
  regex substitution with before/after count verification — no logic
  changes). **This plan's own Step 8 is local-only. Do not push the
  resulting commit — see Git workflow.**
- **Depends on**: plans/086 + 087 (landed at `68e95a2`/later — the
  identifier/UI-copy rename is done; this plan is the one remaining layer,
  the database schema and the agent-token prefix)
- **Category**: chore / migration
- **Planned at**: commit `deb93f2`, 2026-08-26
- **Naming scheme confirmed with the user**: new prefix is `ol_` for both
  the table/index rename and the agent-token prefix (was `ff_*` / `off_`).

## Why this matters

Every other trace of "open-ff" is gone from the repo (plans 086/087). The
one thing left is the physical layer: 27 Postgres tables and 14 explicitly
named indexes still carry the `ff_` prefix (from the original "fantasy
football" working name), and personal agent tokens still mint with an
`off_` prefix. Neither is user-visible in normal use, but both are visible
to anyone who opens a `psql` shell, reads a migration file, or inspects a
minted token — and they're the one piece of "old branding" this session
hasn't yet closed out. Renaming now, before the codebase moves on to new
work, keeps the transition a single clean unit instead of a permanent
scar in the schema.

## Current state (all counts verified directly at commit `deb93f2`)

**Two different creation mechanisms exist side by side** — this is the
thing the plan's first version missed, so it's called out explicitly:

1. **22 tables + 12 indexes are tracked in `migrations/*.sql`**, applied
   once each via the `_migrations` table (see `scripts/migrate.mjs` /
   `src/lib/db.ts`).
2. **5 more tables + 2 more indexes are created directly inside app code**,
   via an idempotent `create table if not exists` / `create index if not
   exists` pattern that some modules run defensively on first use (e.g.
   `src/lib/league/events.server.ts:71` creates `ff_events` itself, never
   via a migration file). These are just as real and just as present in
   production as the migration-tracked ones — they simply aren't tracked
   by the `_migrations` mechanism.

**Both mechanisms need a rename, and they need it via different paths**:
migration-tracked and app-code-created tables/indexes alike get renamed at
the DB layer by the new `migrations/0016` file (Step 1) — that part doesn't
care which mechanism created them, `ALTER TABLE ... RENAME` works either
way. But the *idempotent create statements themselves*, embedded in app
code, also need their literal `ff_x` string updated to `ol_x` (Step 2's
codemod) — otherwise, after migration 0016 renames the table, that
module's own `create table if not exists ff_x` runs again on next boot,
finds no table named `ff_x` anymore, and creates a **new, empty, duplicate
table** under the old name. Same failure mode applies to the handful of
index names hardcoded as literal strings in app code.

**27 tables total** (22 from `grep -ohE 'create table (if not exists )?ff_[a-z_]+' migrations/*.sql | sort -u`,
plus 5 from `grep -rnoE 'create table (if not exists )?ff_[a-z_]+' src --include='*.ts'`):
`ff_agent_tokens, ff_allowlist, ff_claims, ff_dispatches, ff_draft, ff_events,
ff_leagues, ff_matchups, ff_moves, ff_picks, ff_player_notes,
ff_player_status, ff_pool, ff_projections, ff_push_subs, ff_queue,
ff_refresh_log, ff_rosters, ff_spots, ff_ticks, ff_trade_assets,
ff_trade_sides, ff_trades, ff_user_ai, ff_wagers, ff_waiver_holds,
ff_week_results`

(`ff_events` is created in `src/lib/league/events.server.ts:71`, `ff_pool`
and `ff_wagers` in `src/lib/league/wagers.server.ts:80,63`, `ff_user_ai` in
`src/lib/league/ai.server.ts:33`, `ff_refresh_log` in **both**
`src/lib/data/projection-feed.server.ts:35` and
`src/lib/data/player-refresh.server.ts:66` — same table, same schema in
both places, confirmed by direct read; both idempotently ensure it exists,
which is fine, harmless double-coverage of one physical table.)

**14 explicitly named indexes** (12 from migrations, plus 2 more from the
same app-code pattern: `ff_events_league_at` in `events.server.ts:84`,
`ff_wagers_league_week` in `wagers.server.ts:79`). Every index name is
`<table>_<suffix>` for one of the 27 tables above:
`ff_agent_tokens_hash, ff_claims_league_week_idx,
ff_dispatches_league_week, ff_events_league_at, ff_moves_league_week_idx,
ff_player_notes_player_idx, ff_player_status_rotowire_idx,
ff_push_subs_user_league, ff_queue_order_idx, ff_rosters_owner_idx,
ff_spots_league_player_idx, ff_ticks_matchup_at, ff_wagers_league_week,
ff_week_results_league_week_idx`

**Of those 14, only 6 appear as literal strings in app code** (the other 8
only ever appear inside `migrations/*.sql` and are never referenced by name
outside it — confirmed via `grep -rnoE 'create (unique )?index (if not
exists )?ff_[a-z_]+' src scripts`): `ff_agent_tokens_hash`
(`tokens.server.ts:31`), `ff_events_league_at` (`events.server.ts:84`),
`ff_ticks_matchup_at` (`ticks.server.ts:35`), `ff_queue_order_idx`
(`ops.server.ts:100`), `ff_wagers_league_week` (`wagers.server.ts:79`),
`ff_player_notes_player_idx` (`rotowire.server.ts:42`). These 6 must be in
the codemod's identifier list (Step 2) alongside the 27 table names — the
other 8 index names are handled entirely by migration 0016 and never
appear in the code sweep.

**416 `ff_*` code references total** across exactly these 24 files (this
count already includes every occurrence of all 27 table names and all 6
in-code index names — it was always a blanket regex scan, not scoped to a
hand-picked list, so it didn't change between plan versions; what changed
is that the codemod's *own* identifier list, below, now actually covers
all of what this total counts):

| File | Count |
|---|---:|
| `src/lib/auth/seed.server.ts` | 1 |
| `src/lib/auth/tokens.server.ts` | 7 |
| `src/lib/agent/dispatch.ts` | 1 |
| `src/lib/league/events.server.ts` | 8 |
| `src/lib/league/book.server.ts` | 5 |
| `src/lib/league/league-facts.server.ts` | 7 |
| `src/lib/league/engine.server.ts` | 147 |
| `src/lib/league/import-commit.ts` | 17 |
| `src/lib/league/ops.server.ts` | 128 |
| `src/lib/league/ticks.server.ts` | 8 |
| `src/lib/league/ai.server.ts` | 6 |
| `src/lib/league/agent-context.server.ts` | 2 |
| `src/lib/league/wagers.server.ts` | 35 |
| `src/lib/push/send.server.ts` | 3 |
| `src/lib/push/fns.ts` | 3 |
| `src/lib/live/spread-series.ts` | 1 |
| `src/lib/live/matchup-series.ts` | 1 |
| `src/lib/data/fns.ts` | 2 |
| `src/lib/data/player-profile.server.ts` | 3 |
| `src/lib/data/projection-feed.server.ts` | 6 |
| `src/lib/data/rotowire.server.ts` | 8 |
| `src/lib/data/projections.server.ts` | 1 |
| `src/lib/data/player-refresh.server.ts` | 15 |
| `scripts/pglite-repair.mjs` | 1 |
| **Total** | **416** |

**6 `off_` token-prefix mentions** (a separate namespace — no overlap with
the `ff_` table names, both are renamed to `ol_` but via different steps):

- `src/lib/auth/tokens.server.ts:4` — `const RAW_PREFIX = "off_";`
- `src/lib/auth/tokens.server.ts:13` — comment `e.g. off_a1b2c3d4`
- `src/lib/auth/verify.server.ts:60,62,63,72` — three `startsWith("off_")` /
  `startsWith("Bearer off_")` checks plus one comment
- `src/lib/auth/tokens.test.mjs:11,16,19-22,25,27` — test literals and
  assertions built on the `off_` prefix
- `src/routes/api/mcp.ts:3,32,36` — two comments plus one
  `startsWith("off_")` check
- `README.md:103` — `export OPENLEAGUES_TOKEN=off_…`
- `.env.example:14` — `# Agent host tokens (off_…) are minted in-app...`

**Historical migrations (`migrations/0001*.sql`–`0015*.sql`) are explicitly
OUT OF SCOPE** — see Scope below for why.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | matches `deb93f2` baseline |
| Tests | `bun test src scripts` | pass (pre-existing PGLite "corrupt WAL" flake → `bun run db:repair` once, unrelated to this plan) |
| Build | `bun run build` | exit 0 |
| Dev server (local rehearsal only) | `bun run dev` | boots, logs `[migrate] applied 0016_rename_open_leagues.sql` (or PGLite's equivalent startup log) |

## Scope

**In scope**:
- New file `migrations/0016_rename_open_leagues.sql` (Step 1)
- New, temporary file `scripts/_rename-ff-to-ol.mjs` — write it, run it once,
  delete it before committing (Step 2–3)
- The 24 files in the table above (touched only by running the script — do
  not hand-edit them)
- The 6 `off_`-mention files/lines listed above (hand-edited directly —
  small enough not to script)
- `plans/README.md` status row — skip if a reviewer maintains the index

**Out of scope**:
- **`migrations/0001*.sql` through `0015*.sql` — do not edit these.** They
  are historical fact (what actually ran, in order, against every database
  that has ever applied them, local and production). Editing them would not
  change anything on databases that already ran them, but WOULD change what
  a brand-new install creates on migrations 0001–0015, breaking migration
  0016's `ALTER TABLE ff_x RENAME TO ol_x` (which expects `ff_x` to exist)
  for that fresh-install case. Adding one new migration that renames forward
  is the only correct way to do this — never edit a migration once it may
  have run anywhere.
- **The app-code idempotent create statements' column definitions** — only
  their `ff_x` → `ol_x` identifier changes (via the codemod). Do not touch
  any column, type, or constraint inside those `create table`/`create
  index` calls — this plan renames identifiers, it does not alter schema
  shape.
- **Implicit/auto-named Postgres objects** — primary key constraints,
  foreign key constraints, and sequences that Postgres auto-named following
  the OLD table name (e.g. a primary key literally named `ff_leagues_pkey`)
  are **not** renamed by this plan. `ALTER TABLE ... RENAME TO` only renames
  the table itself; Postgres has no requirement that a table's internal
  constraint/sequence names match its own name, and leaving them as-is is
  purely cosmetic residue (visible only in `\d ol_leagues` output), not a
  functional issue. Chasing every implicit name down would multiply this
  migration's size for zero behavioral benefit — explicitly deferred, note
  it in NOTES if you want, don't fix it.
- The historical comment at `migrations/0013_agent_tokens.sql:1`
  (`-- Personal access tokens for agent hosts (Bearer off_…)...`) — same
  reason as above, it's an accurate description of what was true when that
  file was written; do not edit it.
- The 3 `SKILL.md` body-prose `open-ff` mentions (plan 087's already-deferred
  item) — not this plan's job either.
- Anything not explicitly listed above.

## Git workflow

Current branch; commit locally, e.g.
`chore: rename ff_* schema and off_ token prefix to ol_`.

**Do NOT push.** Same standing rule as every prior rename plan this
session — `main` auto-deploys to `leagues.waits.dev` via Render on every
push (`render.yaml: autoDeploy: true`). This plan is explicitly scoped to
**land locally and rehearse locally only** (Step 8). Pushing this specific
commit needs one more, separate, explicit go-ahead from the user after
they've seen this plan's local rehearsal results — it is not implied by
"land the plan."

## Steps

### Step 1: Write `migrations/0016_rename_open_leagues.sql`

```sql
-- One-time rename: the ff_ prefix (from the project's original "fantasy
-- football" working name) becomes ol_ (open-leagues). Covers both
-- migration-tracked tables/indexes AND the 5 tables + 2 indexes created
-- directly in app code via an idempotent create-if-not-exists pattern
-- (see plans/089) — ALTER TABLE/INDEX RENAME works identically either way.
-- Table renames only — Postgres does not require a table's own internal
-- constraint/sequence names to match the table name, so auto-named primary
-- keys etc. are left as-is (cosmetic only, see plans/089). IF EXISTS makes
-- this safe to apply to a database that (for any reason) already has the
-- new names.

alter table if exists ff_agent_tokens rename to ol_agent_tokens;
alter table if exists ff_allowlist rename to ol_allowlist;
alter table if exists ff_claims rename to ol_claims;
alter table if exists ff_dispatches rename to ol_dispatches;
alter table if exists ff_draft rename to ol_draft;
alter table if exists ff_events rename to ol_events;
alter table if exists ff_leagues rename to ol_leagues;
alter table if exists ff_matchups rename to ol_matchups;
alter table if exists ff_moves rename to ol_moves;
alter table if exists ff_picks rename to ol_picks;
alter table if exists ff_player_notes rename to ol_player_notes;
alter table if exists ff_player_status rename to ol_player_status;
alter table if exists ff_pool rename to ol_pool;
alter table if exists ff_projections rename to ol_projections;
alter table if exists ff_push_subs rename to ol_push_subs;
alter table if exists ff_queue rename to ol_queue;
alter table if exists ff_refresh_log rename to ol_refresh_log;
alter table if exists ff_rosters rename to ol_rosters;
alter table if exists ff_spots rename to ol_spots;
alter table if exists ff_ticks rename to ol_ticks;
alter table if exists ff_trade_assets rename to ol_trade_assets;
alter table if exists ff_trade_sides rename to ol_trade_sides;
alter table if exists ff_trades rename to ol_trades;
alter table if exists ff_user_ai rename to ol_user_ai;
alter table if exists ff_wagers rename to ol_wagers;
alter table if exists ff_waiver_holds rename to ol_waiver_holds;
alter table if exists ff_week_results rename to ol_week_results;

alter index if exists ff_agent_tokens_hash rename to ol_agent_tokens_hash;
alter index if exists ff_claims_league_week_idx rename to ol_claims_league_week_idx;
alter index if exists ff_dispatches_league_week rename to ol_dispatches_league_week;
alter index if exists ff_events_league_at rename to ol_events_league_at;
alter index if exists ff_moves_league_week_idx rename to ol_moves_league_week_idx;
alter index if exists ff_player_notes_player_idx rename to ol_player_notes_player_idx;
alter index if exists ff_player_status_rotowire_idx rename to ol_player_status_rotowire_idx;
alter index if exists ff_push_subs_user_league rename to ol_push_subs_user_league;
alter index if exists ff_queue_order_idx rename to ol_queue_order_idx;
alter index if exists ff_rosters_owner_idx rename to ol_rosters_owner_idx;
alter index if exists ff_spots_league_player_idx rename to ol_spots_league_player_idx;
alter index if exists ff_ticks_matchup_at rename to ol_ticks_matchup_at;
alter index if exists ff_wagers_league_week rename to ol_wagers_league_week;
alter index if exists ff_week_results_league_week_idx rename to ol_week_results_league_week_idx;
```

**Verify**: `wc -l migrations/0016_rename_open_leagues.sql` → non-zero;
`grep -c '^alter table' migrations/0016_rename_open_leagues.sql` → `27`;
`grep -c '^alter index' migrations/0016_rename_open_leagues.sql` → `14`.

### Step 2: Write the one-time rename script

Create `scripts/_rename-ff-to-ol.mjs` with exactly this content:

```js
#!/usr/bin/env node
// One-time codemod for plans/089 — renames every ff_<identifier> to
// ol_<identifier> across a fixed file list, via word-boundary regex
// (underscore is a \w char, so \b correctly matches only whole
// identifiers — "ff_queue" will NOT falsely match inside
// "ff_queue_order_idx", so both can safely be in this same list in any
// order). IDENTIFIERS covers all 27 table names plus the 6 index names
// that appear as literal strings in app code (the other 8 index names
// only ever appear in migrations/*.sql and are renamed there, by
// migrations/0016, not here).
// Delete this file after running it once and verifying the result.
import { readFileSync, writeFileSync } from "node:fs";

const IDENTIFIERS = [
  "ff_agent_tokens", "ff_agent_tokens_hash", "ff_allowlist", "ff_claims",
  "ff_dispatches", "ff_draft", "ff_events", "ff_events_league_at",
  "ff_leagues", "ff_matchups", "ff_moves", "ff_picks", "ff_player_notes",
  "ff_player_notes_player_idx", "ff_player_status", "ff_pool",
  "ff_projections", "ff_push_subs", "ff_queue", "ff_queue_order_idx",
  "ff_refresh_log", "ff_rosters", "ff_spots", "ff_ticks",
  "ff_ticks_matchup_at", "ff_trade_assets", "ff_trade_sides", "ff_trades",
  "ff_user_ai", "ff_wagers", "ff_wagers_league_week", "ff_waiver_holds",
  "ff_week_results",
];

const FILES = [
  "src/lib/auth/seed.server.ts",
  "src/lib/auth/tokens.server.ts",
  "src/lib/agent/dispatch.ts",
  "src/lib/league/events.server.ts",
  "src/lib/league/book.server.ts",
  "src/lib/league/league-facts.server.ts",
  "src/lib/league/engine.server.ts",
  "src/lib/league/import-commit.ts",
  "src/lib/league/ops.server.ts",
  "src/lib/league/ticks.server.ts",
  "src/lib/league/ai.server.ts",
  "src/lib/league/agent-context.server.ts",
  "src/lib/league/wagers.server.ts",
  "src/lib/push/send.server.ts",
  "src/lib/push/fns.ts",
  "src/lib/live/spread-series.ts",
  "src/lib/live/matchup-series.ts",
  "src/lib/data/fns.ts",
  "src/lib/data/player-profile.server.ts",
  "src/lib/data/projection-feed.server.ts",
  "src/lib/data/rotowire.server.ts",
  "src/lib/data/projections.server.ts",
  "src/lib/data/player-refresh.server.ts",
  "scripts/pglite-repair.mjs",
];

let totalBefore = 0;
let totalAfter = 0;

for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  const beforeCount = (before.match(/\bff_[a-z_]+\b/g) || []).length;
  let after = before;
  for (const id of IDENTIFIERS) {
    after = after.replaceAll(new RegExp(`\\b${id}\\b`, "g"), id.replace("ff_", "ol_"));
  }
  const afterOldCount = (after.match(/\bff_[a-z_]+\b/g) || []).length;
  const afterNewCount = (after.match(/\bol_[a-z_]+\b/g) || []).length;
  console.log(
    `${file}: ${beforeCount} ff_ before -> ${afterOldCount} ff_ / ${afterNewCount} ol_ after`,
  );
  totalBefore += beforeCount;
  totalAfter += afterNewCount;
  writeFileSync(file, after);
}

console.log(`\nTotal: ${totalBefore} ff_ occurrences -> ${totalAfter} ol_ occurrences`);
```

**Verify**: file exists, no syntax errors on save (this is plain JS, will be
run directly — a typo would surface as a runtime error in Step 3, not here);
`IDENTIFIERS` has 33 entries (27 table names + 6 in-code index names).

### Step 3: Run the script, verify, delete it

```sh
node scripts/_rename-ff-to-ol.mjs
```

Expected: the per-file log lines show, for every one of the 24 files, the
"before" count exactly matching the table in "Current state" above, "after"
`ff_` count of `0`, and "after" `ol_` count equal to the original count.
Final line: `Total: 416 ff_ occurrences -> 416 ol_ occurrences`.

**Delete the script now, before the safety-net grep**:
`rm scripts/_rename-ff-to-ol.mjs` — it's a one-time codemod, not permanent
tooling, and it must be gone before the next check, because its own source
(the doc comment's examples plus its `IDENTIFIERS` array, i.e. the literal
list of old names it searches for) otherwise matches the grep below and
produces a false positive that has nothing to do with whether the 24 real
target files are actually clean.

Then run the safety-net grep:

```sh
grep -rhoE '\bff_[a-z_]+\b' src scripts --include='*.ts' --include='*.mjs' --include='*.tsx' | wc -l
```
→ `0` (all 416 are gone from the 24 files — this also re-scans everywhere
else under `src`/`scripts` in case something outside the 24-file list was
missed; if this is non-zero *now that the script is deleted*, STOP, see
STOP conditions).

### Step 4: Rename the `off_` token prefix to `ol_`

Six hand-edits (small enough not to script):

- **`src/lib/auth/tokens.server.ts:4`**: `const RAW_PREFIX = "off_";` →
  `const RAW_PREFIX = "ol_";`
- **`src/lib/auth/tokens.server.ts:13`** comment: `e.g. off_a1b2c3d4` →
  `e.g. ol_a1b2c3d4`
- **`src/lib/auth/verify.server.ts:60,62,63`**: the three
  `startsWith("off_")` / `startsWith("Bearer off_")` checks →
  `startsWith("ol_")` / `startsWith("Bearer ol_")`; **line 72** comment
  `(off_…)` → `(ol_…)`
- **`src/lib/auth/tokens.test.mjs`**: every `off_` literal/assertion (lines
  11, 16, 19–22, 25, 27 per "Current state" above) → `ol_`
- **`src/routes/api/mcp.ts:3,32,36`**: two comments (`Bearer off_…`,
  `Resolve Bearer off_…`) and the `startsWith("off_")` check → `ol_`
  equivalents
- **`README.md:103`**: `export OPENLEAGUES_TOKEN=off_…` →
  `export OPENLEAGUES_TOKEN=ol_…`
- **`.env.example:14`**: `# Agent host tokens (off_…) are minted in-app...`
  → `# Agent host tokens (ol_…) are minted in-app...`

**Verify**: `grep -rn 'off_' src README.md .env.example --include='*.ts' --include='*.mjs'`
→ no matches (the historical `migrations/0013_agent_tokens.sql:1` comment
is out of scope and untouched, so don't include `migrations/` in this grep).

### Step 5: Full gate

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0.

If any test asserts a literal old table/index name (unlikely — tests
generally go through the app layer, not raw SQL) and fails here, that's
real signal: fix the test's expectation to the new name, don't skip it.

### Step 6: Commit (local only)

Commit message: `chore: rename ff_* schema and off_ token prefix to ol_`.
Do not push (see Git workflow).

### Step 7 (rehearsal, not a fresh checkout): confirm local PGLite state before rehearsing

```sh
ls data/pglite  # confirm the local dev database directory exists —
                # it should, from prior sessions' seeded WIFFL league data
```

If `data/pglite` does not exist locally, STOP and report — the whole point
of this rehearsal is testing the rename against a database that already ran
migrations 0001–0015 (plus the app-code idempotent creates, which will have
already run too, the first time each relevant server function was called
locally) and holds real data, not a fresh empty one.

### Step 8: Local rehearsal — apply migration 0016 and smoke-test

```sh
bun run dev
```

Watch the startup log for PGLite's migration-apply line for `0016_*.sql`
(mirrors `scripts/migrate.mjs`'s `[migrate] applied <name>` format — check
`src/lib/db.ts`'s migrate function for its exact log wording if unsure, and
match against that, don't guess).

With the dev server running on localhost, using `agent-browser`
(`~/.bun/bin/agent-browser`, sandbox disabled per the browser-automation
rule) **against the local dev URL only — never `leagues.waits.dev` for this
step**:

1. Sign in to the existing WIFFL league.
2. Load the standings page.
3. Load a matchup / box score page.
4. Open `/account` and confirm the agent-token section still renders (don't
   need to mint a new token, just confirm the page loads without error).
5. If reasonably quick to trigger without side effects: touch one path that
   hits an app-code-created table (e.g. a page/action that reads the wager
   book, which touches `ol_wagers`/`ol_pool`) — this is the part most at
   risk of the "duplicate empty table" failure mode described in "Current
   state," so it's worth exercising specifically, not just the
   migration-tracked tables.

All must load with no server errors in the `bun run dev` console. If any of
them 500s or the console shows a SQL error mentioning `ff_` or a
missing-relation error, STOP — see STOP conditions.

Then confirm the rename actually took effect at the DB layer, not just "the
app didn't crash" — from the same terminal, while `bun run dev` is running,
this needs an actual PGLite-level check. If there's an existing script or
route for this (check `scripts/` for an existing PGLite-inspection helper
before writing a new one, e.g. something used by `db:repair`), use it;
otherwise a minimal one-off:

```sh
node -e '
import("@electric-sql/pglite").then(async ({ PGlite }) => {
  const pg = new PGlite("./data/pglite");
  const rows = await pg.query(
    "select tablename from pg_tables where schemaname = $1 and tablename like $2",
    ["public", "%f_%"],
  );
  console.log(rows.rows);
});
'
```
Expected: only `_migrations` and (if PGLite creates its own internal
tables) rows with the new `ol_` prefix — zero rows with `ff_`, and
specifically **no duplicate pair** like both `ol_events` and a
re-created empty `ff_events` (that pairing is exactly the failure mode
this plan's "Current state" section warns about — if you see it, the
codemod missed renaming that table's idempotent create statement; STOP,
don't just drop the duplicate). (This is a one-off diagnostic command, not
a file to add to the repo.)

## Test plan

- No new automated tests — this is a pure rename with identical logic; the
  existing test suite (`bun test src scripts`) exercises the renamed tables
  indirectly through every existing test that touches league data, and its
  continuing to pass after Step 3 IS the regression check.
- Manual: Step 8's smoke test plus the PGLite table-name check (including
  the no-duplicate-tables check above).

## Done criteria

- [ ] `migrations/0016_rename_open_leagues.sql` exists with 27 table + 14
      index rename statements
- [ ] `grep -rhoE '\bff_[a-z_]+\b' src scripts --include='*.ts' --include='*.mjs' --include='*.tsx' | wc -l` → `0`
- [ ] `grep -rn 'off_' src README.md .env.example --include='*.ts' --include='*.mjs'` → no matches
- [ ] `scripts/_rename-ff-to-ol.mjs` deleted (not committed)
- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] Local `bun run dev` boots, applies migration `0016_*`, and every
      smoke-test page in Step 8 loads without server errors
- [ ] PGLite table-name check shows zero `ff_`-prefixed tables remaining
      locally, and no duplicate old/new table pairs
- [ ] Commit created locally; **not pushed**

## STOP conditions

- The drift check's 416 count doesn't match, or HEAD has diverged on any
  in-scope file.
- The script's before/after counts don't line up per-file (any file where
  "after ff_ count" isn't exactly 0, or "after ol_ count" doesn't match its
  own "before" count) — a mismatch means the regex missed or double-matched
  something; do not hand-patch around it, stop and report the exact file
  and counts.
- The final safety-net grep across all of `src`/`scripts` finds any `ff_*`
  occurrence outside the 24-file list (would mean the recon in this plan
  missed a file — stop, don't just add it and continue silently).
- Any test fails for a reason other than a literal old-name assertion that
  needs updating (i.e. any real logic regression).
- The local rehearsal (Step 8) shows a server error, a missing-relation SQL
  error, any `ff_`-prefixed table still present in PGLite after the
  migration ran, or a duplicate old/new table pair.
- You find yourself wanting to also touch `migrations/0001`–`0015`, the
  `migrations/0013_agent_tokens.sql:1` comment, implicit PK/FK/sequence
  names, or the 3 `SKILL.md` body-prose mentions — all explicitly out of
  scope, note in NOTES instead.
- You find yourself wanting to push this commit — don't. That decision
  belongs to the user, after they've reviewed this plan's local rehearsal
  results, per Git workflow above.

## Maintenance notes

- After this plan lands (locally), the codebase has zero remaining
  `open-ff`/`ff_`/`off_` identity anywhere except: the 3 deferred
  `SKILL.md` body-prose lines, the historical `migrations/0001`–`0015`
  files (correct, as explained above, to leave untouched), and the
  historical comment at `migrations/0013_agent_tokens.sql:1`.
- Before this commit is ever pushed: the live `open-leagues-pg` Postgres
  has real production data. Migration 0016 uses `IF EXISTS` and is a set of
  plain renames (no data movement, no drops), so the actual production risk
  is low, but the standing rule holds regardless — get the user's explicit
  go-ahead immediately before that specific push, informed by this plan's
  local rehearsal results.
- Worth flagging to the user separately from this plan (not this plan's job
  to fix): the app-code idempotent create-table/index pattern discovered
  here is a slightly separate schema-management mechanism from
  `migrations/*.sql`, living in at least 5 different `.server.ts` files. It
  works, but it means "grep migrations/ for the schema" undersells what
  tables actually exist — a future cleanup could consolidate these into
  real migration files now that they're known, but that's out of scope here.
- Next planned work after this (per the user, not part of this plan):
  scoping a Codex-based reference-implementation demo against the renamed
  MCP server/token scheme.
