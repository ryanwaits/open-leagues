import { Link } from "@tanstack/react-router";
import type { StandingRow } from "@/lib/data/types";
import type { Phase } from "@/lib/league/phase";
import { fmtRecord, formatPts } from "@/lib/utils";

/**
 * The constant over the lineup. The hero above is the exception layer — it
 * only exists when something needs attention — so on a calm week this strip
 * is the page's top. Four agate cells, fixed slots: only the third changes
 * meaning, walking Projected → Live → Final with the phase, and nothing
 * ever moves when a number does.
 */
export function TeamMasthead({
  leagueId,
  standings,
  rosterId,
  phase,
  weekPts,
  faab,
}: {
  leagueId: string;
  standings: StandingRow[];
  rosterId: number;
  phase: Phase;
  /** The week's number: forecast before kickoff, running or final after. */
  weekPts: number | null;
  faab: number | null;
}) {
  const idx = standings.findIndex((s) => s.rosterId === rosterId);
  const mine = idx >= 0 ? standings[idx] : null;
  if (!mine) return null;

  const ptsLabel = phase === "live" ? "Live" : phase === "settled" ? "Final" : "Projected";

  return (
    <section className="grid grid-cols-4 rounded-xl bg-surface ring-card">
      <Cell label="Record" value={fmtRecord(mine.wins, mine.losses, mine.ties)} />
      {/* Rank is the one cell that goes somewhere: the full table with the
          playoff line lives on standings, one tap away. */}
      <Link
        to="/league/$leagueId/standings"
        params={{ leagueId }}
        className="group min-w-0 border-l border-line px-3 py-3.5 hover:bg-raised sm:px-5"
      >
        <span className="block font-mono text-base font-semibold tabular-nums group-hover:text-accent-strong sm:text-lg">
          {ordinal(idx + 1)}
          <small className="ml-1 text-[11px] font-medium text-faint">of {standings.length}</small>
        </span>
        <span className="block microlabel-data">Rank</span>
      </Link>
      <Cell label={ptsLabel} value={weekPts != null ? formatPts(weekPts, 1) : "—"} />
      {faab != null ? (
        <Cell label="FAAB left" value={`$${faab}`} />
      ) : (
        <Cell label="PF" value={formatPts(mine.pf, 1)} />
      )}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-line px-3 py-3.5 first:border-l-0 sm:px-5">
      <span className="block truncate font-mono text-base font-semibold tabular-nums sm:text-lg">
        {value}
      </span>
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
