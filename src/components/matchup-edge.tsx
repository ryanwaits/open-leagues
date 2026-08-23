import { useQuery } from "@tanstack/react-query";
import { LiveLine } from "@/components/live-line";
import { getOutlooks, getTicks } from "@/lib/data/fns";
import { pairHasStarted } from "@/lib/data/matchup-view";
import { baseSlotLabel } from "@/lib/data/teams";
import { isHostedLeague, type MatchupPair } from "@/lib/data/types";
import { useSimPhase } from "@/lib/demo/store";
import { type PlayerOutlook, winProbability } from "@/lib/league/win-probability";
import { type EdgeView, useLiveProjPref } from "@/lib/live/prefs";
import { swing } from "@/lib/live/series";
import { useMatchupSeries } from "@/lib/live/use-matchup-series";
import { cn, formatPts } from "@/lib/utils";

/**
 * Where the game actually is: the last hour / three hours / day of both
 * teams' projected finals on one liveline, then the same signed bar per
 * slot the panel always had.
 *
 * Green is your advantage and neutral grey is theirs. A true diverging scale
 * would want two hues, but coral means alarm in this system and losing a slot
 * is not an alarm.
 */

const WINDOWS = [
  { label: "1H", secs: 3600 },
  { label: "3H", secs: 10800 },
  { label: "DAY", secs: 43200 },
];

const EDGE_VIEWS: { id: EdgeView; label: string }[] = [
  { id: "finals", label: "Finals" },
  { id: "pct", label: "Win %" },
  { id: "margin", label: "Margin" },
];

/** The 5-minute momentum chip under the chart: whoever's line actually moved, or quiet. */
function momentumChip(
  you: string,
  them: string,
  swingYou: ReturnType<typeof swing>,
  swingThem: ReturnType<typeof swing>,
): { text: string; cls: string } {
  if (swingYou.dir === "up" && swingThem.dir !== "up") {
    return {
      text: `▲ ${you} +${swingYou.delta.toFixed(1)} · last 5 min`,
      cls: "text-accent-strong",
    };
  }
  if (swingThem.dir === "up") {
    return { text: `▼ ${them} +${swingThem.delta.toFixed(1)} on you · 5 min`, cls: "text-loss" };
  }
  return { text: "quiet · 5 min", cls: "text-faint" };
}

export function MatchupEdge({
  pair,
  leagueId,
  season,
  week,
  mine,
}: {
  pair: MatchupPair;
  leagueId: string;
  season: string;
  week: number;
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
  const map = outlooks.data ?? {};

  const kicked = pairHasStarted(pair);
  const ticks = useQuery({
    queryKey: ["ticks", leagueId, week, pair.matchupId],
    queryFn: () => getTicks({ data: { leagueId, week, matchupId: pair.matchupId } }),
    enabled: isHostedLeague(leagueId),
    refetchInterval: kicked ? 60_000 : false,
    staleTime: 30_000,
  });

  const s = useMatchupSeries({ leagueId, week, pair, outlooks: map, mine, ticks: ticks.data });

  const edgeView = useLiveProjPref((st) => st.edgeView);
  const setEdgeView = useLiveProjPref((st) => st.setEdgeView);
  const edgeWindow = useLiveProjPref((st) => st.edgeWindow);
  const setEdgeWindow = useLiveProjPref((st) => st.setEdgeWindow);
  // A simulated Sunday plays out in ~96 real seconds (REPLAY_TICK_MS), so the
  // real-time 1H/3H/DAY windows would compress the whole game into a sliver
  // at the right edge — use a fixed short window and hide the chips instead.
  const simOn = useSimPhase() != null;

  if (!away) return null;

  // Sign everything from the viewer's side so "+" always means good news.
  // The chart series from useMatchupSeries are already signed the same way.
  const flip = mine != null && away.rosterId === mine;
  const a = flip ? away : pair.home;
  const b = flip ? pair.home : away;

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
  const pct = Math.round(s.last?.youPct ?? wp.probability * 100);
  const live = kicked && !s.final;
  const chip = momentumChip(a.teamName, b.teamName, s.swingYou, s.swingThem);
  const marginMomentum =
    s.swingYou.dir === "up" && s.swingThem.dir !== "up"
      ? "up"
      : s.swingThem.dir === "up"
        ? "down"
        : "flat";

  return (
    <section className="mt-6 rounded-xl bg-surface ring-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Where the game is</h2>
        {s.started ? (
          <span className="flex rounded-pill bg-raised p-0.5">
            {EDGE_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={edgeView === v.id}
                onClick={() => setEdgeView(v.id)}
                className={cn(
                  "h-7 rounded-pill px-2.5 text-[12px] font-medium transition-colors duration-150",
                  edgeView === v.id ? "bg-fg text-bg" : "text-faint hover:text-muted",
                )}
              >
                {v.label}
              </button>
            ))}
          </span>
        ) : (
          <span className="microlabel-data">Margin by slot</span>
        )}
      </header>

      {s.started ? (
        <div className="px-5 pb-4">
          {edgeView === "finals" ? (
            <LiveLine
              series={[
                { id: "you", label: a.teamName, points: s.you, tone: "brand" },
                { id: "them", label: b.teamName, points: s.them, tone: "muted" },
              ]}
              height={196}
              windowSecs={simOn ? 150 : edgeWindow}
              windows={simOn ? undefined : WINDOWS}
              onWindowChange={setEdgeWindow}
              frozen={s.final}
              padding={{ top: 8, right: 8, bottom: 26, left: 0 }}
              ariaLabel="Projected finals"
            />
          ) : edgeView === "pct" ? (
            <LiveLine
              series={s.pct}
              value={s.last?.youPct}
              height={196}
              windowSecs={simOn ? 150 : edgeWindow}
              windows={simOn ? undefined : WINDOWS}
              onWindowChange={setEdgeWindow}
              referenceLine={{ value: 50, label: "COIN FLIP" }}
              momentum={swing(s.pct, 300, 3).dir}
              formatValue={(v) => `${Math.round(v)}%`}
              frozen={s.final}
              padding={{ top: 8, right: 8, bottom: 26, left: 0 }}
              ariaLabel="Win probability"
            />
          ) : (
            <LiveLine
              series={s.margin}
              value={s.last?.margin}
              height={196}
              windowSecs={simOn ? 150 : edgeWindow}
              windows={simOn ? undefined : WINDOWS}
              onWindowChange={setEdgeWindow}
              referenceLine={{ value: 0, label: "EVEN" }}
              momentum={marginMomentum}
              formatValue={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
              frozen={s.final}
              padding={{ top: 8, right: 8, bottom: 26, left: 0 }}
              ariaLabel="Projected margin"
            />
          )}

          <div className="mt-5 flex justify-between microlabel-data">
            <span>
              {a.teamName} {pct}%{live ? <span className="text-live"> · live</span> : null}
              {s.sinceOpened && !s.final ? " · since you opened" : null}
            </span>
            <span className={chip.cls}>{chip.text}</span>
            <span>
              proj {formatPts(s.last?.youProj ?? wp.projected[0], 1)} &ndash;{" "}
              {formatPts(s.last?.themProj ?? wp.projected[1], 1)}
            </span>
          </div>
        </div>
      ) : wp.live ? (
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
