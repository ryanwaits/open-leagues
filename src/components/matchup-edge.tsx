import { useQuery } from "@tanstack/react-query";
import { getOutlooks } from "@/lib/data/fns";
import { baseSlotLabel } from "@/lib/data/teams";
import type { MatchupPair } from "@/lib/data/types";
import { type PlayerOutlook, winProbability } from "@/lib/league/win-probability";
import { cn, formatPts } from "@/lib/utils";

/**
 * Where the game actually is: one signed bar per slot, plus the probability
 * that falls out of the same numbers.
 *
 * Green is your advantage and neutral grey is theirs. A true diverging scale
 * would want two hues, but coral means alarm in this system and losing a slot
 * is not an alarm.
 */
export function MatchupEdge({
  pair,
  leagueId,
  season,
  mine,
}: {
  pair: MatchupPair;
  leagueId: string;
  season: string;
  /** Which roster is "you"; the whole panel is signed from this side. */
  mine: number | null;
}) {
  const away = pair.away;
  const ids = [
    ...pair.home.starters.map((s) => s.playerId),
    ...(away?.starters ?? []).map((s) => s.playerId),
  ].filter((x): x is string => Boolean(x));

  const outlooks = useQuery({
    queryKey: ["outlooks", leagueId, season, ids.join(",")],
    queryFn: () => getOutlooks({ data: { leagueId, season, playerIds: ids } }),
    enabled: Boolean(season) && ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  if (!away) return null;

  // Sign everything from the viewer's side so "+" always means good news.
  const flip = mine != null && away.rosterId === mine;
  const a = flip ? away : pair.home;
  const b = flip ? pair.home : away;
  const map = outlooks.data ?? {};

  const outlookFor = (line: (typeof a.starters)[number]): PlayerOutlook => {
    const o = line.playerId ? map[line.playerId] : undefined;
    return {
      playerId: line.playerId ?? "",
      team: line.player?.team ?? null,
      position: line.player?.position ?? null,
      mean: o?.mean ?? 0,
      sd: o?.sd ?? 0,
      game: line.game,
    };
  };

  const wp = winProbability({
    scores: [a.points, b.points],
    starters: [a.starters.map(outlookFor), b.starters.map(outlookFor)],
  });

  const rows = a.starters.map((line, i) => {
    const other = b.starters[i];
    const delta = (line.points ?? 0) - (other?.points ?? 0);
    return { slot: line.slot, delta };
  });
  const span = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);
  const pct = Math.round(wp.probability * 100);

  return (
    <section className="mt-6 rounded-xl bg-surface ring-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Where the game is</h2>
        <span className="microlabel-data">Margin by slot</span>
      </header>

      {wp.live ? (
        <div className="px-5 pb-4">
          <div className="flex h-1.5 overflow-hidden rounded-pill bg-raised">
            <span className="bg-accent-deep" style={{ width: `${pct}%` }} />
            <span className="bg-faint" style={{ width: `${100 - pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between microlabel-data">
            <span>
              {a.teamName} {pct}%
            </span>
            <span>
              proj {formatPts(wp.projected[0], 1)} &ndash; {formatPts(wp.projected[1], 1)}
            </span>
          </div>
        </div>
      ) : null}

      <ul>
        {rows.map((r) => {
          const w = (Math.abs(r.delta) / span) * 50;
          // A dead-even slot is neither side's advantage.
          const even = Math.abs(r.delta) < 0.05;
          const up = r.delta > 0;
          return (
            <li
              key={r.slot}
              className="grid grid-cols-[34px_1fr_62px] items-center gap-3 px-5 py-1.5"
            >
              <span className="microlabel-data">{baseSlotLabel(r.slot)}</span>
              <span className="relative h-4">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                <span
                  className={cn(
                    "absolute inset-y-[3px] rounded-xs",
                    up ? "left-1/2 bg-accent-strong" : "right-1/2 bg-faint",
                  )}
                  style={{ width: even ? 0 : `${w}%` }}
                />
              </span>
              <span
                className={cn(
                  "text-right font-mono text-xs font-semibold tabular-nums",
                  even ? "text-faint" : up ? "text-accent-strong" : "text-muted",
                )}
              >
                {even ? "—" : `${up ? "+" : "−"}${formatPts(Math.abs(r.delta), 1)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-5 pt-2 pb-5 text-xs text-faint">
        Green is {a.teamName}, grey is {b.teamName}. Bars scale to the biggest gap on the board.
      </p>
    </section>
  );
}
