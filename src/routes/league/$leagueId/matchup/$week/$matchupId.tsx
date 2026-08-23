import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { MatchupEdge } from "@/components/matchup-edge";
import { PlayerCell } from "@/components/player-cell";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { PlayerWatch, type WatchTarget, watchFromLine } from "@/components/player-watch";
import { SlotPts, useScoreFlash } from "@/components/slot-pts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  getLeagueBundle,
  getMatchups,
  getTeam,
  getWeekProjections,
  getWeekStats,
} from "@/lib/data/fns";
import {
  gameHasStarted,
  liveStatLine,
  paintMatchup,
  paintMatchups,
  pairPreviewScores,
  slotDisplay,
} from "@/lib/data/matchup-view";
import { baseSlotLabel } from "@/lib/data/teams";
import type {
  GameChip,
  MatchupPair,
  MatchupSide,
  Projection,
  RosterPlayer,
  StandingRow,
  StarterLine,
  TeamBundle,
} from "@/lib/data/types";
import { overlayPreLivePairs, overlayPreLiveRoster } from "@/lib/demo/pre-live";
import { useDemoStore, useSimPhase, useSimProgress } from "@/lib/demo/store";
import { usePreLiveFeed } from "@/lib/demo/use-pre-live-feed";
import type { ScoringBook } from "@/lib/league/scoring";
import {
  applyReplaySide,
  bookFromLeague,
  LIVE_POLL_MS,
  pairingIsLive,
  REPLAY_PHASES,
  REPLAY_TICK_MS,
  replayPts,
  replayStatMap,
  seedPairForReplay,
} from "@/lib/replay";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/matchup/$week/$matchupId")({
  component: MatchupPage,
});

function MatchupPage() {
  const { leagueId, week: weekParam, matchupId: idParam } = Route.useParams();
  const week = Number(weekParam);
  const matchupId = Number(idParam);
  // The transport lives in the demo toolbar; this page only reads the clock.
  // `phase` (integer) indexes REPLAY_PHASES for labels/game state; `progress`
  // (fractional, same value rounded down when paused) drives the painted
  // point totals so the matchup chart moves smoothly instead of in cliffs.
  const phase = useSimPhase();
  const progress = useSimProgress();
  const pre = usePreLiveFeed();
  const stopSim = useDemoStore((s) => s.stop);
  const [watch, setWatch] = useState<WatchTarget | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);

  /**
   * A live game and a finished one ask different questions. In progress, you
   * want the play-by-play; otherwise you want the season and whether to start
   * him. Same tap, different surface.
   */
  function openPlayer(t: WatchTarget | null) {
    if (!t) return;
    if (t.gameState === "in") {
      setWatch(t);
      return;
    }
    setSheet({
      player: t.player,
      game:
        t.gameId || t.gameDetail
          ? { state: t.gameState ?? "pre", detail: t.gameDetail ?? "", opp: null, gameId: t.gameId }
          : null,
      context: {
        label: t.club,
        rows: [
          ["Slot", baseSlotLabel(t.slot)],
          ["This week", formatPts(t.points, 1)],
        ],
      },
      projection: t.projection,
      book: t.book,
    });
  }

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (phase == null && q.state.data?.scoringLive ? LIVE_POLL_MS : false),
  });
  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    enabled: Number.isFinite(week),
    refetchInterval: (q) => {
      if (phase != null) return false;
      const rows = q.state.data ?? [];
      const live = rows.some((pair) =>
        [pair.home, pair.away].some((side) => side?.starters.some((s) => s.game?.state === "in")),
      );
      return live || league.data?.scoringLive ? LIVE_POLL_MS : false;
    },
  });

  const rawPair = matchups.data?.find((p) => p.matchupId === matchupId) ?? null;
  const idx = matchups.data?.findIndex((p) => p.matchupId === matchupId) ?? -1;
  const prevNav = idx > 0 ? matchups.data![idx - 1] : null;
  const nextNav =
    idx >= 0 && matchups.data && idx < matchups.data.length - 1 ? matchups.data[idx + 1] : null;

  const homeTeam = useQuery({
    queryKey: ["team", leagueId, rawPair?.home.rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: rawPair!.home.rosterId, week } }),
    enabled: Boolean(rawPair),
    refetchInterval: () => (phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false),
  });
  const awayTeam = useQuery({
    queryKey: ["team", leagueId, rawPair?.away?.rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: rawPair!.away!.rosterId, week } }),
    enabled: Boolean(rawPair?.away),
    refetchInterval: () => (phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false),
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", league.data?.league.season, week],
    queryFn: () =>
      getWeekStats({
        data: {
          season: String(league.data!.league.season),
          week,
          kind: fantasyStatKind(),
        },
      }),
    enabled: Boolean(league.data?.league.season) && Number.isFinite(week),
    refetchInterval: () => (phase == null && league.data?.scoringLive ? LIVE_POLL_MS : false),
  });
  const finalsRaw = weekStats.data ?? {};
  const priorSeason = league.data?.league.season
    ? String(Number(league.data.league.season) - 1)
    : "";
  const priorStats = useQuery({
    queryKey: ["week-stats", priorSeason, week],
    queryFn: () =>
      getWeekStats({
        data: { season: priorSeason, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(priorSeason) && Number.isFinite(Number(priorSeason)),
  });
  const projections = useQuery({
    queryKey: ["week-projections", leagueId, week],
    queryFn: () =>
      getWeekProjections({
        data: {
          leagueId,
          season: String(league.data!.league.season),
          week,
        },
      }),
    enabled: Boolean(league.data?.league.season),
    staleTime: 60_000,
  });
  const book = bookFromLeague(league.data?.league.scoring_settings);
  const seeded = useMemo(() => {
    if (!rawPair) return null;
    const bags = Object.keys(finalsRaw).length ? finalsRaw : { ...(priorStats.data ?? {}) };
    return seedPairForReplay(rawPair, week, bags, book);
  }, [rawPair, week, finalsRaw, priorStats.data, book]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the watched player whenever the week, matchup, or league changes, not just when its own value changes
  useEffect(() => {
    setWatch(null);
  }, [week, matchupId, leagueId]);

  // A box already playing out for real has nothing to replay, and a fake Q3 on
  // top of live scores is the worst thing this page could do.
  useEffect(() => {
    if (rawPair && pairingIsLive(rawPair) && phase != null) stopSim();
  }, [rawPair, phase, stopSim]);

  const livePair = useMemo(() => {
    if (pre.on && rawPair) {
      return overlayPreLivePairs([rawPair], pre.games, pre.stats, book)[0] ?? rawPair;
    }
    if (!seeded) return null;
    if (phase == null) return rawPair;
    const at = progress ?? phase;
    return {
      ...seeded.pair,
      home: applyReplaySide(seeded.pair.home, week, at, seeded.finals),
      away: seeded.pair.away ? applyReplaySide(seeded.pair.away, week, at, seeded.finals) : null,
    };
  }, [pre.on, pre.games, pre.stats, book, rawPair, seeded, phase, progress, week]);

  const stats = useMemo(
    () =>
      pre.on
        ? pre.stats
        : phase == null
          ? finalsRaw
          : replayStatMap(seeded?.finals ?? finalsRaw, progress ?? phase, week),
    [pre.on, pre.stats, finalsRaw, seeded, phase, progress, week],
  );

  const pair = useMemo(
    () => (livePair ? paintMatchup(livePair, projections.data ?? {}, stats) : null),
    [livePair, projections.data, stats],
  );

  const slate = useMemo(() => {
    const rows = matchups.data ?? [];
    if (!rows.length) return rows;
    const overlaid = pre.on ? overlayPreLivePairs(rows, pre.games, pre.stats, book) : rows;
    return paintMatchups(overlaid, projections.data ?? {}, stats);
  }, [matchups.data, pre.on, pre.games, pre.stats, book, projections.data, stats]);

  const prevPair = useMemo(() => {
    if (!seeded || progress == null || progress <= 0) return null;
    const raw: MatchupPair = {
      ...seeded.pair,
      home: applyReplaySide(seeded.pair.home, week, progress - 1, seeded.finals),
      away: seeded.pair.away
        ? applyReplaySide(seeded.pair.away, week, progress - 1, seeded.finals)
        : null,
    };
    return paintMatchup(
      raw,
      projections.data ?? {},
      replayStatMap(seeded.finals, progress - 1, week),
    );
  }, [seeded, progress, week, projections.data]);

  const viewHome = useMemo(() => {
    const replayed = replayRoster(homeTeam.data, phase, progress, week);
    if (!pre.on || !replayed) return replayed;
    return {
      ...replayed,
      players: overlayPreLiveRoster(replayed.players, pre.games, pre.stats, book),
    };
  }, [homeTeam.data, phase, progress, week, pre.on, pre.games, pre.stats, book]);
  const viewAway = useMemo(() => {
    const replayed = replayRoster(awayTeam.data, phase, progress, week);
    if (!pre.on || !replayed) return replayed;
    return {
      ...replayed,
      players: overlayPreLiveRoster(replayed.players, pre.games, pre.stats, book),
    };
  }, [awayTeam.data, phase, progress, week, pre.on, pre.games, pre.stats, book]);

  if (!Number.isFinite(week) || !Number.isFinite(matchupId)) {
    return <p className="text-sm text-muted">That matchup link is broken.</p>;
  }

  if (
    (league.data == null && league.isPending) ||
    (matchups.data == null && (matchups.isPending || matchups.isLoading || !matchups.isFetched))
  ) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!pair) {
    return (
      <div>
        <BackLink leagueId={leagueId} week={week} />
        <p className="mt-4 text-sm text-muted">No matchup with that id this week.</p>
      </div>
    );
  }

  const standings = league.data?.standings ?? [];
  const lastPhase = REPLAY_PHASES.length - 1;
  const status =
    phase == null
      ? statusOf(livePair ?? pair)
      : {
          label: REPLAY_PHASES[phase]?.label ?? "Replay",
          tone: (phase >= lastPhase ? "win" : "live") as "live" | "muted" | "win",
        };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackLink leagueId={leagueId} week={week} />
        <div className="flex items-center gap-1">
          {prevNav ? (
            <NavChip
              leagueId={leagueId}
              week={week}
              matchupId={prevNav.matchupId}
              label="Prev"
              icon="left"
            />
          ) : (
            <span className="inline-flex h-10 w-10" />
          )}
          {nextNav ? (
            <NavChip
              leagueId={leagueId}
              week={week}
              matchupId={nextNav.matchupId}
              label="Next"
              icon="right"
            />
          ) : (
            <span className="inline-flex h-10 w-10" />
          )}
        </div>
      </div>

      {pairingIsLive(pair) ? (
        <p className="mb-4 microlabel text-live">
          Live unofficial · same pipe as Sunday · ticks every {LIVE_POLL_MS / 1000}s
        </p>
      ) : null}

      <Scoreboard
        pair={pair}
        week={week}
        leagueId={leagueId}
        standings={standings}
        status={status}
        live={phase == null && Boolean(league.data?.scoringLive) && status.tone === "live"}
      />

      <MatchupEdge
        pair={livePair ?? pair}
        leagueId={leagueId}
        season={league.data?.league.season ?? ""}
        week={week}
        mine={league.data?.myRosterId ?? null}
      />

      <section className="mt-6 rounded-xl bg-surface ring-card">
        <header className="flex items-center justify-between border-b border-line px-3 py-2.5 sm:px-4">
          <h2 className="microlabel">Starters</h2>
          <p className="font-mono text-[11px] tabular-nums text-faint">
            Tap a name · {formatPts(starterTotal(pair.home), 1)}
            <span className="mx-1.5 text-line">·</span>
            {pair.away ? formatPts(starterTotal(pair.away), 1) : "Bye"}
          </p>
        </header>
        <ul>
          {pair.home.starters.map((homeLine, i) => (
            <StarterRow
              key={homeLine.slot}
              home={homeLine}
              away={pair.away?.starters[i] ?? null}
              prevHome={prevPair?.home.starters[i] ?? null}
              prevAway={prevPair?.away?.starters[i] ?? null}
              bye={!pair.away}
              stats={stats}
              homeClub={pair.home.teamName}
              awayClub={pair.away?.teamName ?? ""}
              onWatch={openPlayer}
              projections={projections.data ?? {}}
              book={book}
            />
          ))}
        </ul>
      </section>

      {pair.away ? (
        <section className="mt-6 rounded-xl bg-surface ring-card">
          <header className="border-b border-line px-3 py-2.5 sm:px-4">
            <h2 className="microlabel">Bench</h2>
          </header>
          {!homeTeam.data && !awayTeam.data ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <BenchGrid
              home={viewHome}
              away={viewAway}
              stats={stats}
              projections={projections.data ?? {}}
              homeClub={pair.home.teamName}
              awayClub={pair.away?.teamName ?? ""}
              onWatch={openPlayer}
            />
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-xl bg-surface ring-card">
          <header className="border-b border-line px-3 py-2.5 sm:px-4">
            <h2 className="microlabel">Bench</h2>
          </header>
          {!homeTeam.data ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {benchOf(viewHome).map((p) => {
                const bag = stats[p.player_id];
                const line = liveStatLine(p.position, p.game, bag);
                const disp = slotDisplay(p.game, p.weekPts, projections.data?.[p.player_id]);
                return (
                  <li key={p.player_id}>
                    <button
                      type="button"
                      onClick={() =>
                        setWatch({
                          player: p,
                          slot: "BN",
                          points: disp.points,
                          line,
                          gameState: p.game?.state ?? null,
                          gameId: p.game?.gameId ?? null,
                          gameDetail: p.game?.detail ?? null,
                          club: pair.home.teamName,
                          stats: bag ?? null,
                        })
                      }
                      className="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left sm:px-4 hover:bg-raised"
                    >
                      <div className="min-w-0 flex-1">
                        <PlayerCell player={p} compact quiet game={p.game} line={line} />
                      </div>
                      <SlotPts
                        points={disp.points}
                        forecast={disp.forecast}
                        className="w-12 text-sm"
                      />
                    </button>
                  </li>
                );
              })}
              {benchOf(viewHome).length === 0 ? (
                <li className="px-3 py-4 text-sm text-muted sm:px-4">No one on the pine.</li>
              ) : null}
            </ul>
          )}
        </section>
      )}

      {slate.length > 1 ? (
        <section className="mt-8">
          <h2 className="microlabel">Rest of week {week}</h2>
          <ul className="mt-3 space-y-1.5">
            {slate
              .filter((p) => p.matchupId !== pair.matchupId)
              .map((p) => (
                <li key={p.matchupId}>
                  <Link
                    to="/league/$leagueId/matchup/$week/$matchupId"
                    params={{
                      leagueId,
                      week: String(week),
                      matchupId: String(p.matchupId),
                    }}
                    className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-sm ring-card transition-[box-shadow] duration-150 ring-card-h"
                  >
                    <span className="min-w-0 flex-1 truncate">{p.home.teamName}</span>
                    <span className="shrink-0 font-mono tabular-nums text-muted">
                      {(() => {
                        const s = pairPreviewScores(p);
                        return `${formatPts(s.home, 1)}–${formatPts(s.away, 1)}`;
                      })()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right">
                      {p.away?.teamName ?? "Bye"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <PlayerWatch target={watch} onClose={() => setWatch(null)} />
      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}

function BackLink({ leagueId, week }: { leagueId: string; week: number }) {
  return (
    <Link
      to="/league/$leagueId/matchups"
      params={{ leagueId }}
      search={{ week }}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-4" strokeWidth={1.75} />
      Week {week} slate
    </Link>
  );
}

function NavChip({
  leagueId,
  week,
  matchupId,
  label,
  icon,
}: {
  leagueId: string;
  week: number;
  matchupId: number;
  label: string;
  icon: "left" | "right";
}) {
  return (
    <Link
      to="/league/$leagueId/matchup/$week/$matchupId"
      params={{ leagueId, week: String(week), matchupId: String(matchupId) }}
      className="inline-flex size-10 items-center justify-center rounded-pill bg-raised text-muted hover:bg-line hover:text-fg"
      aria-label={label}
    >
      {icon === "left" ? (
        <ChevronLeft className="size-4" strokeWidth={1.75} />
      ) : (
        <ChevronRight className="size-4" strokeWidth={1.75} />
      )}
    </Link>
  );
}

function Scoreboard({
  pair,
  week,
  leagueId,
  standings,
  status,
  live,
}: {
  pair: MatchupPair;
  week: number;
  leagueId: string;
  standings: StandingRow[];
  status: { label: string; tone: "live" | "muted" | "win" };
  live: boolean;
}) {
  const away = pair.away;
  const scores = pairPreviewScores(pair);
  const preview = !scores.live;
  const decided = isDecided(pair);
  const homeLeads = !away || scores.home > scores.away;
  const awayLeads = Boolean(away && scores.away > scores.home);
  const tied = Boolean(away && scores.home === scores.away && decided);

  return (
    <section className="rounded-xl bg-surface px-4 py-5 ring-card sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="microlabel">
          Week {week}
          {pair.label ? ` · ${pair.label}` : pair.kind === "playoff" ? " · Playoff" : ""}
        </p>
        <Badge tone={status.tone === "live" ? "live" : status.tone === "win" ? "win" : "default"}>
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <TeamHead
          side={pair.home}
          leagueId={leagueId}
          record={recordOf(standings, pair.home.rosterId)}
          leading={homeLeads && decided}
          align="left"
        />
        <div className="text-center">
          <p className="font-display text-4xl tabular-nums tracking-tight sm:text-5xl">
            <span className={homeLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(scores.home, 1)}
            </span>
            <span className="mx-1.5 text-2xl text-faint sm:mx-2">–</span>
            <span className={awayLeads && decided ? "text-fg" : "text-muted"}>
              {formatPts(scores.away, 1)}
            </span>
          </p>
          {preview ? <p className="mt-1 microlabel-data">proj</p> : null}
          {tied ? <p className="mt-1 microlabel">Tie</p> : null}
          {live ? (
            <p className="mt-1 microlabel text-live">Unofficial · {LIVE_POLL_MS / 1000}s</p>
          ) : null}
        </div>
        {away ? (
          <TeamHead
            side={away}
            leagueId={leagueId}
            record={recordOf(standings, away.rosterId)}
            leading={awayLeads && decided}
            align="right"
          />
        ) : (
          <div className="text-right">
            <p className="font-display text-2xl tracking-tight text-faint">Bye</p>
            <p className="mt-1 text-sm text-muted">No opponent this week</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 microlabel">
        <p>{yetLabel(pair.home)}</p>
        <p className="text-right">{away ? yetLabel(away) : "Bye"}</p>
      </div>
    </section>
  );
}

function TeamHead({
  side,
  leagueId,
  record,
  leading,
  align,
}: {
  side: MatchupSide;
  leagueId: string;
  record: StandingRow | undefined;
  leading: boolean;
  align: "left" | "right";
}) {
  return (
    <Link
      to="/league/$leagueId/team/$rosterId"
      params={{ leagueId, rosterId: String(side.rosterId) }}
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar
        src={side.avatar}
        name={side.teamName}
        className="size-11 sm:size-12"
        textClassName="text-sm"
        tint
      />
      <span className="min-w-0">
        <span
          className={cn("block truncate text-sm sm:text-base", leading ? "text-fg" : "text-muted")}
        >
          {side.teamName}
        </span>
        <span className="block truncate font-mono text-[11px] text-faint">
          {side.manager}
          {record ? ` · ${fmtRecord(record.wins, record.losses, record.ties)}` : ""}
        </span>
      </span>
    </Link>
  );
}

/** No baseline for a bye/out/no-data week — nothing to project against. */
function baselineOf(
  projections: Record<string, Projection>,
  playerId: string | null | undefined,
): number | null {
  if (!playerId) return null;
  const p = projections[playerId];
  if (!p || p.reason === "bye" || p.reason === "out" || p.reason === "no-data") return null;
  return p.points;
}

function StarterRow({
  home,
  away,
  prevHome: _prevHome,
  prevAway: _prevAway,
  bye,
  stats,
  homeClub,
  awayClub,
  onWatch,
  projections,
  book,
}: {
  home: StarterLine;
  away: StarterLine | null;
  prevHome: StarterLine | null;
  prevAway: StarterLine | null;
  bye: boolean;
  stats: Record<string, Record<string, number>>;
  homeClub: string;
  awayClub: string;
  onWatch: (t: WatchTarget) => void;
  projections: Record<string, Projection>;
  book: ScoringBook;
}) {
  const hp = home.points ?? 0;
  const ap = away?.points ?? 0;
  const bothIn = Boolean(home.player && away?.player);
  const homeHot = bothIn && hp > ap;
  const awayHot = bothIn && ap > hp;
  return (
    <li className="grid min-h-13 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line px-3 py-2 first:border-t-0 sm:gap-3 sm:px-4">
      <Line
        side={home}
        align="left"
        hot={homeHot}
        stats={stats}
        club={homeClub}
        onWatch={onWatch}
        projection={baselineOf(projections, home.playerId)}
        book={book}
      />
      <span className="w-8 text-center microlabel-data sm:w-10">{baseSlotLabel(home.slot)}</span>
      {bye ? (
        <span className="text-right text-sm text-faint">Bye</span>
      ) : (
        <Line
          side={away}
          align="right"
          hot={awayHot}
          stats={stats}
          club={awayClub}
          onWatch={onWatch}
          projection={baselineOf(projections, away?.playerId)}
          book={book}
        />
      )}
    </li>
  );
}

function Line({
  side,
  align,
  hot,
  stats,
  club,
  onWatch,
  projection,
  book,
}: {
  side: StarterLine | null;
  align: "left" | "right";
  hot: boolean;
  stats: Record<string, Record<string, number>>;
  club: string;
  onWatch: (t: WatchTarget) => void;
  projection?: number | null;
  book?: ScoringBook;
}) {
  const live = Boolean(side && gameHasStarted(side.game) && !side.forecast);
  const flash = useScoreFlash(side?.points, live);
  if (!side) {
    return <span className="text-sm text-faint">—</span>;
  }
  const bag = side.stats ?? (side.playerId ? stats[side.playerId] : undefined);
  const line = liveStatLine(side.player?.position, side.game, bag);
  const target = watchFromLine(side, club, line, bag, { projection, book });
  return (
    <button
      type="button"
      disabled={!target}
      onClick={() => target && onWatch(target)}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors duration-150",
        align === "right" && "flex-row-reverse text-right",
        flash > 0.04 && "bg-highlight/15",
        target && "hover:bg-raised",
      )}
    >
      <div className="min-w-0 flex-1">
        <PlayerCell
          player={side.player}
          empty="—"
          compact
          quiet
          game={side.game}
          align={align}
          line={line}
        />
      </div>
      <SlotPts
        points={side.points}
        forecast={side.forecast}
        expected={side.expected}
        live={live}
        align={align}
        className={cn("w-10 text-sm sm:w-12", !side.forecast && (hot ? "text-fg" : "text-muted"))}
      />
    </button>
  );
}

function BenchGrid({
  home,
  away,
  stats,
  projections,
  homeClub,
  awayClub,
  onWatch,
}: {
  home?: TeamBundle;
  away?: TeamBundle;
  stats: Record<string, Record<string, number>>;
  projections: Record<string, Projection>;
  homeClub: string;
  awayClub: string;
  onWatch: (t: WatchTarget) => void;
}) {
  const left = benchOf(home);
  const right = benchOf(away);
  const rows = Math.max(left.length, right.length);
  if (rows === 0) {
    return <p className="px-3 py-4 text-sm text-muted sm:px-4">Both benches are empty.</p>;
  }
  return (
    <ul>
      {Array.from({ length: rows }, (_, i) => {
        const h = left[i];
        const a = right[i];
        return (
          <li
            key={`${h?.player_id ?? "h"}-${a?.player_id ?? "a"}`}
            className="grid grid-cols-2 gap-4 border-t border-line px-3 py-2.5 first:border-t-0 sm:px-4"
          >
            {h ? (
              <BenchCell
                player={h}
                stats={stats}
                projection={projections[h.player_id]}
                club={homeClub}
                align="left"
                onWatch={onWatch}
              />
            ) : (
              <span />
            )}
            {a ? (
              <BenchCell
                player={a}
                stats={stats}
                projection={projections[a.player_id]}
                club={awayClub}
                align="right"
                onWatch={onWatch}
              />
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BenchCell({
  player,
  stats,
  projection,
  club,
  align,
  onWatch,
}: {
  player: RosterPlayer;
  stats: Record<string, Record<string, number>>;
  projection?: Projection;
  club: string;
  align: "left" | "right";
  onWatch: (t: WatchTarget) => void;
}) {
  const bag = stats[player.player_id];
  const line = liveStatLine(player.position, player.game, bag);
  const disp = slotDisplay(player.game, player.weekPts, projection);
  return (
    <button
      type="button"
      onClick={() =>
        onWatch({
          player,
          slot: "BN",
          points: disp.points,
          line,
          gameState: player.game?.state ?? null,
          gameId: player.game?.gameId ?? null,
          gameDetail: player.game?.detail ?? null,
          club,
          stats: bag ?? null,
        })
      }
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 hover:bg-raised",
        align === "right" ? "flex-row-reverse text-right" : "text-left",
      )}
    >
      <div className="min-w-0 flex-1">
        <PlayerCell player={player} compact quiet game={player.game} align={align} line={line} />
      </div>
      <SlotPts
        points={disp.points}
        forecast={disp.forecast}
        align={align}
        className="w-10 text-sm text-muted"
      />
    </button>
  );
}

function benchOf(team?: TeamBundle) {
  return (team?.players ?? []).filter((p) => p.slot === "bench");
}

/**
 * `phase` (integer) picks the `REPLAY_PHASES` entry for each bench player's
 * game chip; `progress` (fractional, falls back to `phase`) drives the
 * points so bench totals climb smoothly along with the starters.
 */
function replayRoster(
  team: TeamBundle | undefined,
  phase: number | null,
  progress: number | null,
  week: number,
): TeamBundle | undefined {
  if (!team || phase == null) return team;
  const clock = REPLAY_PHASES[phase] ?? REPLAY_PHASES[0]!;
  const at = progress ?? phase;
  return {
    ...team,
    players: team.players.map((p) => ({
      ...p,
      weekPts: replayPts(p.player_id, p.weekPts ?? 0, at, week),
      game: p.game
        ? {
            state: clock.state,
            detail: clock.detail,
            opp: p.game.opp,
            gameId: p.game.gameId ?? null,
          }
        : { state: clock.state, detail: clock.detail, opp: null, gameId: null },
    })),
  };
}

function starterTotal(side: MatchupSide) {
  return side.starters.reduce((sum, line) => sum + (line.points ?? 0), 0);
}

function recordOf(standings: StandingRow[], rosterId: number) {
  return standings.find((s) => s.rosterId === rosterId);
}

function gamesOf(pair: MatchupPair): GameChip[] {
  return [...pair.home.starters, ...(pair.away?.starters ?? [])]
    .map((s) => s.game)
    .filter((g): g is GameChip => Boolean(g));
}

function isDecided(pair: MatchupPair) {
  const games = gamesOf(pair);
  if (games.length) return games.every((g) => g.state === "post");
  return pair.home.points > 0 || (pair.away?.points ?? 0) > 0;
}

function yetToPlay(side: MatchupSide) {
  return side.starters.filter((s) => s.player && s.game?.state === "pre").length;
}

function yetLabel(side: MatchupSide) {
  const n = yetToPlay(side);
  const live = side.starters.filter((s) => s.game?.state === "in").length;
  if (live) return live === 1 ? "1 live" : `${live} live`;
  if (n === 0) {
    const had = side.starters.some((s) => s.game);
    return had ? "All in" : "Yet to play";
  }
  return n === 1 ? "1 still to play" : `${n} still to play`;
}

function statusOf(pair: MatchupPair): { label: string; tone: "live" | "muted" | "win" } {
  if (!pair.away) return { label: "Bye", tone: "muted" };
  const games = gamesOf(pair);
  if (games.some((g) => g.state === "in")) return { label: "Live", tone: "live" };
  if (games.length && games.every((g) => g.state === "post"))
    return { label: "Final", tone: "win" };
  if (pair.home.points === 0 && pair.away.points === 0) return { label: "Preview", tone: "muted" };
  return { label: "In progress", tone: "live" };
}
