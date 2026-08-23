import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect } from "react";
import {
  type LeagueContext,
  ProfileGameLog,
  ProfileIdentity,
  ProfileNews,
  ProfileSchedule,
  ProfileSplits,
  ProfileStats,
  ProfileThisWeek,
} from "@/components/player-profile";
import { Skeleton } from "@/components/ui/skeleton";
import {
  findCachedWirePlayer,
  isWirePlayer,
  prefetchPlayerProfile,
  usePlayerProfile,
} from "@/lib/data/player-view";
import type { GameChip, SlimPlayer } from "@/lib/data/types";
import type { ScoringBook } from "@/lib/league/scoring";

export type SheetTarget = {
  player: SlimPlayer;
  game?: GameChip | null;
  context?: LeagueContext;
  /** Pre-game projection this week — the projection line's baseline. */
  projection?: number | null;
  book?: ScoringBook | null;
};

/**
 * The quick look, for when you are mid-task and do not want to lose the page
 * you are on. Browsing players goes to the full route instead; this is the
 * in-context peek, with a way out to the whole thing.
 */
export function PlayerSheet({
  target,
  leagueId,
  onClose,
}: {
  target: SheetTarget | null;
  leagueId: string;
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
        aria-label="Close player details"
        className="absolute inset-0 bg-fg/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={target.player.full_name}
        className="relative z-10 flex h-[min(88vh,44rem)] w-full flex-col rounded-t-xl bg-surface ring-card sm:h-full sm:w-[34rem] sm:rounded-none sm:border-l sm:border-line"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        <Body target={target} leagueId={leagueId} onClose={onClose} />
      </section>
    </div>
  );
}

function Body({
  target,
  leagueId,
  onClose,
}: {
  target: SheetTarget;
  leagueId: string;
  onClose: () => void;
}) {
  const { player, game, context, projection, book } = target;
  const qc = useQueryClient();
  const q = usePlayerProfile(leagueId, player.player_id);
  const p = q.data;
  const cached = findCachedWirePlayer(qc, leagueId, player.player_id);
  const hint = isWirePlayer(cached) ? { points: cached.pts, posRank: cached.rank } : undefined;

  return (
    <>
      <header className="border-b border-line px-5 py-4">
        <ProfileIdentity player={player} context={context}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-pill text-faint hover:bg-raised hover:text-fg"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </ProfileIdentity>
        <Link
          to="/league/$leagueId/player/$playerId"
          params={{ leagueId, playerId: player.player_id }}
          preload="intent"
          onPointerEnter={() => void prefetchPlayerProfile(qc, leagueId, player.player_id)}
          onClick={onClose}
          className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-raised px-3.5 py-1.5 text-[13px] font-semibold hover:bg-line"
        >
          Full profile
          <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {q.isError && !p ? (
          <p className="p-5 text-sm text-muted">No profile for this player yet.</p>
        ) : (
          <>
            <div className="border-b border-line">
              <ProfileStats p={p} player={player} hint={hint} />
            </div>
            {p ? (
              <>
                <ProfileNews notes={p.news} />
                <ProfileThisWeek
                  p={p}
                  player={player}
                  game={game}
                  projection={projection}
                  book={book}
                />
                <ProfileSchedule games={p.schedule} week={p.slateWeek} compact />
                <ProfileGameLog weekly={p.weekly} bye={p.byeWeek} perGame={p.perGame} />
                <ProfileSplits p={p} />
                <div className="h-6" />
              </>
            ) : (
              <div className="space-y-3 p-5">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-36 rounded-lg" />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
