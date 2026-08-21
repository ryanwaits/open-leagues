import { useQuery } from "@tanstack/react-query";
import { getScores, getWeekStats } from "@/lib/data/fns";
import { denserStatBag } from "@/lib/demo/pre-live";
import { usePreLive } from "@/lib/demo/store";

const POLL_MS = 4_000;

export function usePreLiveFeed() {
  const on = usePreLive();
  const board = useQuery({
    queryKey: ["pre-live-board"],
    queryFn: () => getScores({ data: {} }),
    enabled: on,
    refetchInterval: (q) => {
      if (!on) return false;
      const games = q.state.data?.games ?? [];
      if (games.some((g) => g.state === "in")) return POLL_MS;
      if (games.some((g) => g.state === "pre")) return 20_000;
      return false;
    },
  });
  const seasonType = board.data?.seasonType;
  const kind = seasonType === "post" || seasonType === "pre" ? seasonType : "pre";
  const season = board.data?.season ? String(board.data.season) : "";
  const week = board.data?.week ?? 0;
  const live = Boolean(board.data?.games.some((g) => g.state === "in"));
  const stats = useQuery({
    queryKey: ["pre-live-stats", season, week, kind],
    queryFn: () => getWeekStats({ data: { season, week, kind } }),
    enabled: on && Boolean(season) && week > 0,
    refetchInterval: () => (live ? POLL_MS : false),
  });
  const fallback = useQuery({
    queryKey: ["pre-live-stats", season, week - 1, kind],
    queryFn: () => getWeekStats({ data: { season, week: week - 1, kind } }),
    enabled: on && Boolean(season) && week > 1 && Object.keys(stats.data ?? {}).length < 20,
    refetchInterval: () => (live ? POLL_MS : false),
  });
  return {
    on,
    games: board.data?.games ?? [],
    stats: denserStatBag(stats.data, fallback.data),
    live,
    week,
    season,
    kind,
  };
}
