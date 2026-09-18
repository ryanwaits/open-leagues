---
name: open-leagues-wire
description: >
  Monday waiver card for a Sleeper league: spendable FAAB, bid band or
  no-move, fetchable receipt. Use when the user says "waivers", "wire
  card", "what should I bid", "any adds", "should I add anyone",
  "looking to add", "anyone this week", or "Monday FAAB". Works on the
  public box with a Sleeper league id — do not wait for a league-box
  token. Notify only — never write the roster.
---

# Wire card

## Before anything

This skill only works with the open-leagues MCP server connected. Public
substrate: pass a Sleeper league id (SDIFFL `1312215005088739328`; ryanwaits
is roster 1). A league box also works for hosted `lg_` ids.

Prefer `getWireCard`. If `getAgentContext` is listed and the user named a
hosted league, call it first for spendable FAAB as a cross-check.

Ceiling: [CATALOG.md](../../src/lib/agent/CATALOG.md),
[context-prompt.md](../../src/lib/agent/context-prompt.md).

Call tools. Do not invent a bid.

## Steps

1. `getWireCard` with the league id and roster id (default SDIFFL roster 1
   if they said "my team" and named SDIFFL).
2. Print the call: no-move with its reason, or add X at bid [lo, hi], and
   remaining FAAB. Name the source (spec or quantile).
3. If they ask why, `getAdviceReceipt` with the card's receipt id. Always
   read `seat` (this roster at that pos, injuries, last add) before repeating
   the bid band. Comps on the receipt are the band set, not the whole tape.
4. Optional: `getMoveLedger` for the season tape; `gradeManagerSpec` for
   the holdout. `classifyMoves` / `freezeManagerSpec` only on a box with
   a person and, for labels, `TYPESAFE_API_KEY`.

## Output

- Remaining FAAB / budget
- The call, or an explicit no-move
- Receipt id
- One line on source (spec vs quantile)

Do **not** call `addDrop`, `dropPlayer`, `sitPlayer`, or `startPlayer`.
Do **not** invent a bid when the card said no-move.
Do not call tick.
