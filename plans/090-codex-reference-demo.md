# Plan 090: Document a verified Codex reference-implementation demo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> ```sh
> git rev-parse --short HEAD   # expect b4b9569, or a descendant with no
>                               # changes to README.md's "Connect an agent"
>                               # section or docs/
> sed -n '/## Connect an agent/,/## Docs/p' README.md
> ```
> Compare the printed section against Step 1's "Current state" excerpt
> below. If it's drifted, STOP and report — do not proceed on stale text.

## Status

- **Priority**: P1 (this session's rename work, plans 086–089, is only
  useful if an external client can actually connect — this plan proves it,
  with a real client, not just documentation claims)
- **Effort**: M — one doc-only fix, one new file, no application code
- **Risk**: LOW — README.md and a new `docs/codex-demo.md` file only, no
  `src/` or `migrations/` changes. The one thing to get right: don't
  reproduce a real secret token value anywhere written to disk (see Step 2).
- **Depends on**: plans/089 (landed at `b4b9569`, local only — the `ol_`
  token prefix and `open-leagues` MCP server name this demo exercises)
- **Category**: docs
- **Planned at**: commit `b4b9569`, 2026-08-26

## Why this matters

This whole session has been building toward one claim: "the league is
usable from any client, not just the PWA." Plans 041–044 wired MCP; plans
081–083 filled out the tool catalog; plan 088's README states "an MCP
server exposes the same league as callable primitives for Claude, Codex, or
Grok." None of that has been proven with an actual external LLM client
making an actual tool call and getting back real data — only with the PWA
and with `agent-browser` (a browser automation tool, not an MCP client).

**This was verified live, directly, before writing this plan** (not by a
subagent — a real terminal session, right before writing this):

1. Booted the local dev server (`bun run dev`, PGLite, the same seeded
   WIFFL league used throughout this session).
2. Signed in as the seeded local user
   (`src/lib/auth/local-seed.ts`: `ryan@wiffl.local` / `wiffl2026`) via
   `agent-browser`, went to `/account`, minted a real personal agent token
   (a real `ol_…` value — confirming plan 089's rename works end-to-end,
   not just at the schema level).
3. `codex mcp add open-leagues --url http://localhost:8080/api/mcp
   --bearer-token-env-var OPENLEAGUES_TOKEN` — Codex CLI (`codex-cli
   0.147.0`, logged in via ChatGPT) registered the server; `codex mcp list`
   confirmed it (`Status: enabled`, `Auth: Bearer token`).
4. `codex exec "Use the open-leagues MCP tools to get my agent context
   (league, seat, standings). Just call the tool and report back the
   league name and my team's name/record, nothing else."` — Codex's own
   tool-call log showed it calling `listMyLeagues`, then `getAgentContext`,
   then `getLeagueBundle` against the live server, and it printed back:
   `WIFFL: hands, 0-0-0.` — a real league name and a real team name/record
   from the actual seeded database, not anything hardcoded or fabricated.
5. Cleaned up: revoked the demo token from `/account`, removed the
   `open-leagues` entry from `codex mcp list`, closed the browser, killed
   the dev server.

**One real bug surfaced along the way**, and fixing it is this plan's other
job: README.md's current stdio example (`codex mcp add open-leagues
--command bun --args scripts/mcp.mjs`) **does not work with the installed
Codex CLI** — `codex mcp add --help` shows the actual syntax is
`codex mcp add <NAME> (--url <URL> | -- <COMMAND>...)`; there is no
`--command`/`--args` flag pair at all. Confirmed directly:
`codex mcp add open-leagues-stdio-test -- bun scripts/mcp.mjs` succeeds and
lists correctly; the README's current form would fail for anyone who
copy-pasted it.

## Current state

**`README.md`'s "Connect an agent" section, verbatim at commit `b4b9569`:**

```md
## Connect an agent

Any signed-in member mints their own token from `/account` — no commish
gate. Point Codex / Claude / Grok at the league over MCP:

\`\`\`sh
# local (your own box, hosted Postgres only — bun cannot boot PGLite)
export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your user id>
codex mcp add open-leagues --command bun --args scripts/mcp.mjs

# hosted (a friend's Codex/Claude/Grok, over HTTP with a personal token)
export OPENLEAGUES_TOKEN=ol_…
codex mcp add open-leagues --url https://HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
\`\`\`

Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`,
leave Client ID & Secret blank, authorize with the bearer token. Cookie
sessions are never accepted on this route — bearer token only.

Four playbooks (migrate, lineup, book, week) live under
`src/lib/agent/skills/` — copy or symlink into a host skills dir
(`~/.codex/skills/`, `~/.claude/skills/`; already in `.grok/skills/` here).

<img src="docs/images/account-skins.png" alt="Picking a skin and minting an agent token from /account" width="70%">

## Docs

- [Self-hosting in depth](docs/self-host.md) — env vars, Vercel, running
  without Docker, the tick clock, backups
- [Notifications (Web Push)](docs/notifications.md)
- [Google sign-in](docs/google-sign-in.md)
- [Development](docs/development.md) — test/lint/typecheck, the book's QA script
```

**`docs/` currently has 4 files**: `self-host.md`, `notifications.md`,
`google-sign-in.md`, `development.md` (plus `images/`). No Codex/agent-demo
doc exists yet.

**`src/lib/auth/local-seed.ts`** (unchanged, referenced for your own
rehearsal in Step 2):
```ts
export const LOCAL_SEED = {
  email: "ryan@wiffl.local",
  password: "wiffl2026",
  name: "Ryan",
  userId: "user_ryan",
} as const;
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | matches `b4b9569` baseline |
| Build | `bun run build` | exit 0 |
| Codex CLI present | `codex --version` | prints a version (confirmed `codex-cli 0.147.0` present when this plan was written; if missing entirely, STOP — see STOP conditions) |
| Codex logged in | `codex login status` | `Logged in using ChatGPT` (or another auth method) — if not logged in, STOP, this plan needs a working Codex session, not just the binary |

## Scope

**In scope**:
- `README.md`'s "Connect an agent" section (Step 1 — fix the broken stdio
  command; add one link to the new doc)
- New file `docs/codex-demo.md` (Step 3)
- `plans/README.md` status row — skip if a reviewer maintains the index

**Out of scope**:
- Anything in `src/`, `migrations/`, `scripts/mcp.mjs`, or
  `src/routes/api/mcp.ts` — this plan documents and verifies existing
  behavior, it does not change any application code.
- A ChatGPT custom-connector or Claude-connector live demo — README already
  documents that path (unchanged, out of scope here); this plan is Codex
  CLI specifically, per the user's request. A future plan can do the same
  treatment for a ChatGPT/Claude connector if wanted.
- Automating the whole demo into a single runnable script (e.g. a
  headless-login + auto-mint-token shell script) — the manual walkthrough
  in `docs/codex-demo.md` (sign in, mint a token, export it, run one
  command) is the realistic path a real user follows; over-automating it
  would need a headless-auth mechanism that doesn't exist and isn't worth
  building for a demo doc.
- Anything not explicitly listed above.

## Git workflow

Current branch; commit locally, e.g.
`docs: verify + document a live Codex MCP demo, fix broken stdio syntax`.
Do not push (standing rule this whole session — `main` auto-deploys to
`leagues.waits.dev` via Render on every push). This plan's own verification
happens entirely against the local dev server; nothing here touches
production regardless, but the push decision still isn't this plan's call.

## Steps

### Step 1: Fix the broken stdio command in `README.md`

Replace the `Connect an agent` code block (see "Current state" above) with:

```md
Any signed-in member mints their own token from `/account` — no commish
gate. Point Codex / Claude / Grok at the league over MCP:

\`\`\`sh
# local (your own box, hosted Postgres only — bun cannot boot PGLite)
export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your user id>
codex mcp add open-leagues -- bun scripts/mcp.mjs

# hosted (a friend's Codex/Claude/Grok, over HTTP with a personal token)
export OPENLEAGUES_TOKEN=ol_…
codex mcp add open-leagues --url https://HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
\`\`\`

Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`,
leave Client ID & Secret blank, authorize with the bearer token. Cookie
sessions are never accepted on this route — bearer token only.

Walkthrough with real output: [Connecting Codex to a league](docs/codex-demo.md).

Four playbooks (migrate, lineup, book, week) live under
`src/lib/agent/skills/` — copy or symlink into a host skills dir
(`~/.codex/skills/`, `~/.claude/skills/`; already in `.grok/skills/` here).
```

The only functional change from the current text is
`codex mcp add open-leagues --command bun --args scripts/mcp.mjs` →
`codex mcp add open-leagues -- bun scripts/mcp.mjs` (this plan's own
"Why this matters" section explains why the old form is wrong), plus the
one new "Walkthrough with real output" line. Everything else in the
section — the hosted example, the Claude/ChatGPT connector paragraph, the
skills paragraph, the image — is unchanged, keep it verbatim.

Then add one line to the `## Docs` list, right after the existing four:

```md
- [Connecting Codex to a league](docs/codex-demo.md) — a real MCP session,
  end to end, with a working example
```

**Verify**: `grep -n 'codex mcp add open-leagues --' README.md` → shows the
corrected `-- bun scripts/mcp.mjs` form, no `--command`/`--args` anywhere in
the file (`grep -c -- '--command\|--args' README.md` → `0`).

### Step 2: Reproduce the live demo yourself

Don't take this plan's "Why this matters" section on faith — rerun it, so
`docs/codex-demo.md` (Step 3) is written from something you saw with your
own eyes, not copied prose. This takes about 5 minutes.

1. **Boot the dev server**: `bun run dev` (background it or use a second
   terminal — you need it running for the rest of this step). Confirm it
   logs a ready URL (`http://localhost:8080`).
2. **Sign in and mint a token**, via `agent-browser`
   (`~/.bun/bin/agent-browser`, sandbox disabled per the standing
   browser-automation rule):
   - `agent-browser open http://localhost:8080/login`
   - Sign in with `ryan@wiffl.local` / `wiffl2026` (the local seed —
     `src/lib/auth/local-seed.ts`, quoted in "Current state" above).
   - Navigate to `/account`, fill the "Token name" field with something
     like `codex-demo`, click Create.
   - Read the newly-shown token value directly from the page (a full
     `agent-browser snapshot` will show it as static text starting
     `ol_…`) — **do not** write this raw value into any file, plan, or
     doc. Keep it only in your shell's environment for this step.
3. **Register it with Codex**:
   ```sh
   export OPENLEAGUES_TOKEN=<the ol_… value you just read>
   codex mcp add open-leagues --url http://localhost:8080/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
   codex mcp list
   ```
   Expect the `list` output to show `open-leagues` with `Status: enabled`,
   `Auth: Bearer token`.
4. **Run a real prompt**:
   ```sh
   codex exec "Use the open-leagues MCP tools to get my league context — team name, record, and this week's matchup opponent if one exists. Report just that, nothing else."
   ```
   Watch the output for actual `mcp: open-leagues/<toolName> started` /
   `(completed)` lines — this is the proof it's a real tool call, not the
   model inventing an answer. Note which tool names it actually called and
   what the final printed answer was — you'll use your own real output
   (not this plan's example above, which was from a separate run) in
   `docs/codex-demo.md`.
5. **Clean up immediately after**, in this order: revoke the token from
   `/account` (click Revoke) → `codex mcp remove open-leagues` → confirm
   `codex mcp list` shows no servers → close `agent-browser`
   (`agent-browser close --all`) → stop the dev server.

**Verify**: you have, written down for your own reference in this step
(not yet committed anywhere), the real tool names Codex called and the
real final answer text it printed. If Codex refused to call any tool, or
the connection failed, or `codex mcp list` never showed `enabled` — STOP,
see STOP conditions, this plan's core claim doesn't hold and the doc
shouldn't be written yet.

### Step 3: Write `docs/codex-demo.md`

Using your own Step 2 output (not this plan's example run) for the actual
transcript, write a new file with this shape — adapt the "what it printed"
block to what you actually saw, keep everything else:

```md
# Connecting Codex to a league

A real MCP session, end to end: mint a token, point Codex at it, ask a
question in plain language, and get back a real answer pulled live from
the league — no custom integration code on either side, just the MCP
protocol both sides already speak.

This works the same way for Claude Code, a Claude Connector, or a ChatGPT
custom connector — Codex is just the one this walkthrough uses.

## 1. Mint a token

Sign in at `/account` (any member can do this — no commissioner gate).
Under **Agent tokens**, name one (e.g. `codex`) and click **Create**. The
raw value is shown once — copy it now, it can't be viewed again (you can
always revoke it and mint a new one).

## 2. Point Codex at it

\`\`\`sh
export OPENLEAGUES_TOKEN=ol_…    # the value from step 1
codex mcp add open-leagues --url https://YOUR_HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex mcp list
\`\`\`

\`\`\`
Name          Url                       Bearer Token Env Var  Status   Auth
open-leagues  https://YOUR_HOST/api/mcp  OPENLEAGUES_TOKEN    enabled  Bearer token
\`\`\`

## 3. Ask it something

\`\`\`sh
codex exec "Use the open-leagues MCP tools to get my league context — team name, record, and this week's matchup opponent if one exists. Report just that, nothing else."
\`\`\`

[[REPLACE: your own real terminal output here — the actual
`mcp: open-leagues/<toolName> started`/`(completed)` lines Codex printed,
in order, followed by the actual final answer text it gave. Do not
fabricate this or copy the plan's example — use exactly what you saw in
Step 2.]]

The `mcp: open-leagues/…` lines are the tool calls actually happening —
Codex is reading the live league through MCP, not answering from memory.

## Running your own box instead (stdio)

A commissioner running their own box can point their own Codex/Claude at
the league directly, without a public HTTP endpoint:

\`\`\`sh
export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your Better Auth user id>
codex mcp add open-leagues -- bun scripts/mcp.mjs
\`\`\`

This needs a real Postgres `DATABASE_URL` — `bun` cannot boot the PGLite
fallback the dev server uses locally (no `import.meta.glob` support), so
this path isn't reproducible against `bun run dev` the way the hosted
example above is; it's exactly what a self-hoster with Docker/Render's
Postgres already has running.

## Playbooks

Four skills (migrate, lineup, book, week) live under
`src/lib/agent/skills/` — copy or symlink into `~/.codex/skills/` (or
`~/.claude/skills/`) so a prompt like "migrate my league from Sleeper" or
"set my lineup for the bye weeks" runs the whole playbook, not just one
tool call.
```

**Verify**: `wc -l docs/codex-demo.md` → non-zero; the file contains your
own real tool-call transcript, not this plan's example run (`grep -c
'REPLACE' docs/codex-demo.md` → `0` — the placeholder must be gone,
replaced with real content); `grep -c 'ol_' docs/codex-demo.md` → matches
only appear in the `ol_…` placeholder pattern and the stdio note, never a
real 64-character token value (`grep -oE 'ol_[0-9a-f]{20,}' docs/codex-demo.md`
→ no matches — a real token is far longer than the `ol_…` placeholder and
this must never appear).

### Step 4: Full gate

`bun run typecheck` · `bun run lint` · `bun run build` all exit 0. (No
`bun test` step needed — nothing in `src/` changed; run it anyway if you
want the baseline confirmation, but it's not required for a docs-only
change to pass done criteria.)

### Step 5: Commit

Commit message: `docs: verify + document a live Codex MCP demo, fix broken stdio syntax`.
Do not push.

## Test plan

- No automated tests — documentation and one command-syntax fix, verified
  by actually running the commands (Step 2) rather than by an automated
  assertion.
- The "test" here IS Step 2: a real Codex CLI session against a real
  running server, with a real tool call and a real answer. If that step
  doesn't produce genuine `mcp: open-leagues/… started/(completed)` lines,
  the plan has failed regardless of what the docs say.

## Done criteria

- [ ] `README.md`'s stdio example reads
      `codex mcp add open-leagues -- bun scripts/mcp.mjs`, not the old
      `--command`/`--args` form
- [ ] `README.md`'s Docs list links `docs/codex-demo.md`
- [ ] `docs/codex-demo.md` exists, contains a real (not fabricated,
      not copied from this plan) tool-call transcript from your own Step 2
      run, and contains no real token value (only the `ol_…` placeholder)
- [ ] `bun run typecheck` · `bun run lint` · `bun run build` all exit 0
- [ ] Step 2's cleanup fully done: demo token revoked, `codex mcp list`
      shows no leftover `open-leagues` entry, dev server stopped
- [ ] Commit created locally; **not pushed**

## STOP conditions

- The drift check shows `README.md`'s "Connect an agent" section no longer
  matches the excerpt in "Current state."
- `codex --version` fails (Codex CLI not installed/available) — this whole
  plan depends on a real Codex session; report back rather than writing
  docs for a demo you couldn't actually run.
- `codex login status` shows not logged in, and you have no way to log in
  — same reasoning; a docs page describing a demo nobody ran is exactly
  the kind of unverified claim this plan exists to avoid.
- Step 2's live demo fails at any point (server won't boot, sign-in fails,
  token mint fails, `codex mcp add` rejects the URL, or `codex exec` never
  shows a real `mcp: open-leagues/…` tool-call line) — stop and report
  the exact failure; do not write `docs/codex-demo.md` describing a demo
  that didn't actually work.
- You find yourself about to write a real token value into any file —
  don't. Stop, redact it, and if you already saved it, remove it before
  continuing.
- You find yourself wanting to also fix something in `src/lib/agent/`,
  `scripts/mcp.mjs`, or `src/routes/api/mcp.ts` — out of scope; note it in
  NOTES and report it, this plan documents behavior, it doesn't change it.

## Maintenance notes

- If a future Codex CLI release changes `mcp add`'s flag syntax again,
  `docs/codex-demo.md` and README's stdio line will both need a matching
  update — there's no automated check tying this doc to the installed
  CLI's actual `--help` output, so it can silently drift the same way the
  original (wrong) command did.
- Next planned work after this (per the user, not part of this plan): a
  ChatGPT custom-connector or Claude-connector version of the same
  demo/doc, and eventually circling back to add screenshots per the
  earlier deferred item.
