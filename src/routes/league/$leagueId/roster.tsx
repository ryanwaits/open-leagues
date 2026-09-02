import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { ClaimLedgerFoot, ClaimLedgerRow } from "@/components/claim-ledger";
import { Deck } from "@/components/deck";
import { LineupBoard } from "@/components/lineup-board";
import { MoveRow } from "@/components/move-row";
import { PlayerSheet, type SheetTarget } from "@/components/player-sheet";
import { TradeSpineRow } from "@/components/trade-spine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsPhone } from "@/lib/breakpoint";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  getActivity,
  getByeWeeks,
  getLeagueBundle,
  getProjections,
  getTeam,
  getWeekStats,
} from "@/lib/data/fns";
import { prefetchPlayerProfile, useWarmRosterProfiles } from "@/lib/data/player-view";
import { projectionRosterKey } from "@/lib/data/projection-key";
import { baseSlotLabel } from "@/lib/data/teams";
import type { Projection, RosterPlayer } from "@/lib/data/types";
import {
  cancelClaim,
  cancelTradeFn,
  getClaims,
  getTrades,
  sitPlayer,
  startPlayer,
  voteTrade,
} from "@/lib/league/fns";
import { invalidateAfterLineup } from "@/lib/league/lineup-cache";
import { bookFromLeague } from "@/lib/live/board";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

/** The card is a digest; the activity page is the full ledger. */
const MOVES_SHOWN = 4;

export const Route = createFileRoute("/league/$leagueId/roster")({
  component: MyTeamPage,
});

/** The deck's tabs, in scroll order. Activity fronts for Waivers + Trades + Your moves. */
const DECK_SECTIONS = ["Lineup", "Bench", "Activity"] as const;
type DeckSection = (typeof DECK_SECTIONS)[number];

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

/**
 * The workbench.
 *
 * Home answers "what needs me right now". This answers "what is my roster made
 * of, and what am I going to do about it": the whole roster including the
 * shelves nothing else shows, the claims queue, trades in both directions, and
 * the bye stack that no other screen can tell you about.
 */
function MyTeamPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const isPhone = useIsPhone();

  // The deck's tabs both jump-scroll and track: the active chip always names
  // the section under the header. Sections are queried fresh at track time
  // (not cached at mount) since LineupBoard's bench can mount after the deck.
  // Tracking is phone-only: the deck's nav is md:hidden, so desktop has no
  // reason to run a scroll listener.
  const [activeSec, setActiveSec] = useState<DeckSection>("Lineup");
  useEffect(() => {
    if (!isPhone) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let current: DeckSection = "Lineup";
        for (const name of DECK_SECTIONS) {
          const el = document.querySelector(`[data-deck-sec="${name}"]`);
          if (el && el.getBoundingClientRect().top <= 90) current = name;
        }
        setActiveSec(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isPhone]);

  function jumpToSection(name: DeckSection) {
    const el = document.querySelector<HTMLElement>(`[data-deck-sec="${name}"]`);
    if (!el) return;
    const scroll = () => {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 76,
        behavior: "auto",
      });
    };
    if (el.getAttribute("aria-expanded") === "false") {
      el.click();
      requestAnimationFrame(scroll);
    } else {
      scroll();
    }
  }

  function openPlayer(p: RosterPlayer) {
    const shelf =
      p.slot === "starter"
        ? `Starting at ${p.starterSlot}`
        : p.slot === "ir"
          ? "On IR"
          : p.slot === "taxi"
            ? "On taxi"
            : "On your bench";
    setSheet({
      player: p,
      game: p.game ?? null,
      context: {
        label: shelf,
        rows: [
          ["Slot", baseSlotLabel(p.starterSlot) || (p.slot === "starter" ? "Starter" : p.slot)],
        ],
      },
      projection: baselineOf(projections.data, p.player_id),
      book,
    });
  }

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const search = Route.useSearch();
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const rosterId = league.data?.myRosterId ?? null;
  const season = league.data?.league.season ?? "";

  const book = bookFromLeague(league.data?.league.scoring_settings);
  const team = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    enabled: rosterId != null,
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", season, week],
    queryFn: () =>
      getWeekStats({
        data: { season, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(season),
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });
  const byes = useQuery({
    queryKey: ["byes", season],
    queryFn: () => getByeWeeks({ data: { season } }),
    enabled: Boolean(season),
    staleTime: 12 * 60 * 60 * 1000,
  });
  const players = team.data?.players;
  useWarmRosterProfiles(
    leagueId,
    players?.map((p) => p.player_id),
  );
  const projections = useQuery({
    queryKey: [
      "projections",
      leagueId,
      week,
      projectionRosterKey(players?.map((p) => p.player_id)),
    ],
    queryFn: () =>
      getProjections({
        data: {
          leagueId,
          season,
          week,
          players: (players ?? []).map((p) => ({
            player_id: p.player_id,
            team: p.team,
            injury_status: p.injury_status,
            status: p.status,
          })),
        },
      }),
    enabled: Boolean(season) && Boolean(players?.length),
    staleTime: 60_000,
  });
  const claims = useQuery({
    queryKey: ["claims", leagueId],
    queryFn: () => getClaims({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });
  const trades = useQuery({
    queryKey: ["trades", leagueId],
    queryFn: () => getTrades({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });
  const activity = useQuery({
    queryKey: ["activity", leagueId, week],
    queryFn: () => getActivity({ data: { leagueId, week } }),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["team", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    void qc.invalidateQueries({ queryKey: ["claims", leagueId] });
    void qc.invalidateQueries({ queryKey: ["trades", leagueId] });
    void qc.invalidateQueries({ queryKey: ["matchups", leagueId], refetchType: "all" });
  }
  const start = useMutation({
    mutationFn: async (input: {
      playerId: string;
      replaceId?: string | null;
      slot?: string | null;
      name?: string;
      into?: string;
    }) => {
      await startPlayer({ data: { leagueId, ...input } });
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: (_r, v) => {
      if (v.name) toast.success(`${v.name} starts${v.into ? ` at ${v.into}` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start"),
  });
  const sit = useMutation({
    mutationFn: async (input: { playerId: string; name?: string }) => {
      await sitPlayer({ data: { leagueId, playerId: input.playerId } });
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: (_r, v) => {
      if (v.name) toast(`${v.name} moved to the bench`);
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
  const drop = useMutation({
    mutationFn: (claimId: string) => cancelClaim({ data: { leagueId, claimId } }),
    onSuccess: () => {
      invalidate();
      toast("Claim withdrawn");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel"),
  });
  const vote = useMutation({
    mutationFn: (input: { tradeId: string; accept: boolean }) =>
      voteTrade({ data: { leagueId, ...input } }),
    onSuccess: (_r, v) => {
      invalidate();
      toast(v.accept ? "Trade accepted" : "Trade rejected");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not respond"),
  });
  const pull = useMutation({
    mutationFn: (tradeId: string) => cancelTradeFn({ data: { leagueId, tradeId } }),
    onSuccess: () => {
      invalidate();
      toast("Offer withdrawn");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not withdraw"),
  });

  const byeStack = useMemo(() => {
    const map = byes.data;
    if (!map || !players) return [];
    const buckets = new Map<number, RosterPlayer[]>();
    for (const p of players) {
      if (p.slot === "taxi") continue;
      const w = p.team ? map[p.team.toUpperCase()] : undefined;
      if (!w || w < week) continue;
      buckets.set(w, [...(buckets.get(w) ?? []), p]);
    }
    return [...buckets.entries()]
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
      .slice(0, 4);
  }, [byes.data, players, week]);

  if (league.data == null && league.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (!league.data) return null;
  if (rosterId == null) {
    return (
      <div className="rounded-xl bg-surface px-5 py-6 ring-card">
        <p className="font-display text-xl font-bold tracking-[-0.03em]">
          You don&rsquo;t have a seat here
        </p>
        <p className="mt-2 text-sm text-muted">Browse the league instead.</p>
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
  if (!team.data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const t = {
    ...team.data,
    players: players ?? team.data.players,
  };
  const ops = league.data.ops;
  const seed = league.data.standings.findIndex((s) => s.rosterId === rosterId) + 1;
  // Only live claims. A cancelled or settled one is finished business and
  // belongs in Your moves, not in a card headed "what is still in".
  const myClaims = (claims.data?.items ?? []).filter((c) => c.mine && c.status === "pending");
  // Their amounts are sealed; the count of who else is in on the same player
  // is not, and it is the fact that decides whether a bid is high enough.
  const contenders = new Map<string, number>();
  for (const c of claims.data?.items ?? []) {
    if (c.mine || c.status !== "pending") continue;
    contenders.set(c.add.id, (contenders.get(c.add.id) ?? 0) + 1);
  }
  const waiverType = claims.data?.waiverType ?? ops?.waiverType ?? "faab";
  const claimsStaked = myClaims.reduce((n, c) => n + (c.bid ?? 0), 0);
  // faabAtRisk is wagers, not claims — it is already unavailable to bid with.
  const spendable = Math.max(0, (league.data.faabRemaining ?? 0) - (league.data.faabAtRisk ?? 0));
  const myTrades = (trades.data ?? []).filter(
    (t2) => t2.status === "proposed" && t2.sides.some((s) => s.rosterId === rosterId),
  );
  const myMoves = (activity.data ?? []).filter((a) => a.rosterIds.includes(rosterId));
  const ir = t.players.filter((p) => p.slot === "ir");
  const taxi = t.players.filter((p) => p.slot === "taxi");

  return (
    <div className="flex flex-col gap-5">
      <Deck>
        <span className="flex items-center gap-0.5 rounded-pill bg-raised p-0.5">
          {DECK_SECTIONS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={activeSec === name}
              onClick={() => jumpToSection(name)}
              className={cn(
                "h-8 rounded-pill px-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
                activeSec === name ? "bg-fg text-bg" : "text-faint",
              )}
            >
              {name}
            </button>
          ))}
        </span>
        <span className="flex-1" />
        <Link
          to="/league/$leagueId/trades"
          params={{ leagueId }}
          className="inline-flex h-9 shrink-0 items-center rounded-pill bg-fg px-3.5 text-[13px] font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
        >
          ⇄ Trade
        </Link>
      </Deck>

      <section className="rounded-xl bg-surface ring-card">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Avatar
            src={t.avatar}
            name={t.teamName}
            className="size-16"
            textClassName="text-lg"
            tint
          />
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">{t.teamName}</h1>
            <p className="mt-1 microlabel-data">
              {t.manager} · seat {rosterId} · {seed}
              {seed === 1 ? "st" : seed === 2 ? "nd" : seed === 3 ? "rd" : "th"} of{" "}
              {league.data.standings.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link to="/league/$leagueId/trades" params={{ leagueId }}>
                Propose a trade
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/league/$leagueId/wire" params={{ leagueId }}>
                Add a player
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          <Stat value={fmtRecord(t.record.wins, t.record.losses, t.record.ties)} label="record" />
          <Stat value={formatPts(t.record.pf, 0)} label="points for" />
          <Stat value={formatPts(t.record.pa, 0)} label="points against" />
          <Stat value={String(t.players.length)} label="on roster" />
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {league.data.faabRemaining != null ? (
            <Chip k="FAAB" v={`$${league.data.faabRemaining}`} />
          ) : null}
          {ops ? <Chip k="Trade deadline" v={`Week ${ops.tradeDeadlineWeek}`} /> : null}
          {ops ? (
            <Chip k="Waivers" v={ops.waiversOpen ? "open" : `week ${ops.lastWaiverWeek}`} />
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div data-deck-sec="Lineup">
            <LineupBoard
              team={t}
              rosterPositions={league.data.league.roster_positions ?? []}
              editable={Boolean(league.data.hosted && !league.data.locked)}
              byes={byes.data}
              week={week}
              projections={projections.data}
              stats={weekStats.data ?? {}}
              busy={start.isPending || sit.isPending || swap.isPending}
              onIntentPlayer={(p) => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
              onOpenPlayer={openPlayer}
              onStart={(playerId, replaceId, slot, name, into) =>
                start.mutate({ playerId, replaceId, slot, name, into })
              }
              onSit={(playerId, name) => sit.mutate({ playerId, name })}
              onSwap={(v) => swap.mutate(v)}
            />
          </div>

          {ir.length || taxi.length ? (
            <section className="rounded-xl bg-surface ring-card">
              <header className="px-5 pt-5 pb-2">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Shelves</h2>
              </header>
              <ul>
                {[...ir, ...taxi].map((p) => (
                  <li
                    key={p.player_id}
                    className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
                  >
                    <span className="w-10 shrink-0 microlabel-data">{p.slot}</span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate rounded-md text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
                      onPointerEnter={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                      onPointerDown={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                      onFocus={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                      onClick={() => openPlayer(p)}
                    >
                      {p.full_name}
                    </button>
                    <span className="microlabel-data">
                      {[p.position, p.team].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {league.data.hosted ? (
            <section className="rounded-xl bg-surface ring-card" data-deck-sec="Activity">
              <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Waivers</h2>
                <Link
                  to="/league/$leagueId/wire"
                  params={{ leagueId }}
                  className="microlabel-data text-accent-strong"
                >
                  Add a claim
                </Link>
              </header>
              {myClaims.length === 0 ? (
                <p className="px-5 pb-4 text-sm text-muted">No claims in.</p>
              ) : (
                <ul className="mt-1">
                  {myClaims.map((c) => (
                    <ClaimLedgerRow
                      key={c.id}
                      claim={c}
                      contenders={contenders.get(c.add.id) ?? 0}
                      showBid={waiverType === "faab"}
                      busy={drop.isPending}
                      onWithdraw={() => drop.mutate(c.id)}
                    />
                  ))}
                </ul>
              )}
              <ClaimLedgerFoot
                open={claims.data?.open ?? false}
                week={claims.data?.week ?? week}
                staked={claimsStaked}
                spendable={spendable}
                showMoney={waiverType === "faab"}
              />
            </section>
          ) : null}

          {league.data.hosted ? (
            <section className="rounded-xl bg-surface ring-card">
              <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Trades</h2>
                <Link
                  to="/league/$leagueId/trades"
                  params={{ leagueId }}
                  className="microlabel-data text-accent-strong"
                >
                  Trade desk
                </Link>
              </header>
              {myTrades.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">Nothing on the table.</p>
              ) : (
                <ul className="mt-1">
                  {myTrades.map((tr) => {
                    // An offer you sent is already accepted on your side, so the
                    // only move it leaves you is pulling it back.
                    const iSent = tr.proposerRoster === rosterId;
                    const yourMove = tr.sides.some((s) => s.rosterId === rosterId && !s.accepted);
                    return (
                      <TradeSpineRow
                        key={tr.id}
                        trade={tr}
                        myRosterId={rosterId}
                        leagueId={leagueId}
                        busy={vote.isPending || pull.isPending}
                        onAccept={
                          yourMove ? () => vote.mutate({ tradeId: tr.id, accept: true }) : undefined
                        }
                        onDecline={
                          yourMove
                            ? () => vote.mutate({ tradeId: tr.id, accept: false })
                            : undefined
                        }
                        onCounter={
                          yourMove
                            ? () =>
                                void navigate({
                                  to: "/league/$leagueId/trades",
                                  params: { leagueId },
                                  search: { counter: tr.id },
                                })
                            : undefined
                        }
                        onWithdraw={iSent && !yourMove ? () => pull.mutate(tr.id) : undefined}
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          <section
            className="rounded-xl bg-surface ring-card"
            data-deck-sec={league.data.hosted ? undefined : "Activity"}
          >
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Your moves</h2>
              <Link
                to="/league/$leagueId/activity"
                params={{ leagueId }}
                search={{ week: undefined }}
                className="microlabel-data text-accent-strong"
              >
                All moves
              </Link>
            </header>
            {myMoves.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nothing this week.</p>
            ) : (
              <>
                <ul className="mt-1">
                  {myMoves.slice(0, MOVES_SHOWN).map((m) => (
                    <MoveRow key={m.id} move={m} />
                  ))}
                </ul>
                {/* Say what was cut. A silent slice reads as "that is all of them".
                    No season total: the activity query is capped league-wide, so
                    this count is "more than you can see here", not "all year". */}
                {myMoves.length > MOVES_SHOWN ? (
                  <div className="border-t border-line px-5 py-3">
                    <span className="microlabel-data">+{myMoves.length - MOVES_SHOWN} more</span>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-xl bg-surface ring-card">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Bye trouble</h2>
              <span className="microlabel-data">Derived</span>
            </header>
            {byeStack.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">
                {byes.data ? "No week costs you more than one player." : "Working out the byes…"}
              </p>
            ) : (
              <ul>
                {byeStack.map(([w, list]) => (
                  <li
                    key={w}
                    className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">Week {w}</span>
                      <span className="block truncate microlabel-data">
                        {list.map((p) => p.full_name.split(" ").slice(-1)[0]).join(" · ")}
                      </span>
                    </span>
                    <Badge tone={list.length >= 3 ? "loss" : "muted"}>{list.length} out</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <PlayerSheet target={sheet} leagueId={leagueId} onClose={() => setSheet(null)} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={cn("border-r border-b border-line px-5 py-3 last:border-r-0 sm:border-b-0")}>
      <span className="block font-mono text-xl font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 block microlabel-data">{label}</span>
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 font-mono text-[10.5px] text-muted">
      {k} <b className="font-semibold text-fg">{v}</b>
    </span>
  );
}
