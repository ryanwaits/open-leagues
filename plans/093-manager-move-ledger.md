# Plan 093: Move ledger

Manager lab slice 1. Facts only. Planned at `400a7dc`.

SDIFFL `1312215005088739328` (2026), previous `1255972181892935680` (2025),
ryanwaits roster 1.

## Done when

- `ol_projections` does not overwrite settled weeks
- `getMoveLedger` returns every roster's adds/drops/claims with
  remaining_before, last3 / season_avg / sleeper_proj / actuals
- One `previous_league_id` hop (default on)
- `PUBLIC_CORE` + tests: remaining never negative; sources use prior weeks only

## Out

Jev, advice, UI, `engine.server.ts`
