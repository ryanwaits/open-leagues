import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LineupBoard } from "@/components/lineup-board";
import { MatchupCard } from "@/components/matchup-card";
import { PhaseHero } from "@/components/phase-hero";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { TeamMasthead } from "@/components/team-masthead";
import { Skeleton } from "@/components/ui/skeleton";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  getByeWeeks,
  getLeagueBundle,
  getMatchups,
  getProjections,
  getPulse,
  getTeam,
  getWeekStats,
} from "@/lib/data/fns";
import { paintMatchup, pairHasStarted } from "@/lib/data/matchup-view";
import { prefetchPlayerProfile, useWarmRosterProfiles } from "@/lib/data/player-view";
import { projectionRosterKey } from "@/lib/data/projection-key";
import { baseSlotLabel } from "@/lib/data/teams";
import type { Projection } from "@/lib/data/types";
import { planAutoFill } from "@/lib/league/autofill";
import { sitPlayer, startPlayer } from "@/lib/league/fns";
import { invalidateAfterLineup } from "@/lib/league/lineup-cache";
import { lineupHealth, resolvePhase } from "@/lib/league/phase";
import { bookFromLeague } from "@/lib/live/board";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/")({
  component: MyTeamPage,
});

/** No baseline for a bye/out/no-data week — nothing to project against. */
function baselineOf(
  projections: Record<string, Projection> | undefined,
  playerId: string | null | undefined,
): number | null {
  if (!playerId) return null;
  const p = projections?.[playerId];
  if (!p || p.reason === "bye" || p.reason === "out" || p.reason === "no-data") return null;
  return p.points;
}

function MyTeamPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive ? 15_000 : false),
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
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });

  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });

  const book = bookFromLeague(league.data?.league.scoring_settings);
  const pairs = matchups.data ?? [];
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

  const cardPair = useMemo(() => {
    if (!myPair) return null;
    return paintMatchup(myPair, projections.data ?? {}, {});
  }, [myPair, projections.data]);

  const weekStats = useQuery({
    queryKey: ["week-stats", season, week],
    queryFn: () =>
      getWeekStats({
        data: { season, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(season),
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

  const games = pulse.data?.games;
  const nflState = pulse.data?.state;
  const bundle = league.data;
  const phase = useMemo(
    () =>
      bundle
        ? resolvePhase(bundle, games, nflState)
        : { phase: "midweek" as const, nextKickoff: null, gamesInPlay: 0, gamesLeft: 0 },
    [bundle, games, nflState],
  );

  const players = team.data?.players;
  const rosterPositions = league.data?.league.roster_positions;
  const byeMap = byes.data;
  const realHealth = useMemo(
    () => lineupHealth(players ?? [], rosterPositions, byeMap, week),
    [players, rosterPositions, byeMap, week],
  );

  const projMap = projections.data;
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

  const hero = {
    phase: phase.phase,
    health: realHealth,
    draftStatus: bundle?.draftStatus ?? "none",
    me: realMe,
    them: realThem,
    fixable: realPlan.length,
  };

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
  const started = phase.phase === "live" || (cardPair ? pairHasStarted(cardPair) : false);

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
          {/* On a phone the agate strip still leads the page; on desktop it lives
              in the rail as its own card (desk → you → the matchup). */}
          <div className="lg:hidden">
            <TeamMasthead
              leagueId={leagueId}
              standings={standings}
              rosterId={rosterId}
              week={week}
              faab={league.data.faabRemaining ?? null}
            />
          </div>
          {/* Once anyone has kicked off, a phone wants the score before the
              lineup. Desktop keeps it in the rail, so this copy is phone-only. */}
          {cardPair && started ? (
            <div className="lg:hidden">
              <MatchupCard
                leagueId={leagueId}
                week={week}
                pair={cardPair}
                rosterId={rosterId}
                standings={standings}
                phase={phase.phase}
                projections={projections.data}
                season={season}
              />
            </div>
          ) : null}
          {!team.data ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <LineupBoard
              title={team.data.teamName}
              benchCollapsed
              team={{ ...team.data, players: players ?? team.data.players }}
              rosterPositions={league.data.league.roster_positions ?? []}
              editable={editable}
              byes={byes.data}
              week={week}
              projections={projections.data}
              stats={weekStats.data ?? {}}
              onIntentPlayer={(p) => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
              onOpenPlayer={(p) =>
                setSheet({
                  player: p,
                  game: p.game ?? null,
                  context: {
                    label: p.slot === "starter" ? `Starting at ${p.starterSlot}` : "On your bench",
                    rows: [["Slot", baseSlotLabel(p.starterSlot) || "Bench"]],
                  },
                  projection: baselineOf(projMap, p.player_id),
                  book,
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
          <div className="max-lg:hidden">
            <TeamMasthead
              leagueId={leagueId}
              standings={standings}
              rosterId={rosterId}
              week={week}
              faab={league.data.faabRemaining ?? null}
            />
          </div>

          {/* Rail reads story → the week → the risk. Like the hero, the
              matchup card only exists when there is a matchup. */}
          {cardPair ? (
            <div className={cn(started && "max-lg:hidden")}>
              <MatchupCard
                leagueId={leagueId}
                week={week}
                pair={cardPair}
                rosterId={rosterId}
                standings={standings}
                phase={phase.phase}
                projections={projections.data}
                season={season}
              />
            </div>
          ) : null}
        </div>
      </div>

      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}
