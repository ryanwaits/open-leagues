import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GhostNum } from "@/components/ghost-num";
import { ScoreStrip } from "@/components/scoreboard";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarOf } from "@/lib/data/calendar";
import { getLiveWire, getPulse, getScores } from "@/lib/data/fns";
import { warmQuery } from "@/lib/query-client";
import { cn, formatPts } from "@/lib/utils";

type Search = { week?: number; season?: number; kind?: "pre" | "regular" | "post" };

export const Route = createFileRoute("/scores")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: typeof s.week === "number" ? s.week : s.week ? Number(s.week) : undefined,
    season: typeof s.season === "number" ? s.season : s.season ? Number(s.season) : undefined,
    kind: s.kind === "pre" || s.kind === "regular" || s.kind === "post" ? s.kind : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const { week, season, kind } = deps;
    const seasonType = kind === "pre" ? 1 : kind === "post" ? 3 : 2;
    return Promise.all([
      warmQuery(context.queryClient, {
        queryKey: ["pulse"],
        queryFn: () => getPulse(),
      }),
      warmQuery(context.queryClient, {
        queryKey: ["scores", season, week, seasonType],
        queryFn: () => getScores({ data: { week, season, seasonType } }),
      }),
    ]);
  },
  component: ScoresPage,
});

const KINDS = [
  { id: "pre" as const, label: "Pre", type: 1 },
  { id: "regular" as const, label: "Regular", type: 2 },
  { id: "post" as const, label: "Post", type: 3 },
];

function ScoresPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const pulse = useQuery({
    queryKey: ["pulse"],
    queryFn: () => getPulse(),
  });
  const cal = pulse.data ? calendarOf(pulse.data.state) : null;
  const kind = search.kind ?? cal?.kind ?? "regular";
  const seasonType = KINDS.find((k) => k.id === kind)?.type ?? 2;
  const week = search.week ?? cal?.week;
  const season = search.season ?? cal?.seasonNum;

  const q = useQuery({
    queryKey: ["scores", season, week, seasonType],
    queryFn: () =>
      getScores({
        data: {
          week,
          season,
          seasonType,
        },
      }),
    refetchInterval: (query) => {
      const games = query.state.data?.games ?? [];
      if (games.some((g) => g.state === "in")) return 12_000;
      if (games.some((g) => g.state === "pre")) return 30_000;
      return false;
    },
  });

  const wire = useQuery({
    queryKey: ["live-wire", season, week, kind],
    queryFn: () =>
      getLiveWire({
        data: { season, week, kind },
      }),
    refetchInterval: (query) => (query.state.data?.live ? 12_000 : 30_000),
  });

  const resolvedWeek = week ?? wire.data?.week ?? q.data?.week ?? 1;
  const liveGames = q.data?.games.filter((g) => g.state === "in").length ?? 0;

  return (
    <Shell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="ghost-host">
          <GhostNum n={resolvedWeek} />
          <p className="microlabel">ESPN public scoreboard</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">NFL scores</h1>
          <p className="mt-1 text-sm text-muted">Tap a game for the live box and every play.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.id}
              type="button"
              size="sm"
              variant={kind === k.id ? "primary" : "outline"}
              onClick={() => navigate({ search: { ...search, kind: k.id } })}
            >
              {k.label}
            </Button>
          ))}
        </div>
      </header>

      <section className="mt-6 rounded-xl bg-surface p-4 ring-card sm:p-5">
        <p className="microlabel">Scoring pipe</p>
        <p className="mt-2 text-sm text-muted">
          {liveGames > 0
            ? `${liveGames} game${liveGames === 1 ? "" : "s"} live · unofficial fantasy lines poll every 12s.`
            : "No NFL games in progress. The pipe is live — nothing to tick until kickoff."}
        </p>
        <p className="mt-1 font-mono text-[11px] text-faint">
          {wire.data
            ? `${wire.data.kind} ${wire.data.season} week ${wire.data.week} · ${wire.data.scoredPlayers} unofficial lines · ${wire.data.gamesIn}/${wire.data.gamesTotal} live`
            : "Checking unofficial feed…"}
        </p>
        <p className="mt-3 text-sm text-muted">
          Replay a locked week from a hosted league&rsquo;s matchups tab once you have one.
        </p>
      </section>

      <div className="mt-6 flex gap-1 overflow-x-auto pb-2">
        {Array.from(
          { length: kind === "regular" ? 18 : kind === "pre" ? 4 : 5 },
          (_, i) => i + 1,
        ).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => navigate({ search: { ...search, week: w, season } })}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-sm font-mono text-sm",
              w === resolvedWeek ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {(() => {
          const scoresReady = q.isFetched && week != null && season != null;
          if (!scoresReady && !q.data) {
            return (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            );
          }
          if (q.data?.games.length) {
            return <ScoreStrip games={q.data.games} />;
          }
          if (scoresReady) {
            return <p className="text-sm text-muted">No games for that week.</p>;
          }
          return (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          );
        })()}
      </div>

      {wire.data?.leaders.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Unofficial PPR this week</h2>
          <p className="mt-1 text-sm text-muted">
            Same Sleeper stat line we score leagues from. Empty means they have not posted this week
            yet.
          </p>
          <ol className="mt-4 divide-y divide-line rounded-xl bg-surface ring-card">
            {wire.data.leaders.map((row, i) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 font-mono text-xs text-faint">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {row.name}
                  <span className="ml-2 microlabel">
                    {[row.pos, row.team].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-mono text-sm tabular-nums">{formatPts(row.points, 1)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </Shell>
  );
}
