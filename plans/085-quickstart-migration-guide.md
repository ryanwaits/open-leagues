# Plan 085: Add a Quickstart and turn the import table into a real migration guide

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 37264ee..HEAD -- README.md`
> If any diff exists, compare the "Current state" excerpts below against
> the live file before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: M (one new short section + expanding one existing section's
  prose; the reference table is kept, not rewritten)
- **Risk**: LOW — prose-only, no source logic changes. The only real risk
  is copy that doesn't match the actual `/import` UI (tab labels, field
  names) — every UI label cited below was read directly from
  `src/routes/import.tsx`, not guessed.
- **Depends on**: plans/084-headless-docs-reposition.md (this plan builds
  on 084's section order — landed at `a4a4915`, confirmed via `git log`)
- **Category**: docs
- **Planned at**: commit `37264ee`, 2026-08-26

## Why this matters

084 gave the README an honest headless-operator thesis and surfaced the
agent-hosting sections, but two things a first-time reader actually needs
are still missing:

1. **A quickstart.** The fastest path to a running league is currently
   buried inside "Put it on the internet," mixed in with the full env-var
   reference table and the Vercel alternative. Someone skimming the README
   has to read past all of that to find the three commands that actually
   get them started.
2. **A migration guide that reads like a guide.** "Players and imports" is
   a dense reference table — accurate, but not something a person who just
   got frustrated trying to find "transfer commissioner" on ESPN's website
   can actually follow step by step. It has no narrated path, and it
   doesn't mention the one detail that saves someone the most pain on a
   private ESPN league: you can flip the league public for one minute
   instead of hunting for SWID/espn_s2 cookies.

This plan adds a short Quickstart section and expands the import table
into a real per-source walkthrough, using the actual `/import` page's own
UI labels (confirmed by reading `src/routes/import.tsx` directly — the
"rebuild" source is labeled **"Draft"** in the UI, not "Rebuild"; this
plan's copy uses "Draft" wherever it's user-facing and "rebuild" only when
naming the actual MCP tool/internal term, exactly the split the source
file itself makes).

## Current state

All excerpts read directly at commit `37264ee`.

- `README.md:1-34` — after 084, the file opens: title → one-line intro →
  `## What this is` (the thesis section, ending with a link to "Agent hosts
  (local)") → `## Agent hosts (local)` (line 35). This plan's new
  `## Quickstart` section goes **between** the end of `## What this is`
  and the start of `## Agent hosts (local)`.

- `README.md:72` — `## Put it on the internet` is the Docker walkthrough
  Quickstart will link to for full detail (env var table, Vercel
  alternative). This plan does not modify that section's content, only
  links to it.

- `README.md:168-188` — `## Players and imports`, full current text:
  ```markdown
  ## Players and imports

  Sleeper is the player/week pipe (outbound HTTPS). No member needs a
  Sleeper account. ESPN cookies are import-only; they are not used at
  runtime after import.

  Every source becomes one canonical import pack, then commits into the
  ledger. Connect is one-way extract — we do not keep polling the old host.
  File/paste rebuild is always the fallback when connect fails.

  | Source | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
  |---|---|---|---|---|---|---|---|
  | Sleeper | league id, no auth | rebuild paste | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | optional one `previous_league_id` via `includeHistory` (default off) |
  | ESPN | public **or** SWID+espnS2 one-shot, not saved | rebuild paste | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
  | Rebuild | — | paste, PDF, known recap | yes | scoring **preset** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
  | Yahoo | OAuth not shipped | paste via rebuild | via paste | via paste | via paste | no | no |
  | NFL.com | hop: espn.com/importnfl → ESPN import (no HTML scrape) | paste via rebuild | via ESPN/paste | via ESPN/paste | via ESPN/paste | via ESPN | no |

  Manager emails are never pulled from these APIs — allowlist is typed
  post-import by the commissioner.
  ```
  Immediately before this section (line 167, blank) is the end of
  `## Advanced: tick without Docker`; immediately after it (line 189) is
  `## Book`.

- `src/routes/import.tsx` (confirmed by direct read) — the real UI:
  - Line 412–414: the three source tabs, exact labels:
    `["rebuild", "Draft"], ["sleeper", "Sleeper"], ["espn", "ESPN"]` — the
    internal `source` value is `"rebuild"` but the **label shown to the
    user is "Draft."**
  - Lines 848–856: ESPN tab fields — "ESPN league ID or URL" (placeholder
    `fantasy.espn.com/football/league?leagueId=…`).
  - Lines 877–879: the exact copy already shown to a user on the ESPN tab:
    *"Private leagues need SWID + espn_s2, or flip the league public for
    one minute. A recap paste is simpler if you just want the names."*
  - Lines 834: Sleeper tab field — "Sleeper league ID".
  - Lines 751, 826: the Draft/rebuild tab accepts "ESPN draft recap, team
    blocks, or a CSV" / "ESPN recap lines, or `Team | Manager | W-L`" paste,
    or a PDF (print-to-PDF is often an image, flagged in the UI copy too).
  - A `step === "review"` state exists on all three tabs — confirming the
    real flow is fill in → preview/review → confirm, matching what this
    plan's copy describes.
  - `src/routes/new.tsx:58` — the `/new` page links to `/import`, confirming
    the `/new` → `/import` path this plan's Quickstart references.

- Conventions: this repo has no `docs/` directory — README.md is the sole
  user-facing doc (same as 084's finding, still true).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint (README isn't linted by Biome, but confirm nothing else broke) | `bun run lint` | matches pre-existing baseline (`git stash` comparison, same technique as 084) |
| Full test suite (sanity) | `bun test src scripts` | same pass/fail shape as baseline |

## Scope

**In scope**:
- `README.md` (one new section + expanding one existing section's prose;
  the table stays, reworded only where marked below)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- `src/routes/import.tsx` or any other application code — this plan
  documents the existing flow, it does not change it.
- Any other README section (Agent hosts, Put it on the internet, Book,
  Google sign-in, Notifications, Check) beyond adding the one link from
  Quickstart — no rewording of those sections.
- A separate `docs/` file — same convention as 084, keep it in README.md.
- The X/social post — still a separate, later step.

## Git workflow

Current branch; one commit, e.g.
`docs: add a quickstart and a real migration guide`. Do NOT push.

## Steps

### Step 1: add "## Quickstart" between "What this is" and "Agent hosts (local)"

Insert this new section immediately after the last line of `## What this
is` (the line ending "...for how to connect one.") and immediately before
`## Agent hosts (local)`:

```markdown
## Quickstart

```sh
git clone https://github.com/YOUR_ORG/open-ff.git
cd open-ff
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends to this
origin. That's a running league — see
[Put it on the internet](#put-it-on-the-internet) for env vars and the
Vercel alternative.

Already have a league on Sleeper or ESPN, or just a screenshot/paste of an
old season? See [Migrating your league](#migrating-your-league).

Want to run this with Claude, Codex, or Grok instead of (or alongside) the
web app? Any signed-in member mints their own token from `/account` — see
[Agent hosts (local)](#agent-hosts-local) or
[Agent hosts (hosted)](#agent-hosts-hosted).
```

**Verify**: `grep -c '^## Quickstart' README.md` → `1`;
`grep -n '^## ' README.md` shows `## Quickstart` between `## What this is`
and `## Agent hosts (local)`.

### Step 2: expand "## Players and imports" into "## Migrating your league"

Replace the section (current lines 168–188, quoted in full in "Current
state" above) with:

```markdown
## Migrating your league

Every source becomes one canonical import pack, then commits into the
ledger once. Connect is one-way: we extract, we don't keep polling the old
host, and after commit **this is the source of truth** — sit/start, FAAB,
trades, and the book all happen here from then on. Sleeper stays the
player/week data pipe either way (outbound HTTPS only; no member needs a
Sleeper account). ESPN cookies are import-only and are never used again
after the import completes.

**From Sleeper** — no login needed, just the league id:

1. `/new` → **Import** → **Sleeper** tab → paste the league id.
2. Review the preview (teams, scoring, rosters) and confirm.
3. Optionally include one prior season's history.

(Same two steps over MCP or an agent skill: `previewImport`, then
`importLeague` with `confirm: true`.)

**From ESPN** — public leagues need only the league id/URL and season:

1. `/new` → **Import** → **ESPN** tab → league id or URL, season.
2. Private league? Either paste SWID + `espn_s2` (one-time, never stored,
   never reused after import), or flip the league public for one minute
   first — a recap paste is simpler still if you only need the names.
3. Review the preview and confirm.

(Same over MCP: `previewEspn`, then `importEspn` with `confirm: true`.)

**From anywhere else** (Yahoo, NFL.com, a spreadsheet, a screenshot, or
just "I remember who won") — the **Draft** tab reconstructs a season from
whatever you can paste or upload:

1. `/new` → **Import** → **Draft** tab → paste an ESPN draft recap, team
   blocks, a CSV, a known-record summary, or upload a PDF (a print-to-PDF
   that's actually an image won't parse — paste the text instead).
2. Review the preview and confirm.

(Same over MCP: `previewRebuild`, then `importRebuild` with
`confirm: true`.)

Manager emails are never pulled from any of these APIs — the invite
allowlist is typed in post-import, by the commissioner, in league settings.

| Source | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
|---|---|---|---|---|---|---|---|
| Sleeper | league id, no auth | Draft-tab paste | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | optional one `previous_league_id` via `includeHistory` (default off) |
| ESPN | public **or** SWID+espn_s2 one-shot, not saved | Draft-tab paste | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
| Draft (paste/PDF/known record) | — | paste, PDF, known recap | yes | scoring **preset** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
| Yahoo | OAuth not shipped | Draft-tab paste | via paste | via paste | via paste | no | no |
| NFL.com | hop: espn.com/importnfl → ESPN import (no HTML scrape) | Draft-tab paste | via ESPN/paste | via ESPN/paste | via ESPN/paste | via ESPN | no |
```

Note the table's row/column values are unchanged from the original except:
the heading is `## Migrating your league`; "rebuild paste"/"Rebuild" become
"Draft-tab paste"/"Draft (paste/PDF/known record)" to match the real UI
label; "SWID+espnS2" becomes "SWID+espn_s2" to match the exact field name
shown in the UI (`src/routes/import.tsx:892`, the label is literally
`espn_s2`, lowercase with an underscore — the original README had it as
one word `espnS2`, which was never accurate to the UI, only to the JS
variable name).

**Verify**: `grep -c '^## Migrating your league' README.md` → `1`;
`grep -c '^## Players and imports' README.md` → `0` (the old heading is
gone); `grep -n '^## ' README.md` shows `## Migrating your league` in the
same position the old `## Players and imports` occupied (between
`## Advanced: tick without Docker` and `## Book`).

### Step 3: full gate, then commit

`bun run lint` — compare against the `37264ee` baseline via `git stash`/
`git stash pop`, the same technique used in 084; confirm no change (README
isn't Biome-linted, this should be a no-op). `bun test src scripts` — same
pass/fail shape as baseline. Commit (message above). Update the 085 row in
`plans/README.md`.

## Test plan

- No new automated tests — prose content, same as 084.
- Manual verification: read the final README top-to-bottom once. Confirm
  the Quickstart's three links (`#put-it-on-the-internet`,
  `#migrating-your-league`, `#agent-hosts-local`/`#agent-hosts-hosted`)
  point at headings that actually exist with those anchor slugs (GitHub's
  anchor-slug rule: lowercase, spaces to hyphens, punctuation stripped —
  `## Migrating your league` → `#migrating-your-league`; verify each one
  by eye, don't assume).

## Done criteria

- [ ] `grep -c '^## Quickstart' README.md` → 1
- [ ] `grep -c '^## Migrating your league' README.md` → 1
- [ ] `grep -c '^## Players and imports' README.md` → 0
- [ ] `grep -n '^## ' README.md` shows both new/renamed headings in the
      correct position (Quickstart between "What this is" and "Agent hosts
      (local)"; "Migrating your league" between "Advanced: tick without
      Docker" and "Book")
- [ ] `git diff --stat` touches only `README.md` (two counting
      `plans/README.md`)
- [ ] `bun run lint` and `bun test src scripts` show no change from the
      `37264ee` baseline
- [ ] Every internal link added in Step 1 resolves to a real heading (manual check)

## STOP conditions

- The drift check shows `README.md` no longer matches the excerpts above
  (someone edited it concurrently) — reconcile is not your call.
- You open `src/routes/import.tsx` and the tab labels, field names, or the
  SWID/espn_s2 copy don't match what's cited here — STOP and report the
  actual current UI text rather than shipping a guide that describes a UI
  that no longer exists.
- You find yourself wanting to add a fourth "quickstart path" beyond the
  three linked in Step 1 (run it, migrate a league, connect an agent) —
  don't; a quickstart that tries to cover everything stops being quick.
- You find yourself wanting to touch the env-var table in "Put it on the
  internet" — out of scope; Quickstart links to it, it doesn't absorb it.

## Maintenance notes

- If `/import`'s tab labels or field names change in a future UI pass, this
  guide's copy (and the table's "Draft-tab paste" wording) needs a matching
  update — nothing enforces that automatically.
- Next step after this plan lands (per the operator's own sequencing):
  push to the remote, then use `agent-browser` against the reference
  deployment (leagues.waits.dev) to capture real screenshots for the
  showcase/README — that's screenshot work, not more prose, and is a
  separate step from this plan.
