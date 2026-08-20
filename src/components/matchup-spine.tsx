import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { InjuryMark } from "@/components/player-cell";
import { TeamTotal } from "@/components/slot-pts";
import { liveStatLine, sideIsProjected } from "@/lib/data/matchup-view";
import { profileIntent } from "@/lib/data/player-view";
import { baseSlotLabel, dstLabel } from "@/lib/data/teams";
import type { MatchupSide, SlimPlayer, StarterLine } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

/**
 * The matchup on a phone.
 *
 * The two-column grid collapses under `sm`, which stacks nine of your starters
 * on top of nine of theirs — so comparing quarterbacks means scrolling past
 * eight players holding a number in your head. This pairs the sides by slot
 * instead, which is the same index pairing `MatchupEdge` already relies on.
 *
 * Everything here is the existing type scale and tokens; the only new idea is
 * the arrangement. Detail is a tap rather than a page, so nothing is lost —
 * it is just no longer all shouting at once.
 */
export function MatchupSpine({
  home,
  away,
  liveHome = 0,
  liveAway = 0,
  stats,
  leagueId,
  onPlayer,
}: {
  home: MatchupSide;
  away: MatchupSide;
  liveHome?: number;
  liveAway?: number;
  stats: Record<string, Record<string, number>>;
  leagueId: string;
  onPlayer: (line: StarterLine, side: MatchupSide) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const rows = home.starters.map((line, i) => ({
    slot: line.slot,
    a: line,
    b: away.starters[i] ?? null,
  }));
  // Bars are relative to the widest gap on this board, so they read as "which
  // slot is deciding the week" rather than as absolute points.
  const span = Math.max(...rows.map((r) => Math.abs((r.a.points ?? 0) - (r.b?.points ?? 0))), 1);
  const preview = sideIsProjected(home) && sideIsProjected(away);

  return (
    <div className="sm:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line pb-3">
        <Total
          name={home.teamName}
          live={liveHome}
          projected={home.points}
          showProjected={sideIsProjected(home)}
          ahead={!preview && liveHome >= liveAway}
        />
        <span className="text-center font-mono text-sm tabular-nums text-faint">–</span>
        <Total
          name={away.teamName}
          live={liveAway}
          projected={away.points}
          showProjected={sideIsProjected(away)}
          ahead={!preview && liveAway > liveHome}
          flip
          right
        />
      </div>

      <ul>
        {rows.map((r, i) => {
          const ap = r.a.points ?? 0;
          const bp = r.b?.points ?? 0;
          const delta = ap - bp;
          const even = Math.abs(delta) < 0.05;
          const width = even ? 0 : (Math.abs(delta) / span) * 50;
          const showing = open === i;

          return (
            <li key={`${i}-${r.slot}`} className="border-b border-line last:border-0">
              <button
                type="button"
                aria-expanded={showing}
                onClick={() => setOpen(showing ? null : i)}
                className="grid w-full grid-cols-[minmax(0,1fr)_38px_minmax(0,1fr)] items-center gap-1.5 px-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
              >
                <Half line={r.a} winning={!even && delta > 0} />
                <span className="rounded-pill bg-raised py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-wide text-faint">
                  {baseSlotLabel(r.slot)}
                </span>
                <Half line={r.b} winning={!even && delta < 0} right />
              </button>

              {/* The margin, drawn. Green is yours, grey is theirs — coral means
                  alarm in this system and losing a slot is not an alarm. */}
              <span className="relative mx-1 mb-2 block h-[3px] rounded-pill bg-raised">
                <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line-strong" />
                <span
                  className={cn(
                    "absolute inset-y-0 rounded-pill",
                    delta >= 0 ? "left-1/2 bg-accent-strong" : "right-1/2 bg-faint",
                  )}
                  style={{ width: `${width}%` }}
                />
              </span>

              {showing ? (
                <div className="grid grid-cols-[minmax(0,1fr)_38px_minmax(0,1fr)] gap-1.5 px-1 pb-2.5">
                  <Detail
                    line={r.a}
                    stats={stats}
                    leagueId={leagueId}
                    onOpen={() => onPlayer(r.a, home)}
                  />
                  <span />
                  <Detail
                    line={r.b}
                    stats={stats}
                    leagueId={leagueId}
                    right
                    onOpen={() => r.b && onPlayer(r.b, away)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Total({
  name,
  live,
  projected,
  showProjected,
  ahead,
  flip,
  right,
}: {
  name: string;
  live: number;
  projected: number;
  showProjected: boolean;
  ahead: boolean;
  flip?: boolean;
  right?: boolean;
}) {
  return (
    <span className={cn("min-w-0", right && "text-right")}>
      <span className="block truncate text-xs font-semibold text-muted">{name}</span>
      <span className={cn(ahead && "text-accent-strong")}>
        <TeamTotal
          live={live}
          projected={projected}
          showProjected={showProjected}
          size="md"
          flip={flip}
          reserve
        />
      </span>
    </span>
  );
}

function Half({
  line,
  winning,
  right,
}: {
  line: StarterLine | null;
  winning: boolean;
  right?: boolean;
}) {
  // A game that has not kicked off has no score yet, so showing 0.0 as a result
  // reads as a bad afternoon rather than as an afternoon that has not happened.
  const idle = Boolean(line?.forecast) || line?.game?.state === "pre";
  const live = line?.game?.state === "in";
  const liveStatus = [line?.game?.detail, line?.game?.situation].filter(Boolean).join(" · ");
  const status =
    line?.forecast === "bye" || line?.forecast === "out"
      ? line.forecast
      : idle
        ? (line?.game?.detail ?? "")
        : live
          ? liveStatus || "live"
          : "final";

  return (
    <span className={cn("min-w-0", right && "text-right")}>
      <span
        className={cn(
          "flex min-w-0 items-center gap-1",
          right && "flex-row-reverse",
          idle && "text-faint",
        )}
      >
        <span className="truncate text-[13px] font-semibold">
          {line?.player ? shortName(line.player) : "—"}
        </span>
        <InjuryMark status={line?.player?.injury_status} />
      </span>
      <span className={cn("mt-px flex items-baseline gap-1.5", right && "flex-row-reverse")}>
        <span
          className={cn(
            "font-mono text-[15px] font-bold tabular-nums",
            idle ? "text-faint" : winning && "text-accent-strong",
          )}
        >
          {formatPts(line?.points, 1)}
        </span>
        <span className={cn("truncate microlabel-data", live ? "text-live" : "text-faint")}>
          {status}
        </span>
      </span>
    </span>
  );
}

function Detail({
  line,
  stats,
  leagueId,
  right,
  onOpen,
}: {
  line: StarterLine | null;
  stats: Record<string, Record<string, number>>;
  leagueId: string;
  right?: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  if (!line?.player) return <span />;
  const bag = line.stats ?? (line.playerId ? stats[line.playerId] : undefined);
  const statLine = liveStatLine(line.player.position, line.game, bag);
  const intent = profileIntent(qc, leagueId, line.player.player_id);
  return (
    <button
      type="button"
      {...intent}
      onClick={onOpen}
      className={cn(
        "min-w-0 rounded-md font-mono text-[9.5px] leading-relaxed text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep",
        right ? "text-right" : "text-left",
      )}
    >
      <span className="block truncate text-muted">
        {[line.player.full_name, line.game?.opp].filter(Boolean).join(" · ")}
      </span>
      {statLine ? <span className="block truncate">{statLine}</span> : null}
    </button>
  );
}

/**
 * `Christian McCaffrey` does not fit in half a phone; `C. McCaffrey` does. A
 * formatter, not a data change — the full name is still in the expanded row.
 */
function shortName(player: SlimPlayer): string {
  if (player.position === "DEF") return dstLabel(player.team);
  const [first = "", ...rest] = player.full_name.trim().split(/\s+/);
  if (rest.length === 0) return player.full_name;
  // A first name that is already initials — A.J., D.K., T.J. — is shorter than
  // anything we would replace it with, and cutting it to "A." loses the person.
  const head = first.includes(".") ? first : `${first.charAt(0)}.`;
  return `${head} ${rest.join(" ")}`;
}
