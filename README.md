# open-leagues

**The minute your matchup flipped.** Paste a Sleeper league id or username
and get a receipt for your week: when the game turned, what you left on the
bench, what the wire cost — and which open source called it before kickoff.

Underneath, a headless fantasy league: Postgres holds the league and
enforces the rules, an MCP server exposes every verb, and the browser app is
client zero — not the product.

## Receipts

```
/r/<sleeper league id>                  every matchup this week, one line each
/r/<sleeper league id>/<week>/<roster>  one team's receipt, with a share card
```

Any Sleeper league, public or private. No account. Team names only — never a
person's name. Every receipt has a permalink and an image card that unfurls
in the group chat.

What's on one:

- **The flip** — the minute the matchup changed hands and the play that did
  it, from nflverse play-by-play scored under the league's own book.
- **The bench** — points left sitting, and exactly who over whom. The best
  lineup on the box score against the one you set.
- **The sources** — what Sleeper's projection, the last three weeks, and the
  season average would each have called before kickoff. Open sources only;
  a paid source is never rendered.
- **The wire** — what you bid, whether you won, and the median a player
  cleared for across every league that has pasted.

## Open data

Two files every hobby tool rebuilds by hand, published once. Anonymous
aggregates, CORS on, no key.

```sh
curl https://YOUR_HOST/api/players.json          # sleeper ↔ gsis ↔ espn ↔ yahoo ↔ sportradar
curl https://YOUR_HOST/api/wire/2025/14.json     # FAAB clearing prices: median, quartiles, n
```

## Run your own

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
```

Open `http://YOUR_HOST:8080`. Receipts work immediately for any Sleeper id.
To migrate a league in and run it here — standings, waivers, trades, a
book — see [docs/migrate.md](docs/migrate.md). Env vars, Vercel, and
running without Docker: [docs/self-host.md](docs/self-host.md).

## Connect an agent

Any signed-in member mints their own token from `/account`, or from a shell:

```sh
bun scripts/ledger.mjs mintToken --write --user usr_… --name codex --scope read   # or act
```

`read` tokens can look; `act` tokens can move. Every agent write is tagged
with the token's name, so a receipt can show the agent's line next to yours.
If you already authenticate people at the edge, set
`OPENLEAGUES_MCP_AUTH=proxy` and pass the user id on a header — the engine
only ever needs a user id.

```sh
codex mcp add open-leagues --url https://YOUR_HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex "set my lineup for the bye weeks"
```

Walkthrough with real output: [Connecting an agent](docs/codex-demo.md).
Four playbooks (migrate, lineup, book, week) live under
`src/lib/agent/skills/`.

## Docs

The full docs live in the app at `/docs`. Start with `/docs/guide`: every use
case as pain, fix, what you run, and the real output. In the repo:

- [Migrating your league](docs/migrate.md) — Sleeper, ESPN, or a pasted recap
- [Connecting an agent](docs/codex-demo.md) — a real MCP session, end to end
- [Self-hosting in depth](docs/self-host.md) — env vars, Vercel, the tick clock
- [Notifications (Web Push)](docs/notifications.md) · [Google sign-in](docs/google-sign-in.md)
- [Development](docs/development.md) — test/lint/typecheck

## License

MIT.
