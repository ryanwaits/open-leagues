# The lab, end to end

Test a betting hunch with an agent, on real closing lines and (if you opt in)
real public betting splits, then track it week to week. Fifteen minutes the
first time. Every number the agent reports comes back from a verb; the skills
forbid it from inventing one.

## 0. Pick a box

- **Public box** (`https://leagues.waits.dev/api/mcp`): no install, no account,
  no token. Lines, cohorts, grading, staking all work. **Splits are off** there,
  so hunches about ticket or money share cannot run against it.
- **Your own box**, for splits and for storing frozen strategies. From the repo:

```sh
# substrate + splits: anonymous MCP, no accounts, Action Network splits on
OPENLEAGUES_MODE=substrate OPENLEAGUES_SPLITS_SOURCE=actionnetwork bun run dev
```

The first `sampleGames` that asks for splits pulls 2023–2025 from Action
Network (54 requests, ~90 s) and keeps them; after that it is instant. The
first `getGameLines` pulls nflverse's games table (~3 s).

## 1. Point your agent at it

```sh
# Claude Code
claude mcp add --transport http open-leagues http://localhost:8080/api/mcp
# or the public box
claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp

# Codex
codex mcp add open-leagues --url http://localhost:8080/api/mcp
```

Check: ask the agent to call `getGameLines` for `season: 2025, week: 14`. You
should see 14 games with `spread`, `total`, moneylines, and `result`.

## 2. Install the two skills

```sh
# Claude Code (global)
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-discover -g
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-run -g
# Codex
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-discover --agent codex -g
# or, from a checkout: cp -r skills/open-leagues-lab-* ~/.claude/skills/
```

Start a new agent session so it picks them up.

## 3. Discover

In Claude Code:

```
/open-leagues-lab-discover
Home dogs getting over half the spread tickets. Discover on 2023–2024, hold out
2025. Bankroll $1,000, flat 1% stakes.
```

What the skill does, in order — you will see these calls in the transcript:

1. `getBettingSplits` for one week, to confirm the box has splits (an empty
   `games` means it does not; the skill stops and says so).
2. `sampleGames` on 2023–2024 with
   `{ homeDog: true, played: true, splits: [{ market: "spread", side: "home", tickets: [50, 100] }] }`
3. `evaluateBets` on the cohort (spread, home side), then `summarizeRun`.
4. `sampleGames` on 2025 — the holdout, opened once — then the same grading.
5. `simulateBankroll` on the holdout's graded bets with your policy.
6. A verdict, with `n` and `pBreakEven`. It freezes only if the holdout clears.

What it found when we ran it (2026-09-02):

```
discovery 2023–24   27-18   roi +0.14   pBreakEven 0.19   n 45
holdout   2025      15-18   roi −0.13   pBreakEven 0.83   n 33
→ not frozen. $1,000 at 1%: $1,019; bootstrap band $892–$1,170; 43% chance of a loss.
```

That is the skill working: a hunch that looked like +14% on the seasons it was
tuned on, and lost 13% on the one it was not.

## 4. Freeze one that clears

On a box with no accounts (the substrate, or your local one above), the skill
writes the frozen spec to your workspace:

```
labs/<name>/strategy.json        # words, seasons, filter, bet, staking, bankroll
labs/<name>/runs/discover.json   # the holdout record and the simulation
```

On a league box (`OPENLEAGUES_MODE=league`, signed in, token in hand) it calls
`freezeStrategy` and `recordLabRun` instead, and any agent with your token can
read it back with `getStrategy`.

## 5. Run it on Tuesday

```
/open-leagues-lab-run
<name>, for last week.
```

The skill loads the frozen spec and never edits it, grades last week, grades
the season to date, runs `simulateBankroll` on the season, lists next week's
games the rule would take at the closing line, appends the run, and writes:

```
<name> · week N
this week      W-L-P · units · vs the number taken
season to date W-L-P · units · roi · pBreakEven · n
bankroll       $start → $now · max drawdown $ (x%) · bootstrap p5/p50/p95
next week      <n> games the rule takes, with the closing line
caveat         one sentence on what n can carry
```

It cannot call `placeWager`. The ticket list is what the rule selects; whether
to bet it is yours, off this box.

## Hunches to try

Each is one sentence to the discover skill. None need splits except the first.

- "Home dogs the public is fading — under 40% of spread tickets on the home side."
- "Home dogs of 3 or fewer, against the spread." (closing lines only; ran
  2022–25 at 89-108-9, −12%.)
- "Divisional games under the total, weeks 10 through 18."
- "Teams off a bye at home, against the spread." (`restEdge: [6, 14]`)
- "Dome teams outdoors in December, under the total." (`roof`, `weeks`)
- "Thursday night favorites of a touchdown or more, on the moneyline."

Ask for the same hunch with a quarter-Kelly cap of 3% and compare the drawdown
band to flat 1%.

## What to expect, and what it will not pretend

- Sample sizes of 30–300. `pBreakEven` under 0.05 with `n ≥ 100` on the
  holdout is the bar the skill uses to freeze. Most hunches will not clear it.
  That is the product working.
- Closing lines only. Anything about line movement cannot be tested yet.
- Splits are Action Network's consensus (an aggregate, 2023 onward), opt-in,
  undocumented, and kept on your box once pulled.
- Staking is arithmetic: the policy is yours; `simulateBankroll` compounds it,
  reports drawdown in dollars, resamples the bets a thousand times, and flags
  Kelly fed from its own sample.
- Nothing here places a bet, connects to a sportsbook, or touches a purse.

Verbs behind all of it, over MCP: `getGameLines`, `getGameContext`,
`getBettingSplits`, `sampleGames`, `evaluateBets`, `summarizeRun`,
`simulateBankroll`, and on a league box `freezeStrategy`, `listStrategies`,
`getStrategy`, `deleteStrategy`, `recordLabRun`, `getLabRuns`. Shapes are on
the Open data and Guide pages of the in-app docs.
