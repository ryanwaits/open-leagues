import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GhostNum } from "@/components/ghost-num";
import { ScoreStrip } from "@/components/scoreboard";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLiveWire, getPulse, getScores } from "@/lib/data/fns";
import {
  asScoreboardKind,
  resolveScoreboard,
  scoreboardIsNow,
  seasonTypeNum,
} from "@/lib/data/scoreboard-week";
import { warmQuery } from "@/lib/query-client";
import { cn, formatPts } from "@/lib/utils";

type Search = { week?: number; season?: number; kind?: "pre" | "regular" | "post" };

function pollScores(games: { state: string }[] | undefined) {
  const list = games ?? [];
  if (list.some((g) => g.state === "in")) return 12_000;
  if (list.some((g) => g.state === "pre")) return 30_000;
  return false;
}

export const Route = createFileRoute("/scores")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: typeof s.week === "number" ? s.week : s.week ? Number(s.week) : undefined,
    season: typeof s.season === "number" ? s.season : s.season ? Number(s.season) : undefined,
    kind: s.kind === "pre" || s.kind === "regular" || s.kind === "post" ? s.kind : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const { week, season, kind } = deps;
    return Promise.all([
      warmQuery(context.queryClient, {
        queryKey: ["pulse"],
        queryFn: () => getPulse(),
      }),
      warmQuery(context.queryClient, {
        queryKey: ["scores", "now"],
        queryFn: () => getScores({ data: {} }),
      }),
      week != null && kind
        ? warmQuery(context.queryClient, {
            queryKey: ["scores", season, week, kind],
            queryFn: () =>
              getScores({
                data: { week, season, seasonType: seasonTypeNum(kind) },
              }),
          })
        : Promise.resolve(null),
    ]);
  },
  component: ScoresPage,
});

const KINDS = [
  { id: "pre" as const, label: "Pre" },
  { id: "regular" as const, label: "Regular" },
  { id: "post" as const, label: "Post" },
];

function ScoresPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const now = useQuery({
    queryKey: ["scores", "now"],
    queryFn: () => getScores({ data: {} }),
    refetchInterval: (query) => pollScores(query.state.data?.games),
  });
  const nowCursor = now.data
    ? {
        week: now.data.week,
        season: now.data.season,
        seasonType: asScoreboardKind(now.data.seasonType) ?? "regular",
      }
    : null;
  const cursor = resolveScoreboard(search, nowCursor);
  const onNow = scoreboardIsNow(cursor, nowCursor);

  const q = useQuery({
    queryKey: ["scores", cursor?.season, cursor?.week, cursor?.seasonType],
    queryFn: () => {
      if (!cursor) throw new Error("scoreboard cursor missing");
      return getScores({
        data: {
          week: cursor.week,
          season: cursor.season,
          seasonType: seasonTypeNum(cursor.seasonType),
        },
      });
    },
    enabled: Boolean(cursor) && !onNow,
    refetchInterval: (query) => pollScores(query.state.data?.games),
  });

  const board = onNow ? now.data : q.data;
  const kind = cursor?.seasonType ?? nowCursor?.seasonType ?? "regular";
  const season = cursor?.season ?? now.data?.season;
  const resolvedWeek = cursor?.week ?? board?.week ?? 1;

  const wire = useQuery({
    queryKey: ["live-wire", season, resolvedWeek, kind],
    queryFn: () =>
      getLiveWire({
        data: { season, week: resolvedWeek, kind },
      }),
    enabled: Boolean(season) && Boolean(resolvedWeek),
    refetchInterval: (query) => (query.state.data?.live ? 12_000 : 30_000),
  });

  const liveGames = board?.games.filter((g) => g.state === "in").length ?? 0;

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
              onClick={() =>
                navigate({
                  search: {
                    kind: k.id,
                    season,
                  },
                })
              }
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
            onClick={() => navigate({ search: { kind, week: w, season } })}
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
          const scoresReady = Boolean(board) && cursor != null;
          if (!scoresReady && !board) {
            return (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
                  <Skeleton key={k} className="h-28" />
                ))}
              </div>
            );
          }
          if (board?.games.length) {
            return <ScoreStrip games={board.games} />;
          }
          if (scoresReady) {
            return <p className="text-sm text-muted">No games for that week.</p>;
          }
          return (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
                <Skeleton key={k} className="h-28" />
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
