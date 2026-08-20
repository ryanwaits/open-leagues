import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DraftBoard } from "@/components/draft-board";
import { DraftTradeDrawer } from "@/components/draft-trade-drawer";
import { PlayerCell } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle } from "@/lib/data/fns";
import {
  autoFillDraft,
  getDraft,
  makePick,
  queueAdd,
  queueRemove,
  queueReorder,
  setAutodraft,
  startDraft,
} from "@/lib/league/fns";
import { cn, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const Route = createFileRoute("/league/$leagueId/draft")({
  component: DraftPage,
});

function formatClock(remainingMs: number | null): string {
  if (remainingMs == null) return "--:--";
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Client-only display of pickDeadline — does not mutate when it hits zero. */
function usePickClock(pickDeadline: string | null | undefined) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!pickDeadline) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(new Date(pickDeadline).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pickDeadline]);
  return remainingMs;
}

function DraftPage() {
  const { leagueId } = Route.useParams();
  const qc = useQueryClient();
  const [pos, setPos] = useState<(typeof POS)[number]>("ALL");
  const [q, setQ] = useState("");
  const [tradeOpen, setTradeOpen] = useState(false);
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const draft = useQuery({
    queryKey: ["draft", leagueId, pos],
    queryFn: () => getDraft({ data: { leagueId, position: pos, query: "" } }),
    refetchInterval: (query) => (query.state.data?.status === "live" ? 4000 : false),
  });
  const remainingMs = usePickClock(draft.data?.pickDeadline ?? null);
  const needle = q.trim().toLowerCase();
  const available = (draft.data?.available ?? []).filter((p) => {
    if (!needle) return true;
    const hay = `${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["draft", leagueId] });
    void qc.invalidateQueries({ queryKey: ["league", leagueId] });
  }

  const start = useMutation({
    mutationFn: () => startDraft({ data: { leagueId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not start"),
  });
  const fill = useMutation({
    mutationFn: () => autoFillDraft({ data: { leagueId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not fill"),
  });
  const pick = useMutation({
    mutationFn: (playerId: string) => makePick({ data: { leagueId, playerId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Pick failed"),
  });
  const autodraft = useMutation({
    mutationFn: (on: boolean) => setAutodraft({ data: { leagueId, on } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not update autodraft"),
  });
  const addQueue = useMutation({
    mutationFn: (playerId: string) => queueAdd({ data: { leagueId, playerId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not queue"),
  });
  const removeQueue = useMutation({
    mutationFn: (playerId: string) => queueRemove({ data: { leagueId, playerId } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not remove"),
  });
  const reorderQueue = useMutation({
    mutationFn: (playerIds: string[]) => queueReorder({ data: { leagueId, playerIds } }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof Error ? e.message : "Could not reorder"),
  });

  if (league.data == null && league.isPending) {
    return <Skeleton className="h-64 rounded-xl" />;
  }
  if (league.isError) {
    return (
      <p className="text-sm text-loss">
        {league.error instanceof Error ? league.error.message : "Couldn't load this league."}
      </p>
    );
  }
  if (!league.data?.hosted) {
    return (
      <p className="text-sm text-muted">
        This is a Sleeper peek — the draft already happened over there.
      </p>
    );
  }

  const d = draft.data;
  const myRosterId = league.data?.myRosterId ?? null;
  const canTrade =
    myRosterId != null &&
    !(league.data?.locked || d?.locked) &&
    d != null &&
    d.status !== "complete";
  const clockLabel = formatClock(d?.status === "live" ? remainingMs : null);
  const clockUrgent = d?.status === "live" && remainingMs != null && remainingMs < 20_000;
  const queuedIds = new Set((d?.queue ?? []).map((q) => q.playerId));
  const queueBusy = addQueue.isPending || removeQueue.isPending || reorderQueue.isPending;

  function moveQueue(playerId: string, dir: -1 | 1) {
    const ids = (d?.queue ?? []).map((q) => q.playerId);
    const i = ids.indexOf(playerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    reorderQueue.mutate(next);
  }

  return (
    <div className="space-y-8">
      {draft.isError ? (
        <p className="text-sm text-loss">
          {draft.error instanceof Error ? draft.error.message : "Couldn't load the draft."}
        </p>
      ) : d == null ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <DraftBoard
          board={d.board}
          seats={d.seats}
          onClockPickNo={d.pickNo}
          myRosterId={myRosterId}
        />
      )}
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <p className="microlabel">
            {d
              ? `${d.status} · pick ${Math.min(d.pickNo, d.total || 1)} / ${d.total || "—"}`
              : "Draft"}
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h2 className="flex flex-wrap items-baseline gap-x-3 font-display text-3xl tracking-tight">
              <span>
                {d?.status === "complete"
                  ? "Board is closed"
                  : d?.onClockName
                    ? `${d.onClockName} is on the clock`
                    : "Waiting to open"}
              </span>
              {d?.status === "live" ? (
                <span
                  className={cn(
                    "font-mono text-2xl tabular-nums",
                    clockUrgent ? "text-loss" : "text-muted",
                  )}
                >
                  {clockLabel}
                </span>
              ) : null}
            </h2>
            {canTrade ? (
              <Button variant="outline" size="sm" onClick={() => setTradeOpen(true)}>
                Propose a trade
              </Button>
            ) : null}
          </div>
          {d?.isMyPick ? <p className="mt-2 text-sm text-live">Your pick. Take someone.</p> : null}
          {d?.status === "live" && myRosterId != null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {d.myAutodraft ? (
                <>
                  <Badge tone="live">Autodraft on</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={autodraft.isPending}
                    onClick={() => autodraft.mutate(false)}
                  >
                    {autodraft.isPending ? "Updating…" : "Turn off autodraft"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={autodraft.isPending}
                  onClick={() => autodraft.mutate(true)}
                >
                  {autodraft.isPending ? "Updating…" : "Autodraft for me"}
                </Button>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {d?.status === "pending" && d.isCommish ? (
              <Button onClick={() => start.mutate()} disabled={start.isPending}>
                {start.isPending ? "Opening…" : "Open the draft"}
              </Button>
            ) : null}
            {d?.status === "live" && d.isCommish ? (
              <Button variant="outline" onClick={() => fill.mutate()} disabled={fill.isPending}>
                {fill.isPending ? "Filling…" : "Autodraft the rest"}
              </Button>
            ) : null}
            {d?.status === "complete" ? (
              <Button asChild variant="outline">
                <Link to="/league/$leagueId" params={{ leagueId }}>
                  Standings
                </Link>
              </Button>
            ) : null}
          </div>

          {canTrade && myRosterId != null && d != null ? (
            <DraftTradeDrawer
              open={tradeOpen}
              onOpenChange={setTradeOpen}
              leagueId={leagueId}
              myRosterId={myRosterId}
              seats={d.seats}
              board={d.board}
              stock={d.stock}
              onClockPickNo={d.pickNo}
              faabRemaining={league.data?.faabRemaining ?? league.data?.ops?.faabBudget ?? 100}
            />
          ) : null}

          {myRosterId != null && d != null && d.status !== "complete" ? (
            <div className="mt-8">
              <p className="microlabel">Your queue</p>
              <ul className="mt-2 space-y-1">
                {(d.queue ?? []).map((q, i) => (
                  <li
                    key={q.playerId}
                    className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 ring-card"
                  >
                    <span className="w-5 font-mono text-[11px] text-faint">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{q.name}</p>
                      <p className="font-mono text-[11px] text-muted">
                        {[q.position, q.team].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queueBusy || i === 0}
                        onClick={() => moveQueue(q.playerId, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queueBusy || i === (d.queue?.length ?? 0) - 1}
                        onClick={() => moveQueue(q.playerId, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={queueBusy}
                        onClick={() => removeQueue.mutate(q.playerId)}
                        aria-label="Remove from queue"
                      >
                        ×
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {(d.queue ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Empty — autodraft will take best available.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                Autodraft takes the top of this queue first.
              </p>
            </div>
          ) : null}

          <ol className="mt-6 space-y-2">
            {d == null
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)
              : d.recent.map((p) => (
                  <li
                    key={p.pick}
                    className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-card"
                  >
                    <span className="w-10 font-mono text-[11px] text-faint">
                      {p.round}.{p.pick}
                    </span>
                    <div className="min-w-0 flex-1">
                      <PlayerCell player={p.player} compact />
                    </div>
                    <span className="truncate text-xs text-muted">{p.teamName}</span>
                  </li>
                ))}
            {d && d.recent.length === 0 ? (
              <p className="text-sm text-muted">
                No picks yet. Unused picks can be traded before you open the board.{" "}
                <Link
                  to="/league/$leagueId/mock"
                  params={{ leagueId }}
                  className="text-accent-strong underline-offset-2 hover:underline"
                >
                  Try a mock
                </Link>
              </p>
            ) : null}
          </ol>

          {d && d.stock.some((p) => !p.used) ? (
            <div className="mt-8">
              <p className="microlabel">Pick stock</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {d.stock
                  .filter((p) => !p.used)
                  .slice(0, 40)
                  .map((p) => (
                    <li
                      key={p.pickNo}
                      className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
                    >
                      <span className="font-mono text-xs text-faint">{p.label}</span>
                      <span className="min-w-0 truncate text-muted">
                        {p.ownerName}
                        {p.via ? <span className="text-faint"> · via {p.via}</span> : null}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="draft-pool-search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the pool"
              aria-label="Search the pool"
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
            {d == null
              ? Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="p-3">
                    <Skeleton className="h-8" />
                  </li>
                ))
              : available.map((p) => (
                  <li key={p.player_id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <PlayerCell player={p} compact />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {formatPts(p.pts, 1)}
                    </span>
                    <div className="flex items-center gap-1">
                      {myRosterId != null && d.status !== "complete" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={queueBusy || queuedIds.has(p.player_id)}
                          onClick={() => addQueue.mutate(p.player_id)}
                        >
                          {queuedIds.has(p.player_id) ? "Queued" : "Queue"}
                        </Button>
                      ) : null}
                      {d.status === "live" && (d.isMyPick || d.isCommish) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pick.isPending}
                          onClick={() => pick.mutate(p.player_id)}
                        >
                          Draft
                        </Button>
                      ) : myRosterId == null || d.status === "complete" ? (
                        <Badge tone="muted">Pool</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
          </ul>
          {d != null && available.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              {needle ? "No one matches" : "No players left in the pool."}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
