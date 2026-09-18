---
name: open-leagues-week
description: >
  Read-only weekly digest for one league: record, matchup, bye/injury
  flags. Use when the user says "week preview", "newsletter", "who do
  I play", or "what's going on this week". Adds and FAAB are
  open-leagues-wire, not this skill. Decision support only, not autopilot.
---

# Weekly digest

## Before anything

This skill only works with the open-leagues MCP server connected.

Adds / waivers / FAAB: stop and use open-leagues-wire (`getWireCard`). That
works on the public box with a Sleeper league id (SDIFFL
`1312215005088739328`, roster 1). Do not call `getAgentContext` for that.

The rest of this digest (record, matchup, sit/start flags) needs
`getAgentContext` on a league box. If that call is refused as public
substrate, do not invent a digest. You may still run `getWireCard` if they
named a Sleeper league. Do not answer from memory.

Ceiling and invariants: [CATALOG.md](../../src/lib/agent/CATALOG.md),
[context-prompt.md](../../src/lib/agent/context-prompt.md).

## Steps

1. Call `getAgentContext`.
2. Call `getMatchups` for the week.
3. Call `getTeam` for the user's roster.
4. Call `getWire` for free-agent context.

## Output

- Record / standings bite from context
- This week's opponent
- Bye / injury flags as sit-or-start *advice* only

Adds belong in open-leagues-wire.

League points are `getReceipt`. Do not quote `getLiveWire` as this
league's score — that verb is unofficial Sleeper PPR, not the book.

Do **not** write the roster or claim / drop players here. Lineup
changes are `open-leagues-lineup`. Do not call tick.
