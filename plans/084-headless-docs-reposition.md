# Plan 084: Reposition the README as a headless operator, fix the stale migrate-skill claim

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b04b795..HEAD -- README.md src/lib/agent/skills/open-ff-migrate/SKILL.md .grok/skills/open-ff-migrate/SKILL.md`
> If any diff exists, compare the "Current state" excerpts below against
> the live files before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: M (one new README section + relocating three existing
  sections verbatim + a two-file text fix that must stay byte-identical
  across its mirror)
- **Risk**: LOW — this is prose/doc content, no source logic changes. The
  only thing that could go wrong is a factual claim not matching what
  plans 081–083 actually shipped, or the two `SKILL.md` copies drifting out
  of sync (there is no automated test for that mirror — it's a manual
  convention, confirmed by direct `diff` today).
- **Depends on**: plans/081, 082, 083 (all landed — the accurate 57/76 MCP
  coverage figure and the ESPN/rebuild-on-MCP fact this plan documents
  don't exist until they did)
- **Category**: docs, direction (headless operator positioning)
- **Planned at**: commit `b04b795`, 2026-08-26

## Why this matters

The repo's actual internal design thesis — "a headless catalog (MCP) can
run the league's verbs; the PWA stays client zero" (`PRODUCT.md` line 11) —
has never made it to the README. Today's README opens with "A self-hosted
fantasy football league desk" and buries the MCP/agent-hosting sections
~200 lines down, after Docker install steps, Google sign-in, and Web Push.
Anyone skimming the README sees "another self-hosted fantasy app," not
"an operator you can put any client on top of." Separately, plan 083 just
wired `previewEspn`/`importEspn`/`previewRebuild`/`importRebuild` onto MCP
— but `src/lib/agent/skills/open-ff-migrate/SKILL.md` (and its `.grok/`
mirror) still tell an agent those four verbs "are not on the MCP socket,"
which is now false and would make an agent route a fully-MCP-capable ESPN
or rebuild import to the PWA unnecessarily.

This plan does two things: (1) gives the README an honest, accurate
"headless operator" framing up front, with a concrete pseudocode walkthrough
instead of just a claim, and relocates the existing Agent hosts/skills
sections so they're not buried; (2) fixes the two stale `SKILL.md` copies.

**What this plan does not do**: invent new capabilities, exaggerate
coverage (the copy below says "57 of 76," not "the whole league," matching
plan 081's own honest framing), or touch `PRODUCT.md`/`AGENTS.md` (internal
docs, out of scope) or marketing copy for an X post (that's the next,
separate step after this lands).

## Current state

All excerpts read directly at commit `b04b795`.

- `README.md:1-4` — the current opening (full file is 257 lines; already
  read in full):
  ```markdown
  # open-ff

  A self-hosted fantasy football league desk. Sign in, create a league, invite
  friends to **this** origin. One deploy can host many leagues.

  ## Put it on the internet
  ```
  Immediately after line 4, `## Put it on the internet` begins the Docker
  install walkthrough.

- `README.md:211-246` — the three sections this plan relocates, **verbatim,
  no wording changes** (only their position in the file changes):
  ```markdown
  ## Agent hosts (local)

  Point Codex / Claude / Grok at the same catalog over MCP stdio (hosted Postgres only — bun cannot boot PGLite):

  ```sh
  export DATABASE_URL=postgres://…
  export OPENFF_USER=<your user id>
  codex mcp add openff --command bun --args scripts/mcp.mjs
  # Claude: claude mcp add openff -- bun scripts/mcp.mjs
  # Grok:   grok mcp add openff -- bun scripts/mcp.mjs
  ```

  `OPENFF_USER` is the Better Auth `user.id` (copy from the `user` table / local seed until settings shows it).

  ## Agent hosts (hosted)

  Same `AGENT_CORE` catalog over Streamable HTTP in **JSON response mode** (request/response; no SSE — Vercel-friendly) with a personal `off_` token (mint in the app; 041):

  ```sh
  export OPENFF_TOKEN=off_…
  codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
  ```

  Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`, leave Client ID & Secret blank, authorize with the bearer token. Grok: `--transport http` against the same URL (bearer via env). Cookie sessions are not accepted — `Authorization: Bearer off_…` only.

  ## Agent skills

  Playbooks for migrate / lineup / book / week live under
  `src/lib/agent/skills/` (and are mirrored in `.grok/skills/` for this repo).
  Copy or symlink into a host skills dir:

  ```sh
  # Codex:  cp -R src/lib/agent/skills/* ~/.codex/skills/
  # Claude: cp -R src/lib/agent/skills/* ~/.claude/skills/
  # Grok:   already in .grok/skills/ of this repo; else ~/.grok/skills/
  ```
  ```
  Immediately before `## Agent hosts (local)` (line 211) is the end of the
  `## Notifications (Web Push)` section; immediately after `## Agent
  skills` (line 246) is `## Check` (line 248). After this plan, `##
  Notifications (Web Push)` connects directly to `## Check`, and the three
  relocated sections sit right after the new section this plan adds.

- `src/lib/agent/skills/open-ff-migrate/SKILL.md` (51 lines, full file) —
  two spots need fixing:

  The decision table (lines 27–32):
  ```markdown
  | Source | Connect | File fallback |
  |---|---|---|
  | **Sleeper** | League id → `previewImport` then `importLeague` (`confirm: true`) on MCP | Paste/PDF rebuild on PWA `/import` |
  | **ESPN** | Public league id on PWA `/import`; if private, SWID+espnS2 **once** (not saved) | Same `/import` rebuild paste |
  | **Yahoo** | OAuth **not shipped** (YDN app not approved) | Paste standings/rosters on `/import` |
  | **NFL.com** | Do **not** scrape. Hop: espn.com/importnfl → our ESPN import | Or paste on `/import` |
  ```

  Numbered step 4 (lines 40–44):
  ```markdown
  4. **ESPN / rebuild / Yahoo paste / NFL hop:** those commit verbs are
     not on the MCP socket. Tell them to use the PWA `/import` page
     (`previewEspn` / `importEspn` / `previewRebuild` / `importRebuild`
     run there). Never ask them to paste cookies into chat; never echo
     cookies. Never fetch `fantasy.nfl.com` HTML.
  5. Optional invite allowlist: `addAllowlistEmail` is PWA settings
     only — not MCP. Point them at league settings. **No emails from
     Sleeper/ESPN/Yahoo APIs.**
  ```
  Both are now inaccurate: plan 083 (commit `b04b795`) wired `previewEspn`,
  `importEspn`, `previewRebuild`, and `importRebuild` onto MCP. Yahoo (no
  OAuth app approved) and the NFL.com hop are still PWA-only — those two
  did **not** change.

- `.grok/skills/open-ff-migrate/SKILL.md` — confirmed byte-identical to
  the file above via `diff` at `b04b795` (no automated test enforces this;
  it's a manual mirror). Apply the identical fix to both.

- Conventions: this repo has no `docs/` directory — README.md is the sole
  user-facing doc (confirmed: no other `.md` outside `plans/`, root-level
  internal docs (`PRODUCT.md`, `AGENTS.md`, `DESIGN.md`), and
  `src/lib/agent/`'s own `.md` files). Keep new content in README.md, don't
  introduce a new doc file.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Diff the two SKILL.md copies | `diff src/lib/agent/skills/open-ff-migrate/SKILL.md .grok/skills/open-ff-migrate/SKILL.md` | no output (identical) |
| Lint (README isn't linted by Biome, but confirm nothing else broke) | `bun run lint` | matches pre-existing baseline (10 errors / 177 warnings / 6 infos at `b04b795` — confirm via `git stash` comparison, same technique used in plans 081–083) |
| Full test suite (sanity — this plan shouldn't touch anything tested) | `bun test src scripts` | same pass/fail shape as baseline |

## Scope

**In scope**:
- `README.md` (new section + relocating three existing sections verbatim)
- `src/lib/agent/skills/open-ff-migrate/SKILL.md` (the table + step 4 fix)
- `.grok/skills/open-ff-migrate/SKILL.md` (the identical fix, kept in sync)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- `PRODUCT.md`, `AGENTS.md`, `AGENTS.project.md`, `DESIGN.md` — internal
  docs, not touched by this plan.
- Any other `SKILL.md` under `src/lib/agent/skills/` (`open-ff-lineup`,
  `open-ff-book`, `open-ff-week`) — none of them reference the
  ESPN/rebuild-on-MCP claim; don't touch them speculatively.
- `src/lib/agent/CATALOG.md` / `context-prompt.md` — already accurate,
  test-enforced (`catalog.test.mjs`), not part of this plan.
- Any code file — this is a docs-only plan.
- Drafting the X/social post — that's the next step after this plan lands,
  not part of it.

## Git workflow

Current branch; one commit, e.g.
`docs: reposition README as a headless operator, fix stale migrate-skill claim`.
Do NOT push.

## Steps

### Step 1: add "## What this is" to `README.md`, right after the opening paragraph

Insert this new section between the existing opening paragraph (line 4,
ending "...One deploy can host many leagues.") and `## Put it on the
internet` (line 6):

```markdown
## What this is

open-ff is a headless fantasy football operator, not just another league
app. Postgres is the source of truth, FAAB is conserved (nobody can invent
free money), and every scoring, trade, waiver, and draft decision runs
through one engine — not a UI. Migrate a league in from Sleeper or ESPN, or
rebuild one from a paste/PDF of a historical record, and from then on this
is the source of truth; the old host is done.

What runs on top of that engine isn't fixed. The PWA in this repo is
"client zero," not the product — it ships in three visual skins today
(Ledger, Box Score, Console), proof the same data doesn't dictate one look.
More concretely: an MCP server (stdio for your own box, HTTP with a
personal bearer token for a friend's Claude/Codex/Grok) exposes the league
as callable primitives — 57 of the 76 documented verbs are wired as of this
writing, covering the day-to-day manager loop end to end:

```
context = getAgentContext(leagueId)        # seat, purse, standings, recent events
team    = getTeam(leagueId, context.rosterId, week)
# decide, using getProjections / getWire / getWeekProjections ...
sitPlayer(leagueId, benchedPlayerId)
startPlayer(leagueId, startingPlayerId)
```

Read your team, read the book, set your lineup, work the waiver wire, vote
on a trade, place a wager, migrate a league in — all without a browser. See
[Agent hosts (local)](#agent-hosts-local) below for how to connect one.
```

Note the pseudocode block above uses a plain fenced code block with no
language tag (it's illustrative, not a real script — don't mark it `sh` or
`js`).

**Verify**: `sed -n '1,10p' README.md` shows the new section's heading
appears before `## Put it on the internet`; `grep -c '^## What this is'
README.md` → `1`.

### Step 2: relocate the three "Agent" sections

Cut `## Agent hosts (local)` through the end of `## Agent skills` (the
whole block quoted in "Current state" above, currently README.md lines
211–246) from its current position (right after `## Notifications (Web
Push)`, right before `## Check`), and paste it **verbatim, unchanged**
immediately after the new `## What this is` section from Step 1 (i.e.,
right before `## Put it on the internet`).

After this step, the README's section order should read (top to bottom):
title → opening paragraph → **What this is** → **Agent hosts (local)** →
**Agent hosts (hosted)** → **Agent skills** → Put it on the internet →
Local without Docker → Advanced: tick without Docker → Players and
imports → Book → Google sign-in → Notifications (Web Push) → Check.

Do not reword anything in the moved block — this step is a pure relocation.

**Verify**: `grep -n '^## ' README.md` — confirm the order matches the
list above exactly; `wc -l README.md` should be unchanged from its
pre-Step-1 line count plus exactly the number of lines Step 1 added (moving
a block doesn't change the file's total line count).

### Step 3: fix `src/lib/agent/skills/open-ff-migrate/SKILL.md`

Replace the decision table (current lines 27–32) with:

```markdown
| Source | Connect | File fallback |
|---|---|---|
| **Sleeper** | League id → `previewImport` then `importLeague` (`confirm: true`) on MCP | Paste/PDF rebuild on MCP or PWA `/import` |
| **ESPN** | League id + season → `previewEspn` then `importEspn` (`confirm: true`) on MCP; private leagues need SWID+espnS2 **once** (never saved, never echoed) | Same rebuild path, below |
| **Rebuild (paste/PDF/known record)** | `previewRebuild` then `importRebuild` (`confirm: true`) on MCP | Same, via PWA `/import` if MCP isn't available |
| **Yahoo** | OAuth **not shipped** (YDN app not approved) | Paste standings/rosters on `/import` |
| **NFL.com** | Do **not** scrape. Hop: espn.com/importnfl → our ESPN import | Or paste on `/import` |
```

Replace numbered step 4 (current lines 40–44) with:

```markdown
4. **ESPN:** call `previewEspn` with the league id + season (swid/espnS2
   only if the league is private — ask once, never store it, never echo it
   back in any message). Show the preview; after they say yes, call
   `importEspn` with `confirm: true`.
5. **Paste/PDF rebuild:** call `previewRebuild` with whatever they can give
   you (paste, a known-record summary, or a base64 PDF). Show the preview;
   after they say yes, call `importRebuild` with `confirm: true`.
6. **Yahoo / NFL.com:** still commit-only on the PWA `/import` page — Yahoo
   has no OAuth app approved, and NFL.com is a hop through the ESPN import,
   not a direct MCP path. Point them there. Never ask them to paste cookies
   into chat; never echo cookies. Never fetch `fantasy.nfl.com` HTML.
```

The old step 5 (allowlist) becomes step 7 — renumber it, wording unchanged:

```markdown
7. Optional invite allowlist: `addAllowlistEmail` is PWA settings
   only — not MCP. Point them at league settings. **No emails from
   Sleeper/ESPN/Yahoo APIs.**
```

**Verify**: `grep -n 'not on the MCP socket' src/lib/agent/skills/open-ff-migrate/SKILL.md` → no matches (the stale claim is gone).

### Step 4: apply the identical fix to `.grok/skills/open-ff-migrate/SKILL.md`

Make `.grok/skills/open-ff-migrate/SKILL.md` byte-identical to the file you
just edited in Step 3 — either copy it over (`cp
src/lib/agent/skills/open-ff-migrate/SKILL.md
.grok/skills/open-ff-migrate/SKILL.md`) or apply the same edits by hand.
Copying is simpler and less error-prone; either is fine as long as the
result is identical.

**Verify**: `diff src/lib/agent/skills/open-ff-migrate/SKILL.md .grok/skills/open-ff-migrate/SKILL.md` → no output.

### Step 5: full gate, then commit

`bun run lint` — compare against the `b04b795` baseline (10 errors / 177
warnings / 6 infos) via `git stash`/`git stash pop` the same way plans
081–083 did; confirm no new issues (README/`.md` files aren't linted by
Biome, so this should be a pure no-op, but confirm rather than assume).
`bun test src scripts` — same pass/fail shape as baseline (this plan
touches no test-covered code). Commit (message above). Update the 084 row
in `plans/README.md`.

## Test plan

- No new automated tests — this is prose content with no existing test
  harness around it (`catalog.test.mjs` covers `CATALOG.md`, not
  `README.md` or the migrate `SKILL.md`).
- Manual verification: read the final `README.md` top-to-bottom once and
  confirm it reads coherently in the new order (no dangling cross-reference,
  no orphaned heading) — this is a judgment call the STOP conditions below
  don't automate, so actually do it, don't skip it.

## Done criteria

- [ ] `grep -c '^## What this is' README.md` → 1
- [ ] `grep -n '^## ' README.md` shows the section order from Step 2
- [ ] `grep -n 'not on the MCP socket' src/lib/agent/skills/open-ff-migrate/SKILL.md` → no matches
- [ ] `diff src/lib/agent/skills/open-ff-migrate/SKILL.md .grok/skills/open-ff-migrate/SKILL.md` → no output
- [ ] `git diff --stat` touches only the three in-scope files (four
      counting `plans/README.md`)
- [ ] `bun run lint` and `bun test src scripts` show no change from the
      `b04b795` baseline

## STOP conditions

- The drift check shows `README.md` or either `SKILL.md` no longer match
  the excerpts above (someone else edited docs concurrently) — reconcile
  is not your call.
- You find yourself wanting to change the "57 of 76" figure — it must match
  `grep -c '^  "' src/lib/agent/core.ts` at the time you run this plan; if
  that number isn't 57, STOP and report rather than silently updating the
  copy (a drifted number means something landed between 083 and this plan
  that isn't accounted for here).
- You find yourself wanting to add marketing language beyond what's given
  in Step 1's exact text (superlatives, unverified claims, "the best way
  to...") — don't; this plan's copy is deliberately plain and factual, and
  embellishing it is out of scope (that's the X-post work, later, and it
  goes through its own review).
- You find yourself wanting to reorder or reword any *other* README
  section beyond the Step 2 relocation — don't; a full README restructure
  beyond what's specified here is a bigger, separate decision.

## Maintenance notes

- If plan 083's tool count ever changes (more primitives wired, or one
  removed), the "57 of 76" line in README.md's new "What this is" section
  needs a matching update — nothing enforces this automatically; a future
  reviewer should treat a catalog-coverage plan and this copy as coupled.
- The `.grok/skills/` mirror has no automated parity test today. If this
  drift (this plan existing at all) happens again, consider adding one —
  flagged here, not built, since it's outside this plan's scope.
- Next natural step after this plan (per the operator's own stated
  sequencing): a `/showcase`-produced visual explainer artifact, then
  circling back to drafting the first public/X post — both come after this
  plan, using its corrected copy as the source of truth for claims.
