---
name: open-leagues-book
description: >
  Read the matchup book and place or pull FAAB wagers. Use when the
  user says "book", "bet", "wager", "spread", "moneyline", "pull my
  ticket", or "fade".
---

# Matchup book

Ceiling and invariants: [CATALOG.md](../../src/lib/agent/CATALOG.md),
[context-prompt.md](../../src/lib/agent/context-prompt.md).

You cannot fade the user's own roster. You may back your own team;
you may not bet against it. The engine also blocks fade-self.

## Steps

1. Call `getAgentContext` then `getBook` for the league / week.
2. Summarize lines and open tickets. Confirm stake in whole dollars.
3. Place with `placeWager`, or withdraw before close with
   `pullWager`.

Do not invent a second FAAB purse. Do not call tick.
