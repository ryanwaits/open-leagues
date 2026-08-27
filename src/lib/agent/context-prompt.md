# open-leagues agent context

open-leagues is a hosted fantasy football league: draft, lineups, waivers/FAAB,
trades, a matchup book, and an event diary. Mechanics live as named primitives
in [CATALOG.md](./CATALOG.md). Features are the skills in
[./skills](./skills) — playbooks (migrate, lineup, book, week) over those
tools, not a second engine. Start a session with `getAgentContext`.

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

## Catalog is the ceiling

If you need a capability that is not in the catalog, stop. Do not invent a
table. Do not invent a tool.
