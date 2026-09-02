---
name: open-leagues-week
description: >
  Read-only weekly digest for one league: record, matchup, bye/injury
  flags, one waiver idea. Use when the user says "week preview",
  "newsletter", "who do I play", "waiver wire idea", or "what's
  going on this week". Decision support only, not autopilot.
---

# Weekly digest

## Before anything

This skill only works with the open-leagues MCP server connected, pointed at a
league box (one running `OPENLEAGUES_MODE=league` with your seat and a
token). If no `open-leagues` tools are listed, or `getAgentContext` is refused
as "public substrate", stop and say so: the public box at leagues.waits.dev
hosts no leagues. Do not answer from memory.

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
- One FA add idea from the wire

Do **not** write the roster or claim / drop players here. Lineup
changes are `open-leagues-lineup`. Do not call tick.
