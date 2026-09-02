import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Avatar } from "@/components/avatar";
import { ProjectionBlock } from "@/components/projection-block";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsPhone } from "@/lib/breakpoint";
import { getGameSummary } from "@/lib/data/fns";
import { shortKickoff } from "@/lib/data/kickoff";
import { playerPlays, playMentionsPlayer, situationIsRedZone } from "@/lib/data/player-plays";
import { formatStatLine } from "@/lib/data/statline";
import { baseSlotLabel, dstLabel, playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { GamePlay, GameSummary, SlimPlayer, StarterLine } from "@/lib/data/types";
import type { ScoringBook } from "@/lib/league/scoring";
import { EMPTY_BOOK, useProjectionSeries } from "@/lib/live/use-projection-series";
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
  /** Pre-game projection this week — the projection line's baseline. */
  projection?: number | null;
  book?: ScoringBook | null;
};

export function watchFromLine(
  line: StarterLine,
  club: string,
  statLine: string | null,
  bag?: Record<string, number> | null,
  extra?: { projection?: number | null; book?: ScoringBook | null },
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
    projection: extra?.projection ?? null,
    book: extra?.book ?? null,
  };
}

export function PlayerWatch({
  target,
  onClose,
}: {
  target: WatchTarget | null;
  onClose: () => void;
}) {
  const isPhone = useIsPhone();

  useEffect(() => {
    if (isPhone || !target) return;
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
  }, [isPhone, target, onClose]);

  if (isPhone) {
    return (
      <Drawer.Root
        open={Boolean(target)}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-fg/40" />
          <Drawer.Content
            aria-label={target?.player.full_name}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[94%] flex-col rounded-t-xl bg-surface ring-card outline-none"
          >
            <Drawer.Handle className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
            {/* Keyed on the player so switching subjects resets the drawer's
                tab and queries the way a fresh mount would. */}
            {target ? (
              <WatchBody key={target.player.player_id} target={target} onClose={onClose} />
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button
        type="button"
        aria-label="Close player watch"
        className="absolute inset-0 bg-fg/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={target.player.full_name}
        className="relative z-10 flex h-[min(88vh,42rem)] w-full flex-col rounded-t-xl bg-surface ring-card sm:h-full sm:w-[34rem] sm:rounded-none sm:border-l sm:border-line"
      >
        {/* Keyed on the player so switching subjects resets the drawer's tab
            and queries the way a fresh mount would. */}
        <WatchBody key={target.player.player_id} target={target} onClose={onClose} />
      </section>
    </div>
  );
}

function WatchBody({ target, onClose }: { target: WatchTarget; onClose: () => void }) {
  const [tab, setTab] = useState<"drive" | "plays">("drive");
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
  const g = q.data ?? null;
  const his = g ? playerPlays(g, target.player) : [];
  const red = situationIsRedZone(g?.situation);
  const live = g?.state === "in";
  const shownLine = formatStatLine(target.player.position, target.stats) ?? target.line;
  const shownPts = target.points;
  const name =
    target.player.position === "DEF" && target.player.team
      ? dstLabel(target.player.team)
      : target.player.full_name;
  const src =
    target.player.position === "DEF"
      ? teamLogo(target.player.team ?? target.player.player_id)
      : playerHeadshot(target.player.player_id, target.player.espn_id);
  const series = useProjectionSeries({
    game: g,
    player: target.player,
    book: target.book ?? EMPTY_BOOK,
    baseline: target.projection,
    points: shownPts,
  });

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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {series ? (
          <ProjectionBlock
            s={series}
            kickoffLabel={shortKickoff(g?.detail)}
            windowSecs={undefined}
          />
        ) : null}

        {!liveHasPlays && !(target.gameId && q.isLoading) ? (
          <p className="microlabel">No kickoff yet</p>
        ) : null}

        {target.gameId && q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : !g ? (
          <p className="text-sm text-muted">Could not load that box. Try again in a moment.</p>
        ) : (
          <>
            <GameStrip g={g} live={live} red={red} />

            <div className="flex gap-1.5">
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
                    "h-9 rounded-pill px-3 text-[13px] font-semibold transition-colors duration-150",
                    tab === id ? "bg-fg text-bg" : "bg-raised text-muted hover:text-fg",
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

function GameStrip({ g, live, red }: { g: GameSummary; live: boolean; red: boolean }) {
  return (
    <section className={cn("rounded-md px-3 py-3", red ? "bg-live/15" : "bg-raised")}>
      <div className="flex items-center justify-between gap-2">
        <p className="microlabel">
          {g.away.abbr} @ {g.home.abbr}
        </p>
        <Badge tone={live ? "live" : g.state === "post" ? "win" : "default"}>
          {live ? "Live" : g.detail || "Scheduled"}
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
