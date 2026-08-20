import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TradeComposer, type TradeComposerInitial } from "@/components/trade-composer";
import { TradeOfferCard } from "@/components/trade-offer-card";
import { getLeagueBundle, getProjections, getTeam } from "@/lib/data/fns";
import { projectionRosterKey } from "@/lib/data/projection-key";
import type { Projection, RosterPlayer, SlimPlayer } from "@/lib/data/types";
import { cancelTradeFn, getTradablePicks, getTrades, voteTrade } from "@/lib/league/fns";
import { type TradeDelta, tradeDelta } from "@/lib/league/lineup-value";
import { cn } from "@/lib/utils";

type TradesSearch = { counter?: string; want?: string; with?: number };

export const Route = createFileRoute("/league/$leagueId/trades")({
  validateSearch: (s: Record<string, unknown>): TradesSearch => {
    const out: TradesSearch = {};
    if (typeof s.counter === "string") out.counter = s.counter;
    if (typeof s.want === "string") out.want = s.want;
    if (typeof s.with === "number" && Number.isFinite(s.with)) out.with = Math.floor(s.with);
    else if (typeof s.with === "string" && /^\d+$/.test(s.with)) out.with = Number(s.with);
    return out;
  },
  component: TradesPage,
});

function TradesPage() {
  const { leagueId } = Route.useParams();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const trades = useQuery({
    queryKey: ["trades", leagueId],
    queryFn: () => getTrades({ data: { leagueId } }),
  });
  const picksOpen = league.data?.draftStatus === "pending" || league.data?.draftStatus === "live";
  const picks = useQuery({
    queryKey: ["picks", leagueId],
    queryFn: () => getTradablePicks({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted && picksOpen),
  });
  const mineId = league.data?.myRosterId;
  const week = league.data?.currentWeek ?? 1;
  const season = league.data?.league.season ?? "";
  const rosterPositions = league.data?.league.roster_positions ?? [];
  const standings = league.data?.standings ?? [];
  const partners = standings.filter((s) => s.rosterId !== mineId);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [thirdId, setThirdId] = useState<number | null>(null);
  const them = partnerId ?? partners[0]?.rosterId ?? null;

  const counterTrade = useMemo(() => {
    if (!search.counter || !trades.data) return null;
    return trades.data.find((t) => t.id === search.counter) ?? null;
  }, [search.counter, trades.data]);

  // Counter: pick the other seat so the composer opens against the right roster.
  // A player-page handoff (`?want=&with=`) does the same against the owner.
  useEffect(() => {
    if (counterTrade && mineId != null) {
      const other = counterTrade.sides.find((s) => s.rosterId !== mineId);
      if (other) setPartnerId(other.rosterId);
      return;
    }
    if (search.with != null) setPartnerId(search.with);
  }, [counterTrade, mineId, search.with]);

  const composerInitial = useMemo((): TradeComposerInitial | null => {
    if (!counterTrade || mineId == null) {
      if (!search.want) return null;
      return {
        sendPlayerIds: [],
        sendPickNos: [],
        sendFaab: null,
        getPlayerIds: [search.want],
        getPickNos: [],
        getFaab: null,
      };
    }
    const sendPlayerIds: string[] = [];
    const getPlayerIds: string[] = [];
    const sendPickNos: number[] = [];
    const getPickNos: number[] = [];
    let sendFaab: number | null = null;
    let getFaab: number | null = null;
    for (const a of counterTrade.assets) {
      if (a.kind === "player" && a.playerId) {
        if (a.fromRoster === mineId) sendPlayerIds.push(a.playerId);
        else if (a.toRoster === mineId) getPlayerIds.push(a.playerId);
      } else if (a.kind === "pick" && a.pickNo != null) {
        if (a.fromRoster === mineId) sendPickNos.push(a.pickNo);
        else if (a.toRoster === mineId) getPickNos.push(a.pickNo);
      } else if (a.kind === "faab" && a.amount != null && a.amount > 0) {
        if (a.fromRoster === mineId) sendFaab = (sendFaab ?? 0) + a.amount;
        else if (a.toRoster === mineId) getFaab = (getFaab ?? 0) + a.amount;
      }
    }
    return {
      sendPlayerIds,
      sendPickNos,
      sendFaab,
      getPlayerIds,
      getPickNos,
      getFaab,
    };
  }, [counterTrade, mineId, search.want]);

  // One getTeam per involved roster, shared across every pending card.
  const bookRosterIds = useMemo(() => {
    const ids = new Set<number>();
    if (mineId != null) ids.add(mineId);
    for (const t of trades.data ?? []) {
      if (t.status !== "proposed") continue;
      if (mineId == null || !t.sides.some((s) => s.rosterId === mineId)) continue;
      for (const s of t.sides) ids.add(s.rosterId);
    }
    return [...ids].sort((a, b) => a - b);
  }, [trades.data, mineId]);

  const bookRosterQueries = useQueries({
    queries: bookRosterIds.map((rosterId) => ({
      queryKey: ["team", leagueId, rosterId, week] as const,
      queryFn: () => getTeam({ data: { leagueId, rosterId, week } }),
      enabled: Boolean(league.data && rosterId != null),
    })),
  });

  const rosterById = useMemo(() => {
    const map = new Map<number, RosterPlayer[]>();
    bookRosterIds.forEach((id, i) => {
      const players = bookRosterQueries[i]?.data?.players;
      if (players) map.set(id, players);
    });
    return map;
  }, [bookRosterIds, bookRosterQueries]);

  const playerById = useMemo(() => {
    const map = new Map<string, SlimPlayer>();
    for (const players of rosterById.values()) {
      for (const p of players) map.set(p.player_id, p);
    }
    return map;
  }, [rosterById]);

  const mineTeam = useQuery({
    queryKey: ["team", leagueId, mineId, league.data?.currentWeek],
    queryFn: () =>
      getTeam({ data: { leagueId, rosterId: mineId!, week: league.data!.currentWeek } }),
    enabled: Boolean(mineId && league.data?.hosted && !league.data.locked),
  });
  const themTeam = useQuery({
    queryKey: ["team", leagueId, them, league.data?.currentWeek],
    queryFn: () => getTeam({ data: { leagueId, rosterId: them!, week: league.data!.currentWeek } }),
    enabled: Boolean(them && league.data),
  });
  const thirdTeam = useQuery({
    queryKey: ["team", leagueId, thirdId, league.data?.currentWeek],
    queryFn: () =>
      getTeam({ data: { leagueId, rosterId: thirdId!, week: league.data!.currentWeek } }),
    enabled: Boolean(thirdId && league.data),
  });

  const projectionInputs = useMemo(() => {
    const byId = new Map<
      string,
      {
        player_id: string;
        team: string | null;
        injury_status: string | null | undefined;
        status: string | null | undefined;
      }
    >();
    const add = (players: RosterPlayer[] | undefined) => {
      for (const p of players ?? []) {
        byId.set(p.player_id, {
          player_id: p.player_id,
          team: p.team,
          injury_status: p.injury_status,
          status: p.status,
        });
      }
    };
    for (const players of rosterById.values()) add(players);
    // Composer sides — partner may not yet appear in the book roster set.
    add(mineTeam.data?.players);
    add(themTeam.data?.players);
    add(thirdTeam.data?.players);
    return [...byId.values()];
  }, [rosterById, mineTeam.data?.players, themTeam.data?.players, thirdTeam.data?.players]);

  const projectionKey = useMemo(
    () => projectionRosterKey(projectionInputs.map((p) => p.player_id)),
    [projectionInputs],
  );
  const projectionsQ = useQuery({
    queryKey: ["projections", leagueId, week, projectionKey],
    queryFn: () =>
      getProjections({
        data: {
          leagueId,
          season,
          week,
          players: projectionInputs,
        },
      }),
    enabled: Boolean(season) && projectionInputs.length > 0,
    staleTime: 60_000,
  });
  const projections = (projectionsQ.data ?? {}) as Record<string, Projection>;

  const bookRostersReady =
    bookRosterIds.length === 0 || bookRosterIds.every((_, i) => bookRosterQueries[i]?.data != null);
  // Empty map while loading is a false 0.0 — wait for the book when we asked for one.
  const projectionsReady =
    projectionInputs.length === 0 || projectionsQ.isSuccess || projectionsQ.isError;

  const deltas = useMemo(() => {
    const out = new Map<string, TradeDelta | null>();
    if (mineId == null) return out;
    const minePlayers = rosterById.get(mineId);
    if (!minePlayers || !bookRostersReady || !projectionsReady || !rosterPositions.length) {
      for (const t of trades.data ?? []) out.set(t.id, null);
      return out;
    }
    for (const t of trades.data ?? []) {
      if (t.status !== "proposed" || !t.sides.some((s) => s.rosterId === mineId)) {
        out.set(t.id, null);
        continue;
      }
      const outgoingIds = t.assets
        .filter((a) => a.kind === "player" && a.fromRoster === mineId && a.playerId)
        .map((a) => a.playerId!);
      const incoming: RosterPlayer[] = [];
      for (const a of t.assets) {
        if (a.kind !== "player" || a.toRoster !== mineId || !a.playerId) continue;
        const fromPlayers = rosterById.get(a.fromRoster);
        const found = fromPlayers?.find((p) => p.player_id === a.playerId);
        if (found) incoming.push(found);
      }
      // Wait until every counterparty roster used by this trade has loaded.
      const needed = new Set(
        t.assets
          .filter((a) => a.kind === "player" && a.toRoster === mineId)
          .map((a) => a.fromRoster),
      );
      if ([...needed].some((id) => !rosterById.has(id))) {
        out.set(t.id, null);
        continue;
      }
      out.set(
        t.id,
        tradeDelta({
          players: minePlayers,
          rosterPositions,
          projections,
          outgoingIds,
          incoming,
        }),
      );
    }
    return out;
  }, [
    trades.data,
    mineId,
    rosterById,
    bookRostersReady,
    projectionsReady,
    rosterPositions,
    projections,
  ]);

  const myPicks = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === mineId),
    [picks.data, mineId],
  );
  const theirPicks = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === them),
    [picks.data, them],
  );
  const thirdPickList = useMemo(
    () => (picks.data ?? []).filter((p) => p.rosterId === thirdId),
    [picks.data, thirdId],
  );

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["trades", leagueId] });
    void qc.invalidateQueries({ queryKey: ["picks", leagueId] });
    void qc.invalidateQueries({ queryKey: ["team", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    void qc.invalidateQueries({ queryKey: ["draft", leagueId] });
  }

  const vote = useMutation({
    mutationFn: (input: { tradeId: string; accept: boolean }) =>
      voteTrade({ data: { leagueId, ...input } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not vote"),
  });
  const pull = useMutation({
    mutationFn: (tradeId: string) => cancelTradeFn({ data: { leagueId, tradeId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not cancel"),
  });

  // Pulled or declined deals are finished. Keep proposed + processed only.
  const book = useMemo(
    () => (trades.data ?? []).filter((t) => t.status !== "cancelled" && t.status !== "rejected"),
    [trades.data],
  );

  if (!league.data?.hosted) {
    return <p className="text-sm text-muted">Trades live on hosted Ledger leagues.</p>;
  }

  const preDraft = picksOpen;
  // The composer parks a fixed action rail over the bottom of the viewport, so
  // the page owes it room. Padding the composer alone left the book underneath
  // it clipped — the rail is fixed to the window, not to its sibling.
  const composing = Boolean(mineId && !league.data.locked && them != null);

  return (
    <div className={cn("space-y-8", composing && "pb-28 md:pb-24")}>
      <p className="max-w-xl text-sm text-muted">
        {preDraft
          ? "Draft hasn't happened yet — trade unused picks now. Your first for their first and second, dump a last-rounder, three-teamers. Ownership moves on the board immediately once everyone accepts."
          : "Swap players. Two teams or three. Everyone in the deal has to accept."}{" "}
        Deadline week {league.data.ops?.tradeDeadlineWeek ?? 11}.
      </p>

      {mineId && !league.data.locked ? (
        <section className="space-y-3">
          <p className="microlabel">Propose</p>
          {search.want && !counterTrade ? (
            <p className="text-xs text-muted">
              Player is on their roster. Partner is set — add what you want to send.
            </p>
          ) : null}
          <p className="text-xs text-muted">Partner</p>
          <div className="flex flex-wrap gap-2">
            {partners.map((p) => (
              <button
                key={p.rosterId}
                type="button"
                onClick={() => {
                  setPartnerId(p.rosterId);
                  if (thirdId === p.rosterId) setThirdId(null);
                }}
                className={cn(
                  "h-10 rounded-sm px-3 text-sm",
                  them === p.rosterId ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                )}
              >
                {p.teamName}
              </button>
            ))}
          </div>

          {them != null ? (
            <TradeComposer
              leagueId={leagueId}
              myRosterId={mineId}
              theirRosterId={them}
              thirdRosterId={thirdId}
              partners={partners.map((p) => ({ rosterId: p.rosterId, teamName: p.teamName }))}
              myRoster={mineTeam.data?.players ?? []}
              theirRoster={themTeam.data?.players ?? []}
              thirdRoster={thirdTeam.data?.players ?? []}
              myPicks={picksOpen ? myPicks : []}
              theirPicks={picksOpen ? theirPicks : []}
              thirdPicks={picksOpen ? thirdPickList : []}
              projections={projections}
              rosterPositions={rosterPositions}
              myFaabFree={Math.max(
                0,
                (league.data.faabRemaining ?? 0) - (league.data.faabAtRisk ?? 0),
              )}
              theirFaabFree={null}
              thirdFaabFree={null}
              onThirdChange={setThirdId}
              initial={composerInitial}
              countering={Boolean(counterTrade)}
              onProposed={() => {
                invalidate();
                if (search.counter || search.want) {
                  void navigate({
                    search: (prev) => {
                      const next = { ...prev };
                      delete next.counter;
                      delete next.want;
                      delete next.with;
                      return next;
                    },
                  });
                }
              }}
            />
          ) : null}

          {!thirdId ? (
            <button
              type="button"
              className="microlabel text-muted hover:text-fg"
              onClick={() =>
                setThirdId(partners.find((p) => p.rosterId !== them)?.rosterId ?? null)
              }
            >
              + Team
            </button>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted">Claim a seat to propose trades.</p>
      )}

      <section>
        <p className="microlabel">Book</p>
        {trades.data == null && trades.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !book.length ? (
          <p className="mt-3 text-sm text-muted">No trades yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {book.map((t) => {
              const delta = deltas.get(t.id) ?? null;
              const minePlayers = mineId != null ? rosterById.get(mineId) : undefined;
              let posBefore: Record<string, number> | undefined;
              let posAfter: Record<string, number> | undefined;
              if (delta != null && minePlayers && mineId != null) {
                const outgoing = new Set(
                  t.assets
                    .filter((a) => a.kind === "player" && a.fromRoster === mineId && a.playerId)
                    .map((a) => a.playerId!),
                );
                const incoming = t.assets
                  .filter((a) => a.kind === "player" && a.toRoster === mineId && a.playerId)
                  .map((a) => {
                    const from = rosterById.get(a.fromRoster);
                    return from?.find((p) => p.player_id === a.playerId) ?? null;
                  })
                  .filter((p): p is RosterPlayer => p != null);
                const afterPlayers = [
                  ...minePlayers.filter((p) => !outgoing.has(p.player_id)),
                  ...incoming,
                ];
                posBefore = countPositions(minePlayers);
                posAfter = countPositions(afterPlayers);
              }
              const waitingOnMe =
                Boolean(mineId) &&
                t.status === "proposed" &&
                t.sides.some((s) => s.rosterId === mineId && !s.accepted);
              return (
                <TradeOfferCard
                  key={t.id}
                  trade={t}
                  myRosterId={mineId ?? null}
                  delta={delta}
                  projections={projections}
                  playerById={playerById}
                  posBefore={posBefore}
                  posAfter={posAfter}
                  busy={vote.isPending || pull.isPending}
                  onAccept={
                    waitingOnMe ? () => vote.mutate({ tradeId: t.id, accept: true }) : undefined
                  }
                  onDecline={
                    waitingOnMe ? () => vote.mutate({ tradeId: t.id, accept: false }) : undefined
                  }
                  onCounter={
                    waitingOnMe
                      ? () =>
                          void navigate({
                            search: (prev) => ({ ...prev, counter: t.id }),
                          })
                      : undefined
                  }
                  onAcceptHouse={
                    league.data.isCommish &&
                    t.status === "proposed" &&
                    t.sides.some((s) => s.house && !s.accepted)
                      ? () => vote.mutate({ tradeId: t.id, accept: true })
                      : undefined
                  }
                  onPull={
                    t.status === "proposed" && t.proposerRoster === mineId
                      ? () => pull.mutate(t.id)
                      : undefined
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function countPositions(players: Array<{ position: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    const pos = p.position?.trim() || "?";
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}
