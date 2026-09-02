# open-leagues

open-leagues is a set of headless tools and sources over MCP: facts about a
fantasy league (rosters, matchups, FAAB, the wire), open fantasy knowledge
(projections, stats, a player-ID crosswalk), and NFL betting lines since 1999
with a bench for grading cohorts. Every answer carries a timestamp and a named
open source. No rankings, no picks, no paid feeds. Your agent brings its own
model and makes the call. Add one URL to the public box; no account, no token.

```sh
claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp
codex  mcp add open-leagues --url https://leagues.waits.dev/api/mcp
```

First prompt to try: "Which week is it, what is on the board right now, and
who is trending on Sleeper?"

## The public box

`leagues.waits.dev` is `/api/mcp` with no account and no token, plus the
open-data files; receipts for any Sleeper league ride on the same verbs. It
keeps no accounts and hosts no leagues. Your agent pays for its own model; the
box pays for nothing but Postgres. Everything that needs a person, a league,
tokens, frozen strategies, runs on a box you own.

## What an agent can ask

Three families, all facts.

- **Your league.** Any Sleeper league by id on the public box: rosters,
  matchups, the week's board, the minute a matchup flipped, what the bench
  left, what the wire cost as a share of budget. On a box you own, the same
  verbs read and move a league you host, with a confirm gate on anything that
  spends. Ask: "Find my Sleeper username, list the leagues, and give me the
  receipt for roster 4 in week 6."
- **The game.** The NFL with no league attached: scoreboard, box scores, raw
  weekly stats, leaders, byes, player pages, projections and outlooks from open
  sources. Ask: "Who leads the season at TE, and which teams sit on bye in
  week 9 of 2026?"
- **The lab.** Every closing line since 1999, public splits where a box opts
  in, a cohort filter you describe in words, a grader, a bankroll simulator.
  Arithmetic only; it never picks a side. Ask: "Home dogs of 3 to 7 in
  division games, 2015 to 2024: record against the spread, n, break-even rate,
  max drawdown."

## Open data

Three files every hobby tool rebuilds by hand, published once: anonymous
aggregates, CORS on, no key.

```sh
curl https://YOUR_HOST/api/players.json          # sleeper, gsis, espn, yahoo, sportradar ids
curl https://YOUR_HOST/api/wire/2025/14.json     # FAAB clearing prices as a share of budget, by cohort
curl https://YOUR_HOST/api/lines/2025.json       # closing spread, total, moneylines, result, context
```

## The lab

A backtest bench with no opinions attached: every NFL game's closing line
since 1999, a cohort filter, a grader with `pBreakEven`, a bankroll simulator
(flat, percent, fractional Kelly; seeded bootstrap), frozen strategies with a
run ledger, and, if you opt in, the public's ticket and money share per side.
Two skills compose them: `lab-discover` tunes on some seasons and verifies on
a holdout before it freezes anything; `lab-run` grades a frozen rule every
week and writes the digest. Neither can place a bet.

```
home dogs the public was on
discovery 2023-24   27-18   roi +0.14   pBreakEven 0.19   n 45
holdout   2025      15-18   roi -0.13   pBreakEven 0.83   n 33
not frozen. $1,000 at 1%: $1,019; bootstrap band $892 to $1,170; 43% chance of a loss.
```

```sh
# over MCP: sampleGames → evaluateBets → summarizeRun → simulateBankroll
# OPENLEAGUES_SPLITS_SOURCE=actionnetwork,dknetwork,wiseguyteam   # opt-in ticket/money splits
```

## A worked example: the receipt

An agent asked for one roster's week; four verbs answered, and nothing on the
card came from a model.

```
/r/<sleeper league id>                  every matchup this week, one line each
/r/<sleeper league id>/<week>/<roster>  one team's receipt, with a share card
```

- The flip: the minute the matchup changed hands and the play that did it.
- The bench: points left sitting, and exactly who over whom.
- The sources: what Sleeper's projection, the last three weeks, and the season
  average would each have called before kickoff.
- The wire: what you bid, whether you won, and the median a player cleared
  for across every league read through the box.

Any Sleeper league, public or private. No account. Team names only, never a
person's name. Every receipt has a permalink and a card that unfurls in the
group chat.

## Run your own

Same code, one command: `docker compose up -d` runs a league box with
accounts, your league, and tokens.

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
```

Point an agent at `http://YOUR_HOST:8080/api/mcp`; the public verbs answer
immediately for any Sleeper id. Compose sets `OPENLEAGUES_MODE=league`; drop
the mode line and the same box is a public substrate like ours. To migrate a
league in, see [docs/migrate.md](docs/migrate.md). Env vars, Vercel, and
running without Docker: [docs/self-host.md](docs/self-host.md).

## Connect an agent to your own box

On a league box, any signed-in member mints a read or act token from
`/account`, or from a shell:

```sh
bun scripts/ledger.mjs mintToken --write --user usr_… --name codex --scope read   # or act
```

`read` tokens can look; `act` tokens can move. Every agent write is tagged
with the token's name, so the event log, and any receipt, shows the agent's
line next to yours. If you already authenticate people at the edge, set
`OPENLEAGUES_MCP_AUTH=proxy` and pass the user id on a header; the engine only
ever needs a user id.

```sh
codex mcp add open-leagues --url https://YOUR_BOX/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
codex "set my lineup for the bye weeks"
```

Six playbooks (migrate, lineup, book, week, lab-discover, lab-run) live under
`skills/` at the repo root; install with
`npx skills add ryanwaits/open-leagues -g`.

## Docs

The full docs live in the app at `/docs`. Start with `/docs/guide`. In the repo:

- [The lab, end to end](docs/lab.md): install the two skills, test a hunch, run it on Tuesday
- [Migrating your league](docs/migrate.md): Sleeper, ESPN, or a pasted recap
- [Connecting an agent](docs/codex-demo.md): a real MCP session, end to end
- [Self-hosting in depth](docs/self-host.md): env vars, Vercel, the tick clock
- [Notifications (Web Push)](docs/notifications.md) · [Google sign-in](docs/google-sign-in.md)
- [Development](docs/development.md): test/lint/typecheck

## License

MIT.
