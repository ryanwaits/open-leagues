import { Link } from "@tanstack/react-router";
import type { StandingRow } from "@/lib/data/types";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

/**
 * The constant: record, rank, the week, FAAB. A two-by-two card — leads the
 * page on a phone, sits in the rail on desktop between the desk and the
 * matchup. Nothing in it changes meaning with the phase.
 */
export function TeamMasthead({
  leagueId,
  standings,
  rosterId,
  week,
  faab,
}: {
  leagueId: string;
  standings: StandingRow[];
  rosterId: number;
  week: number;
  faab: number | null;
}) {
  const idx = standings.findIndex((s) => s.rosterId === rosterId);
  const mine = idx >= 0 ? standings[idx] : null;
  if (!mine) return null;

  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-xl bg-surface ring-card">
      <Cell label="Record" value={fmtRecord(mine.wins, mine.losses, mine.ties)} />
      {/* Rank is the one cell that goes somewhere: the full table with the
          playoff line lives on standings, one tap away. */}
      <Link
        to="/league/$leagueId/standings"
        params={{ leagueId }}
        className="group min-w-0 border-b border-l border-line px-5 py-4 hover:bg-raised"
      >
        <span className="block font-mono text-lg font-semibold tabular-nums group-hover:text-accent-strong">
          {ordinal(idx + 1)}
          <small className="ml-1 text-[11px] font-medium text-faint">of {standings.length}</small>
        </span>
        <span className="block microlabel-data">Rank</span>
      </Link>
      <Cell label="Week" value={String(week)} last />
      {faab != null ? (
        <Cell label="FAAB left" value={`$${faab}`} last side />
      ) : (
        <Cell label="PF" value={formatPts(mine.pf, 1)} last side />
      )}
    </section>
  );
}

function Cell({
  label,
  value,
  last = false,
  side = false,
}: {
  label: string;
  value: string;
  /** Bottom row: no rule underneath. */
  last?: boolean;
  /** Right column: rule on the left. */
  side?: boolean;
}) {
  return (
    <div className={cn("min-w-0 border-line px-5 py-4", !last && "border-b", side && "border-l")}>
      <span className="block truncate font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="block microlabel-data">{label}</span>
    </div>
  );
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}
