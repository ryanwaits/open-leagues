# Plan 092: Rewrite README to the locked "one screen" concept, split the migrate table into docs/migrate.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If anything in the "STOP conditions" section occurs, stop
> and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 101cd0c..HEAD -- README.md docs/`
> If any diff exists, compare "Current state" below against the live files
> before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW — docs-only, no application code. The one thing to get
  right: the migrate-source table and per-source steps must move to
  `docs/migrate.md` *verbatim*, not be summarized or lossy — self-hosters
  rely on those exact details (e.g. the `includeHistory` flag, the
  `espn_s2` one-shot-not-stored note).
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `101cd0c`, 2026-08-27
- **Design source**: this is "Concept A · one screen" from the
  `README Concepts` artifact mock, which the user approved, with one
  correction already applied to the mock per the user's own feedback
  (the confusing `getAgentContext`/`startPlayer` pseudocode replaced with a
  real, concrete migrate CLI example) — see "Current state" for the exact
  final README text this plan lands.

## Why this matters

Research into what makes a README actually work (done earlier this
session, before the mock was built): fit one screen, one-line positioning,
a short usage example, no feature-list wall of text, no table of contents
— if it needs one, it's too long, split the depth into `/docs`. The
current `README.md` is 132 lines with a 5-column comparison table and five
paragraphs of per-source migrate instructions inline — genuinely useful
content, but it's exactly the kind of depth that belongs in `docs/`, one
click away, not the first thing anyone encounters. This plan doesn't
delete any of that detail — it moves it to a new `docs/migrate.md` and
leaves a short, honest pointer in its place.

## Current state

**`README.md`** — full current content already read directly at commit
`101cd0c` (132 lines) — see the file itself; not re-quoted here in full
since Step 1 replaces essentially the whole thing and reproducing all 132
lines here would just be duplicated noise. The two pieces that matter for
this plan:

- Lines 39-89 (`## Migrating your league` through the comparison table) —
  this entire block moves to `docs/migrate.md`, verbatim, word for word,
  including the table.
- Everything else gets rewritten to the shape in Step 1.

**New asset already produced and placed** (disclosed exception — the
advisor handles raw image binaries directly, same as every other
screenshot this session): `docs/images/hero-banner.png` (1200×260, 6.8KB,
PNG8/64-color) — a real rendered banner, Console skin tokens, the
`open-leagues` wordmark with a live-style accent dot, "headless fantasy
football operator" tagline. Confirm it's present:
`identify docs/images/hero-banner.png` → `1200x260`.

**`docs/` directory currently has** (verified at `101cd0c`): `self-host.md`,
`notifications.md`, `google-sign-in.md`, `development.md`, `codex-demo.md`,
`images/`. No `migrate.md` yet.

**`docs/codex-demo.md`** already documents the stdio (self-hosted-box)
connection variant in full under its own "Running your own box instead
(stdio)" heading — confirmed by direct read. This plan's new README
"Connect an agent" section therefore only needs the hosted-HTTP example,
not both — the stdio path is one click away already, no duplication needed.

## Scope

**In scope**:
- Full rewrite of `README.md` (Step 1)
- New file `docs/migrate.md` (Step 2)
- `plans/README.md` status row — skip if a reviewer maintains the index

**Out of scope**:
- Any change to `docs/self-host.md`, `docs/notifications.md`,
  `docs/google-sign-in.md`, `docs/development.md`, `docs/codex-demo.md` —
  read-only, link targets only
- `docs/images/hero-banner.png` — already placed, do not regenerate or
  modify it
- Any application code
- Anything not explicitly listed above

## Git workflow

Current branch; one commit, e.g.
`docs: rewrite README to one-screen shape, split migrate guide to docs/migrate.md`.
Do not push (standing rule — `main` auto-deploys to `leagues.waits.dev`).

## Steps

### Step 1: Rewrite `README.md`

Replace the entire file with exactly this:

```md
# open-leagues

<img src="docs/images/hero-banner.png" alt="open-leagues — headless fantasy football operator" width="100%">

**A headless fantasy football operator.** Postgres holds the league and
enforces the rules — conserved FAAB, one scoring book, no UI required.
Migrate a league in once, then run it from a browser, a terminal, or an
agent that's never seen this repo before.

## Quickstart

\`\`\`sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
\`\`\`

Open `http://YOUR_HOST:8080` → `/new`. That's a running league. Env vars,
the Vercel alternative, and running without Docker:
[docs/self-host.md](docs/self-host.md).

<img src="docs/images/boxscore-ledger.png" alt="The box score page — score card, live starters, full bench" width="100%">

## Connect an agent

Any signed-in member mints their own token from `/account` — no commish
gate. Any client can migrate a league in and run it over MCP too:

\`\`\`sh
codex mcp add open-leagues --url https://YOUR_HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex "migrate my Sleeper league in, id 1181923847562"
\`\`\`

Walkthrough with real output, the local/stdio variant, and Claude/ChatGPT
connector setup: [Connecting an agent](docs/codex-demo.md). Migrating from
Sleeper, ESPN, or a pasted recap in more depth:
[docs/migrate.md](docs/migrate.md).

Four playbooks (migrate, lineup, book, week) live under
`src/lib/agent/skills/` — copy or symlink into a host skills dir
(`~/.codex/skills/`, `~/.claude/skills/`; already in `.grok/skills/` here).

<img src="docs/images/account-skins.png" alt="Picking a skin and minting an agent token from /account" width="70%">

## Docs

- [Migrating your league](docs/migrate.md) — Sleeper, ESPN, or a pasted
  recap, source by source
- [Connecting an agent](docs/codex-demo.md) — a real MCP session, end to
  end, with a working example
- [Self-hosting in depth](docs/self-host.md) — env vars, Vercel, running
  without Docker, the tick clock, backups
- [Notifications (Web Push)](docs/notifications.md)
- [Google sign-in](docs/google-sign-in.md)
- [Development](docs/development.md) — test/lint/typecheck, the book's QA
  script

## License

MIT.
```

**Verify**: `wc -l README.md` → around 55-60 lines (down from 132);
`grep -c 'docs/migrate.md' README.md` → at least `3`.

### Step 2: Create `docs/migrate.md`

Move the current README's `## Migrating your league` section (its intro
paragraph, all three per-source subsections, and the comparison table —
lines 39-89 of the README at commit `101cd0c`) into this new file,
**verbatim, word for word** — do not paraphrase, shorten, or drop any cell
of the table. Only the top-level heading changes (from `##` to `#`, since
this is now its own document) and the MCP-verb parentheticals stay exactly
as they are. The file should read:

```md
# Migrating your league

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

**Verify**: `diff <(sed -n '41,89p' <(git show 101cd0c:README.md)) <(sed -n '3,51p' docs/migrate.md)`
should show only the expected heading-level difference (or run a manual
side-by-side read if the line-number slice doesn't align exactly with
whitespace — the point is zero content drift on the table and the three
per-source subsections, not an exact byte diff including surrounding
headings).

### Step 3: Full gate

`bun run typecheck` · `bun run lint` · `bun run build` all exit 0. (No
`bun test` needed — no application code touched.)

### Step 4: Commit

Message: `docs: rewrite README to one-screen shape, split migrate guide to docs/migrate.md`.
Do not push.

## Test plan

- No automated tests — documentation only.
- Manual: open `README.md` and `docs/migrate.md` and read them top to
  bottom as a first-time visitor would — confirm the README alone answers
  "what is this, how do I run it, how do I connect an agent" within one
  scroll, and confirm nothing from the original migrate table/steps is
  missing from the new doc.

## Done criteria

- [ ] `README.md` matches Step 1's text exactly
- [ ] `docs/migrate.md` exists and contains the full original migrate
      content, table included, with zero cells dropped or reworded
- [ ] `docs/images/hero-banner.png` referenced correctly and renders
      (open the file, confirm it's not a broken path)
- [ ] `bun run typecheck` · `bun run lint` · `bun run build` all exit 0
- [ ] Commit created locally; **not pushed**

## STOP conditions

- The drift check shows `README.md` or `docs/` has changed since `101cd0c`
  in a way that contradicts "Current state" above.
- You find yourself paraphrasing or shortening any cell of the migrate
  table while moving it — stop, the move must be lossless.
- You find yourself wanting to also touch the `/about` route from plan
  091 — separate plan, not this one's job (if 091 hasn't landed yet when
  you run this, that's fine, they're independent).

## Maintenance notes

- The README's "57 of 76 verbs" claim from the old version was dropped in
  this rewrite (concept A didn't carry it, favoring brevity) — if that
  number is important to keep visible, it now lives in the `/about` page's
  `--help` block (plan 091) instead of the README.
- Future doc additions should ask "does this belong on the one screen, or
  one click away" before growing the README again — that's the whole
  point of this plan.
