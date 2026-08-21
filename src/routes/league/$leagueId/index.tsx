import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LineupBoard } from "@/components/lineup-board";
import { MatchupCard } from "@/components/matchup-card";
import { PhaseHero } from "@/components/phase-hero";
import { PlayerFeed } from "@/components/player-feed";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { TeamMasthead } from "@/components/team-masthead";
import { Skeleton } from "@/components/ui/skeleton";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  getActivity,
  getByeWeeks,
  getLeagueBundle,
  getMatchups,
  getProjections,
  getPulse,
  getRecap,
  getTeam,
  getWeekStats,
} from "@/lib/data/fns";
import { paintMatchup } from "@/lib/data/matchup-view";
import { prefetchPlayerProfile, useWarmRosterProfiles } from "@/lib/data/player-view";
import { projectionRosterKey } from "@/lib/data/projection-key";
import { baseSlotLabel } from "@/lib/data/teams";
import { overlayPreLivePairs, overlayPreLiveRoster } from "@/lib/demo/pre-live";
import { useDemoOn, usePreLive } from "@/lib/demo/store";
import { usePreLiveFeed } from "@/lib/demo/use-pre-live-feed";
import { planAutoFill } from "@/lib/league/autofill";
import { sitPlayer, startPlayer } from "@/lib/league/fns";
import { invalidateAfterLineup } from "@/lib/league/lineup-cache";
import { lineupHealth, resolvePhase } from "@/lib/league/phase";
import { applyPrototype } from "@/lib/league/prototype";
import { bookFromLeague } from "@/lib/replay";

export const Route = createFileRoute("/league/$leagueId/")({
  component: MyTeamPage,
});

function MyTeamPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const demoOn = useDemoOn();
  const preOn = usePreLive();
  const pre = usePreLiveFeed();

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive || preOn ? 15_000 : false),
  });
  const search = Route.useSearch();
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const rosterId = league.data?.myRosterId ?? null;

  const pulse = useQuery({ queryKey: ["pulse"], queryFn: () => getPulse() });
  const season = league.data?.league.season ?? pulse.data?.state.season ?? "";
  const byes = useQuery({
    queryKey: ["byes", season],
    queryFn: () => getByeWeeks({ data: { season } }),
    enabled: Boolean(season),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const team = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    enabled: rosterId != null,
    refetchInterval: () => (league.data?.scoringLive || preOn ? 4_000 : false),
  });

  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    refetchInterval: () => (league.data?.scoringLive || preOn ? 4_000 : false),
  });

  const book = bookFromLeague(league.data?.league.scoring_settings);
  const pairs = useMemo(() => {
    const rows = matchups.data ?? [];
    if (!pre.on) return rows;
    return overlayPreLivePairs(rows, pre.games, pre.stats, book);
  }, [matchups.data, pre.on, pre.games, pre.stats, book]);
  const myPair = useMemo(() => {
    if (!pairs.length || rosterId == null) return null;
    return pairs.find((p) => p.home.rosterId === rosterId || p.away?.rosterId === rosterId) ?? null;
  }, [pairs, rosterId]);

  const realMe = myPair ? (myPair.home.rosterId === rosterId ? myPair.home : myPair.away) : null;
  const realThem = myPair ? (myPair.home.rosterId === rosterId ? myPair.away : myPair.home) : null;

  const roster = team.data?.players;
  // The matchup card projects both sides, so the opponent's starters ride
  // along in the same projections fetch my lineup already needs.
  const oppStarters = useMemo(
    () =>
      (realThem?.starters ?? [])
        .map((l) => l.player)
        .filter((p): p is NonNullable<typeof p> => p != null),
    [realThem],
  );
  const projections = useQuery({
    queryKey: [
      "projections",
      leagueId,
      week,
      projectionRosterKey([...(roster ?? []), ...oppStarters].map((p) => p.player_id)),
    ],
    queryFn: () =>
      getProjections({
        data: {
          leagueId,
          season,
          week,
          players: [...(roster ?? []), ...oppStarters].map((p) => ({
            player_id: p.player_id,
            team: p.team,
            injury_status: p.injury_status,
            status: p.status,
          })),
        },
      }),
    enabled: Boolean(season) && Boolean(roster?.length),
    staleTime: 60_000,
  });

  const activity = useQuery({
    queryKey: ["activity", leagueId, week],
    queryFn: () => getActivity({ data: { leagueId, week } }),
  });

  const cardPair = useMemo(() => {
    if (!myPair) return null;
    return paintMatchup(myPair, projections.data ?? {}, pre.on ? pre.stats : {});
  }, [myPair, projections.data, pre.on, pre.stats]);

  const recap = useQuery({
    queryKey: ["recap", leagueId, week],
    queryFn: () => getRecap({ data: { leagueId, week } }),
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", season, week],
    queryFn: () =>
      getWeekStats({
        data: { season, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(season) && !preOn,
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });

  const editable = Boolean(league.data?.hosted && rosterId != null && !league.data?.locked);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  useWarmRosterProfiles(
    leagueId,
    team.data?.players.filter((p) => p.slot === "starter").map((p) => p.player_id),
  );

  const start = useMutation({
    mutationFn: async (input: {
      playerId: string;
      replaceId?: string | null;
      slot?: string | null;
      name?: string;
      into?: string;
    }) => {
      await startPlayer({ data: { leagueId, ...input } });
      // Inside mutationFn so a fast Home → Matchups click cannot skip this.
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: (_r, vars) => {
      if (vars.name) toast.success(`${vars.name} starts${vars.into ? ` at ${vars.into}` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start"),
  });
  const sit = useMutation({
    mutationFn: async (input: { playerId: string; name?: string }) => {
      await sitPlayer({ data: { leagueId, playerId: input.playerId } });
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: (_r, vars) => {
      if (vars.name) toast(`${vars.name} moved to the bench`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sit"),
  });

  const swap = useMutation({
    mutationFn: async (v: {
      aId: string;
      bId: string;
      aSlot: string;
      bSlot: string;
      aName: string;
      bName: string;
    }) => {
      // Two legs, in order: the first benches b and moves a into b's slot,
      // the second lifts b into the slot a just left. One invalidate at the end.
      await startPlayer({ data: { leagueId, playerId: v.aId, replaceId: v.bId } });
      await startPlayer({ data: { leagueId, playerId: v.bId, slot: v.aSlot } });
      await invalidateAfterLineup(qc, leagueId);
      return v;
    },
    onSuccess: (v) => toast.success(`${v.aName} to ${v.bSlot}, ${v.bName} to ${v.aSlot}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not swap"),
  });

  const autoFill = useMutation({
    mutationFn: async (swaps: ReturnType<typeof planAutoFill>) => {
      // One at a time: each swap changes what the next one is replacing, and
      // the endpoint is per-player.
      for (const s of swaps) {
        await startPlayer({
          data: {
            leagueId,
            playerId: s.inPlayer.player_id,
            replaceId: s.outPlayer?.player_id ?? null,
            slot: s.outPlayer ? null : s.slot,
          },
        });
      }
      await invalidateAfterLineup(qc, leagueId);
      return swaps;
    },
    onSuccess: (swaps) => {
      if (swaps.length === 0) return;
      const first = swaps[0]!;
      toast.success(
        swaps.length === 1
          ? `${first.inPlayer.full_name} starts at ${first.slot}`
          : `Filled ${swaps.length} slots`,
        {
          description:
            swaps.length === 1
              ? first.outPlayer
                ? `In for ${first.outPlayer.full_name}.`
                : "The slot was empty."
              : swaps.map((s) => `${s.slot} · ${s.inPlayer.full_name}`).join("  ·  "),
        },
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set the lineup"),
  });

  const games = pre.on ? pre.games : pulse.data?.games;
  const nflState = pulse.data?.state;
  const bundle = league.data;
  const phase = useMemo(
    () =>
      bundle
        ? resolvePhase(bundle, games, pre.on ? { ...nflState, season_type: "regular" } : nflState)
        : { phase: "midweek" as const, nextKickoff: null, gamesInPlay: 0, gamesLeft: 0 },
    [bundle, games, nflState, pre.on],
  );

  const players = useMemo(() => {
    const list = team.data?.players;
    if (!list) return list;
    if (!pre.on) return list;
    return overlayPreLiveRoster(list, pre.games, pre.stats, book);
  }, [team.data?.players, pre.on, pre.games, pre.stats, book]);
  const rosterPositions = league.data?.league.roster_positions;
  const byeMap = byes.data;
  const realHealth = useMemo(
    () => lineupHealth(players ?? [], rosterPositions, byeMap, week),
    [players, rosterPositions, byeMap, week],
  );

  const projMap = projections.data;
  /**
   * The masthead's pre-kickoff number: this week's projected total for the
   * lineup as set. getMatchups reports raw points (zero until games start),
   * so the forecast comes from the same projections map the lineup rows use.
   */
  const projTotal = useMemo(() => {
    const starters = (players ?? []).filter((p) => p.slot === "starter");
    if (!projMap || starters.length === 0) return null;
    return starters.reduce((sum, p) => sum + (projMap[p.player_id]?.points ?? 0), 0);
  }, [players, projMap]);
  const realPlan = useMemo(
    () =>
      planAutoFill({
        players: players ?? [],
        rosterPositions: rosterPositions ?? [],
        projections: projMap ?? {},
        byes: byeMap,
        week,
      }),
    [players, rosterPositions, projMap, byeMap, week],
  );

  // `?state=` swaps the derived inputs to the hero and nothing else, so the
  // states it can be in are reviewable in August. Demo mode, dev builds only.
  const hero = useMemo(
    () =>
      applyPrototype(demoOn ? search.state : undefined, {
        phase: phase.phase,
        health: realHealth,
        draftStatus: bundle?.draftStatus ?? "none",
        me: realMe,
        them: realThem,
        starters: (players ?? []).filter((p) => p.slot === "starter"),
        fixable: realPlan.length,
      }),
    [
      demoOn,
      search.state,
      phase.phase,
      realHealth,
      bundle?.draftStatus,
      realMe,
      realThem,
      players,
      realPlan,
    ],
  );

  if (league.data == null && league.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!league.data) return null;

  // No seat in this league. Nothing personal to show, so point at the league
  // rather than render an empty shell.
  if (rosterId == null) {
    return (
      <div className="rounded-xl bg-surface px-5 py-6 ring-card">
        <p className="font-display text-xl font-bold tracking-[-0.03em]">
          You don&rsquo;t have a seat here
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          This page is your roster and your week. Browse the league instead.
        </p>
        <Link
          to="/league/$leagueId/standings"
          params={{ leagueId }}
          className="mt-4 inline-flex h-11 items-center rounded-pill bg-raised px-5 text-sm font-semibold hover:bg-line"
        >
          Open the league
        </Link>
      </div>
    );
  }

  const standings = league.data.standings;

  return (
    <div className="flex flex-col gap-5">
      <PhaseHero
        phase={hero.phase}
        health={hero.health}
        fixable={hero.fixable}
        fixing={autoFill.isPending}
        onFix={() => {
          if (realPlan.length) autoFill.mutate(realPlan);
          else toast("Prototype state — there is nothing on the bench to move.");
        }}
        leagueId={leagueId}
        week={week}
        me={hero.me}
        them={hero.them}
        draftStatus={hero.draftStatus}
        editable={editable}
      />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div id="lineup" className="flex min-w-0 flex-col gap-5 scroll-mt-20">
          {/* The constant masthead: on a calm week the hero is null and this
              strip is the page's top. Its rank cell replaces the old
              "Where you sit" card — the full table is one tap away. */}
          <TeamMasthead
            leagueId={leagueId}
            standings={standings}
            rosterId={rosterId}
            phase={phase.phase}
            weekPts={
              phase.phase === "live" || phase.phase === "settled"
                ? (realMe?.points ?? null)
                : projTotal
            }
            faab={league.data.faabRemaining ?? null}
          />
          {!team.data ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <LineupBoard
              team={{ ...team.data, players: players ?? team.data.players }}
              rosterPositions={league.data.league.roster_positions ?? []}
              editable={editable}
              byes={byes.data}
              week={week}
              projections={projections.data}
              stats={pre.on ? pre.stats : (weekStats.data ?? {})}
              onIntentPlayer={(p) => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
              onOpenPlayer={(p) =>
                setSheet({
                  player: p,
                  game: p.game ?? null,
                  context: {
                    label: p.slot === "starter" ? `Starting at ${p.starterSlot}` : "On your bench",
                    rows: [["Slot", baseSlotLabel(p.starterSlot) || "Bench"]],
                  },
                })
              }
              busy={start.isPending || sit.isPending || swap.isPending}
              onStart={(playerId, replaceId, slot, name, into) =>
                start.mutate({ playerId, replaceId, slot, name, into })
              }
              onSit={(playerId, name) => sit.mutate({ playerId, name })}
              onSwap={(v) => swap.mutate(v)}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {/* The hero keeps the page's only full-width band — it earns it by
              being stateful. The desk leads the rail instead, so an alert or
              live week never stacks two banners before the lineup. */}
          {recap.data ? <DeskCard leagueId={leagueId} week={week} recap={recap.data} /> : null}

          {/* Rail reads story → the week → the risk. Like the hero, the
              matchup card only exists when there is a matchup. */}
          {cardPair ? (
            <MatchupCard
              leagueId={leagueId}
              week={week}
              pair={cardPair}
              rosterId={rosterId}
              standings={standings}
              phase={phase.phase}
              projections={projections.data}
            />
          ) : null}

          <PlayerFeed
            phase={phase.phase}
            players={players ?? []}
            activity={activity.data ?? []}
            news={pulse.data?.news ?? []}
            loading={team.data == null && team.isPending}
          />
        </div>
      </div>

      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}

/** The recap desk card — the editorial tile that leads the right rail. */
function DeskCard({
  leagueId,
  week,
  recap,
}: {
  leagueId: string;
  week: number;
  recap: { kicker: string; headline: string; dek: string };
}) {
  return (
    <Link
      to="/league/$leagueId/recap"
      params={{ leagueId }}
      search={{ week, story: undefined }}
      className="block rounded-xl bg-surface px-5 py-5 ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
    >
      <p className="microlabel">{recap.kicker}</p>
      <p className="mt-1.5 font-display text-xl font-bold leading-snug tracking-[-0.03em]">
        <span className="hl">{recap.headline}</span>
      </p>
      <p className="mt-2.5 max-w-prose text-sm text-muted">{recap.dek}</p>
    </Link>
  );
}
