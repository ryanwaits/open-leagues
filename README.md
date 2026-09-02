# open-leagues

An MCP server for fantasy football and NFL data. Any Sleeper league by id,
NFL stats and open projections, and every closing line since 1999. No
account. It does not rank players or pick sides; that part is your agent's.

```sh
claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp
codex  mcp add open-leagues --url https://leagues.waits.dev/api/mcp
```

## Then ask

- "Which week is it, and who is trending on Sleeper?"
- "Find my Sleeper username, list my leagues, and show roster 4 in week 6."
- "Give me the receipt for that matchup." (when it flipped, points left on
  the bench, what the wire cost as a share of budget)
- "Who leads the season at TE, and which teams are on bye in week 9?"
- "Home dogs of 3 to 7 in division games, 2015 to 2024: record against the
  spread and n." (graded at the closing line, with pBreakEven; it never picks
  a side or places a bet)

Every answer carries a timestamp and a named open source. The public box
keeps no accounts and hosts no leagues.

## Without an agent

```sh
curl https://leagues.waits.dev/api/players.json       # one row per player: sleeper, gsis, espn, yahoo ids
curl https://leagues.waits.dev/api/wire/2025/14.json  # waiver prices as a share of budget, by cohort
curl https://leagues.waits.dev/api/lines/2025.json    # every game: closing spread, total, moneylines, result
```

Receipts for any Sleeper league: `/r/<league id>` and
`/r/<league id>/<week>/<roster>`.

## Run your own

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
```

The same box, holding your league: rosters, FAAB, scoring, and read or act
tokens for your agents. Point an agent at `http://YOUR_HOST:8080/api/mcp`.
Compose sets `OPENLEAGUES_MODE=league`; drop that line and the box is a public
server like ours.

```sh
bun scripts/ledger.mjs mintToken --write --user usr_… --name codex --scope read   # or act
codex mcp add open-leagues --url https://YOUR_BOX/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
```

Skills for Claude Code and Codex (lineup, week, book, migrate, lab-discover,
lab-run): `npx skills add ryanwaits/open-leagues -g`.

## Docs

In the app at `/docs`; start with `/docs/guide`. In the repo:

- [The lab, end to end](docs/lab.md): test a betting hunch, run it on Tuesday
- [Migrating your league](docs/migrate.md): Sleeper, ESPN, or a pasted recap
- [Self-hosting](docs/self-host.md): env vars, Vercel, the tick clock
- [Notifications](docs/notifications.md) · [Google sign-in](docs/google-sign-in.md) · [Development](docs/development.md)

## License

MIT.
