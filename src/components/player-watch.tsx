import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGameSummary } from "@/lib/data/fns";
import { playerPlays, playMentionsPlayer, situationIsRedZone } from "@/lib/data/player-plays";
import { bagForPlayer, simulatePlayerGame } from "@/lib/data/sim-game";
import { formatStatLine } from "@/lib/data/statline";
import { baseSlotLabel, dstLabel, playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { GamePlay, GameSummary, SlimPlayer, StarterLine } from "@/lib/data/types";
import { useSimPhase } from "@/lib/demo/store";
import { REPLAY_PHASES, replayPts, replayStats } from "@/lib/replay";
import { cn, formatPts } from "@/lib/utils";

export type WatchTarget = {
  player: SlimPlayer;
  slot: string;
  points: number | null;
  line: string | null;
  gameId: string | null;
  gameDetail: string | null;
  /** Lets the caller decide between the live drawer and the profile sheet. */
  gameState: "pre" | "in" | "post" | null;
  club: string;
  stats?: Record<string, number> | null;
};

export function watchFromLine(
  line: StarterLine,
  club: string,
  statLine: string | null,
  bag?: Record<string, number> | null,
): WatchTarget | null {
  if (!line.player) return null;
  return {
    player: line.player,
    slot: line.slot,
    points: line.points,
    line: statLine,
    gameId: line.game?.gameId ?? null,
    gameDetail: line.game?.detail ?? null,
    gameState: line.game?.state ?? null,
    club,
    stats: bag ?? line.stats ?? null,
  };
}

export function PlayerWatch({
  target,
  onClose,
}: {
  target: WatchTarget | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button
        type="button"
        aria-label="Close player watch"
        className="absolute inset-0 bg-bg/50"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={target.player.full_name}
        className="relative z-10 flex h-[min(88vh,42rem)] w-full flex-col rounded-t-xl bg-surface ring-card sm:h-full sm:w-[34rem] sm:rounded-none sm:border-l sm:border-line"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        {/* Keyed on the player so switching subjects resets the drawer's tab
            and queries the way a fresh mount would. */}
        <WatchBody key={target.player.player_id} target={target} onClose={onClose} />
      </section>
    </div>
  );
}

function WatchBody({ target, onClose }: { target: WatchTarget; onClose: () => void }) {
  const [tab, setTab] = useState<"drive" | "plays">("drive");
  // No transport of its own. If a simulated Sunday is running, this drawer is
  // part of it; otherwise it shows whatever the real box says.
  const simPhase = useSimPhase();
  const q = useQuery({
    queryKey: ["game", target.gameId],
    queryFn: () => getGameSummary({ data: { gameId: target.gameId! } }),
    enabled: Boolean(target.gameId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "in") return 8_000;
      if (state === "pre") return 20_000;
      return false;
    },
  });
  const liveHasPlays =
    Boolean(q.data?.drives.some((d) => d.plays.length)) && q.data?.state !== "pre";
  const bag = bagForPlayer(target.player, target.stats);
  // Real play-by-play always wins: a game that is actually being played does
  // not get a made-up one drawn over it.
  const phase = liveHasPlays ? null : simPhase;

  const sim =
    phase != null
      ? simulatePlayerGame({ player: target.player, bag, phase, base: q.data ?? null })
      : null;
  const g = sim ?? q.data ?? null;
  const his = g ? playerPlays(g, target.player) : [];
  const red = situationIsRedZone(g?.situation);
  const live = g?.state === "in";
  const shownBag =
    sim && phase != null ? replayStats(target.player.player_id, bag, phase, 1) : target.stats;
  const shownLine = formatStatLine(target.player.position, shownBag) ?? target.line;
  const shownPts =
    sim && phase != null
      ? replayPts(target.player.player_id, target.points ?? 0, phase, 1)
      : target.points;
  const name =
    target.player.position === "DEF" && target.player.team
      ? dstLabel(target.player.team)
      : target.player.full_name;
  const src =
    target.player.position === "DEF"
      ? teamLogo(target.player.team ?? target.player.player_id)
      : playerHeadshot(target.player.player_id, target.player.espn_id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-line px-4 pb-3 pt-2 sm:pt-4">
        <div className="flex items-start gap-3">
          <Avatar src={src} name={name} className="size-11" textClassName="text-xs"></Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base">{name}</h2>
            <p className="microlabel">
              {baseSlotLabel(target.slot)}
              {target.player.team ? ` · ${target.player.team}` : ""}
              {` · ${target.club}`}
            </p>
            {shownLine ? (
              <p className="mt-0.5 font-mono text-[11px] text-muted">{shownLine}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl tabular-nums tracking-tight">
              {formatPts(shownPts, 1)}
            </p>
            <p className="microlabel-data">pts</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-sm text-muted hover:bg-raised hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!liveHasPlays && !(target.gameId && q.isLoading) ? (
          <p className="mb-3 microlabel">
            {phase != null ? `Sim · ${REPLAY_PHASES[phase]?.label ?? ""}` : "No kickoff yet"}
          </p>
        ) : null}

        {target.gameId && q.isLoading && !sim ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : !g ? (
          <p className="text-sm text-muted">Could not load that box. Try again in a moment.</p>
        ) : (
          <>
            <GameStrip g={g} live={live} red={red} sim={Boolean(sim)} />

            <div className="mt-4 flex gap-1">
              {(
                [
                  ["drive", "Drive"],
                  ["plays", his.length ? `Plays (${his.length})` : "Plays"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "h-10 rounded-sm px-3 text-sm",
                    tab === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "drive" ? <DriveList g={g} player={target.player} /> : null}
            {tab === "plays" ? (
              <PlayList
                plays={his}
                empty={
                  g.state === "pre"
                    ? "Kickoff. His first target is coming."
                    : "No play has named him yet."
                }
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function GameStrip({
  g,
  live,
  red,
  sim,
}: {
  g: GameSummary;
  live: boolean;
  red: boolean;
  sim?: boolean;
}) {
  return (
    <section className={cn("rounded-lg px-3 py-3", red ? "bg-live/15" : "bg-raised")}>
      <div className="flex items-center justify-between gap-2">
        <p className="microlabel">
          {g.away.abbr} @ {g.home.abbr}
        </p>
        <Badge tone={live ? "live" : g.state === "post" ? "win" : "default"}>
          {sim
            ? live
              ? "Sim live"
              : g.state === "post"
                ? "Sim final"
                : "Sim"
            : live
              ? "Live"
              : g.detail || "Scheduled"}
        </Badge>
      </div>
      <p className="mt-1 font-display text-2xl tabular-nums tracking-tight">
        {g.away.score || "0"}–{g.home.score || "0"}
      </p>
      {g.situation ? (
        <p className={cn("mt-1 font-mono text-xs", red ? "text-live" : "text-muted")}>
          {red ? "Red zone · " : ""}
          {g.situation}
        </p>
      ) : null}
      {g.lastPlay ? <p className="mt-1 text-sm text-muted">{g.lastPlay}</p> : null}
    </section>
  );
}

function PlayList({ plays, empty }: { plays: GamePlay[]; empty: string }) {
  if (!plays.length) {
    return <p className="mt-4 text-sm text-muted">{empty}</p>;
  }
  const shown = [...plays].reverse();
  return (
    <ol className="mt-4 divide-y divide-line rounded-lg bg-raised">
      {shown.map((p) => (
        <li
          key={p.id}
          className={cn("flex items-start gap-3 px-3 py-2.5", p.scoring && "bg-win/10")}
        >
          <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-faint">
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
  );
}

function DriveList({ g, player }: { g: GameSummary; player: SlimPlayer }) {
  if (!g.drives.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre" ? "No plays yet — waiting on kickoff." : "No play-by-play posted."}
      </p>
    );
  }
  const drives = g.state === "in" ? [...g.drives].reverse() : g.drives;
  return (
    <div className="mt-4 space-y-3">
      {drives.map((d) => (
        <article key={d.id} className="rounded-lg bg-raised">
          <header className="border-b border-line px-3 py-2 microlabel">
            {d.team || "Drive"}
            {d.result ? ` · ${d.result}` : ""}
          </header>
          <ol>
            {d.plays.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-start gap-3 px-3 py-2",
                  p.scoring && "bg-win/10",
                  playMentionsPlayer(p.text, player) && "bg-accent/10",
                )}
              >
                <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-faint">
                  {p.period ? `Q${p.period}` : ""}
                  {p.clock ? ` ${p.clock}` : ""}
                </span>
                <p className="min-w-0 flex-1 text-sm">{p.text}</p>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
