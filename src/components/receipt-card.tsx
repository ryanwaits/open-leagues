import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Receipt, WeekBoard } from "@/lib/receipts/receipt.server";
import { cn } from "@/lib/utils";

/**
 * The receipt on the page. One card, the Ledger voice: mono tabular numbers,
 * losing is the marked state, counts not adjectives. Team names only.
 */

function fmt(n: number): string {
  return n.toFixed(1);
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg font-sans text-fg">
      <div className="mx-auto max-w-[720px] px-6 pb-16">
        <nav className="flex items-center justify-between gap-3 border-b border-line py-6">
          <Link to="/" className="shrink-0 whitespace-nowrap text-[15px] font-semibold">
            open-leagues
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/docs" className="text-muted hover:text-fg">
              Docs
            </Link>
            <a
              href="https://github.com/ryanwaits/open-leagues"
              className="text-muted hover:text-fg"
            >
              GitHub
            </a>
          </div>
        </nav>
        {children}
        <footer className="mt-12 border-t border-line pt-5 text-[12px] leading-relaxed text-faint">
          Receipts read a league&apos;s public Sleeper data and show team names, not people. To have
          a league&apos;s receipts taken down,{" "}
          <a
            href="https://github.com/ryanwaits/open-leagues/issues"
            className="underline underline-offset-2"
          >
            open an issue
          </a>
          .
        </footer>
      </div>
    </div>
  );
}

export function ReceiptCard({ receipt: r, permalink }: { receipt: Receipt; permalink: string }) {
  const opp = r.opponent;
  const lost = r.outcome === "loss";
  const won = r.outcome === "win";
  const topMiss = r.bench.misses[0];
  const claimsWon = r.wire.moves.filter((m) => m.kind === "waiver" && m.won);

  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-band px-4 py-2 font-mono text-[11px] text-faint">
        <span>
          week {r.week} · {r.league.name}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-pill bg-accent" />
          receipt
        </span>
      </div>

      <div className="px-5 pt-5 pb-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <div className="text-[14px] font-medium">{r.roster.name}</div>
            <div
              className={cn(
                "mt-1 font-mono text-[34px] leading-none tabular-nums tracking-[-0.02em]",
                lost && "text-loss",
              )}
            >
              {fmt(r.roster.points)}
            </div>
          </div>
          <div className="pb-1.5 font-mono text-[11px] text-faint">
            {r.outcome === "pending" ? "proj" : "final"}
          </div>
          <div className="text-right">
            <div className="text-[14px] font-medium">{opp?.name ?? "—"}</div>
            <div
              className={cn(
                "mt-1 font-mono text-[34px] leading-none tabular-nums tracking-[-0.02em]",
                won && "text-loss",
              )}
            >
              {opp ? fmt(opp.points) : "—"}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4 text-[15px]">
          {!opp
            ? "No opponent this week."
            : r.outcome === "pending"
              ? `Projected against ${opp.name}. Nothing scored yet.`
              : r.outcome === "tie"
                ? `Tied with ${opp.name}.`
                : `${won ? "Beat" : "Lost to"} ${opp.name} by ${fmt(Math.abs(r.roster.points - opp.points))}.`}
        </div>

        {r.outcome !== "pending" ? (
          <div className="mt-4">
            <div className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
              the bench
            </div>
            {r.bench.left <= 0 ? (
              <p className="mt-1 text-[14px] text-muted">
                Nothing left on the bench. Best lineup you could have set.
              </p>
            ) : (
              <>
                <p className="mt-1 text-[14px]">
                  Left <b className="font-mono font-semibold tabular-nums">{fmt(r.bench.left)}</b>{" "}
                  on the bench.
                  {topMiss ? (
                    <span className="text-muted">
                      {" "}
                      {topMiss.best.name} {fmt(topMiss.best.points)} sat behind{" "}
                      {topMiss.started
                        ? `${topMiss.started.name} ${fmt(topMiss.started.points)}`
                        : "an empty slot"}
                      .
                    </span>
                  ) : null}
                </p>
                {r.bench.misses.length > 1 ? (
                  <ul className="mt-2 divide-y divide-line border-y border-line">
                    {r.bench.misses.map((m) => (
                      <li
                        key={`${m.slot}-${m.best.playerId}`}
                        className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-[10.5px] text-faint">{m.slot}</span>{" "}
                          {m.best.name}{" "}
                          <span className="text-faint">
                            over {m.started ? m.started.name : "empty"}
                          </span>
                        </span>
                        <span className="font-mono text-[12.5px] tabular-nums text-muted">
                          +{fmt(m.cost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {claimsWon.length > 0 ? (
          <div className="mt-4">
            <div className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
              the wire
            </div>
            <ul className="mt-1 divide-y divide-line border-y border-line">
              {claimsWon.map((m) => (
                <li
                  key={`${m.add ?? ""}|${m.drop ?? ""}|${m.bid ?? ""}`}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]"
                >
                  <span className="min-w-0 truncate">
                    {m.add}
                    {m.drop ? <span className="text-faint"> for {m.drop}</span> : null}
                  </span>
                  <span className="font-mono text-[12.5px] tabular-nums text-muted">
                    ${m.bid ?? 0}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 font-mono text-[11px] text-faint">${r.wire.spent} spent this week</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-band px-4 py-2 font-mono text-[11px] text-faint">
        <span className="min-w-0 truncate">{permalink.replace(/^https?:\/\//, "")}</span>
        <Link to="/" className="hover:text-fg">
          paste your Sleeper league →
        </Link>
      </div>
    </div>
  );
}

export function WeekBoardList({ board }: { board: WeekBoard }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
      <div className="border-b border-line bg-band px-4 py-2 font-mono text-[11px] text-faint">
        week {board.week} · {board.rows.length} matchups
      </div>
      <ul className="divide-y divide-line">
        {board.rows.map((row) => (
          <li
            key={row.matchupId}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3"
          >
            <Link
              to="/r/$leagueId/$week/$rosterId"
              params={{
                leagueId: board.league.id,
                week: String(board.week),
                rosterId: String(row.home.rosterId),
              }}
              className="min-w-0 truncate text-[14px] hover:underline"
            >
              {row.home.name}
            </Link>
            <span
              className={cn(
                "font-mono text-[13px] tabular-nums",
                row.outcome === "pending" ? "text-faint" : "text-fg",
              )}
            >
              {row.outcome === "pending"
                ? "—"
                : `${fmt(row.home.points)} – ${fmt(row.away?.points ?? 0)}`}
            </span>
            {row.away ? (
              <Link
                to="/r/$leagueId/$week/$rosterId"
                params={{
                  leagueId: board.league.id,
                  week: String(board.week),
                  rosterId: String(row.away.rosterId),
                }}
                className="min-w-0 truncate text-right text-[14px] hover:underline"
              >
                {row.away.name}
              </Link>
            ) : (
              <span className="text-right text-[13px] text-faint">bye</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
