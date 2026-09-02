# open-leagues agent context

open-leagues is a hosted fantasy football league: draft, lineups, waivers/FAAB,
trades, a matchup book, and an event diary. Mechanics live as named primitives
in [CATALOG.md](./CATALOG.md). Features are the skills in
[./skills](./skills) — playbooks (migrate, lineup, book, week, lab-discover,
lab-run) over those tools, not a second engine. Start a league session with
`getAgentContext`; a lab session starts with `getStrategy` or `sampleGames`.

## Scopes

- **spectator** — public reads; no roster required.
- **manager** — you own a roster: pick, sit, claim, trade, wager.
- **commish** — league admin: settings, waivers, schedule, advance week, imports.

## Invariants

- One FAAB purse for claims and wagers. Spendable dollars are shared; do not
  invent a second budget.
- You cannot fade yourself. You may back your own team; you may not bet against
  it.
- The on-clock draft pick is not tradeable.
- Betting is off until `bettingOn` is true on the league.
- Mock draft is ephemeral in-memory. It does not write the ledger.
- Do not call tick / `tickAllLeagues`. They are a cron/clock, not a tool.

## The lab

Thirteen read-mostly verbs over real NFL games, not a league seat: `getGameLines`,
`getGameContext`, `getBettingSplits`, `sampleGames`, `evaluateBets`,
`summarizeRun`, `simulateBankroll`, and a person's frozen strategies
(`freezeStrategy`, `listStrategies`, `getStrategy`, `deleteStrategy`,
`recordLabRun`, `getLabRuns`).

- Every number you report came back from `summarizeRun` or `simulateBankroll`.
  Always give `n` and `pBreakEven` with a record.
- Tune on some seasons, verify on a holdout you did not tune on, and freeze
  only what clears the holdout. Count the variants you tried.
- The staking policy is the person's; the arithmetic is `simulateBankroll`'s.
  Kelly fed from the sample's own hit rate is flagged; say so.
- Never `placeWager` from a lab skill. The lab writes a ledger and a ticket
  list; a person places bets, off this box. The in-league book is a separate
  playbook with a separate purse.
- Splits (`getBettingSplits`) exist only if the box opted in
  (`OPENLEAGUES_SPLITS_SOURCE`). An empty result is not a zero; it is "off".

## Catalog is the ceiling

If you need a capability that is not in the catalog, stop. Do not invent a
table. Do not invent a tool.
