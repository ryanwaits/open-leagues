---
name: open-leagues-week
description: >
  Read-only weekly digest for one league: record, matchup, bye/injury
  flags, one waiver idea. Use when the user says "week preview",
  "newsletter", "who do I play", "waiver wire idea", or "what's
  going on this week". Decision support only — not autopilot.
---

# Weekly digest

Call tools. Do not answer from memory.

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md).

## Steps

1. Call `getAgentContext`.
2. Call `getMatchups` for the week.
3. Call `getTeam` for the user's roster.
4. Call `getWire` for free-agent context.

## Output

- Record / standings bite from context
- This week's opponent
- Bye / injury flags as sit-or-start *advice* only
- One FA add idea from the wire

Do **not** write the roster or claim / drop players here. Lineup
changes are `open-ff-lineup`. Do not call tick.
