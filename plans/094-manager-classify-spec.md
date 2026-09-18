# Plan 094: Classify + freeze spec

Manager lab slice 2. Planned at `400a7dc`. Depends on 093.

## Done when

- `classifyMoves` labels rows via Jev when `TYPESAFE_API_KEY` is set; no-op otherwise
- Key is box env, not the chat BYOK row (one row cannot hold Claude + Jev)
- `freezeManagerSpec` stores a league-scoped policy only if holdout beats always-no-move
- Holdout: later season if it has ≥4 weeks, else last 4 weeks of the one season
- Not in `PUBLIC_CORE`

## Out

Monday card, push, writes to the roster
