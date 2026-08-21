import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { DraftBoard } from "@/components/draft-board";
import { PlayerCell } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import type { SlimPlayer } from "@/lib/data/types";
import { getMockPool } from "@/lib/league/fns";
import {
  type MockPlayer,
  type MockState,
  mockPick,
  runBotsUntilMyTurn,
  startMock,
} from "@/lib/league/mock-draft";
import { cn, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const Route = createFileRoute("/league/$leagueId/mock")({
  component: MockDraftPage,
});

type QueueEntry = {
  playerId: string;
  name: string;
  position: string | null;
  team: string | null;
};

type HistoryEntry = {
  finishedAt: number;
  mySeat: number;
  myPicks: { round: number; slot: number; name: string; position: string | null }[];
};

function asSlim(p: MockPlayer): SlimPlayer {
  return {
    player_id: p.playerId,
    full_name: p.name,
    position: p.position,
    team: p.team,
  };
}

function boardFromMock(state: MockState) {
  return state.picks.map((p) => {
    const seat = state.seats.find((s) => s.rosterId === p.rosterId);
    return {
      pickNo: p.pickNo,
      round: p.round,
      slot: p.slot,
      label: `${p.round}.${String(p.slot).padStart(2, "0")}`,
      rosterId: p.rosterId,
      teamName: seat?.teamName ?? `Team ${p.rosterId}`,
      via: null as string | null,
      player: p.player
        ? {
            playerId: p.player.playerId,
            name: p.player.name,
            position: p.player.position,
          }
        : null,
    };
  });
}

function snapshotHistory(state: MockState): HistoryEntry {
  const myRosterId = state.seats[state.mySeat]?.rosterId;
  return {
    finishedAt: Date.now(),
    mySeat: state.mySeat,
    myPicks: state.picks
      .filter((p) => p.rosterId === myRosterId && p.player)
      .map((p) => ({
        round: p.round,
        slot: p.slot,
        name: p.player!.name,
        position: p.player!.position,
      })),
  };
}

function MockDraftPage() {
  const { leagueId } = Route.useParams();
  const [pos, setPos] = useState<(typeof POS)[number]>("ALL");
  const [q, setQ] = useState("");
  const [state, setState] = useState<MockState | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [seatPicker, setSeatPicker] = useState(false);
  const historyRef = useRef<HistoryEntry[]>([]);
  const [, bump] = useState(0);

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const poolQ = useQuery({
    queryKey: ["mock-pool", leagueId],
    queryFn: () => getMockPool({ data: { leagueId } }),
    staleTime: 60 * 60 * 1000,
    enabled: Boolean(league.data?.hosted),
  });

  const seats = useMemo(() => {
    const rows = league.data?.standings ?? [];
    return [...rows]
      .sort((a, b) => a.rosterId - b.rosterId)
      .map((r) => ({ rosterId: r.rosterId, teamName: r.teamName }));
  }, [league.data?.standings]);

  const rounds = Math.max(1, league.data?.league.roster_positions?.length ?? 15);
  const pool = poolQ.data ?? [];
  const poolNote =
    poolQ.isSuccess && pool.length <= 80
      ? "Pool is thin — scored under your league book from last season."
      : null;

  function begin(mySeat: number) {
    if (seats.length === 0) return;
    if (state && state.picks.every((p) => p.player)) {
      historyRef.current = [snapshotHistory(state), ...historyRef.current].slice(0, 8);
      bump((n) => n + 1);
    }
    let next = startMock({ seats, mySeat, rounds });
    next = runBotsUntilMyTurn(next, pool);
    setState(next);
    setSeatPicker(false);
  }

  function restart() {
    begin(state?.mySeat ?? defaultSeat());
  }

  function defaultSeat() {
    const mine = league.data?.myRosterId;
    if (mine == null) return 0;
    const i = seats.findIndex((s) => s.rosterId === mine);
    return i >= 0 ? i : 0;
  }

  function takePlayer(playerId: string) {
    if (!state) return;
    let next = mockPick(state, pool, playerId);
    setQueue((prev) => prev.filter((e) => e.playerId !== playerId));
    next = runBotsUntilMyTurn(next, pool);
    if (next.picks.every((p) => p.player)) {
      historyRef.current = [snapshotHistory(next), ...historyRef.current].slice(0, 8);
      bump((n) => n + 1);
    }
    setState(next);
  }

  function skipToMine() {
    if (!state) return;
    setState(runBotsUntilMyTurn(state, pool));
  }

  function addQueue(p: MockPlayer) {
    setQueue((prev) =>
      prev.some((e) => e.playerId === p.playerId)
        ? prev
        : [...prev, { playerId: p.playerId, name: p.name, position: p.position, team: p.team }],
    );
  }

  function removeQueue(playerId: string) {
    setQueue((prev) => prev.filter((e) => e.playerId !== playerId));
  }

  function moveQueue(playerId: string, dir: -1 | 1) {
    setQueue((prev) => {
      const ids = prev.map((e) => e.playerId);
      const i = ids.indexOf(playerId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  if (league.data == null && league.isPending) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (!league.data?.hosted) {
    return (
      <p className="text-sm text-muted">
        Mock drafts are for hosted leagues — this one already drafted on Sleeper.
      </p>
    );
  }

  if (seats.length === 0) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (!state) {
    return (
      <div className="space-y-6">
        <Banner />
        <div className="rounded-xl bg-surface p-6 ring-card">
          <h2 className="font-display text-2xl tracking-tight">Mock draft</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Same board and book as the real room. Nothing here is saved — refresh and it is gone.
          </p>
          {poolQ.isLoading ? (
            <Skeleton className="mt-4 h-10 w-40" />
          ) : (
            <Button
              className="mt-4"
              onClick={() => begin(defaultSeat())}
              disabled={pool.length === 0}
            >
              Start from {seats[defaultSeat()]?.teamName ?? "your seat"}
            </Button>
          )}
          {poolNote ? <p className="mt-3 text-xs text-muted">{poolNote}</p> : null}
          <p className="mt-4 text-sm">
            <Link
              to="/league/$leagueId/draft"
              params={{ leagueId }}
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              Back to the real draft
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const taken = new Set(state.picks.filter((p) => p.player).map((p) => p.player!.playerId));
  const myRosterId = state.seats[state.mySeat]?.rosterId ?? null;
  const onClock = state.picks.find((p) => p.pickNo === state.onClock);
  const isMyPick = Boolean(onClock && !onClock.player && onClock.rosterId === myRosterId);
  const done = state.picks.every((p) => p.player);
  const needle = q.trim().toLowerCase();
  const available = pool
    .filter((p) => !taken.has(p.playerId))
    .filter((p) => (pos === "ALL" ? true : p.position === pos))
    .filter((p) => {
      if (!needle) return true;
      return `${p.name} ${p.team ?? ""}`.toLowerCase().includes(needle);
    });
  const queuedIds = new Set(queue.map((e) => e.playerId));
  const onClockName =
    onClock && !onClock.player
      ? (state.seats.find((s) => s.rosterId === onClock.rosterId)?.teamName ?? null)
      : null;
  const filled = state.picks.filter((p) => p.player).length;

  return (
    <div className="space-y-8">
      <Banner />

      <DraftBoard
        board={boardFromMock(state)}
        seats={state.seats}
        onClockPickNo={done ? -1 : state.onClock}
        myRosterId={myRosterId}
      />

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <p className="microlabel">
            Mock · pick {Math.min(state.onClock, state.picks.length)} / {state.picks.length}
            {pool.length ? ` · ${pool.length}-player pool` : ""}
          </p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            {done
              ? "Board is closed"
              : isMyPick
                ? "Your pick"
                : onClockName
                  ? `${onClockName} is on the clock`
                  : "Mock draft"}
          </h2>
          {isMyPick ? <p className="mt-2 text-sm text-live">Your pick. Take someone.</p> : null}
          {poolNote ? <p className="mt-2 text-xs text-muted">{poolNote}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={restart}>
              Restart
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSeatPicker((v) => !v)}>
              Change seat
            </Button>
            {!done && !isMyPick ? (
              <Button variant="outline" size="sm" onClick={skipToMine}>
                Skip to my pick
              </Button>
            ) : null}
            {isMyPick && queue[0] && !taken.has(queue[0].playerId) ? (
              <Button size="sm" onClick={() => takePlayer(queue[0]!.playerId)}>
                Take queued
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/league/$leagueId/draft" params={{ leagueId }}>
                Real draft
              </Link>
            </Button>
          </div>

          {seatPicker ? (
            <ul className="mt-4 space-y-1 rounded-xl bg-surface p-3 ring-card">
              {state.seats.map((s, i) => (
                <li key={s.rosterId}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                      i === state.mySeat ? "bg-accent text-accent-fg" : "hover:bg-raised",
                    )}
                    onClick={() => begin(i)}
                  >
                    <span>
                      #{i + 1} · {s.teamName}
                    </span>
                    {league.data?.myRosterId === s.rosterId ? (
                      <Badge tone="muted">You</Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8">
            <p className="microlabel">Your queue</p>
            <ul className="mt-2 space-y-1">
              {queue.map((entry, i) => (
                <li
                  key={entry.playerId}
                  className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 ring-card"
                >
                  <span className="w-5 font-mono text-[11px] text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.name}</p>
                    <p className="font-mono text-[11px] text-muted">
                      {[entry.position, entry.team].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={i === 0}
                      onClick={() => moveQueue(entry.playerId, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={i === queue.length - 1}
                      onClick={() => moveQueue(entry.playerId, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeQueue(entry.playerId)}
                      aria-label="Remove from queue"
                    >
                      ×
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {queue.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Empty — queue someone from the pool.</p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Local to this mock. Never hits the league queue.
            </p>
          </div>

          {historyRef.current.length > 0 ? (
            <div className="mt-8">
              <p className="microlabel">How the board fell</p>
              <ul className="mt-2 space-y-3">
                {historyRef.current.map((h) => (
                  <li
                    key={h.finishedAt}
                    className="rounded-lg bg-surface px-3 py-2 text-sm ring-card"
                  >
                    <p className="font-mono text-[11px] text-faint">
                      Seat {h.mySeat + 1} · {h.myPicks.length} picks
                    </p>
                    <p className="mt-1 text-muted">
                      {h.myPicks
                        .slice(0, 6)
                        .map((p) => `${p.round}.${p.slot} ${p.name}`)
                        .join(" · ")}
                      {h.myPicks.length > 6 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Ephemeral — gone when you leave this page.</p>
            </div>
          ) : null}

          <p className="mt-6 text-xs text-muted">
            {filled} / {state.picks.length} filled · no clock · scored as {league.data.scoringLabel}
          </p>
        </section>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the pool"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {POS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPos(p)}
                  className={cn(
                    "h-9 rounded-sm px-3 font-mono text-xs",
                    pos === p ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-4 divide-y divide-line rounded-xl bg-surface ring-card">
            {poolQ.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, no identity
                  <li key={i} className="p-3">
                    <Skeleton className="h-8" />
                  </li>
                ))
              : available.map((p) => (
                  <li key={p.playerId} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <PlayerCell player={asSlim(p)} compact />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {formatPts(p.pts, 1)}
                    </span>
                    <div className="flex items-center gap-1">
                      {!done ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={queuedIds.has(p.playerId)}
                          onClick={() => addQueue(p)}
                        >
                          {queuedIds.has(p.playerId) ? "Queued" : "Queue"}
                        </Button>
                      ) : null}
                      {isMyPick ? (
                        <Button size="sm" variant="outline" onClick={() => takePlayer(p.playerId)}>
                          Draft
                        </Button>
                      ) : done ? (
                        <Badge tone="muted">Pool</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
          </ul>
          {!poolQ.isLoading && available.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              {needle ? "No one matches" : "No players left in the pool."}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Banner() {
  return (
    <div className="rounded-lg bg-fg px-4 py-3 text-sm text-bg">
      Nothing here touches the league. Picks, queue, and history stay in this tab only.
    </div>
  );
}
