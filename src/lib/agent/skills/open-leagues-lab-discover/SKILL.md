---
name: open-leagues-lab-discover
description: >
  Turn a betting hunch stated in plain words into a tested strategy: find the
  cohort, grade it on the seasons it was tuned on, verify it on seasons it was
  not, and freeze the spec only if it survives. Use when the user says "test
  this hunch", "is there anything to", "backtest", or "find me a trend".
  Read-only until the freeze; never recommends a bet.
---

# Discover

Call tools. Do not answer from memory. Every number you report came back from
`summarizeRun` or `simulateBankroll`.

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md).

## The one rule that matters

You will look at many cohorts. One of them will look good by luck. So:

- Tune on some seasons, verify on others, and never touch the holdout until
  the rule is fixed. Default: discover on all but the most recent full season,
  hold out the most recent.
- Report `pBreakEven` and `n` every time. Below 0.05 on the holdout with
  n ≥ 100 is worth freezing. Anything else is a story, and you say so.
- Do not widen or narrow a filter *after* seeing the holdout. That is the
  thing this skill exists to prevent.

## Steps

1. Translate the words into one `sampleGames` filter and one bet rule
   (market, side). If the words admit two readings, ask before running.
   If the filter needs ticket or money share, call `getBettingSplits` for one
   week first; an empty `games` object means the box has not opted into a
   splits source — stop and say so.
2. Call `sampleGames` on the discovery seasons. Build the bet list from the
   rule. Call `evaluateBets`, then `summarizeRun`. Read `decided`, `roi`,
   `pBreakEven`, `maxDrawdown`, `bySeason`.
3. Explore variants if asked — spread bands, rest edges, roof — but count
   them. Ten variants at p < 0.05 is one expected false positive; say that.
4. Fix the best rule. Call `sampleGames` on the holdout seasons *only now*.
   `evaluateBets`, `summarizeRun`. This is the number that decides.
5. If the user named a bankroll or a staking policy, call `simulateBankroll`
   on the holdout's graded bets. Report the bootstrap band (`p5`/`p50`/`p95`)
   and `probLoss`, not just the point result. If they named none, use
   `{ type: "flat", unit: 1% of bankroll }` and say you did.
6. If it survives and the user wants to track it, call `freezeStrategy` with
   the exact filter, bet rule, staking policy, bankroll, and both season
   lists. Then `recordLabRun` with kind `discover`, the holdout summary, the
   simulation, and the bets.

## Output

- Discovery record and holdout record, each with n, roi, pBreakEven.
- How many variants you looked at.
- The bootstrap band if a bankroll was given.
- One sentence on what the sample can and cannot carry.
- Never "edge", "lock", "value", or a bet to place. Not one.

Do **not** call `placeWager`, `addDrop`, or anything that moves money or a
roster. Do **not** freeze a strategy that did not clear the holdout.
