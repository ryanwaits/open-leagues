-- Matchup samples on game days: the past the live line needs. Append-only,
-- never read by any mechanic. One row per matchup per ~minute while scoring
-- is live, written on read (getMatchups) and on the hourly tick.
create table if not exists ff_ticks (
  league_id text not null,
  week int not null,
  matchup_id int not null,
  at timestamptz not null default now(),
  home_pts real not null,
  away_pts real not null,
  home_proj real not null,
  away_proj real not null,
  home_pct smallint not null,
  spread real not null
);
create index if not exists ff_ticks_matchup_at on ff_ticks (league_id, week, matchup_id, at);
