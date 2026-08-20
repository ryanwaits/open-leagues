import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSchedule, rebuildSchedule, saveWeekSchedule } from "@/lib/league/fns";
import { cn } from "@/lib/utils";

type Pair = { home: number; away: number | null };

export function ScheduleDesk({ leagueId, canEdit }: { leagueId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["schedule", leagueId],
    queryFn: () => getSchedule({ data: { leagueId } }),
  });
  const [week, setWeek] = useState(1);
  const [pairs, setPairs] = useState<Pair[]>([]);

  const selected = q.data?.weeks.find((w) => w.week === week);

  useEffect(() => {
    if (!q.data) return;
    const next = q.data.weeks.find((w) => w.week === week) ?? q.data.weeks[0];
    if (next && next.week !== week) setWeek(next.week);
    if (next) setPairs(next.pairs.map((p) => ({ home: p.home, away: p.away })));
  }, [q.data, week]);

  const names = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of q.data?.teams ?? []) m.set(t.rosterId, t.teamName);
    return m;
  }, [q.data]);

  const used = useMemo(() => {
    const s = new Set<number>();
    for (const p of pairs) {
      s.add(p.home);
      if (p.away != null) s.add(p.away);
    }
    return s;
  }, [pairs]);

  const save = useMutation({
    mutationFn: () => saveWeekSchedule({ data: { leagueId, week, pairs } }),
    onSuccess: async () => {
      toast(`Week ${week} saved.`);
      await qc.invalidateQueries({ queryKey: ["schedule", leagueId] });
      await qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not save week."),
  });

  const rebuild = useMutation({
    mutationFn: () => rebuildSchedule({ data: { leagueId } }),
    onSuccess: async () => {
      toast("Unplayed weeks rebuilt.");
      await qc.invalidateQueries({ queryKey: ["schedule", leagueId] });
      await qc.invalidateQueries({ queryKey: ["matchups", leagueId] });
      await qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not rebuild."),
  });

  if (q.data == null && q.isPending) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  }
  if (!q.data) return null;

  const lockedWeek = selected?.locked ?? false;
  const editable = canEdit && !q.data.locked && !lockedWeek;

  function setHome(i: number, home: number) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, home } : p)));
  }
  function setAway(i: number, away: number | null) {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, away } : p)));
  }

  const missing = (q.data.teams.length ?? 0) - used.size;

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {q.data.weeks.map((w) => (
          <button
            key={w.week}
            type="button"
            onClick={() => setWeek(w.week)}
            className={cn(
              "h-10 min-w-10 rounded-sm px-3 font-mono text-sm",
              week === w.week ? "bg-accent text-accent-fg" : "bg-raised text-muted",
            )}
          >
            {w.week}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">
        Week {week}
        {lockedWeek ? " · scored — locked" : " · open"}
        {week === q.data.currentWeek ? " · current" : ""}
        {missing > 0 ? ` · ${missing} team${missing === 1 ? "" : "s"} unassigned` : ""}
      </p>
      <ul className="mt-3 divide-y divide-line rounded-xl bg-surface ring-card">
        {pairs.map((p, i) => (
          <li key={i} className="grid items-center gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto_1fr]">
            <TeamPick
              value={p.home}
              names={names}
              used={used}
              disabled={!editable}
              onChange={(id) => {
                if (id != null) setHome(i, id);
              }}
            />
            <span className="text-center microlabel">vs</span>
            <TeamPick
              value={p.away}
              names={names}
              used={used}
              disabled={!editable}
              allowBye={q.data.teams.length % 2 === 1}
              onChange={(id) => setAway(i, id)}
            />
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : `Save week ${week}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
          >
            {rebuild.isPending ? "Rebuilding…" : "Rebuild unplayed weeks"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">
          {lockedWeek
            ? "Scored weeks stay as they were."
            : "Commissioner sets pairings here. Playoffs seed themselves."}
        </p>
      )}
    </div>
  );
}

function TeamPick({
  value,
  names,
  used,
  disabled,
  allowBye,
  onChange,
}: {
  value: number | null;
  names: Map<number, string>;
  used: Set<number>;
  disabled: boolean;
  allowBye?: boolean;
  onChange: (id: number | null) => void;
}) {
  return (
    <select
      className="h-11 w-full rounded-md bg-raised px-3 text-sm text-fg ring-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
    >
      <option value="">{allowBye ? "Bye" : "—"}</option>
      {[...names.entries()].map(([id, name]) => (
        <option key={id} value={id} disabled={used.has(id) && id !== value}>
          {name}
        </option>
      ))}
    </select>
  );
}
