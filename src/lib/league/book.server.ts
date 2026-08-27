import { getSql } from "@/lib/db";
import {
  atRisk,
  ensureWagerSchema,
  poolBalance,
  type Quote,
  quoteFrom,
  spendable,
  type WagerKind,
  type WagerStatus,
} from "./wagers.server";
import type { PlayerOutlook } from "./win-probability";

/**
 * Everything the book surfaces need, in one round trip.
 *
 * Quotes come from the same outlook data the matchup page draws, so the number
 * on a price button and the number in "Where the game is" can never disagree —
 * they are computed from one call.
 */

export type BookLine = Quote & {
  homeName: string;
  awayName: string;
  /** True once the week is closed and prices are frozen. */
  locked: boolean;
  /** The roster you may back here, or null when you are not in this game. */
  restrictedTo: number | null;
};

export type BookPosition = {
  id: string;
  week: number;
  matchupId: number;
  kind: WagerKind;
  sideRoster: number;
  sideName: string;
  line: number;
  /** Profit per dollar this was written at. 1 on a spread. */
  mult: number;
  stake: number;
  status: WagerStatus;
  payout: number | null;
  mine: boolean;
  ownerName: string;
};

export type BookBundle = {
  enabled: boolean;
  week: number;
  locked: boolean;
  lines: BookLine[];
  /** Yours first, then the rest of the league's settled history. */
  positions: BookPosition[];
  settled: BookPosition[];
  pool: { balance: number; seeded: number; committed: number };
  purse: {
    budget: number;
    free: number;
    atRisk: number;
    rosterId: number | null;
  };
  caps: { wager: number; exposure: number };
};

/**
 * Price one matchup, server-side.
 *
 * Placement re-quotes rather than trusting whatever the client displayed — the
 * multiplier decides what the pool owes, so it is not a number a browser gets to
 * assert. The stored figure is this one, which is also what settlement uses.
 */
export async function quoteOne(
  leagueId: string,
  week: number,
  matchupId: number,
): Promise<Quote | null> {
  const sql = await getSql();
  const season = String(
    (await sql<{ season: string }>`select season from ol_leagues where id = ${leagueId}`)[0]
      ?.season ?? "",
  );
  const eng = await import("./engine.server");
  const pairs = await eng.loadMatchups(leagueId, week);
  const pair = pairs.find((p) => p.matchupId === matchupId);
  if (!pair?.away) return null;

  const ids = [...pair.home.starters, ...pair.away.starters]
    .map((s) => s.playerId)
    .filter((x): x is string => Boolean(x));
  const { outlooksFor } = await import("@/lib/data/projections.server");
  const outlooks = ids.length ? await outlooksFor({ leagueId, season, playerIds: ids }) : {};

  const side = (s: typeof pair.home): PlayerOutlook[] =>
    s.starters.map((line) => {
      const o = line.playerId ? outlooks[line.playerId] : undefined;
      return {
        playerId: line.playerId ?? "",
        team: line.player?.team ?? null,
        position: line.player?.position ?? null,
        mean: o?.mean ?? 0,
        sd: o?.sd ?? 0,
        game: line.game,
      };
    });

  return quoteFrom({
    matchupId: pair.matchupId,
    homeRoster: pair.home.rosterId,
    awayRoster: pair.away.rosterId,
    scores: [pair.home.points, pair.away.points],
    starters: [side(pair.home), side(pair.away)],
  });
}

export async function loadBook(
  leagueId: string,
  userId: string | null,
  weekIn?: number,
): Promise<BookBundle> {
  await ensureWagerSchema();
  const sql = await getSql();

  const league = (
    await sql<{
      current_week: number;
      betting_on: number;
      wager_cap: number;
      exposure_cap: number;
      wagers_locked_week: number;
      faab_budget: number | null;
    }>`select current_week, betting_on, wager_cap, exposure_cap, wagers_locked_week, faab_budget
       from ol_leagues where id = ${leagueId}`
  )[0];

  const week = weekIn ?? league?.current_week ?? 1;
  const empty: BookBundle = {
    enabled: false,
    week,
    locked: true,
    lines: [],
    positions: [],
    settled: [],
    pool: { balance: 0, seeded: 0, committed: 0 },
    purse: { budget: 0, free: 0, atRisk: 0, rosterId: null },
    caps: { wager: 0, exposure: 0 },
  };
  if (!league || !league.betting_on) return empty;

  const rosters = await sql<{ roster_id: number; team_name: string; owner_id: string | null }>`
    select roster_id, team_name, owner_id from ol_rosters where league_id = ${leagueId}
  `;
  const nameOf = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  const mine = userId ? (rosters.find((r) => r.owner_id === userId)?.roster_id ?? null) : null;
  const locked = league.wagers_locked_week >= week;

  /* ------------------------------------------------------------- quotes -- */
  const lines: BookLine[] = [];
  try {
    const eng = await import("./engine.server");
    const pairs = await eng.loadMatchups(leagueId, week);
    const season = String(
      (await sql<{ season: string }>`select season from ol_leagues where id = ${leagueId}`)[0]
        ?.season ?? "",
    );

    const ids = pairs.flatMap((p) =>
      [...p.home.starters, ...(p.away?.starters ?? [])]
        .map((s) => s.playerId)
        .filter((x): x is string => Boolean(x)),
    );
    const { outlooksFor } = await import("@/lib/data/projections.server");
    const outlooks = ids.length ? await outlooksFor({ leagueId, season, playerIds: ids }) : {};

    for (const pair of pairs) {
      if (!pair.away) continue;
      const side = (s: typeof pair.home): PlayerOutlook[] =>
        s.starters.map((line) => {
          const o = line.playerId ? outlooks[line.playerId] : undefined;
          return {
            playerId: line.playerId ?? "",
            team: line.player?.team ?? null,
            position: line.player?.position ?? null,
            mean: o?.mean ?? 0,
            sd: o?.sd ?? 0,
            game: line.game,
          };
        });

      const quote = quoteFrom({
        matchupId: pair.matchupId,
        homeRoster: pair.home.rosterId,
        awayRoster: pair.away.rosterId,
        scores: [pair.home.points, pair.away.points],
        starters: [side(pair.home), side(pair.away)],
      });

      const inIt = mine === pair.home.rosterId || mine === pair.away.rosterId;
      lines.push({
        ...quote,
        homeName: pair.home.teamName,
        awayName: pair.away.teamName,
        locked,
        // Rule: you may back yourself but never fade yourself, so on your own
        // game only one side is offered at all.
        restrictedTo: inIt ? mine : null,
      });
    }
  } catch {
    // No projections yet, or a week with no schedule. No lines is a valid state.
  }

  /* ---------------------------------------------------------- positions -- */
  const rows = await sql<{
    id: string;
    week: number;
    matchup_id: number;
    kind: string;
    roster_id: number;
    side_roster: number;
    line: number;
    payout_mult: number;
    stake: number;
    status: string;
    payout: number | null;
  }>`
    select id, week, matchup_id, kind, roster_id, side_roster, line, payout_mult, stake, status, payout
    from ol_wagers where league_id = ${leagueId}
    order by created_at desc
    limit 200
  `;

  const shape = (r: (typeof rows)[number]): BookPosition => ({
    id: r.id,
    week: r.week,
    matchupId: r.matchup_id,
    kind: r.kind as WagerKind,
    sideRoster: r.side_roster,
    sideName: nameOf.get(r.side_roster) ?? `Roster ${r.side_roster}`,
    line: r.line,
    mult: r.payout_mult || 1,
    stake: r.stake,
    status: r.status as WagerStatus,
    payout: r.payout,
    mine: r.roster_id === mine,
    ownerName: nameOf.get(r.roster_id) ?? `Roster ${r.roster_id}`,
  });

  const all = rows.map(shape);
  // Open positions stay private until the book closes; after that the whole
  // league sees who was on what, which is both fairer and better material.
  const open = all.filter((p) => p.status === "placed").filter((p) => p.mine || locked);
  const settled = all.filter((p) => p.status !== "placed" && p.status !== "pulled");

  /* -------------------------------------------------------------- purse -- */
  const pool = await poolBalance(leagueId);
  // What the pool could owe, not what was staked — a long shot commits several
  // times its stake and that is the number solvency turns on.
  const committed = all
    .filter((p) => p.status === "placed")
    .reduce((t, p) => t + Math.floor(p.stake * p.mult), 0);

  const budget = league.faab_budget ?? 100;
  let free = 0;
  let risk = 0;
  if (mine != null) {
    free = await spendable(leagueId, mine);
    risk = await atRisk(leagueId, mine);
  }

  return {
    enabled: true,
    week,
    locked,
    lines,
    positions: open,
    settled,
    pool: { ...pool, committed },
    purse: { budget, free, atRisk: risk, rosterId: mine },
    caps: { wager: league.wager_cap, exposure: league.exposure_cap },
  };
}
