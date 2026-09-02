# Connecting Codex to a league

A real MCP session, end to end: mint a token, point Codex at it, ask a
question in plain language, and get back a real answer pulled live from
the league — no custom integration code on either side, just the MCP
protocol both sides already speak.

This works the same way for Claude Code, a Claude Connector, or a ChatGPT
custom connector — Codex is just the one this walkthrough uses.

The live host is `https://leagues.waits.dev`. Every read of a hosted
(`lg_`) league needs a seat, so MCP always needs a member token. Raw
Sleeper ids pass through Sleeper's public data read-only and need none. The transcript below is a real preseason-2026 run
against that host (team `hands`, opponent `Butterbean`, record `0-0-0`).

## 1. Mint a token

Sign in at `/account` (any member can do this — no commissioner gate).
Under **Agent tokens**, name one (e.g. `codex`) and click **Create**. The
raw value is shown once — copy it now, it can't be viewed again (you can
always revoke it and mint a new one).

No browser on the box? The CLI issues the same credential against the same
table:

```sh
bun scripts/ledger.mjs mintToken --write --user <your Better Auth user id> --name codex
```

Either way the token belongs to *that* box — tokens are never issued
centrally. A host that already authenticates callers at its edge can skip
tokens entirely with `OPENLEAGUES_MCP_AUTH=proxy` and pass the user id on
`x-openleagues-user`.

## 2. Point Codex at it

```sh
export OPENLEAGUES_TOKEN=ol_…    # the value from step 1
codex mcp add open-leagues --url https://leagues.waits.dev/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex mcp list
```

```
Name          Url                                     Bearer Token Env Var  Status   Auth
open-leagues  https://leagues.waits.dev/api/mcp       OPENLEAGUES_TOKEN      enabled  Bearer token
```

On your own box, swap the URL for `https://YOUR_HOST/api/mcp`.

## 3. Ask it something

```sh
codex exec "Use the open-leagues MCP tools to get my league context — team name, record, and this week's matchup opponent if one exists. Report just that, nothing else."
```

```
mcp: open-leagues/getDesk started
mcp: open-leagues/getDesk (failed)
mcp: open-leagues/getSchedule started
mcp: open-leagues/getSchedule (failed)
mcp: open-leagues/listMyLeagues started
mcp: open-leagues/listMyLeagues (completed)
mcp: open-leagues/getAgentContext started
mcp: open-leagues/getAgentContext (completed)
mcp: open-leagues/getLeagueBundle started
mcp: open-leagues/getLeagueBundle (completed)
mcp: open-leagues/getMatchups started
mcp: open-leagues/getMatchups (completed)
mcp: open-leagues/getSchedule started
mcp: open-leagues/getSchedule (completed)

codex
hands — 0-0-0 — Butterbean
```

Codex's first two guesses (`getDesk`, `getSchedule` with no arguments) hit
tools that don't exist under those names or shapes and failed outright —
it hadn't yet introspected the real tool catalog. It recovered on its own,
called `listMyLeagues` to find the league id, then `getAgentContext` and
`getLeagueBundle` for team/season state, `getMatchups` and `getSchedule`
for the week, and printed the answer above: team name `hands`, record
`0-0-0`, opponent `Butterbean` — real values from the seeded WIFFL league,
not anything hardcoded or invented. The `mcp: open-leagues/…` lines are
the proof — Codex is reading the live league through MCP, not answering
from memory.

## Running your own box instead (stdio)

A commissioner running their own box can point their own Codex/Claude at
the league directly, without a public HTTP endpoint:

```sh
export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your Better Auth user id>
codex mcp add open-leagues -- bun scripts/mcp.mjs
```

This needs a real Postgres `DATABASE_URL` — `bun` cannot boot the PGLite
fallback the dev server uses locally (no `import.meta.glob` support), so
this path isn't reproducible against `bun run dev` the way the hosted
example above is; it's exactly what a self-hoster with Docker/Render's
Postgres already has running.

## Playbooks

Six skills (migrate, lineup, book, week, lab-discover, lab-run) live under
`src/lib/agent/skills/` — copy or symlink into `~/.codex/skills/` (or
`~/.claude/skills/`) so a prompt like "migrate my league from Sleeper" or
"set my lineup for the bye weeks" runs the whole playbook, not just one
tool call.
