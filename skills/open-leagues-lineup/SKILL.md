---
name: open-leagues-lineup
description: >
  Set a fantasy lineup: sit and start players. Use when the user says
  "set lineup", "who should I start", "sit", "bench", "start this
  player", or "fix my roster".
---

# Set lineup

## Before anything

This skill only works with the open-leagues MCP server connected, pointed at a
league box — one running `OPENLEAGUES_MODE=league` with your seat and a
token. If no `open-leagues` tools are listed, or `getAgentContext` is refused
as "public substrate", stop and say so: the public box at leagues.waits.dev
hosts no leagues. Do not answer from memory.

Ceiling and invariants: [CATALOG.md](../../src/lib/agent/CATALOG.md),
[context-prompt.md](../../src/lib/agent/context-prompt.md).

Use `getTeam` plus `getWeekProjections` for the sit/start call. Do not
invent projections from memory.

## Steps

1. Call `getAgentContext` for the league.
2. Call `getTeam` for the user's roster (slots, bench, byes).
3. Call `getWeekProjections` for the same week.
4. Propose sits and starts in plain language. Wait for the human to
   confirm.
5. Apply with `sitPlayer` and/or `startPlayer`. Undo is the reverse
   pair.

Do not call tick. Lineup *advice without writes* belongs in
`open-leagues-week`.
