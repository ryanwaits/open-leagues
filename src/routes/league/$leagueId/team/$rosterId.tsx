import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { PlayerCell } from "@/components/player-cell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeagueBundle, getTeam } from "@/lib/data/fns";
import type { LeagueBundle, RosterPlayer } from "@/lib/data/types";
import { sitPlayer, startPlayer } from "@/lib/league/fns";
import { invalidateAfterLineup } from "@/lib/league/lineup-cache";
import { labeledStartSlots, slotAccepts } from "@/lib/league/roster";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/team/$rosterId")({
  component: TeamPage,
});

type Pending = { kind: "start"; player: RosterPlayer } | { kind: "sit"; player: RosterPlayer };

function TeamPage() {
  const { leagueId, rosterId } = Route.useParams();
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive ? 15_000 : false),
  });
  const week =
    league.data?.currentWeek ??
    qc.getQueryData<LeagueBundle>(["league", leagueId])?.currentWeek ??
    1;
  const team = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    refetchInterval: () => (league.data?.scoringLive ? 15_000 : false),
  });

  // Lineup editing lives on My Team now, so this page is a read-only view of
  // anybody's roster including your own. One editing surface, not two.
  const isMine = league.data?.myRosterId === Number(rosterId);
  const mine = false as boolean;

  const start = useMutation({
    mutationFn: async (input: {
      playerId: string;
      replaceId?: string | null;
      slot?: string | null;
    }) => {
      await startPlayer({ data: { leagueId, ...input } });
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: () => setPending(null),
    onError: (e) => toast(e instanceof Error ? e.message : "Could not start"),
  });
  const sit = useMutation({
    mutationFn: async (playerId: string) => {
      await sitPlayer({ data: { leagueId, playerId } });
      await invalidateAfterLineup(qc, leagueId);
    },
    onSuccess: () => setPending(null),
    onError: (e) => toast(e instanceof Error ? e.message : "Could not sit"),
  });

  if (
    (team.data == null && (team.isPending || team.isLoading || !team.isFetched)) ||
    (league.data == null && league.isPending)
  ) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, no identity
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }
  if (!team.data) {
    return <p className="text-sm text-muted">Roster not found.</p>;
  }

  const starters = team.data.players.filter((p) => p.slot === "starter");
  const bench = team.data.players.filter((p) => p.slot === "bench");
  const ir = team.data.players.filter((p) => p.slot === "ir");
  const taxi = team.data.players.filter((p) => p.slot === "taxi");
  const slots = labeledStartSlots(league.data?.league.roster_positions ?? []);
  const bySlot = new Map(starters.map((p) => [p.starterSlot ?? "", p]));
  const busy = start.isPending || sit.isPending;

  function eligibleStart(slotLabel: string, occupant: RosterPlayer | undefined) {
    if (!pending || pending.kind !== "start") return false;
    if (occupant?.player_id === pending.player.player_id) return false;
    return slotAccepts(pending.player.position, slotLabel);
  }

  function eligibleSit(p: RosterPlayer) {
    if (!pending || pending.kind !== "sit") return false;
    return slotAccepts(p.position, pending.player.starterSlot);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar
          src={team.data.avatar}
          name={team.data.teamName}
          className="size-14"
          textClassName="text-base"
          tint
        />
        <div>
          <h2 className="font-display text-3xl tracking-tight">{team.data.teamName}</h2>
          <p className="text-sm text-muted">
            {team.data.manager} ·{" "}
            {fmtRecord(team.data.record.wins, team.data.record.losses, team.data.record.ties)} ·{" "}
            {formatPts(team.data.record.pf, 1)} PF
          </p>
          {isMine ? (
            <Link
              to="/league/$leagueId"
              params={{ leagueId }}
              className="mt-2 inline-flex h-9 items-center rounded-pill bg-raised px-4 text-[13px] font-semibold hover:bg-line"
            >
              Set your lineup
            </Link>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-raised px-3 py-2.5">
          <p className="text-sm">
            {pending.kind === "start" ? (
              <>
                Starting <span className="text-fg">{pending.player.full_name}</span>
                <span className="text-muted"> — tap a starter slot</span>
              </>
            ) : (
              <>
                Sitting <span className="text-fg">{pending.player.full_name}</span>
                <span className="text-muted"> — tap who takes {pending.player.starterSlot}</span>
              </>
            )}
          </p>
          <div className="flex gap-1">
            {pending.kind === "sit" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => sit.mutate(pending.player.player_id)}
              >
                Sit only
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mt-8">
        <h3 className="microlabel">Week {week} starters</h3>
        <ul className="mt-2 divide-y divide-line rounded-xl bg-surface ring-card">
          {slots.map(({ label }) => {
            const p = bySlot.get(label);
            const hit = eligibleStart(label, p);
            const selected = pending?.kind === "sit" && pending.player.player_id === p?.player_id;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  hit && "bg-accent/10",
                  selected && "bg-raised",
                )}
              >
                <span className="w-8 microlabel-data">{label}</span>
                <div className="min-w-0 flex-1">
                  {p ? (
                    <PlayerCell player={p} compact game={p.game} />
                  ) : (
                    <span className="text-sm text-faint">Empty</span>
                  )}
                </div>

                <span className="w-12 text-right font-mono text-sm tabular-nums">
                  {p ? formatPts(p.weekPts, 1) : ""}
                </span>
                {mine && hit ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      start.mutate({
                        playerId: pending!.player.player_id,
                        replaceId: p?.player_id ?? null,
                        slot: p ? null : label,
                      })
                    }
                  >
                    {p ? "Here" : "Start here"}
                  </Button>
                ) : null}
                {mine && !pending && p ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPending({ kind: "sit", player: p })}
                  >
                    Sit
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <PlayerGroup
        label="Bench"
        rows={bench}
        mine={Boolean(mine)}
        pending={pending}
        busy={busy}
        eligible={eligibleSit}
        onStart={(p) => setPending({ kind: "start", player: p })}
        onSwap={(p) =>
          start.mutate({ playerId: p.player_id, replaceId: pending!.player.player_id })
        }
      />
      <PlayerGroup
        label="IR"
        rows={ir}
        mine={false}
        pending={null}
        busy={false}
        eligible={() => false}
      />
      <PlayerGroup
        label="Taxi"
        rows={taxi}
        mine={false}
        pending={null}
        busy={false}
        eligible={() => false}
      />
    </div>
  );
}

function PlayerGroup({
  label,
  rows,
  mine,
  pending,
  busy,
  eligible,
  onStart,
  onSwap,
}: {
  label: string;
  rows: RosterPlayer[];
  mine: boolean;
  pending: Pending | null;
  busy: boolean;
  eligible: (p: RosterPlayer) => boolean;
  onStart?: (p: RosterPlayer) => void;
  onSwap?: (p: RosterPlayer) => void;
}) {
  if (!rows.length) return null;
  return (
    <section className="mt-8">
      <h3 className="microlabel">{label}</h3>
      <ul className="mt-2 divide-y divide-line rounded-xl bg-surface ring-card">
        {rows.map((p) => {
          const hit = eligible(p);
          const selected = pending?.kind === "start" && pending.player.player_id === p.player_id;
          return (
            <li
              key={p.player_id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                hit && "bg-accent/10",
                selected && "bg-raised",
              )}
            >
              <span className="w-8" />
              <div className="min-w-0 flex-1">
                <PlayerCell player={p} compact game={p.game} />
              </div>

              <span className="w-12 text-right font-mono text-sm tabular-nums">
                {formatPts(p.weekPts, 1)}
              </span>
              {mine && hit && onSwap ? (
                <Button size="sm" disabled={busy} onClick={() => onSwap(p)}>
                  Here
                </Button>
              ) : null}
              {mine && !pending && onStart ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onStart(p)}>
                  Start
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
