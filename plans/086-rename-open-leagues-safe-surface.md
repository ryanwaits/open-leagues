# Plan 086: Rename product identity open-ff → open-leagues (safe surface only)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7c8e7e9..HEAD -- package.json docker-compose.yml Dockerfile scripts/docker-entrypoint.sh .env.example render.yaml scripts/mcp.mjs src/routes/api/mcp.ts src/lib/league/ops.server.ts src/lib/push/send.server.ts src/lib/agent/dispatch.ts src/lib/agent/dispatch.test.mjs scripts/mcp-http.test.mjs scripts/skills-core.test.mjs README.md AGENTS.project.md src/lib/agent/context-prompt.md`
> If any diff exists, compare the "Current state" excerpts below against
> the live files before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: L (many files, but every change is a mechanical, exact-string
  substitution — no logic changes, no judgment calls)
- **Risk**: MED — this is a **cosmetic + identifier** rename only. It
  explicitly does **not** touch the `ff_*` database tables or the `off_`
  agent-token prefix (see plan 087 for that — deliberately separate,
  deliberately gated, because those are physical schema/data on the live
  `open-leagues-pg` database backing `leagues.waits.dev`). The risk here is
  volume, not danger: miss one of the ~20 files below and something reads
  the old env var name or looks for the old skill directory and silently
  no-ops or 404s. Read every "Verify" grep — they exist to catch exactly
  that.
- **Depends on**: none
- **Category**: chore, direction (rebrand)
- **Planned at**: commit `7c8e7e9`, 2026-08-26

## Why this matters

The GitHub repo has already moved to `github.com/ryanwaits/open-leagues`,
and `render.yaml` (the live deploy config for `leagues.waits.dev`) already
says `open-leagues`/`open-leagues-pg` in several places — the deploy
config is ahead of the codebase. Everything else — `package.json`, the
`OPENFF_*` env var prefix, the MCP server's own advertised name, the four
agent skill directories, the Docker volume name, and every doc that names
the product — still says `open-ff`. This plan brings all of that in line,
without touching the two things that need their own careful migration
(database table names, agent-token prefix — plan 087).

**Read this once, it is the only rule that matters for every step below**:
replace the literal string `open-ff` → `open-leagues` and `OPENFF` →
`OPENLEAGUES` (case preserved: `OPENFF_X` → `OPENLEAGUES_X`, never
lowercase it) everywhere in the files listed in Scope, with the specific
exceptions called out per-file below. Do not touch any `ff_` (lowercase,
no "open" prefix) database table/column/index name, and do not touch the
`off_` bearer-token prefix in `src/lib/auth/tokens.server.ts`,
`src/lib/auth/verify.server.ts`, or `src/routes/api/mcp.ts:36` — those are
explicitly plan 087's territory, not this plan's.

## Current state

All excerpts read directly at commit `7c8e7e9`.

- **`package.json:1-6`**:
  ```json
  {
    "name": "open-ff",
    "private": true,
    "sideEffects": false,
    "type": "module",
    "packageManager": "bun@1.3.10",
  ```

- **`docker-compose.yml`** (full file, 21 lines):
  ```yaml
  services:
    app:
      build: .
      ports:
        - "8080:8080"
      volumes:
        - openff-data:/data
      environment:
        PGLITE_DATA_DIR: /data/pglite
        OPENFF_SELF_TICK: "1"
        # Public origin of this box (no trailing slash). Change when reverse-proxied.
        BETTER_AUTH_URL: ${BETTER_AUTH_URL:-http://localhost:8080}
        # Blank → entrypoint generates one for this process.
        BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:-}
        # Optional. If unset, HTTP /api/league/tick is public (in-process tick still runs).
        CRON_SECRET: ${CRON_SECRET:-}
        # Do not set DATABASE_URL — durable PGLite on the volume is enough.

  volumes:
    openff-data:
  ```
  Two occurrences of `openff-data` (line 7, line 20) and one
  `OPENFF_SELF_TICK` (line 10).

- **`Dockerfile`** — two relevant lines:
  ```dockerfile
  # Household/dev path still available via OPENFF_DEV=1 (long-lived `bun run dev`).
  ...
  ENV PGLITE_DATA_DIR=/data/pglite \
      OPENFF_SELF_TICK=1 \
      PORT=8080 \
      BETTER_AUTH_URL=http://localhost:8080
  ```

- **`scripts/docker-entrypoint.sh`** — one line:
  ```sh
  if [ "${OPENFF_DEV:-0}" = "1" ]; then
  ```

- **`.env.example`** — two lines:
  ```
  OPENFF_SELF_TICK=
  ```
  and a comment: `# Agent host tokens (off_…) are minted in-app — never put
  them here.` — **leave the `off_…` mention in that comment untouched**
  (plan 087's territory, not this one — the comment is about token *values*,
  not this plan's env-var rename).

- **`render.yaml`** (full file, already read) — only one line needs a
  change, `envVars`:
  ```yaml
        - key: OPENFF_SELF_TICK
          value: "1"
  ```
  Everything else in this file (`name: open-leagues`, `domains:
  [leagues.waits.dev]`, `fromDatabase: { name: open-leagues-pg }`,
  `databases: [{ name: open-leagues-pg, ... }]`) **already says
  `open-leagues`** — do not touch those, they're already correct. This file
  is documented as syncing to the live Render service on push ("this file
  is the source of truth and syncs on push" per its own header comment) —
  see STOP conditions.

- **`scripts/mcp.mjs`** (full file, already read) — every occurrence:
  ```js
  *   export OPENFF_USER=<Better Auth user.id>
  ...
  * Hosts: codex/claude/grok `mcp add openff --command bun --args scripts/mcp.mjs`
  ...
  const userId = process.env.OPENFF_USER;
  ...
  const missing = [!userId ? "OPENFF_USER" : null, ...
  ...
  console.error(
    `openff mcp: missing ${missing.join(" and ")}. ...`,
  );
  ...
  const server = new Server({ name: "openff", version: "0.1.0" }, ...
  ...
  // userId from OPENFF_USER only — never from tool arguments
  ```
  Six distinct spots: the doc comment's env var + `mcp add openff` example,
  `process.env.OPENFF_USER`, the missing-var check string, the error
  message's `openff mcp:` prefix, the `Server({ name: "openff", ... })`
  call, and the trailing comment.

- **`src/routes/api/mcp.ts`** — one spot:
  ```ts
  const server = new Server({ name: "openff", version: "0.1.0" }, { capabilities: { tools: {} } });
  ```
  (this file's `off_` mentions — lines 2, 34, 36 — are token-prefix related,
  **do not touch**, plan 087's territory.)

- **`src/lib/league/ops.server.ts:1376-1382`**:
  ```ts
  /**
   * In-process league clock. Only when OPENFF_SELF_TICK=1 (Docker / long-lived
   * host). Vercel keeps vercel.json cron — do not set that env there.
   */
  export function startLeagueClock(): void {
    if (process.env.OPENFF_SELF_TICK !== "1") return;
  ```

- **`src/lib/push/send.server.ts:29-31`**:
  ```ts
   * OPENFF_PUSH_DRY=1 prints "would send" and skips the network.
   */
  ```
  (find the matching `process.env.OPENFF_PUSH_DRY` check nearby in the same
  file — read the file to find its exact line before editing; the comment
  above is the anchor.)

- **`src/lib/agent/dispatch.ts`** — 24 occurrences of the literal substring
  `OPENFF_USER`, every one inside an error message string of the shape
  `` `${id} requires a signed-in user (OPENFF_USER)` `` or the two
  `if (!userId) throw new Error(...)` variants already seen throughout
  plans 081–083. This is a pure find-and-replace of the substring
  `OPENFF_USER` → `OPENLEAGUES_USER` — every occurrence is inside a string
  literal, never a variable name (the variable is always `userId` /
  `context.userId`, already correctly named, not part of this rename).

- **`src/lib/agent/dispatch.test.mjs`** — 5 occurrences of `OPENFF_USER`
  (test assertions matching the same error-message substrings, plus the
  file's own comments) — same substring replacement.

- **`scripts/mcp-http.test.mjs`** — 2 occurrences of `OPENFF_USER` (or a
  related mention) — read the file, apply the same substring replacement.

- **`scripts/skills-core.test.mjs`** (full file, already read, 66 lines) —
  three spots:
  ```js
  test("four open-ff skills exist", () => {
    const names = readdirSync(skillsDir).sort();
    assert.deepEqual(names, ["open-ff-book", "open-ff-lineup", "open-ff-migrate", "open-ff-week"]);
  });
  ```
  and:
  ```js
    const migrate = readFileSync(join(skillsDir, "open-ff-migrate/SKILL.md"), "utf8");
    const week = readFileSync(join(skillsDir, "open-ff-week/SKILL.md"), "utf8");
  ```
  and the comment at line 25: `` skips `open-ff-week`, paths, etc. ``.
  These four directory-name strings **must match the actual renamed
  directories from Step 2** exactly, or this test fails — do Step 2 (the
  directory rename) before touching this file, then update it to match.

- **`README.md`** — every remaining `open-ff`/`OPENFF`/`openff` occurrence
  not already fixed by plans 084/085 (the "What this is" prose, the
  Quickstart/`Put it on the internet` clone URLs, the systemd example unit
  names, the Agent hosts `OPENFF_USER`/`OPENFF_TOKEN`/`mcp add openff`
  lines, the title). Full current occurrences (confirmed by direct read):
  - Line 1: `# open-ff`
  - Line 8: "open-ff is a headless fantasy football operator..."
  - Lines 38-39 and 98-99: `git clone https://github.com/YOUR_ORG/open-ff.git` /
    `cd open-ff` (**use the real URL now**: `https://github.com/ryanwaits/open-leagues.git`
    / `cd open-leagues` — not a generic `YOUR_ORG` placeholder anymore,
    since the actual repo location is known)
  - Lines 62-65: `OPENFF_USER`, `mcp add openff` ×3
  - Lines 75-76: `OPENFF_TOKEN`, `mcp add openff`
  - Line 116: `openff-data` (prose reference to the Docker volume)
  - Lines 170, 173, 178: `open-ff-tick.service` / `/etc/open-ff.env` /
    `open-ff-tick.timer` (systemd example filenames)
  - Line 321: `OPENFF_PUSH_DRY`

- **`AGENTS.project.md:1,3`**:
  ```markdown
  # open-ff — project notes for agents

  Product name is **open-ff**. License is MIT. This is a self-hosted fantasy
  football league desk. One deploy hosts many leagues.
  ```

- **`src/lib/agent/context-prompt.md:1-4`**:
  ```markdown
  # open-ff agent context

  open-ff is a hosted fantasy football league: draft, lineups, waivers/FAAB,
  trades, a matchup book, and an event diary. Mechanics live as named primitives
  ```
  This file is read as agent-facing context prose (referenced by the skill
  files as "Ceiling and invariants") — real agents will read this text, not
  just developers, so it must read naturally as "open-leagues," not be a
  clumsy substitution.

- **Skill directories** (filesystem, confirmed via `ls`/`readlink`):
  ```
  src/lib/agent/skills/open-ff-migrate/SKILL.md   (frontmatter: name: open-ff-migrate)
  src/lib/agent/skills/open-ff-week/SKILL.md      (frontmatter: name: open-ff-week)
  src/lib/agent/skills/open-ff-book/SKILL.md      (frontmatter: name: open-ff-book)
  src/lib/agent/skills/open-ff-lineup/SKILL.md    (frontmatter: name: open-ff-lineup)
  .grok/skills/open-ff-migrate -> ../../src/lib/agent/skills/open-ff-migrate  (symlink)
  .grok/skills/open-ff-week    -> ../../src/lib/agent/skills/open-ff-week     (symlink)
  .grok/skills/open-ff-book    -> ../../src/lib/agent/skills/open-ff-book     (symlink)
  .grok/skills/open-ff-lineup  -> ../../src/lib/agent/skills/open-ff-lineup   (symlink)
  ```
  Each `SKILL.md`'s YAML frontmatter has a `name: open-ff-<x>` field — check
  each file when you get there; do not assume the exact frontmatter shape,
  read it.

- Conventions: Biome (`bun run lint`), TypeScript strict (`bun run
  typecheck`), tests are `.test.mjs` + `node:test`, `bun@1.3.10`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | matches `7c8e7e9` baseline (10/177/6) |
| Tests | `bun test src scripts` | pass, including the two renamed skill tests |
| Build | `bun run build` | exit 0 |
| Sweep for anything missed | `grep -rn 'open-ff\|OPENFF\|openff' --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.md' --include='*.yml' --include='*.yaml' --include='Dockerfile' src scripts README.md AGENTS.project.md docker-compose.yml Dockerfile render.yaml .env.example` | after all steps, the **only** remaining hits should be inside `plans/*.md` (historical record, out of scope — see Scope) and the `ff_`/`off_` identifiers plan 087 owns |

## Scope

**In scope**:
- `package.json` (name field only)
- `docker-compose.yml`, `Dockerfile`, `scripts/docker-entrypoint.sh`,
  `.env.example`, `render.yaml`
- `scripts/mcp.mjs`, `src/routes/api/mcp.ts`
- `src/lib/league/ops.server.ts`, `src/lib/push/send.server.ts`
- `src/lib/agent/dispatch.ts`, `src/lib/agent/dispatch.test.mjs`,
  `scripts/mcp-http.test.mjs`, `scripts/skills-core.test.mjs`
- `README.md`, `AGENTS.project.md`, `src/lib/agent/context-prompt.md`
- The four skill directories (rename + symlinks + frontmatter — Step 2)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope** (do not touch, even where it looks related):
- Any `ff_*` database table/column/index name, anywhere (migrations/,
  every `*.server.ts` that queries them) — **plan 087's territory**.
- The `off_` bearer-token prefix in `src/lib/auth/tokens.server.ts`,
  `src/lib/auth/verify.server.ts`, `src/routes/api/mcp.ts` (lines 2, 34, 36
  only — the `name: "openff"` on line ~48 of that file IS in scope, see
  above; don't confuse the two) — **plan 087's territory**.
- `plans/*.md` — historical planning record. Do **not** rewrite past plan
  files to say "open-leagues" retroactively; they're a record of what was
  true when written. `plans/README.md` gets only its normal status-row
  update for this plan, nothing else.
- `PRODUCT.md`, `AGENTS.md`, `DESIGN.md`, `src/lib/agent/CATALOG.md`,
  `src/skin/SKILL.md` — confirmed zero mentions of the old name by direct
  read; nothing to change, don't touch them.
- Any visual/structural README redesign — that's a separate, later plan.
  This plan only fixes identity strings in the README, it does not
  restructure it.

## Git workflow

Current branch; one commit, e.g.
`chore: rename product identity open-ff to open-leagues`. Do NOT push
without reading the STOP conditions below first — **this repo's pushes to
`main` auto-deploy to `leagues.waits.dev` via Render** (`render.yaml`:
`autoDeploy: true`). This plan's changes are safe to auto-deploy (no schema
change, and `render.yaml`'s `OPENFF_SELF_TICK` key rename is included in
this same commit so the live env stays consistent) — but flag this fact in
your NOTES either way so the reviewer double-checks before advising a push.

## Steps

### Step 1: the mechanical substitutions

For every file listed in "Current state" above except the skill
directories (handled in Step 2), apply the exact-string substitution rule
from "Why this matters": `open-ff` → `open-leagues`, `OPENFF` →
`OPENLEAGUES` (both case-sensitive, whole-word — `OPENFF_USER` becomes
`OPENLEAGUES_USER`, never partially). Specific per-file notes:

- `package.json`: only the `"name": "open-ff"` line.
- `docker-compose.yml`: both `openff-data` occurrences → `open-leagues-data`;
  `OPENFF_SELF_TICK` → `OPENLEAGUES_SELF_TICK`.
- `Dockerfile`: the `OPENFF_DEV` comment and the `OPENFF_SELF_TICK=1` ENV line.
- `scripts/docker-entrypoint.sh`: the one `OPENFF_DEV` check.
- `.env.example`: `OPENFF_SELF_TICK=` → `OPENLEAGUES_SELF_TICK=`. Leave the
  `off_…` comment about agent host tokens untouched.
- `render.yaml`: only `key: OPENFF_SELF_TICK` → `key: OPENLEAGUES_SELF_TICK`
  — everything else in this file already says `open-leagues`, do not touch
  it.
- `scripts/mcp.mjs`: all six spots listed in "Current state" — the doc
  comment's env var name and `mcp add openff` example, the
  `process.env.OPENFF_USER` read, the missing-var string, the
  `openff mcp:` error prefix, `Server({ name: "openff", ... })`, and the
  trailing comment. Result: `mcp add open-leagues`, `OPENLEAGUES_USER`,
  `open-leagues mcp: missing ...`, `Server({ name: "open-leagues", ... })`.
- `src/routes/api/mcp.ts`: only the `Server({ name: "openff", ... })` call
  → `Server({ name: "open-leagues", ... })`. Do not touch the `off_`
  mentions elsewhere in this file.
- `src/lib/league/ops.server.ts`: the doc comment + the
  `process.env.OPENFF_SELF_TICK` check.
- `src/lib/push/send.server.ts`: the `OPENFF_PUSH_DRY` doc comment and its
  matching `process.env.OPENFF_PUSH_DRY` check (find it near the comment).
- `src/lib/agent/dispatch.ts`, `dispatch.test.mjs`, `scripts/mcp-http.test.mjs`:
  every `OPENFF_USER` substring → `OPENLEAGUES_USER`.
- `README.md`: every occurrence listed in "Current state" — **note the two
  clone-URL lines use the real repo now**:
  `git clone https://github.com/ryanwaits/open-leagues.git` /
  `cd open-leagues` (not a `YOUR_ORG` placeholder — replace both instances,
  lines ~38-39 and ~98-99).
- `AGENTS.project.md`: lines 1 and 3.
- `src/lib/agent/context-prompt.md`: lines 1 and 3 — reword naturally
  ("open-leagues is a hosted fantasy football league: ..."), not a
  clumsy mid-sentence substitution.

**Verify**: `bun run typecheck` → 0 (this alone won't catch string-literal
issues, see the sweep grep below);
`grep -c 'OPENFF\|open-ff\|openff' package.json docker-compose.yml Dockerfile scripts/docker-entrypoint.sh .env.example` → `0` for each.

### Step 2: rename the four skill directories

For each of `migrate`, `week`, `book`, `lineup`:

1. `git mv src/lib/agent/skills/open-ff-<x> src/lib/agent/skills/open-leagues-<x>`
2. Inside the moved `SKILL.md`, update its YAML frontmatter `name:
   open-ff-<x>` → `name: open-leagues-<x>` (read the file first to confirm
   the exact frontmatter key/shape — don't assume).
3. Recreate the corresponding `.grok/skills/` symlink: remove the old
   symlink (`rm .grok/skills/open-ff-<x>`) and create a new one pointing at
   the renamed directory (`ln -s ../../src/lib/agent/skills/open-leagues-<x> .grok/skills/open-leagues-<x>`)
   — match the exact relative target path the original symlinks used
   (confirmed: `../../src/lib/agent/skills/<name>`).

**Verify**: `ls src/lib/agent/skills/` → `open-leagues-book open-leagues-lineup open-leagues-migrate open-leagues-week`;
`ls -la .grok/skills/` shows the four symlinks pointing at the renamed
targets; `readlink .grok/skills/open-leagues-migrate` →
`../../src/lib/agent/skills/open-leagues-migrate`.

### Step 3: update `scripts/skills-core.test.mjs` to match

Now that Step 2 is done, update the three spots identified in "Current
state":

```js
test("four open-leagues skills exist", () => {
  const names = readdirSync(skillsDir).sort();
  assert.deepEqual(names, [
    "open-leagues-book",
    "open-leagues-lineup",
    "open-leagues-migrate",
    "open-leagues-week",
  ]);
});
```

and:

```js
  const migrate = readFileSync(join(skillsDir, "open-leagues-migrate/SKILL.md"), "utf8");
  const week = readFileSync(join(skillsDir, "open-leagues-week/SKILL.md"), "utf8");
```

and update the comment at line 25 to say `` open-leagues-week `` instead of
`` open-ff-week ``.

**Verify**: `bun test scripts/skills-core.test.mjs` → all pass.

### Step 4: full gate, sweep, then commit

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0.

Then the sweep: `grep -rn 'open-ff\|OPENFF\|openff' --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.md' --include='*.yml' --include='*.yaml' src scripts README.md AGENTS.project.md docker-compose.yml Dockerfile render.yaml .env.example`
— confirm every remaining hit (if any) is either (a) inside `plans/*.md`
(not swept by this command since it's not in the path list — that's
correct, leave those alone) or (b) an `ff_`/`off_` identifier this plan
deliberately didn't touch. If you find a hit in an in-scope file that
Step 1–3 should have caught, fix it before moving on.

Commit (message above). Update the 086 row in `plans/README.md`.

## Test plan

- `scripts/skills-core.test.mjs`'s three tests, updated in Step 3, must
  pass with the new directory names.
- Full `bun test src scripts` green, including `dispatch.test.mjs` and
  `scripts/mcp-http.test.mjs` (both had `OPENFF_USER` substring changes —
  their assertions match on the substring, so they should still pass
  unchanged in logic, just matching the new string).
- No new tests needed beyond what already exists — this is a rename, not
  new behavior.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -rn 'OPENFF\|open-ff\|openff'` across every in-scope file
      (see Step 4's sweep command) returns nothing outside `plans/*.md`
      and the deliberately-untouched `ff_`/`off_` identifiers
- [ ] `ls src/lib/agent/skills/` shows the four `open-leagues-*` names;
      `.grok/skills/` symlinks resolve correctly
- [ ] `package.json`'s `"name"` is `"open-leagues"`
- [ ] `render.yaml`'s `OPENFF_SELF_TICK` key is now `OPENLEAGUES_SELF_TICK`
      (and nothing else in that file changed — it already said
      `open-leagues` everywhere else)
- [ ] README's clone URL is the real `github.com/ryanwaits/open-leagues`,
      not a `YOUR_ORG` placeholder
- [ ] `git diff --stat` touches only the in-scope files (plus the four
      skill-directory renames, which `git mv` tracks as renames)

## STOP conditions

- The drift check shows any in-scope file no longer matches the excerpts
  above.
- You find yourself editing anything under `migrations/`, any `ff_*`
  identifier, or any `off_` token-prefix mention — that's plan 087, STOP
  and report rather than folding it in here.
- You find yourself editing any file under `plans/` other than
  `plans/README.md`'s status row — historical plans are a record, not
  living docs; leave them.
- The `render.yaml` diff ends up touching anything besides the one
  `OPENFF_SELF_TICK` key — that file's `open-leagues`/`open-leagues-pg`/
  `leagues.waits.dev` values are already correct and load-bearing for the
  live deploy; don't "helpfully" touch them.
- You're about to run `git push` — don't, without saying so explicitly in
  your report first. Land the commit locally; pushing (which auto-deploys
  to `leagues.waits.dev` per `render.yaml`) is the reviewer's call, not
  yours, even though this plan's changes are believed safe to deploy.

## Maintenance notes

- Plan 087 (separately scoped, not yet written) handles the actual
  database-level rename: the 26 `ff_*` tables/indexes and the `off_`
  agent-token prefix. That is a live-schema migration against
  `open-leagues-pg` and needs its own careful, standalone review — do not
  let anyone fold it into a "quick follow-up" on this plan.
- Anyone with an **existing local Docker Compose deployment** using the
  `openff-data` volume will get a brand-new empty volume the next time
  they `docker compose up` after pulling this change, unless they manually
  rename the Docker volume first (`docker volume` commands, or edit their
  local compose override) — this was a known, accepted tradeoff when this
  rename was scoped, not an oversight.
- The MCP server's advertised name (`Server({ name: "open-leagues", ... })`
  in both `scripts/mcp.mjs` and `src/routes/api/mcp.ts`) and the
  `mcp add open-leagues` CLI examples are now kept in sync by this plan —
  if either drifts again in the future, re-sync them, since users copy the
  README's CLI examples verbatim.
- The next step after this plan (per the operator's own sequencing): a
  README/docs visual restructure (short showcase-style README + real
  screenshots + a `docs/` split for deep reference material), then a live
  Codex/ChatGPT connector demo against the renamed MCP server, then
  (separately, carefully) plan 087's database migration.
