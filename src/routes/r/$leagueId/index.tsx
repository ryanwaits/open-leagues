import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, WeekBoardList } from "@/components/receipt-card";
import { getWeekBoard } from "@/lib/data/fns";
import { useConsoleSkin } from "@/lib/use-console-skin";

type Search = { week?: number };

/** A league's week, every matchup, each side a link to its receipt. */
export const Route = createFileRoute("/r/$leagueId/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: s.week != null && Number.isFinite(Number(s.week)) ? Number(s.week) : undefined,
  }),
  component: WeekPage,
  head: () => ({ meta: [{ title: "Receipts · open-leagues" }] }),
});

function WeekPage() {
  useConsoleSkin();
  const { leagueId } = Route.useParams();
  const { week } = Route.useSearch();
  const q = useQuery({
    queryKey: ["receipts", "board", leagueId, week ?? "current"],
    queryFn: () => getWeekBoard({ data: { leagueId, week: week ?? null } }),
    staleTime: 60_000,
  });

  return (
    <PublicShell>
      {q.isPending ? (
        <p className="mt-10 text-sm text-muted">Reading the league…</p>
      ) : q.error || !q.data ? (
        <div className="mt-10">
          <p className="text-[15px]">Couldn&apos;t read that league.</p>
          <p className="mt-2 text-sm text-muted">
            Receipts work for Sleeper leagues by id or username. A hosted league needs a seat.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
            Try another
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
                receipts · {q.data.league.season}
              </p>
              <h1 className="mt-1 text-[28px] font-medium tracking-[-0.01em]">
                {q.data.league.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 font-mono text-[12px]">
              {q.data.week > 1 ? (
                <Link
                  to="/r/$leagueId"
                  params={{ leagueId }}
                  search={{ week: q.data.week - 1 }}
                  className="rounded-pill border border-line-strong px-2.5 py-1 text-muted hover:text-fg"
                >
                  ← week {q.data.week - 1}
                </Link>
              ) : null}
              {q.data.week < q.data.currentWeek ? (
                <Link
                  to="/r/$leagueId"
                  params={{ leagueId }}
                  search={{ week: q.data.week + 1 }}
                  className="rounded-pill border border-line-strong px-2.5 py-1 text-muted hover:text-fg"
                >
                  week {q.data.week + 1} →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <WeekBoardList board={q.data} />
          </div>
          <p className="mt-4 text-[13px] text-faint">
            Tap a team for its receipt: the score, what was left on the bench, what the wire cost.
          </p>
        </>
      )}
    </PublicShell>
  );
}
