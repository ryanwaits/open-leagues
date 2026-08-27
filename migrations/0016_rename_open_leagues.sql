-- One-time rename: the ff_ prefix (from the project's original "fantasy
-- football" working name) becomes ol_ (open-leagues). Covers both
-- migration-tracked tables/indexes AND the 5 tables + 2 indexes created
-- directly in app code via an idempotent create-if-not-exists pattern
-- (see plans/089) — ALTER TABLE/INDEX RENAME works identically either way.
-- Table renames only — Postgres does not require a table's own internal
-- constraint/sequence names to match the table name, so auto-named primary
-- keys etc. are left as-is (cosmetic only, see plans/089). IF EXISTS makes
-- this safe to apply to a database that (for any reason) already has the
-- new names.

alter table if exists ff_agent_tokens rename to ol_agent_tokens;
alter table if exists ff_allowlist rename to ol_allowlist;
alter table if exists ff_claims rename to ol_claims;
alter table if exists ff_dispatches rename to ol_dispatches;
alter table if exists ff_draft rename to ol_draft;
alter table if exists ff_events rename to ol_events;
alter table if exists ff_leagues rename to ol_leagues;
alter table if exists ff_matchups rename to ol_matchups;
alter table if exists ff_moves rename to ol_moves;
alter table if exists ff_picks rename to ol_picks;
alter table if exists ff_player_notes rename to ol_player_notes;
alter table if exists ff_player_status rename to ol_player_status;
alter table if exists ff_pool rename to ol_pool;
alter table if exists ff_projections rename to ol_projections;
alter table if exists ff_push_subs rename to ol_push_subs;
alter table if exists ff_queue rename to ol_queue;
alter table if exists ff_refresh_log rename to ol_refresh_log;
alter table if exists ff_rosters rename to ol_rosters;
alter table if exists ff_spots rename to ol_spots;
alter table if exists ff_ticks rename to ol_ticks;
alter table if exists ff_trade_assets rename to ol_trade_assets;
alter table if exists ff_trade_sides rename to ol_trade_sides;
alter table if exists ff_trades rename to ol_trades;
alter table if exists ff_user_ai rename to ol_user_ai;
alter table if exists ff_wagers rename to ol_wagers;
alter table if exists ff_waiver_holds rename to ol_waiver_holds;
alter table if exists ff_week_results rename to ol_week_results;

alter index if exists ff_agent_tokens_hash rename to ol_agent_tokens_hash;
alter index if exists ff_claims_league_week_idx rename to ol_claims_league_week_idx;
alter index if exists ff_dispatches_league_week rename to ol_dispatches_league_week;
alter index if exists ff_events_league_at rename to ol_events_league_at;
alter index if exists ff_moves_league_week_idx rename to ol_moves_league_week_idx;
alter index if exists ff_player_notes_player_idx rename to ol_player_notes_player_idx;
alter index if exists ff_player_status_rotowire_idx rename to ol_player_status_rotowire_idx;
alter index if exists ff_push_subs_user_league rename to ol_push_subs_user_league;
alter index if exists ff_queue_order_idx rename to ol_queue_order_idx;
alter index if exists ff_rosters_owner_idx rename to ol_rosters_owner_idx;
alter index if exists ff_spots_league_player_idx rename to ol_spots_league_player_idx;
alter index if exists ff_ticks_matchup_at rename to ol_ticks_matchup_at;
alter index if exists ff_wagers_league_week rename to ol_wagers_league_week;
alter index if exists ff_week_results_league_week_idx rename to ol_week_results_league_week_idx;
