import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlayerCell } from "@/components/player-cell";
import { Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeaders, getPlayerSearch } from "@/lib/data/fns";
import type { LeaderRow } from "@/lib/data/types";
import { cn, formatInt, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const Route = createFileRoute("/players")({ component: PlayersPage });

function PlayersPage() {
  const [pos, setPos] = useState<(typeof POS)[number]>("ALL");
  const [q, setQ] = useState("");
  const leaders = useQuery({
    queryKey: ["leaders", pos],
    queryFn: () => getLeaders({ data: { position: pos } }),
    enabled: q.trim().length === 0,
  });
  const search = useQuery({
    queryKey: ["psearch", q, pos],
    queryFn: () => getPlayerSearch({ data: { query: q, position: pos } }),
    enabled: q.trim().length > 0,
  });

  const rows = useMemo(() => {
    if (q.trim()) return search.data ?? [];
    return leaders.data ?? [];
  }, [q, search.data, leaders.data]);

  const loading = q.trim()
    ? search.data == null && search.isPending
    : leaders.data == null && leaders.isPending;

  return (
    <Shell>
      <header>
        <p className="microlabel">Season PPR · Sleeper unofficial stats</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Players</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Live season scoring from Sleeper, with a 2025 seed if the feed is quiet. Search the active
          pool anytime.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a name or team"
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

      <div className="mt-6 overflow-x-auto rounded-xl bg-surface ring-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="microlabel">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-2 py-3 font-medium">Player</th>
              <th className="px-3 py-3 text-right font-medium">PPR</th>
              <th className="px-3 py-3 text-right font-medium">Pass</th>
              <th className="px-3 py-3 text-right font-medium">Rush</th>
              <th className="px-3 py-3 text-right font-medium">Rec</th>
              <th className="px-4 py-3 text-right font-medium">GP</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, no identity
                  <tr key={i} className="border-b border-line">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              : rows.map((p, i) => {
                  const leader =
                    "pts_ppr" in p && typeof p.pts_ppr === "number" ? (p as LeaderRow) : null;
                  return (
                    <tr key={p.player_id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs text-faint">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <PlayerCell player={p} compact />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {leader ? formatPts(leader.pts_ppr, 1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                        {leader
                          ? `${formatInt(leader.pass_yd)} / ${formatInt(leader.pass_td)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                        {leader
                          ? `${formatInt(leader.rush_yd)} / ${formatInt(leader.rush_td)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                        {leader ? `${formatInt(leader.rec)} / ${formatInt(leader.rec_yd)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted">
                        {leader ? formatInt(leader.gp) : "—"}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
