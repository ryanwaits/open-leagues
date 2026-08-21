import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinePanel } from "@/components/book-panel";
import { MatchupBoard } from "@/components/matchup-board";
import { MatchupEdge } from "@/components/matchup-edge";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { PlayerWatch, type WatchTarget, watchFromLine } from "@/components/player-watch";
import { Skeleton } from "@/components/ui/skeleton";
import { type TicketTarget, WagerTicket } from "@/components/wager-ticket";
import { fantasyStatKind } from "@/lib/data/calendar";
import { getLeagueBundle, getMatchups, getWeekProjections, getWeekStats } from "@/lib/data/fns";
import {
  liveStatLine,
  paintMatchups,
  pairIsProjected,
  pairPreviewScores,
} from "@/lib/data/matchup-view";
import { useWarmRosterProfiles } from "@/lib/data/player-view";
import { baseSlotLabel } from "@/lib/data/teams";
import { overlayBookLine, overlayPreLivePairs } from "@/lib/demo/pre-live";
import { useDemoStore, useSimPhase } from "@/lib/demo/store";
import { usePreLiveFeed } from "@/lib/demo/use-pre-live-feed";
import { getBook, getClaims } from "@/lib/league/fns";
import {
  applyReplayPairs,
  bookFromLeague,
  LIVE_POLL_MS,
  pairingIsLive,
  replayStatMap,
  seedPairsForReplay,
} from "@/lib/replay";
import { cn, formatPts } from "@/lib/utils";

type Search = { week?: number; focus?: number };

export const Route = createFileRoute("/league/$leagueId/matchups")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: s.week != null ? Number(s.week) : undefined,
    focus: s.focus != null ? Number(s.focus) : undefined,
  }),
  component: MatchupsPage,
});

function MatchupsPage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  // The transport lives in the demo toolbar; this page only reads the clock.
  const phase = useSimPhase();
  const pre = usePreLiveFeed();
  const stopSim = useDemoStore((s) => s.stop);
  const [watch, setWatch] = useState<WatchTarget | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [ticket, setTicket] = useState<TicketTarget | null>(null);

  /** Live game means play-by-play; anything else means the profile. */
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
      context: { label: t.club, rows: [["Slot", baseSlotLabel(t.slot)]] },
      projection: t.projection,
      book: t.book,
    });
  }

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (phase == null && q.state.data?.scoringLive ? LIVE_POLL_MS : false),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    refetchInterval: (q) => {
      if (phase != null) return false;
      const rows = q.state.data ?? [];
      const live = rows.some((pair) =>
        [pair.home, pair.away].some((side) => side?.starters.some((s) => s.game?.state === "in")),
      );
      return live || league.data?.scoringLive ? LIVE_POLL_MS : false;
    },
  });
  const wagerBook = useQuery({
    queryKey: ["book", leagueId, week],
    queryFn: () => getBook({ data: { leagueId, week } }),
    enabled: Boolean(league.data?.hosted),
  });
  const claims = useQuery({
    queryKey: ["claims", leagueId],
    queryFn: () => getClaims({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
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
    enabled: Boolean(league.data?.league.season),
  });
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
  // What your queued waiver claims add up to, so a stake can say out loud when
  // it would leave them unfunded on Wednesday.
  const pendingClaimTotal = (claims.data?.items ?? [])
    .filter((c) => c.mine && c.status === "pending")
    .reduce((t, c) => t + (c.bid ?? 0), 0);
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
  const liveFinals = weekStats.data ?? {};
  const hasLiveStats = Object.keys(liveFinals).length > 0;
  const book = bookFromLeague(league.data?.league.scoring_settings);
  const seeded = useMemo(() => {
    const bags = hasLiveStats ? liveFinals : { ...(priorStats.data ?? {}) };
    return seedPairsForReplay(matchups.data ?? [], week, bags, book);
  }, [matchups.data, week, liveFinals, priorStats.data, hasLiveStats, book]);
  const finals = seeded.finals;
  const seededPairs = seeded.pairs;
  const sourcePairs = useMemo(() => {
    const rows = matchups.data ?? [];
    if (!pre.on) return rows;
    return overlayPreLivePairs(rows, pre.games, pre.stats, book);
  }, [matchups.data, pre.on, pre.games, pre.stats, book]);
  const rawShown = useMemo(() => {
    if (pre.on) return sourcePairs;
    if (!seededPairs.length) return [];
    if (phase == null) return sourcePairs;
    return applyReplayPairs(seededPairs, week, phase, finals);
  }, [pre.on, sourcePairs, seededPairs, phase, week, finals]);

  const displayStats = useMemo(() => {
    if (pre.on) return pre.stats;
    if (phase == null) return liveFinals;
    return replayStatMap(finals, phase, week);
  }, [pre.on, pre.stats, phase, liveFinals, finals, week]);

  const shown = useMemo(
    () => paintMatchups(rawShown, projections.data ?? {}, displayStats),
    [rawShown, projections.data, displayStats],
  );

  const prevShown = useMemo(() => {
    if (!seededPairs.length || phase == null || phase <= 0) return null;
    const raw = applyReplayPairs(seededPairs, week, phase - 1, finals);
    return paintMatchups(raw, projections.data ?? {}, replayStatMap(finals, phase - 1, week));
  }, [seededPairs, phase, week, finals, projections.data]);

  // The page shows one matchup at a time. Yours is the default, but every game
  // in the week is one tap or one arrow key away.
  const mineRosterId = league.data?.myRosterId ?? null;
  const myIndex = shown.findIndex(
    (p) => p.home.rosterId === mineRosterId || p.away?.rosterId === mineRosterId,
  );
  const focusIndex = shown.findIndex((p) => p.matchupId === search.focus);
  const defaultIndex = focusIndex >= 0 ? focusIndex : myIndex >= 0 ? myIndex : 0;
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked != null && picked < shown.length ? picked : defaultIndex;
  const pair = shown[selected] ?? null;
  useWarmRosterProfiles(
    leagueId,
    pair
      ? [pair.home, pair.away]
          .flatMap((side) => side?.starters ?? [])
          .map((s) => s.playerId)
          .filter((id): id is string => Boolean(id))
      : undefined,
  );

  useEffect(() => {
    setPicked(null);
  }, [week, leagueId]);

  function move(delta: number) {
    if (!shown.length) return;
    setPicked((selected + delta + shown.length) % shown.length);
  }

  // The strip scrolls rather than paginating, so a fourteen-team league is a
  // swipe instead of fourteen clicks. Arrows only appear when there is
  // somewhere to go.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const syncEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    syncEdges();
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges, shown.length]);

  useEffect(() => {
    if (picked != null) return;
    const on = stripRef.current?.querySelector('[aria-selected="true"]');
    if (on instanceof HTMLElement) on.scrollIntoView({ inline: "center", block: "nearest" });
  }, [week, defaultIndex, shown.length, picked]);

  function scrollStrip(dir: 1 | -1) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 200), behavior: "smooth" });
  }

  // A week already playing out for real has nothing to replay, and a fake Q3
  // sitting on top of live scores is the worst thing this page could do.
  const weekLive = sourcePairs.some(pairingIsLive);
  useEffect(() => {
    if (weekLive && phase != null) stopSim();
  }, [weekLive, phase, stopSim]);

  return (
    <div>
      {(league.data?.scoringLive || (pre.on && pre.live)) && phase == null ? (
        <p className="mb-3 microlabel text-live">
          {pre.on ? "Preseason overlay · display only · " : "Live unofficial · "}
          ticks every {pre.on ? 4 : LIVE_POLL_MS / 1000}s
        </p>
      ) : null}

      {matchups.data == null &&
      (matchups.isPending || matchups.isLoading || !matchups.isFetched) ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.length > 1 ? (
            <div className="relative">
              {edges.left ? (
                <button
                  type="button"
                  aria-label="Scroll matchups left"
                  onClick={() => scrollStrip(-1)}
                  className="absolute top-1/2 left-0 z-10 grid size-8 -translate-x-1 -translate-y-1/2 place-items-center rounded-pill border border-line bg-surface text-faint shadow-[var(--shadow-lift)] hover:text-fg"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                </button>
              ) : null}
              {edges.right ? (
                <button
                  type="button"
                  aria-label="Scroll matchups right"
                  onClick={() => scrollStrip(1)}
                  className="absolute top-1/2 right-0 z-10 grid size-8 translate-x-1 -translate-y-1/2 place-items-center rounded-pill border border-line bg-surface text-faint shadow-[var(--shadow-lift)] hover:text-fg"
                >
                  <ChevronRight className="size-4" strokeWidth={2} />
                </button>
              ) : null}
              <div
                ref={stripRef}
                onScroll={syncEdges}
                role="tablist"
                aria-label="Matchups this week"
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    move(1);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    move(-1);
                  }
                }}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
              >
                {shown.map((p, i) => {
                  const on = i === selected;
                  const scores = pairPreviewScores(p);
                  const preview = !scores.live && pairIsProjected(p);
                  const homePts = scores.home;
                  const awayPts = scores.away;
                  const homeLeads = !p.away || homePts >= awayPts;
                  const decided = scores.live && (homePts > 0 || awayPts > 0);
                  const yours =
                    p.home.rosterId === mineRosterId || p.away?.rosterId === mineRosterId;
                  return (
                    <button
                      key={p.matchupId}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setPicked(i)}
                      className={cn(
                        "w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                        on
                          ? "border-line-strong bg-surface shadow-[var(--shadow-lift)]"
                          : "border-line bg-transparent hover:bg-surface",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate microlabel-data">
                          {yours ? "Your game" : `Game ${i + 1}`}
                        </span>
                        {pairingIsLive(p) ? (
                          <span className="size-1.5 shrink-0 rounded-pill bg-live" />
                        ) : preview ? (
                          <span className="microlabel-data">Proj</span>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          <span className={homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {p.home.teamName}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums",
                            preview && "text-muted",
                          )}
                        >
                          {formatPts(homePts, 1)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          <span className={!homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {p.away?.teamName ?? "Bye"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums",
                            preview && "text-muted",
                          )}
                        >
                          {formatPts(awayPts, 1)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {pair
            ? (() => {
                const title =
                  pair.home.rosterId === mineRosterId || pair.away?.rosterId === mineRosterId
                    ? "Your matchup"
                    : `${pair.home.teamName} vs ${pair.away?.teamName ?? "Bye"}`;
                return (
                  <>
                    <article className="overflow-hidden rounded-xl bg-surface ring-card">
                      <MatchupBoard
                        title={title}
                        label={pair.label}
                        action={
                          <Link
                            to="/league/$leagueId/matchup/$week/$matchupId"
                            params={{
                              leagueId,
                              week: String(week),
                              matchupId: String(pair.matchupId),
                            }}
                            className="microlabel text-accent-strong"
                          >
                            Full box score
                          </Link>
                        }
                        home={pair.home}
                        away={pair.away ?? null}
                        prevHome={prevShown?.[selected]?.home ?? null}
                        prevAway={prevShown?.[selected]?.away ?? null}
                        liveHome={rawShown[selected]?.home.points ?? 0}
                        liveAway={rawShown[selected]?.away?.points ?? 0}
                        leagueId={leagueId}
                        stats={displayStats}
                        onPlayer={openPlayer}
                        projections={projections.data ?? {}}
                        book={book}
                      />
                    </article>
                    {wagerBook.data?.enabled
                      ? (() => {
                          const inIt =
                            mineRosterId != null &&
                            (pair.home.rosterId === mineRosterId ||
                              pair.away?.rosterId === mineRosterId);
                          const line =
                            (pre.on
                              ? overlayBookLine(
                                  pair,
                                  projections.data ?? {},
                                  inIt ? mineRosterId : null,
                                )
                              : null) ??
                            wagerBook.data.lines.find((l) => l.matchupId === pair.matchupId);
                          return line ? (
                            <LinePanel className="mt-6" line={line} onPick={setTicket} />
                          ) : null;
                        })()
                      : null}
                    <MatchupEdge
                      pair={rawShown[selected] ?? pair}
                      leagueId={leagueId}
                      season={league.data?.league.season ?? ""}
                      week={week}
                      mine={mineRosterId}
                    />
                  </>
                );
              })()
            : null}

          {matchups.isSuccess && shown.length === 0 ? (
            <p className="text-sm text-muted">No matchups this week.</p>
          ) : null}
        </div>
      )}
      <PlayerWatch target={watch} onClose={() => setWatch(null)} />
      {wagerBook.data ? (
        <WagerTicket
          open={ticket != null}
          onOpenChange={(next) => {
            if (!next) setTicket(null);
          }}
          leagueId={leagueId}
          target={ticket}
          book={wagerBook.data}
          claimsPending={pendingClaimTotal}
        />
      ) : null}

      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}
