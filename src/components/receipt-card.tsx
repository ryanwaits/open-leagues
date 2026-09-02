import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { SourceLedger } from "@/lib/receipts/ledger.server";
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

        {r.flip ? (
          <div className="mt-4">
            <div className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
              the flip
            </div>
            <p className="mt-1 text-[14px]">
              {r.flip.to === r.roster.rosterId
                ? "Took the lead for good"
                : "Lost the lead for good"}{" "}
              at <b className="font-mono font-semibold tabular-nums">{r.flip.atLabel}</b>
              {r.flip.settled ? (
                <span className="text-muted">
                  {" "}
                  on the final box score{r.flip.by ? ` — a stat correction on ${r.flip.by}` : ""}.
                </span>
              ) : r.flip.by ? (
                <span className="text-muted"> on {r.flip.by}.</span>
              ) : (
                "."
              )}
              {r.flip.probBefore != null && r.flip.beforeLabel ? (
                <span className="text-muted">
                  {" "}
                  You were{" "}
                  <b className="font-mono font-semibold tabular-nums text-fg">
                    {Math.round(r.flip.probBefore * 100)}%
                  </b>{" "}
                  to win at {r.flip.beforeLabel}.
                </span>
              ) : null}
            </p>
            {r.flip.play ? (
              <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-faint">
                {r.flip.play}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-[11px] text-faint">
              {r.flip.changes} lead change{r.flip.changes === 1 ? "" : "s"} this week ·{" "}
              {r.flip.scores[0].toFixed(1)}–{r.flip.scores[1].toFixed(1)} at the flip
            </p>
          </div>
        ) : null}

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
                {topMiss?.sources?.some((c) => c.pick !== "none") ? (
                  <ul className="mt-2 divide-y divide-line border-y border-line">
                    {topMiss.sources
                      .filter((c) => c.pick !== "none")
                      .map((c) => (
                        <li
                          key={c.source}
                          className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]"
                        >
                          <span className="text-muted">{c.label}</span>
                          <span className="font-mono text-[12.5px] tabular-nums">
                            {c.pick === "start" ? "start" : "hold"}{" "}
                            <span className="text-faint">
                              {c.best != null ? c.best.toFixed(1) : "—"} /{" "}
                              {c.started != null ? c.started.toFixed(1) : "—"}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : null}
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
                    {m.bidPct != null ? (
                      <span className="text-faint"> · {m.bidPct}% of budget</span>
                    ) : null}
                    {m.medianPct != null && m.leagues != null ? (
                      <span className="text-faint">
                        {" "}
                        · median {m.medianPct}% across {m.leagues} leagues
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 font-mono text-[11px] text-faint">${r.wire.spent} spent this week</p>
          </div>
        ) : null}
      </div>

      {r.agent.actions.length > 0 ? (
        <div className="px-5 pb-4">
          <div className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
            the agent
          </div>
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {r.agent.actions.map((a) => (
              <li
                key={`${a.at}-${a.tool}`}
                className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{a.actor}</span>
                  <span className="text-muted"> · {a.tool}</span>
                </span>
                <span className="font-mono text-[11.5px] text-faint">{a.atLabel}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-faint">
            Writes made through a credential, as the league logged them. Undo is the reverse verb.
          </p>
        </div>
      ) : null}

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

/**
 * The season ledger: what each open source's lineup would have scored, beside
 * what the roster actually set. Counts over weeks, never a verdict.
 */
export function SourceLedgerCard({ ledger }: { ledger: SourceLedger }) {
  const n = ledger.weeks.length;
  const best = [...ledger.sources].sort((a, b) => b.delta - a.delta)[0];
  return (
    <section
      id="ledger"
      className="overflow-hidden rounded-lg border border-line-strong bg-surface font-sans text-fg"
    >
      <div className="flex items-center justify-between border-b border-line bg-band px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-faint uppercase">
        <span>season ledger · {n} weeks</span>
        <span>{ledger.league.season}</span>
      </div>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[14.5px] leading-snug">
          You set lineups worth <b className="font-mono tabular-nums">{ledger.totals.you}</b> and
          left <b className="font-mono tabular-nums">{ledger.totals.left}</b> on the bench across{" "}
          {n} weeks.
          {best && best.weeks > 0 ? (
            <>
              {" "}
              {best.delta > 0 ? (
                <>
                  Following <b>{best.label}</b> every week would have added{" "}
                  <b className="font-mono tabular-nums">+{best.delta}</b>.
                </>
              ) : (
                <>
                  No open source would have beaten you over the season; the closest,{" "}
                  <b>{best.label}</b>, finishes{" "}
                  <b className="font-mono tabular-nums">{best.delta}</b>.
                </>
              )}
            </>
          ) : null}
        </p>
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="font-mono text-[10.5px] tracking-[0.06em] text-faint uppercase">
              <th className="py-1 text-left font-semibold">source</th>
              <th className="py-1 text-right font-semibold">beat · tied · lost</th>
              <th className="py-1 text-right font-semibold">vs you</th>
            </tr>
          </thead>
          <tbody>
            {ledger.sources.map((src) => (
              <tr key={src.source} className="border-t border-line">
                <td className="py-1.5">
                  {src.label}
                  <span className="ml-1.5 font-mono text-[11px] text-faint">{src.weeks} wks</span>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums text-muted">
                  {src.beat} · {src.tied} · {src.lost}
                </td>
                <td
                  className={`py-1.5 text-right font-mono tabular-nums ${src.delta > 0 ? "text-fg" : "text-muted"}`}
                >
                  {src.delta > 0 ? "+" : ""}
                  {src.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2.5 font-mono text-[11px] text-faint">
          Each source's lineup is the one it would have set before kickoff, scored on the box score.
          Open sources only; the count is labeled with how many weeks it holds.
        </p>
      </div>
    </section>
  );
}
