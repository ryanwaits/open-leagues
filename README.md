# open-leagues

<img src="docs/images/hero-banner.png" alt="open-leagues — headless fantasy football operator" width="100%">

**A headless fantasy football operator.** Postgres holds the league and
enforces the rules — conserved FAAB, one scoring book, no UI required.
Migrate a league in once, then run it from a browser, a terminal, or an
agent that's never seen this repo before.

## Quickstart

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/new`. That's a running league. Env vars,
the Vercel alternative, and running without Docker:
[docs/self-host.md](docs/self-host.md).

<img src="docs/images/boxscore-ledger.png" alt="The box score page — score card, live starters, full bench" width="100%">

## Connect an agent

Any signed-in member mints their own token from `/account` — no commish
gate. Any client can migrate a league in and run it over MCP too:

```sh
codex mcp add open-leagues --url https://YOUR_HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex "migrate my Sleeper league in, id 1181923847562"
```

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
