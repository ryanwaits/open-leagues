---
name: open-leagues-lineup
description: >
  Set a fantasy lineup: sit and start players. Use when the user says
  "set lineup", "who should I start", "sit", "bench", "start this
  player", or "fix my roster".
---

# Set lineup

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md).

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
