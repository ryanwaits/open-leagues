# The lab, end to end

Test a betting hunch against real closing lines, then track it week to week.
Public betting splits are opt-in. The first run takes about fifteen minutes.
Every number the agent reports comes from a verb.

## 0. Pick a box

- **Public box** (`https://leagues.waits.dev/api/mcp`): no install, account,
  or token. No splits, so ticket and money share hunches cannot run there.
- **Your own box**, for splits and stored strategies:

```sh
# substrate + splits: anonymous MCP, no accounts, three splits sources on
OPENLEAGUES_MODE=substrate OPENLEAGUES_SPLITS_SOURCE=actionnetwork,dknetwork,wiseguyteam bun run dev
```

Splits sources, each under its own book:

- `actionnetwork`: consensus; the only one with history (2023 season on);
  backtests use it.
- `dknetwork`: DraftKings' own handle and bet share, current slate.
- `wiseguyteam`: multi-book, book named, current slate.

One book: `splits: [{ market: "spread", side: "home", tickets: [50, 100],
book: "draftkings" }]`. The first `sampleGames` with splits pulls 2023–2025
from Action Network (54 requests, ~90 s) and keeps them; live sources refresh
hourly. The first `getGameLines` pulls nflverse's games table (~3 s).

## 1. Point your agent at it

```sh
# Claude Code
claude mcp add --transport http open-leagues http://localhost:8080/api/mcp
# or the public box
claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp

# Codex
codex mcp add open-leagues --url http://localhost:8080/api/mcp
```

Check: `getGameLines` for `season: 2025, week: 14` returns 14 games with
`spread`, `total`, moneylines, and `result`.

## 2. Install the two skills

```sh
# Claude Code (global)
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-discover -g
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-run -g
# Codex
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-discover --agent codex -g
# or, from a checkout: cp -r skills/open-leagues-lab-* ~/.claude/skills/
```

Start a new agent session.

## 3. Discover

```
/open-leagues-lab-discover
Home dogs getting over half the spread tickets. Discover on 2023–2024, hold out
2025. Bankroll $1,000, flat 1% stakes.
```

Calls, in order:

1. `getBettingSplits`, one week. Empty `games` means no splits; the skill stops.
2. `sampleGames`, 2023–2024,
   `{ homeDog: true, played: true, splits: [{ market: "spread", side: "home", tickets: [50, 100] }] }`
3. `evaluateBets` (spread, home side), then `summarizeRun`.
4. `sampleGames`, 2025 holdout, opened once; same grading.
5. `simulateBankroll`, holdout bets, your policy.
6. Verdict with `n` and `pBreakEven`. Freezes only if the holdout clears.

Run on 2026-09-02:

```
discovery 2023–24   27-18   roi +0.14   pBreakEven 0.19   n 45
holdout   2025      15-18   roi −0.13   pBreakEven 0.83   n 33
→ not frozen. $1,000 at 1%: $1,019; bootstrap band $892–$1,170; 43% chance of a loss.
```

## 4. Freeze one that clears

On a box with no accounts (public or local), the spec is written under your
home directory, not the current folder. Every project and agent then share
one ledger:

```
~/.open-leagues/labs/<name>/strategy.json        # words, seasons, filter, bet, staking, bankroll
~/.open-leagues/labs/<name>/runs/discover.json   # the holdout record and the simulation
# set OPENLEAGUES_HOME to move the whole tree
```

A rule that failed the holdout can be saved as a `candidate` for a forward
paper test; every digest says it is not frozen.

On a league box (`OPENLEAGUES_MODE=league`, with a token) the skill calls
`freezeStrategy` and `recordLabRun`; any agent with your token reads it back
with `getStrategy`.

## 5. Run it on Tuesday

```
/open-leagues-lab-run
<name>, for last week.
```

Loads the frozen spec and never edits it. Grades last week and the season to
date; runs `simulateBankroll` on the season. Lists next week's games the rule
takes at the closing line, appends the run, and writes:

```
<name> · week N
this week      W-L-P · units · vs the number taken
season to date W-L-P · units · roi · pBreakEven · n
bankroll       $start → $now · max drawdown $ (x%) · bootstrap p5/p50/p95
next week      <n> games the rule takes, with the closing line
caveat         one sentence on what n can carry
```

It cannot call `placeWager`. Betting the list is your call, off this box.

## Hunches to try

One sentence each. Only the first needs splits.

- "Home dogs the public is fading, under 40% of spread tickets on the home side."
- "Home dogs of 3 or fewer, against the spread." (closing lines only; ran
  2022–25 at 89-108-9, −12%.)
- "Divisional games under the total, weeks 10 through 18."
- "Teams off a bye at home, against the spread." (`restEdge: [6, 14]`)
- "Dome teams outdoors in December, under the total." (`roof`, `weeks`)
- "Thursday night favorites of a touchdown or more, on the moneyline."

Compare a quarter-Kelly cap of 3% with flat 1% on the drawdown band.

## Limits

- Sample sizes run 30–300. Freeze bar: `pBreakEven` under 0.05 with
  `n ≥ 100` on the holdout.
- Closing lines only; no line movement yet.
- Splits: opt-in, undocumented endpoints; pulled weeks stay on your box.
- `simulateBankroll` compounds your policy, reports drawdown in dollars,
  resamples the bets a thousand times, and flags Kelly fed from its own sample.
- Nothing here places a bet, connects to a sportsbook, or touches a FAAB purse.

Verbs, over MCP: `getGameLines`, `getGameContext`, `getBettingSplits`,
`sampleGames`, `evaluateBets`, `summarizeRun`, `simulateBankroll`, and on a
league box `freezeStrategy`, `listStrategies`, `getStrategy`,
`deleteStrategy`, `recordLabRun`, `getLabRuns`. Shapes are on the Open data
and Guide pages of the in-app docs.
