import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fromSleeperSettings, type ScoringBook } from "@/lib/league/scoring";
import { useLeagueStore } from "@/lib/store";
import { fantasyStatKind } from "./calendar";
import { getLeagueBundle, getMatchups, getWeekStats } from "./fns";
import { type TrackedPlayer, trackedForGame } from "./play-tags";
import type { GameSummary } from "./types";

export type GameTracking = {
  tracked: TrackedPlayer[];
  leagueId: string | null;
  week: number | null;
  matchupId: number | null;
  /** The league's scoring, for pricing a single play. */
  book: ScoringBook;
};

const LIVE_MS = 30_000;

/**
 * Your current matchup's starters (yours + the opponent's) who play in this
 * game, from the league you were last in. Quiet when there is no league, no
 * matchup, or nobody relevant — the page is about the game either way.
 */
export function useGameTracking(g: GameSummary | null | undefined): GameTracking {
  const hasHydrated = useLeagueStore((s) => s.hasHydrated);
  const recent = useLeagueStore((s) => s.recent);
  const leagueId = hasHydrated ? (recent[0]?.leagueId ?? null) : null;
  const live = g?.state === "in";

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId: leagueId! } }),
    enabled: Boolean(leagueId),
    staleTime: 60_000,
  });
  // Regular-season games line up with league weeks; anything else (preseason,
  // a stray id) falls back to the league's current week.
  const week = g?.seasonType === "regular" && g.week ? g.week : (league.data?.currentWeek ?? null);
  const season = league.data?.league.season;

  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId: leagueId!, week: week! } }),
    enabled: Boolean(leagueId) && week != null,
    refetchInterval: live ? LIVE_MS : false,
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", season, week],
    queryFn: () =>
      getWeekStats({ data: { season: String(season), week: week!, kind: fantasyStatKind() } }),
    enabled: Boolean(season) && week != null,
    refetchInterval: live ? LIVE_MS : false,
  });

  const myRosterId = league.data?.myRosterId ?? null;
  const pair = useMemo(
    () =>
      (matchups.data ?? []).find(
        (p) => p.home.rosterId === myRosterId || p.away?.rosterId === myRosterId,
      ) ?? null,
    [matchups.data, myRosterId],
  );
  const tracked = useMemo(
    () => (g ? trackedForGame(pair, myRosterId, g, weekStats.data) : []),
    [g, pair, myRosterId, weekStats.data],
  );

  const settings = league.data?.league.scoring_settings;
  const book = useMemo(() => fromSleeperSettings(settings), [settings]);

  return { tracked, leagueId, week, matchupId: pair?.matchupId ?? null, book };
}
