# Plan 096: Win-probability series

Receipts slice. Planned 2026-09-26 at `0e573d3`. For SDIFFL Weekly
(ryanwaits/dataviz `stories/sdiffl/WEEKLY-BRIEF.md`, GAME OF THE WEEK).

## Done when

- `getWinProbSeries(leagueId, week, matchupId)` returns both scores and home's
  win chance at kickoffs, every scoring play, settlement and lead change, and
  each quarter hour a starter's game is on (none between games)
- Same play log and model as the receipt's flip: one replay (`flip.ts`
  `replay`) feeds `computeFlip` and `scoreSeries`; one model (`winModel`) feeds
  `flipFor` and the series, so the two cannot disagree
- `winnerLow`: the eventual winner's lowest sampled chance (the comeback depth)
- Hosted leagues keep the seat rule; in `PUBLIC_CORE`

SDIFFL check: league `1312215005088739328`, week 1, matchup 1 — 167 points,
final 136.76–123.9 matches Sleeper.

## Out

A chart in open-leagues itself, per-player curves, caching the series
