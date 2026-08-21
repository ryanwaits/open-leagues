import { useQuery } from "@tanstack/react-query";
import type { TicketTarget } from "@/components/wager-ticket";
import { getTicks } from "@/lib/data/fns";
import { isHostedLeague } from "@/lib/data/types";
import type { BookBundle, BookLine } from "@/lib/league/book.server";
import { fmtClockOfDay } from "@/lib/live/series";
import { fmtSpread, spreadPoints, spreadSummary } from "@/lib/live/spread-series";
import { cn } from "@/lib/utils";
import { LiveLine } from "./live-line";

/**
 * The two prices for one matchup.
 *
 * The number on a button is the quote, so pressing it opens the ticket with the
 * side already chosen rather than asking you to retype what you just read. On
 * your own game the fade side is drawn and dead: you can read the line, you
 * cannot take it.
 */
export function LinePanel({
  line,
  onPick,
  className,
  leagueId,
  week,
  final = false,
}: {
  line: BookLine;
  onPick: (t: TicketTarget) => void;
  className?: string;
  leagueId?: string;
  week?: number;
  /** All of the week's games are over — freezes the strip instead of leaving it live. */
  final?: boolean;
}) {
  const ticks = useQuery({
    queryKey: ["ticks", leagueId, week, line.matchupId],
    queryFn: () =>
      getTicks({ data: { leagueId: leagueId ?? "", week: week ?? 0, matchupId: line.matchupId } }),
    enabled: Boolean(leagueId) && week != null && isHostedLeague(leagueId ?? ""),
    staleTime: 30_000,
    refetchInterval: line.locked ? false : 60_000,
  });
  const pts = spreadPoints(ticks.data ?? []);
  const sum = spreadSummary(pts);

  // A dead line still needs to say so. Returning null here meant a commissioner
  // could switch betting on, see nothing at all, and have no way to tell whether
  // the feature was broken or simply had nothing to price yet.
  if (!line.live) {
    return (
      <section
        data-testid="wager-no-price"
        className={cn("rounded-xl bg-surface ring-card", className)}
      >
        <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
          <h2 className="font-display text-lg font-bold tracking-[-0.03em]">The line</h2>
          <span className="microlabel-data">no price</span>
        </header>
        <p className="px-5 pb-5 text-sm text-muted">
          Nothing to price yet. A line needs projections for both rosters, which arrive once the
          season has weeks behind it &mdash; in the preseason every player&rsquo;s spread is zero,
          so there is no margin to quote.
        </p>
      </section>
    );
  }

  const fav = line.spread <= 0;
  const homeSpread = line.spread;
  const awaySpread = -line.spread;

  const side = (home: boolean) => ({
    roster: home ? line.homeRoster : line.awayRoster,
    name: home ? line.homeName : line.awayName,
    other: home ? line.awayName : line.homeName,
  });

  const allowed = (roster: number) => line.restrictedTo == null || line.restrictedTo === roster;

  return (
    <section className={cn("rounded-xl bg-surface ring-card", className)}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">The line</h2>
        <span className="microlabel-data">{line.locked ? "closed" : "suggested"}</span>
      </header>

      {sum ? (
        <div className="px-5 pb-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="microlabel-data">{line.homeName} spread · today</span>
            <span className="microlabel-data">
              opened {fmtSpread(sum.first)} at {fmtClockOfDay(sum.firstAt)} · now{" "}
              {fmtSpread(sum.last)}
            </span>
          </div>
          <LiveLine
            series={pts}
            value={sum.last}
            tone="brand"
            height={64}
            quiet
            smooth={false}
            windowSecs={43200}
            frozen={line.locked && final}
            formatValue={fmtSpread}
            padding={{ top: 8, right: 8, bottom: 4, left: 0 }}
            ariaLabel={`${line.homeName} spread today`}
          />
        </div>
      ) : null}

      <Row
        label="Spread"
        sub={`${line.homeName} ${fmtSpread(homeSpread)} · ${line.awayName} ${fmtSpread(awaySpread)}`}
        a={{
          price: fmtSpread(homeSpread),
          note: allowed(line.homeRoster) ? "back" : "your game",
          on: allowed(line.homeRoster) && !line.locked,
        }}
        b={{
          price: fmtSpread(awaySpread),
          note: allowed(line.awayRoster) ? "back" : "your game",
          on: allowed(line.awayRoster) && !line.locked,
        }}
        onA={() =>
          onPick({
            matchupId: line.matchupId,
            kind: "spread",
            sideRoster: side(true).roster,
            sideName: side(true).name,
            againstName: side(true).other,
            line: homeSpread,
            mult: 1,
            priceLabel: fmtSpread(homeSpread),
            ownGame: line.restrictedTo === line.homeRoster,
          })
        }
        onB={() =>
          onPick({
            matchupId: line.matchupId,
            kind: "spread",
            sideRoster: side(false).roster,
            sideName: side(false).name,
            againstName: side(false).other,
            line: awaySpread,
            mult: 1,
            priceLabel: fmtSpread(awaySpread),
            ownGame: line.restrictedTo === line.awayRoster,
          })
        }
      />

      <Row
        label="Moneyline"
        sub={`${line.homeName} to win · ${line.awayName} to win`}
        a={{
          price: fmtOdds(line.homeMult),
          note: allowed(line.homeRoster) ? `${line.homePct}%` : "your game",
          on: allowed(line.homeRoster) && !line.locked,
        }}
        b={{
          price: fmtOdds(line.awayMult),
          note: allowed(line.awayRoster) ? `${line.awayPct}%` : "your game",
          on: allowed(line.awayRoster) && !line.locked,
        }}
        onA={() =>
          onPick({
            matchupId: line.matchupId,
            kind: "moneyline",
            sideRoster: side(true).roster,
            sideName: side(true).name,
            againstName: side(true).other,
            line: 0,
            mult: line.homeMult,
            priceLabel: fmtOdds(line.homeMult),
            ownGame: line.restrictedTo === line.homeRoster,
          })
        }
        onB={() =>
          onPick({
            matchupId: line.matchupId,
            kind: "moneyline",
            sideRoster: side(false).roster,
            sideName: side(false).name,
            againstName: side(false).other,
            line: 0,
            mult: line.awayMult,
            priceLabel: fmtOdds(line.awayMult),
            ownGame: line.restrictedTo === line.awayRoster,
          })
        }
      />
      <p className="px-5 pt-1 pb-4 text-xs text-faint">
        {line.locked
          ? "Closed for this week. Everyone bet against the same last number."
          : `Priced from the same margin as Where the game is. ${fav ? line.homeName : line.awayName} is favoured.`}
      </p>
    </section>
  );
}

function Row({
  label,
  sub,
  a,
  b,
  onA,
  onB,
}: {
  label: string;
  sub: string;
  a: { price: string; note: string; on: boolean };
  b: { price: string; note: string; on: boolean };
  onA: () => void;
  onB: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate font-mono text-[10px] text-faint">{sub}</span>
      </span>
      <span className="flex gap-2">
        <Price {...a} onClick={onA} />
        <Price {...b} onClick={onB} />
      </span>
    </div>
  );
}

function Price({
  price,
  note,
  on,
  onClick,
}: {
  price: string;
  note: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="wager-price"
      disabled={!on}
      onClick={onClick}
      className={cn(
        "min-w-[4.5rem] rounded-md px-3 py-1.5 text-center ring-card transition-colors duration-150",
        on ? "hover:bg-raised" : "opacity-40",
      )}
    >
      <span className="block font-mono text-sm font-bold tabular-nums">{price}</span>
      <span className="block microlabel-data">{note}</span>
    </button>
  );
}

/** The purse, split the way it is actually held. */
export function PurseMeter({ book }: { book: BookBundle }) {
  const { budget, free, atRisk } = book.purse;
  const spent = Math.max(0, budget - free - atRisk);
  const pct = (n: number) => (budget > 0 ? Math.round((n / budget) * 100) : 0);
  return (
    <div className="border-b border-line bg-band px-5 py-3">
      <div className="flex gap-3">
        <Fig n={`$${free}`} label="free" />
        <Fig n={`$${atRisk}`} label="at risk" />
        <Fig n={`$${budget}`} label="budget" />
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-pill bg-raised">
        <span className="bg-accent-strong" style={{ width: `${pct(spent)}%` }} />
        <span className="bg-faint" style={{ width: `${pct(atRisk)}%` }} />
      </div>
    </div>
  );
}

function Fig({ n, label }: { n: string; label: string }) {
  return (
    <span className="flex-1 text-center">
      <span className="block font-mono text-base font-bold tabular-nums">{n}</span>
      <span className="block microlabel-data">{label}</span>
    </span>
  );
}

/**
 * Profit per dollar, said plainly.
 *
 * American odds are the convention and nobody in a ten-team league reads them,
 * so this states the thing you actually want to know: what a dollar returns.
 */
export function fmtOdds(mult: number): string {
  return `${mult >= 10 ? mult.toFixed(0) : mult.toFixed(2).replace(/0$/, "")}×`;
}
