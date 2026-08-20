import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGameSummary } from "@/lib/data/fns";
import type { GameDrive, GameSummary, TeamBox } from "@/lib/data/types";
import { Shell } from "@/components/shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scores_/$gameId")({
  component: GamePage,
});

function GamePage() {
  const { gameId } = Route.useParams();
  const [tab, setTab] = useState<"plays" | "box">("plays");
  const q = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getGameSummary({ data: { gameId } }),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "in") return 8_000;
      if (state === "pre") return 20_000;
      return false;
    },
  });

  if (q.data == null && q.isPending) {
    return (
      <Shell>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-36" />
        <Skeleton className="mt-4 h-80" />
      </Shell>
    );
  }
  if (q.error || !q.data) {
    return (
      <Shell>
        <Back />
        <p className="mt-4 text-sm text-muted">Could not load that box score.</p>
      </Shell>
    );
  }

  const g = q.data;
  const live = g.state === "in";

  return (
    <Shell>
      <Back />
      <ScoreHead g={g} live={live} />

      {g.scoring.length ? (
        <section className="mt-6">
          <h2 className="microlabel">Scoring</h2>
          <ol className="mt-2 divide-y divide-line rounded-xl bg-surface ring-card">
            {g.scoring.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
                {s.logo ? (
                  <img src={s.logo} alt="" className="mt-0.5 size-5 object-contain" />
                ) : (
                  <span className="mt-0.5 w-5 font-mono text-[10px] text-faint">{s.team}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{s.text}</p>
                  <p className="font-mono text-[11px] text-faint">
                    Q{s.period} {s.clock}
                    {s.type ? ` · ${s.type}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
                  {s.awayScore}–{s.homeScore}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-6 flex gap-1">
        {(
          [
            ["plays", "Plays"],
            ["box", "Box"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-10 rounded-sm px-4 text-sm",
              tab === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plays" ? <PlayFeed g={g} /> : <BoxTables g={g} />}
    </Shell>
  );
}

function Back() {
  return (
    <Link
      to="/scores"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-4" strokeWidth={1.75} />
      NFL scores
    </Link>
  );
}

function ScoreHead({ g, live }: { g: GameSummary; live: boolean }) {
  const awayDim = g.state === "post" && g.away.winner === false;
  const homeDim = g.state === "post" && g.home.winner === false;
  return (
    <section className="mt-4 rounded-xl bg-surface px-4 py-5 ring-card sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="microlabel">
          {g.seasonType === "pre"
            ? "Preseason"
            : g.seasonType === "post"
              ? "Postseason"
              : "Regular"}{" "}
          · Week {g.week} · {g.season}
        </p>
        <Badge tone={live ? "live" : g.state === "post" ? "win" : "default"}>
          {live ? "Live" : g.detail || "Scheduled"}
        </Badge>
      </div>
      <TeamScore team={g.away} dim={awayDim} />
      <div className="my-2" />
      <TeamScore team={g.home} dim={homeDim} />
      {live && g.situation ? (
        <p className="mt-4 font-mono text-xs text-live">{g.situation}</p>
      ) : null}
      {g.lastPlay ? (
        <p className="mt-2 text-sm text-muted">
          <span className="microlabel">Last play </span>
          {g.lastPlay}
        </p>
      ) : null}
      {live ? <p className="mt-3 microlabel">Public ESPN box · ticks every 8s</p> : null}
    </section>
  );
}

function TeamScore({ team, dim }: { team: GameSummary["home"]; dim: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", dim && "opacity-45")}>
      {team.logo ? (
        <img src={team.logo} alt="" className="size-9 object-contain" />
      ) : (
        <span className="size-9 rounded-sm bg-raised" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg">{team.name}</p>
        {team.record ? <p className="font-mono text-[11px] text-faint">{team.record}</p> : null}
      </div>
      <p className="font-display text-4xl tabular-nums tracking-tight">{team.score || "—"}</p>
    </div>
  );
}

function PlayFeed({ g }: { g: GameSummary }) {
  if (!g.drives.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre"
          ? "No plays yet — waiting on kickoff."
          : "No play-by-play posted for this game."}
      </p>
    );
  }
  const drives: GameDrive[] = g.state === "in" ? [...g.drives].reverse() : g.drives;
  return (
    <div className="mt-4 space-y-3">
      {drives.map((d) => (
        <article key={d.id} className="rounded-xl bg-surface ring-card">
          <header className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
            {d.logo ? <img src={d.logo} alt="" className="size-4 object-contain" /> : null}
            <p className="min-w-0 flex-1 truncate microlabel">
              {d.team || "Drive"}
              {d.result ? ` · ${d.result}` : ""}
              {d.description ? ` · ${d.description}` : ""}
            </p>
          </header>
          <ol>
            {d.plays.map((p) => (
              <li
                key={p.id}
                className={cn("flex items-start gap-3 px-3 py-2 sm:px-4", p.scoring && "bg-win/10")}
              >
                <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-faint">
                  {p.period ? `Q${p.period}` : ""}
                  {p.clock ? ` ${p.clock}` : ""}
                </span>
                <p className="min-w-0 flex-1 text-sm">{p.text}</p>
                {p.scoring ? (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-win">
                    {p.awayScore}–{p.homeScore}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function BoxTables({ g }: { g: GameSummary }) {
  if (!g.box.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre" ? "Box opens at kickoff." : "No box score posted."}
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-8">
      {g.box.map((team) => (
        <TeamBoxBlock key={team.abbr} team={team} />
      ))}
    </div>
  );
}

function TeamBoxBlock({ team }: { team: TeamBox }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {team.logo ? <img src={team.logo} alt="" className="size-6 object-contain" /> : null}
        <h2 className="font-display text-2xl tracking-tight">{team.name}</h2>
      </div>
      {team.teamStats.length ? (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-surface px-4 py-3 ring-card sm:grid-cols-5">
          {team.teamStats.map((s) => (
            <div key={s.label}>
              <dt className="microlabel-data">{s.label}</dt>
              <dd className="font-mono text-sm tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="space-y-4">
        {team.groups.map((group) => (
          <div key={group.name} className="overflow-x-auto rounded-xl bg-surface ring-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-left microlabel">{group.label}</th>
                  {group.headers.map((h) => (
                    <th key={h} className="px-2 py-2 text-right microlabel">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        {row.headshot ? (
                          <img
                            src={row.headshot}
                            alt=""
                            className="size-6 rounded-sm object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="truncate">
                          {row.jersey ? (
                            <span className="mr-1.5 font-mono text-[11px] text-faint">
                              {row.jersey}
                            </span>
                          ) : null}
                          {row.name}
                        </span>
                      </span>
                    </td>
                    {row.stats.map((v, i) => (
                      <td
                        key={`${row.id}-${i}`}
                        className="px-2 py-1.5 text-right font-mono tabular-nums"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
