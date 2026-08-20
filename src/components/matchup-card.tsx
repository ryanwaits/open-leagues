import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/avatar";
import type {
  MatchupPair,
  MatchupSide,
  Projection,
  StandingRow,
  StarterLine,
} from "@/lib/data/types";
import type { Phase } from "@/lib/league/phase";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

/**
 * The week's stakes as a card: who you play, both totals, the balance
 * between them, and the two players most likely to decide it. The shell
 * never changes — the numbers walk Projected → Live → Final with the
 * phase. Like the hero, it only exists when there is a matchup; the
 * offseason page simply doesn't render it.
 *
 * getMatchups reports raw points, which are zero until games start, so
 * before kickoff every number here comes from the projections map instead
 * — the same source the lineup rows read.
 */
export function MatchupCard({
  leagueId,
  week,
  pair,
  rosterId,
  standings,
  phase,
  projections,
}: {
  leagueId: string;
  week: number;
  pair: MatchupPair;
  rosterId: number;
  standings: StandingRow[];
  phase: Phase;
  projections?: Record<string, Projection>;
}) {
  const mine = pair.home.rosterId === rosterId ? pair.home : pair.away;
  const theirs = pair.home.rosterId === rosterId ? pair.away : pair.home;
  if (!mine || !theirs) return null;

  const settled = phase === "settled";
  const live = phase === "live";
  const scoring = live || settled;
  const label = live ? "Live" : settled ? "Final" : "Projected";

  const lineValue = (l: StarterLine): number =>
    scoring
      ? (l.points ?? 0)
      : (projections?.[l.playerId ?? l.player?.player_id ?? ""]?.points ?? 0);
  const sideTotal = (side: MatchupSide): number =>
    scoring ? side.points : side.starters.reduce((sum, l) => sum + lineValue(l), 0);

  const myPts = sideTotal(mine);
  const theirPts = sideTotal(theirs);
  const total = myPts + theirPts;
  // Pre-kickoff with no projections loaded yet, every figure is a fake zero
  // — say nothing rather than "0.0 · even".
  const known = total > 0;
  const share = known ? (myPts / total) * 100 : 50;
  const diff = myPts - theirPts;

  const delta = !known
    ? null
    : Math.abs(diff) < 0.05
      ? "even"
      : settled
        ? `${diff > 0 ? "won" : "lost"} by ${formatPts(Math.abs(diff), 1)}`
        : `+${formatPts(Math.abs(diff), 1)} ${diff > 0 ? "you" : "them"}`;

  const myBest = bestStarter(mine, lineValue);
  const theirBest = bestStarter(theirs, lineValue);

  return (
    <section className="rounded-xl bg-surface ring-card">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">The matchup</h2>
        <span className={cn("microlabel-data", live ? "text-live" : "text-faint")}>
          Week {week} · {live ? "Live" : settled ? "Final" : "Preview"}
        </span>
      </header>

      <SideRow side={mine} standings={standings} pts={known ? myPts : null} me />
      <SideRow side={theirs} standings={standings} pts={known ? theirPts : null} />

      {known ? (
        <div className="grid gap-1.5 px-5 pt-1 pb-3">
          <div className="flex h-1.5 overflow-hidden rounded-pill bg-raised">
            <div
              className="rounded-l-pill bg-accent motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${share}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between microlabel-data">
            <span>{label}</span>
            {delta ? <span className="tabular-nums">{delta}</span> : null}
          </div>
        </div>
      ) : (
        <div className="px-5 pt-1 pb-3" />
      )}

      {known && myBest?.player && theirBest?.player ? (
        <div className="space-y-1.5 border-t border-line px-5 py-3">
          <WatchRow label="Your best" line={myBest} value={lineValue(myBest)} proj={!scoring} />
          <WatchRow
            label="Their threat"
            line={theirBest}
            value={lineValue(theirBest)}
            proj={!scoring}
          />
        </div>
      ) : null}

      <div className="border-t border-line px-5 py-3 text-right">
        <Link
          to="/league/$leagueId/matchup/$week/$matchupId"
          params={{ leagueId, week: String(week), matchupId: String(pair.matchupId) }}
          className="microlabel-data text-accent-strong"
        >
          {scoring ? "Full box score →" : "Full preview →"}
        </Link>
      </div>
    </section>
  );
}

function SideRow({
  side,
  standings,
  pts,
  me = false,
}: {
  side: MatchupSide;
  standings: StandingRow[];
  pts: number | null;
  me?: boolean;
}) {
  const idx = standings.findIndex((s) => s.rosterId === side.rosterId);
  const row = idx >= 0 ? standings[idx] : null;
  return (
    <div className="flex items-center gap-3 border-t border-line px-5 py-2.5 first-of-type:border-t-0">
      <Avatar src={side.avatar} name={side.teamName} className="size-7" tint />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm tracking-[-0.01em]",
            me ? "font-semibold" : "font-medium text-muted",
          )}
        >
          {side.teamName}
        </span>
        {row ? (
          <span className="block font-mono text-[10px] tabular-nums text-faint">
            {fmtRecord(row.wins, row.losses, row.ties)} · {idx + 1}
            {ordinalSuffix(idx + 1)}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-lg tabular-nums",
          me ? "font-bold" : "font-medium text-muted",
          pts == null && "text-faint",
        )}
      >
        {pts != null ? formatPts(pts, 1) : "—"}
      </span>
    </div>
  );
}

function WatchRow({
  label,
  line,
  value,
  proj,
}: {
  label: string;
  line: StarterLine;
  value: number;
  proj: boolean;
}) {
  const p = line.player;
  if (!p) return null;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="w-[74px] shrink-0 microlabel-data">{label}</span>
      <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">{p.full_name}</span>
      {p.position ? (
        <span className="inline-flex h-4 shrink-0 items-center rounded-xs bg-raised px-1.5 font-mono text-[9px] text-muted">
          {p.position}
        </span>
      ) : null}
      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted">
        {proj ? "proj " : ""}
        {formatPts(value, 1)}
      </span>
    </div>
  );
}

/** The starter most likely to decide the week — highest by the phase's number. */
function bestStarter(side: MatchupSide, value: (l: StarterLine) => number): StarterLine | null {
  let best: StarterLine | null = null;
  for (const line of side.starters) {
    if (!line.player) continue;
    if (best == null || value(line) > value(best)) best = line;
  }
  return best;
}

function ordinalSuffix(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return "st";
  if (rem10 === 2 && rem100 !== 12) return "nd";
  if (rem10 === 3 && rem100 !== 13) return "rd";
  return "th";
}
