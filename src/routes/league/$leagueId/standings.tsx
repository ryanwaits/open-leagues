import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { PurseMeter } from "@/components/book-panel";
import { Deck } from "@/components/deck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fantasyStatKind } from "@/lib/data/calendar";
import {
  getActivity,
  getLeagueBundle,
  getMatchups,
  getRecap,
  getWeekProjections,
  getWeekStats,
} from "@/lib/data/fns";
import { paintMatchups, pairPreviewScores } from "@/lib/data/matchup-view";
import type { LeagueBundle } from "@/lib/data/types";
import { overlayPreLivePairs } from "@/lib/demo/pre-live";
import { usePreLiveFeed } from "@/lib/demo/use-pre-live-feed";
import { getBook, getTrades, pullWager } from "@/lib/league/fns";
import { bookFromLeague } from "@/lib/replay";
import { cn, fmtRecord, formatPts } from "@/lib/utils";

export const Route = createFileRoute("/league/$leagueId/standings")({
  component: LeaguePage,
});

/**
 * One dashboard, no second tab strip.
 *
 * Standings anchors it because that is what people come for; everything the
 * sub-tabs used to hide is a section you can see without a click. It is a
 * browse surface rather than a task surface, so length is fine and a click is
 * not.
 */
function LeaguePage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const pre = usePreLiveFeed();

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
    refetchInterval: (q) => (q.state.data?.scoringLive || pre.on ? 15_000 : false),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const season = league.data?.league.season ?? "";

  const matchups = useQuery({
    queryKey: ["matchups", leagueId, week],
    queryFn: () => getMatchups({ data: { leagueId, week } }),
    refetchInterval: () => (league.data?.scoringLive || pre.on ? 4_000 : false),
  });
  const projections = useQuery({
    queryKey: ["week-projections", leagueId, week],
    queryFn: () =>
      getWeekProjections({
        data: { leagueId, season, week },
      }),
    enabled: Boolean(season),
    staleTime: 60_000,
  });
  const weekStats = useQuery({
    queryKey: ["week-stats", season, week],
    queryFn: () =>
      getWeekStats({
        data: { season, week, kind: fantasyStatKind() },
      }),
    enabled: Boolean(season) && !pre.on,
    refetchInterval: () => (league.data?.scoringLive ? 4_000 : false),
  });
  const scoringBook = bookFromLeague(league.data?.league.scoring_settings);
  const slate = useMemo(() => {
    const rows = matchups.data ?? [];
    const overlaid = pre.on ? overlayPreLivePairs(rows, pre.games, pre.stats, scoringBook) : rows;
    return paintMatchups(
      overlaid,
      projections.data ?? {},
      pre.on ? pre.stats : (weekStats.data ?? {}),
    );
  }, [matchups.data, pre.on, pre.games, pre.stats, scoringBook, projections.data, weekStats.data]);
  const activity = useQuery({
    queryKey: ["activity", leagueId, week],
    queryFn: () => getActivity({ data: { leagueId, week } }),
  });
  const recap = useQuery({
    queryKey: ["recap", leagueId, week],
    queryFn: () => getRecap({ data: { leagueId, week } }),
  });
  const trades = useQuery({
    queryKey: ["trades", leagueId],
    queryFn: () => getTrades({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });

  const book = useQuery({
    queryKey: ["book", leagueId],
    queryFn: () => getBook({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });

  const pull = useMutation({
    mutationFn: (input: { wagerId: string; stake: number }) =>
      pullWager({ data: { leagueId, wagerId: input.wagerId } }),
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: ["book", leagueId] });
      toast(`Pulled $${input.stake}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not pull"),
  });

  if (league.data == null && league.isPending) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!league.data) return null;

  const mine = league.data.myRosterId;
  const playoff = league.data.league.settings.playoff_teams ?? 0;
  const ops = league.data.ops;
  const open = (trades.data ?? []).filter((t) => t.status === "proposed");

  return (
    <>
      <Deck>
        <span className="flex items-center gap-0.5 rounded-pill bg-raised p-0.5">
          <Link
            to="/league/$leagueId/standings"
            params={{ leagueId }}
            search={{ week }}
            aria-current="page"
            className="inline-flex h-8 items-center rounded-pill bg-fg px-3 text-[13px] font-medium text-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep"
          >
            Table
          </Link>
          <Link
            to="/league/$leagueId/recap"
            params={{ leagueId }}
            search={{ week, story: undefined }}
            className="inline-flex h-8 items-center rounded-pill px-3 text-[13px] font-medium text-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep"
          >
            Recap
          </Link>
        </span>
      </Deck>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl bg-surface ring-card">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Standings</h2>
              {playoff > 0 ? <span className="microlabel-data">Top {playoff} make it</span> : null}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead className="microlabel-data">
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 text-left font-medium" />
                    <th className="px-2 py-3 text-left font-medium">Team</th>
                    <th className="px-3 py-3 text-right font-medium">W–L</th>
                    <th className="px-3 py-3 text-right font-medium">PF</th>
                    <th className="px-4 py-3 text-right font-medium">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {league.data.standings.map((row, i) => {
                    const rank = i + 1;
                    const inPlayoffs = playoff > 0 && rank <= playoff;
                    return (
                      <tr
                        key={row.rosterId}
                        className={cn(
                          "border-b border-line last:border-0",
                          // The cut is structure, so it gets a rule rather than a colour.
                          playoff > 0 && rank === playoff && "border-b-2 border-b-line-strong",
                          row.rosterId === mine && "bg-raised",
                        )}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-pill font-mono text-[10px]",
                              inPlayoffs ? "bg-accent font-semibold text-accent-fg" : "text-faint",
                            )}
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <Link
                            to="/league/$leagueId/team/$rosterId"
                            params={{ leagueId, rosterId: String(row.rosterId) }}
                            className="flex items-center gap-2.5"
                          >
                            <Avatar src={row.avatar} name={row.teamName} className="size-7" tint />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{row.teamName}</span>
                              <span className="block truncate font-mono text-[10px] text-faint">
                                {row.manager}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium tabular-nums">
                          {fmtRecord(row.wins, row.losses, row.ties)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {formatPts(row.pf, 1)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                          {formatPts(row.pa, 1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl bg-surface ring-card">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">
                Week {week} slate
              </h2>
              <Link
                to="/league/$leagueId/matchups"
                params={{ leagueId }}
                search={{ week }}
                className="microlabel-data text-accent-strong"
              >
                Open matchup
              </Link>
            </header>
            {matchups.data == null &&
            (matchups.isPending || matchups.isLoading || !matchups.isFetched) ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : (
              <ul>
                {slate.map((pair) => {
                  const scores = pairPreviewScores(pair);
                  const homePts = scores.home;
                  const awayPts = scores.away;
                  const homeLeads = !pair.away || homePts >= awayPts;
                  const decided = scores.live && (homePts > 0 || awayPts > 0);
                  const involvesMe = pair.home.rosterId === mine || pair.away?.rosterId === mine;
                  return (
                    <li key={pair.matchupId}>
                      <Link
                        to="/league/$leagueId/matchup/$week/$matchupId"
                        params={{ leagueId, week: String(week), matchupId: String(pair.matchupId) }}
                        className={cn(
                          "flex items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-raised",
                          involvesMe && "bg-raised/60",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className={homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {pair.home.teamName}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-sm tabular-nums">
                          <span className={homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {formatPts(homePts, 1)}
                          </span>
                          <span className="mx-1.5 text-faint">–</span>
                          <span className={!homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {formatPts(awayPts, 1)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right text-sm">
                          <span className={!homeLeads && decided ? "font-semibold" : "text-muted"}>
                            {pair.away?.teamName ?? "Bye"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-surface ring-card">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Moves</h2>
              <Link
                to="/league/$leagueId/activity"
                params={{ leagueId }}
                search={{ week: undefined }}
                className="microlabel-data text-accent-strong"
              >
                All weeks
              </Link>
            </header>
            {(activity.data ?? []).length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nothing has moved this week.</p>
            ) : (
              <ul>
                {(activity.data ?? []).slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0"
                  >
                    <Badge tone="muted">{item.type}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.teamNames.join(", ") || "Someone"}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {[
                          item.adds.length ? `in ${item.adds.map((a) => a.name).join(", ")}` : null,
                          item.drops.length
                            ? `out ${item.drops.map((d) => d.name).join(", ")}`
                            : null,
                          item.bid ? `$${item.bid}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {recap.data ? (
            <Link
              to="/league/$leagueId/recap"
              params={{ leagueId }}
              search={{ week, story: undefined }}
              className="block rounded-xl bg-surface px-5 py-5 ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
            >
              <p className="microlabel">{recap.data.kicker}</p>
              <p className="mt-1.5 font-display text-xl font-bold leading-snug tracking-[-0.03em]">
                <span className="hl">{recap.data.headline}</span>
              </p>
              <p className="mt-2.5 text-sm text-muted">{recap.data.dek}</p>
            </Link>
          ) : null}

          {league.data.hosted ? (
            <section className="rounded-xl bg-surface ring-card">
              <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">Open trades</h2>
                <Link
                  to="/league/$leagueId/trades"
                  params={{ leagueId }}
                  className="microlabel-data text-accent-strong"
                >
                  Trade desk
                </Link>
              </header>
              {open.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">Nothing on the table.</p>
              ) : (
                <ul>
                  {open.slice(0, 4).map((t) => {
                    const waitingOnMe =
                      mine != null && t.sides.some((s) => s.rosterId === mine && !s.accepted);
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {t.sides.map((s) => s.teamName).join(" ↔ ")}
                          </span>
                          <span className="block microlabel-data">
                            {waitingOnMe ? "waiting on you" : "awaiting them"}
                          </span>
                        </span>
                        {waitingOnMe ? <Badge tone="loss">You</Badge> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {book.data?.enabled ? (
            <section className="rounded-xl bg-surface ring-card">
              <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
                <h2 className="font-display text-lg font-medium tracking-[-0.02em]">The book</h2>
                <span className="microlabel-data">
                  {book.data.locked ? "closed" : `week ${book.data.week}`}
                </span>
              </header>
              <PurseMeter book={book.data} />
              <div className="px-5 py-3">
                <p className="font-mono text-lg font-bold tabular-nums">
                  ${book.data.pool.balance}
                </p>
                <p className="text-xs text-faint">
                  In the pool, against ${book.data.pool.committed} committed. Funded by losing
                  stakes.
                </p>
              </div>
              {book.data.positions.length ? (
                <ul className="border-t border-line">
                  {book.data.positions.slice(0, 6).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.sideName} {p.kind === "spread" ? fmtLine(p.line) : "to win"}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-faint">
                          {p.mine ? "yours" : p.ownerName} · week {p.week}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        ${p.stake}
                      </span>
                      {p.mine && p.status === "placed" && !book.data.locked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`wager-pull-${p.id}`}
                          disabled={pull.isPending}
                          onClick={() => pull.mutate({ wagerId: p.id, stake: p.stake })}
                        >
                          Pull
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-line px-5 py-3 text-sm text-muted">
                  {book.data.locked ? "Nothing was on this week." : "Nothing on the board yet."}
                </p>
              )}
              {book.data.settled.length ? (
                <ul className="border-t border-line">
                  {book.data.settled.slice(0, 4).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {p.sideName} {p.kind === "spread" ? fmtLine(p.line) : "to win"}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-faint">
                          {p.mine ? "yours" : p.ownerName} · week {p.week} · {p.status}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          p.status === "won" && "text-accent-strong",
                          p.status === "lost" && "text-loss",
                        )}
                      >
                        {p.status === "won"
                          ? `+$${p.payout ?? 0}`
                          : p.status === "lost"
                            ? `−$${p.stake}`
                            : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl bg-surface ring-card">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
              <h2 className="font-display text-lg font-medium tracking-[-0.02em]">House rules</h2>
              <span className="microlabel-data">Read only</span>
            </header>
            <dl>
              <Rule k="Scoring" v={league.data.scoringLabel} />
              <Rule k="Format" v={league.data.formatLabel} />
              {ops ? (
                <>
                  <Rule
                    k="Waivers"
                    v={ops.waiverType === "faab" ? `FAAB $${ops.faabBudget}` : "Rolling order"}
                  />
                  <Rule k="Trade deadline" v={`Week ${ops.tradeDeadlineWeek}`} />
                  <Rule k="Playoffs" v={`Top ${playoff} · wk ${ops.playoffStartWeek}`} />
                </>
              ) : null}
            </dl>
            {league.data.lineup ? <LineupRule lineup={league.data.lineup} /> : null}
            <div className="border-t border-line px-5 py-3">
              <Link
                to="/league/$leagueId/settings"
                params={{ leagueId }}
                className="microlabel-data text-accent-strong"
              >
                Open league setup
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** A stored spread reads from the backed side's point of view. */
function fmtLine(n: number): string {
  if (Math.abs(n) < 0.005) return "PK";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
}

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-muted">{k}</dt>
      <dd className="truncate font-mono text-sm font-medium">{v}</dd>
    </div>
  );
}

/** How many slot chips fit before the row starts looking like a paragraph. */
const CHIP_BUDGET = 7;

/**
 * The starting lineup is a list, not a value.
 *
 * Printed as one key/value row it wrapped to three mono lines and made the whole
 * card read as crowded. As its own block of chips it scans in one pass, and a
 * deep roster (superflex, 2QB) folds the tail behind a count instead of growing
 * the card.
 */
function LineupRule({ lineup }: { lineup: NonNullable<LeagueBundle["lineup"]> }) {
  const [open, setOpen] = useState(false);
  // Hiding a single chip behind a "+1 more" costs more room than the chip did.
  const over = lineup.starters.length - CHIP_BUDGET;
  const hidden = over > 1 ? over : 0;
  const shown = open || hidden === 0 ? lineup.starters : lineup.starters.slice(0, CHIP_BUDGET);

  return (
    <div className="border-t border-line px-5 py-3.5">
      <span className="microlabel-data">Starting lineup</span>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {shown.map((s) => (
          <span
            key={s.key}
            className="rounded-pill bg-raised px-2 py-1 font-mono text-[11px] font-medium"
          >
            {s.count > 1 ? `${s.count} ` : ""}
            {s.label}
          </span>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-pill px-2 py-1 font-mono text-[11px] font-medium text-accent-strong transition-colors duration-150 hover:bg-raised"
          >
            {open ? "Less" : `+${hidden} more`}
          </button>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px] text-faint">
        {lineup.startCount} starters &middot; {lineup.bench} bench
        {lineup.ir > 0 ? ` · ${lineup.ir} IR` : ""}
      </p>
    </div>
  );
}
