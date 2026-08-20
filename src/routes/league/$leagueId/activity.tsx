import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivity, getLeagueBundle } from "@/lib/data/fns";

export const Route = createFileRoute("/league/$leagueId/activity")({
  validateSearch: (s: Record<string, unknown>) => ({
    week: s.week != null ? Number(s.week) : undefined,
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const activity = useQuery({
    queryKey: ["activity", leagueId, week],
    queryFn: () => getActivity({ data: { leagueId, week } }),
  });

  return (
    <div>
      {activity.data == null &&
      (activity.isPending || activity.isLoading || !activity.isFetched) ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : activity.isSuccess && activity.data.length === 0 ? (
        <p className="text-sm text-muted">No transactions this week.</p>
      ) : (
        <ul className="space-y-2">
          {activity.data?.map((tx) => (
            <li key={tx.id} className="rounded-xl bg-surface px-4 py-3 ring-card">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{tx.type.replace("_", " ")}</Badge>
                <Badge tone={tx.status === "complete" ? "win" : "muted"}>{tx.status}</Badge>
                <span className="text-xs text-faint">{tx.teamNames.join(" · ")}</span>
                {tx.bid != null ? (
                  <span className="font-mono text-xs text-muted">${tx.bid}</span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {tx.adds.map((p) => (
                  <span key={`a-${p.playerId}`} className="text-win">
                    + {p.name}
                    {p.pos ? ` (${p.pos})` : ""}
                  </span>
                ))}
                {tx.adds.length && tx.drops.length ? (
                  <ArrowLeftRight className="size-3.5 text-faint" />
                ) : null}
                {tx.drops.map((p) => (
                  <span key={`d-${p.playerId}`} className="text-loss">
                    − {p.name}
                    {p.pos ? ` (${p.pos})` : ""}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
