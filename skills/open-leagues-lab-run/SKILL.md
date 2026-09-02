---
name: open-leagues-lab-run
description: >
  Run a frozen strategy for the week just played and for the season to date:
  grade it, stake it on paper, append the run, write the digest. Use when the
  user says "run my lab", "how did my strategy do", "Tuesday digest", or a
  scheduled routine fires. Produces a ledger and a ticket list; places
  nothing.
---

# Run

Call tools. Do not answer from memory. The strategy is frozen; you do not
edit it here. If it should change, that is a new discovery.

Ceiling and invariants: [CATALOG.md](../../src/lib/agent/CATALOG.md),
[context-prompt.md](../../src/lib/agent/context-prompt.md).

## Steps

1. Load the frozen strategy: `getStrategy` (or `listStrategies` and ask
   which) on a box with accounts; `labs/<name>/strategy.json` in the user's
   workspace on the public substrate, where those verbs are not offered.
   Read the filter, bet rule, staking policy, bankroll, and holdout seasons.
   Do not alter any of them.
2. Load the ledger so far: `getLabRuns`, or `labs/<name>/runs/*.json`. The
   most recent `weekly` run tells you the last week graded.
3. For the week just played: call `sampleGames` with the frozen filter,
   `seasons: [thisSeason]`, `weeks: [lastWeek]`, `played: true`. Build the
   bets from the frozen rule. `evaluateBets`, `summarizeRun`.
4. For the season to date: the same with all played weeks of this season.
   `evaluateBets`, `summarizeRun`, then `simulateBankroll` with the frozen
   policy and bankroll, so the digest has dollars and the bootstrap band.
5. For next week's ticket list: `sampleGames` with `weeks: [nextWeek]`,
   `played: false`. List the games and sides the rule would take, at the
   current closing line from `getGameLines`. This is a list, not advice.
6. Write the digest (format below). Append the run: `recordLabRun` with kind
   `weekly`, the week's summary, the season simulation, the week's bets, and
   the digest text — or `labs/<name>/runs/<season>-w<week>.json` on the
   substrate.

## Digest

```
<strategy name> · week N
this week     W-L-P · units · vs the number taken
season to date W-L-P · units · roi · pBreakEven · n
bankroll      $start → $now · max drawdown $ (x%) · bootstrap p5/p50/p95
next week     <n> games the rule takes, listed with the closing line
caveat        one sentence on what n can carry this season
```

## Output rules

- Every figure from `summarizeRun` or `simulateBankroll`. No rounding a
  −13% season into "a rough patch".
- The holdout record from the freeze is the baseline; if this season is
  running below its `p5`, say so plainly.
- Never "edge", "lock", "value". The ticket list is what the frozen rule
  selects; whether to bet it is the person's, off this box.

Do **not** call `placeWager`. Do **not** call `freezeStrategy` or
`deleteStrategy` from this skill. Do **not** call tick.
