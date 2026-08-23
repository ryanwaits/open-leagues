import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/avatar";
import type { TrackedPlayer } from "@/lib/data/play-tags";
import { formatStatLine } from "@/lib/data/statline";
import { playerHeadshot, playerTeam } from "@/lib/data/teams";
import { cn, formatPts } from "@/lib/utils";

/**
 * The tap-a-name quick card: who, what they have done, what it is worth. A
 * popover under the name on wide screens; a bottom sheet on phones. Anything
 * deeper goes to the matchup.
 */
export function PlayerPeek({
  tracked,
  onField,
  leagueId,
  week,
  matchupId,
  onClose,
}: {
  tracked: TrackedPlayer;
  onField: boolean;
  leagueId: string | null;
  week: number | null;
  matchupId: number | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Deferred so the opening click does not immediately close it.
    const id = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const p = tracked.player;
  const line = formatStatLine(p.position, tracked.stats);
  const mine = tracked.side === "mine";
  const canLink = leagueId && week != null && matchupId != null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-fg/40 sm:hidden"
      />
      <div
        ref={ref}
        role="dialog"
        aria-label={p.full_name}
        className={cn(
          "z-50 bg-surface p-3.5 text-left font-sans ring-card-lit",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-xl max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "sm:absolute sm:top-full sm:left-0 sm:mt-1.5 sm:w-72 sm:rounded-xl",
        )}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-center gap-2.5">
          <span className="relative shrink-0">
            <Avatar
              src={playerHeadshot(p.player_id, p.espn_id)}
              name={p.full_name}
              className="size-9 rounded-full"
              textClassName="text-[10px]"
            />
            {onField ? (
              <span className="absolute -right-px -bottom-px size-2.5 rounded-full bg-accent ring-2 ring-surface" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.full_name}</p>
            <p className="microlabel-data whitespace-nowrap">
              {p.position ?? "—"} · {playerTeam(p) ?? "FA"}
              {onField ? " · on field" : ""}
            </p>
          </div>
          <div className="ml-2 shrink-0 text-right">
            <p
              className={cn(
                "font-mono text-[22px] leading-none font-bold tracking-tight tabular-nums",
                mine ? "text-accent-strong" : "text-loss",
              )}
            >
              {formatPts(tracked.points, 2)}
            </p>
            <p className="microlabel-data mt-1">pts</p>
          </div>
        </div>
        <p className="mt-2.5 font-mono text-[13px] tabular-nums">
          {line ?? <span className="text-faint">No stats yet</span>}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[11px] text-faint">
            {mine ? "Your starter" : `${tracked.club}'s`}
            {week != null ? ` · Wk ${week}` : ""}
          </span>
          {canLink ? (
            <Link
              to="/league/$leagueId/matchup/$week/$matchupId"
              params={{ leagueId, week: String(week), matchupId: String(matchupId) }}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs text-accent-strong hover:underline"
            >
              Matchup
              <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
