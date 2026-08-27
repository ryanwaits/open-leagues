import { getSql } from "@/lib/db";
import { recordEvent } from "./events.server";
import { applyLoss, atRiskFrom, spendableFrom } from "./faab";
import { payoutMultiplier } from "./wagers";
import { normalCdf, type PlayerOutlook, winProbability } from "./win-probability";

export { payoutMultiplier };

/**
 * The book.
 *
 * Managers stake FAAB against the house on the same two numbers the matchup
 * page already computes. Losing stakes go into a pool; winning stakes are paid
 * out of it. Nothing is minted after league creation, so the league's total FAAB
 * is fixed forever: manager balances plus the pool always equal the genesis
 * figure, which makes the whole thing auditable with one query.
 *
 * The app never sets a price it will not also stand behind — but it also never
 * takes the other side of a bet, because the pool belongs to the league rather
 * than to us. A manager who beats the line is winning other managers' losses.
 */

export type WagerKind = "spread" | "moneyline";

export type WagerStatus = "placed" | "won" | "lost" | "push" | "pulled" | "voided";

export type Quote = {
  matchupId: number;
  homeRoster: number;
  awayRoster: number;
  /** Points the home side gives up. Negative means home is favoured. */
  spread: number;
  /** 0-100, home side. */
  homePct: number;
  awayPct: number;
  /**
   * Profit per dollar staked on the moneyline. Backing a long shot pays several
   * times the stake; backing a heavy favourite pays a fraction of it.
   */
  homeMult: number;
  awayMult: number;
  /** False when there is nothing to price — no projections, or a bye. */
  live: boolean;
};

/**
 * Fair odds, with no house edge.
 *
 * A wager that pays even money regardless of who you back is not a price, it is
 * a gift to whoever takes the favourite. The fair profit on a stake is the ratio
 * of the two outcomes: back something with probability p and you should win
 * (1 - p) / p per dollar, so a 25% shot pays 3× and a 75% shot pays a third.
 *
 * There is deliberately no vig. The pool is funded by losing stakes rather than
 * by an edge, so taking one would just tax the league to no end.
 */
let ready = false;

export async function ensureWagerSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  const stmts = [
    `create table if not exists ol_wagers (
      id text primary key,
      league_id text not null,
      week int not null,
      matchup_id int not null,
      kind text not null,
      roster_id int not null,
      side_roster int not null,
      line real not null,
      payout_mult real not null default 1,
      stake int not null,
      status text not null default 'placed',
      payout int,
      created_at timestamptz not null default now(),
      settled_at timestamptz)`,
    `alter table ol_wagers add column if not exists payout_mult real not null default 1`,
    `create index if not exists ol_wagers_league_week on ol_wagers (league_id, week)`,
    `create table if not exists ol_pool (
      league_id text primary key,
      balance int not null default 0,
      seeded int not null default 0)`,
    `alter table ol_leagues add column if not exists betting_on int not null default 0`,
    `alter table ol_leagues add column if not exists pool_seed int not null default 200`,
    `alter table ol_leagues add column if not exists wager_cap int not null default 25`,
    `alter table ol_leagues add column if not exists exposure_cap int not null default 60`,
    `alter table ol_leagues add column if not exists wagers_locked_week int not null default 0`,
  ];
  for (const s of stmts) await sql.query(s);
  ready = true;
}

type LeagueBook = {
  id: string;
  current_week: number;
  betting_on: number;
  pool_seed: number;
  wager_cap: number;
  exposure_cap: number;
  wagers_locked_week: number;
  faab_budget: number | null;
};

async function bookLeague(leagueId: string): Promise<LeagueBook> {
  await ensureWagerSchema();
  const sql = await getSql();
  const row = (await sql<LeagueBook>`select * from ol_leagues where id = ${leagueId}`)[0];
  if (!row) throw new Error("No such league.");
  return row;
}

/* ------------------------------------------------------------------ pool -- */

/**
 * Mint the pool once.
 *
 * Called at league creation and again, harmlessly, on the first book read of an
 * older league — so leagues that predate betting still get a pool the first time
 * anyone opens it rather than needing a migration.
 */
export async function seedPool(leagueId: string, amount: number): Promise<void> {
  await ensureWagerSchema();
  const sql = await getSql();
  await sql`
    insert into ol_pool (league_id, balance, seeded)
    values (${leagueId}, ${amount}, ${amount})
    on conflict (league_id) do nothing
  `;
}

export async function poolBalance(leagueId: string): Promise<{ balance: number; seeded: number }> {
  const league = await bookLeague(leagueId);
  await seedPool(leagueId, league.pool_seed);
  const sql = await getSql();
  const row = (
    await sql<{ balance: number; seeded: number }>`
      select balance, seeded from ol_pool where league_id = ${leagueId}
    `
  )[0];
  return row ?? { balance: 0, seeded: 0 };
}

async function movePool(leagueId: string, delta: number): Promise<void> {
  const sql = await getSql();
  await sql`update ol_pool set balance = balance + ${delta} where league_id = ${leagueId}`;
}

/* ----------------------------------------------------------------- quote -- */

/**
 * Price a matchup from the same model the matchup page draws.
 *
 * The spread is the expected margin rounded to a half point, so a push is only
 * reachable when the model lands exactly on a whole number and the game does
 * too. The moneyline is the win probability that already appears in
 * "Where the game is", stated as a percentage.
 */
export function quoteFrom(input: {
  matchupId: number;
  homeRoster: number;
  awayRoster: number;
  scores: [number, number];
  starters: [PlayerOutlook[], PlayerOutlook[]];
}): Quote {
  const wp = winProbability({ scores: input.scores, starters: input.starters });
  const spread = Math.round(wp.expectedMargin * 2) / 2;
  const pct = Math.round(wp.probability * 100);
  return {
    matchupId: input.matchupId,
    homeRoster: input.homeRoster,
    awayRoster: input.awayRoster,
    spread: -spread,
    homePct: pct,
    awayPct: 100 - pct,
    homeMult: payoutMultiplier(wp.probability),
    awayMult: payoutMultiplier(1 - wp.probability),
    live: wp.marginSd > 0.01,
  };
}

/** Exposed so callers can price without importing the stats layer twice. */
export { normalCdf };

/* ------------------------------------------------------------- placement -- */

export type PlaceInput = {
  userId: string;
  leagueId: string;
  matchupId: number;
  kind: WagerKind;
  /** The roster you are backing. */
  sideRoster: number;
  /** The number as it was quoted to you, stored so settlement cannot drift. */
  line: number;
  stake: number;
};

export async function placeWager(input: PlaceInput): Promise<{ id: string }> {
  const league = await bookLeague(input.leagueId);
  if (!league.betting_on) throw new Error("Betting is off in this league.");
  if (league.wagers_locked_week >= league.current_week) {
    throw new Error("The book is closed for this week.");
  }

  const sql = await getSql();
  const mine = (
    await sql<{ roster_id: number; faab_remaining: number | null }>`
      select roster_id, faab_remaining from ol_rosters
      where league_id = ${input.leagueId} and owner_id = ${input.userId}
    `
  )[0];
  if (!mine) throw new Error("You don't have a seat.");

  const stake = Math.max(1, Math.floor(input.stake));
  if (stake > league.wager_cap) {
    throw new Error(`The most you can stake on one wager is $${league.wager_cap}.`);
  }

  const pair = (
    await sql<{ home_roster: number; away_roster: number }>`
      select home_roster, away_roster from ol_matchups
      where league_id = ${input.leagueId} and week = ${league.current_week}
        and matchup_id = ${input.matchupId}
    `
  )[0];
  if (!pair) throw new Error("No such matchup this week.");

  const inThisGame = pair.home_roster === mine.roster_id || pair.away_roster === mine.roster_id;
  // You control your own lineup. Backing yourself is harmless; fading yourself
  // means profiting from a loss you can arrange, which is the one thing that
  // would break the league.
  if (inThisGame && input.sideRoster !== mine.roster_id) {
    throw new Error("You can back yourself, but you cannot bet against yourself.");
  }
  if (input.sideRoster !== pair.home_roster && input.sideRoster !== pair.away_roster) {
    throw new Error("That team is not in this matchup.");
  }

  const free = await spendable(input.leagueId, mine.roster_id, mine.faab_remaining);
  if (stake > free) throw new Error(`Stake $${stake} is over your $${free} available.`);

  const exposure = await atRisk(input.leagueId, mine.roster_id);
  if (exposure + stake > league.exposure_cap) {
    throw new Error(`That would put you over the $${league.exposure_cap} exposure cap.`);
  }

  // Re-quote rather than trusting the browser. The multiplier decides what the
  // pool owes if this lands, so it is not a number a client gets to assert.
  let line = input.line;
  let mult = 1;
  try {
    const { quoteOne } = await import("./book.server");
    const q = await quoteOne(input.leagueId, league.current_week, input.matchupId);
    if (q) {
      const home = input.sideRoster === pair.home_roster;
      if (input.kind === "spread") {
        // A spread is built to make both sides a coin flip, so it pays even money.
        line = home ? q.spread : -q.spread;
        mult = 1;
      } else {
        line = 0;
        mult = home ? q.homeMult : q.awayMult;
      }
    }
  } catch {
    // No fresh quote available: fall back to what was offered, at even money.
  }

  const id = wid();
  await sql`
    insert into ol_wagers
      (id, league_id, week, matchup_id, kind, roster_id, side_roster, line, payout_mult, stake, status)
    values (
      ${id}, ${input.leagueId}, ${league.current_week}, ${input.matchupId}, ${input.kind},
      ${mine.roster_id}, ${input.sideRoster}, ${line}, ${mult}, ${stake}, ${"placed"}
    )
  `;
  await recordEvent({
    leagueId: input.leagueId,
    week: league.current_week,
    kind: "wager_placed",
    actorRoster: mine.roster_id,
    subjectRoster: input.sideRoster,
    amount: stake,
    payload: { kind: input.kind, line, mult, matchupId: input.matchupId, backedSelf: inThisGame },
  });
  return { id };
}

export async function pullWager(userId: string, leagueId: string, wagerId: string): Promise<void> {
  const league = await bookLeague(leagueId);
  const sql = await getSql();
  const mine = (
    await sql<{ roster_id: number }>`
      select roster_id from ol_rosters where league_id = ${leagueId} and owner_id = ${userId}
    `
  )[0];
  if (!mine) throw new Error("You don't have a seat.");
  const row = (
    await sql<{ roster_id: number; status: string; week: number }>`
      select roster_id, status, week from ol_wagers where id = ${wagerId} and league_id = ${leagueId}
    `
  )[0];
  if (!row || row.status !== "placed") throw new Error("That wager is gone.");
  if (row.roster_id !== mine.roster_id) throw new Error("Not your wager.");
  if (league.wagers_locked_week >= row.week) throw new Error("The book is closed for that week.");
  await sql`update ol_wagers set status = ${"pulled"}, settled_at = now() where id = ${wagerId}`;
  await recordEvent({
    leagueId,
    week: row.week,
    kind: "wager_pulled",
    actorRoster: mine.roster_id,
    payload: { wagerId },
  });
}

/* -------------------------------------------------------------- balances -- */

/**
 * What a manager can actually spend.
 *
 * A stake holds money because a wager always resolves; a pending waiver claim
 * does not, because most claims lose and queueing more than you can afford is
 * ordinary strategy. So this subtracts only live stakes.
 */
export async function spendable(
  leagueId: string,
  rosterId: number,
  faabRemaining?: number | null,
): Promise<number> {
  const sql = await getSql();
  let purse = faabRemaining;
  if (purse == null) {
    const row = (
      await sql<{ faab_remaining: number | null; faab_budget: number | null }>`
        select r.faab_remaining, l.faab_budget from ol_rosters r
        join ol_leagues l on l.id = r.league_id
        where r.league_id = ${leagueId} and r.roster_id = ${rosterId}
      `
    )[0];
    purse = row?.faab_remaining ?? row?.faab_budget ?? 100;
  }
  return spendableFrom(purse ?? 0, await atRisk(leagueId, rosterId));
}

/** Total staked on wagers that have not settled. */
export async function atRisk(leagueId: string, rosterId: number): Promise<number> {
  try {
    await ensureWagerSchema();
    const sql = await getSql();
    const row = (
      await sql<{ n: number }>`
        select coalesce(sum(stake), 0)::int as n from ol_wagers
        where league_id = ${leagueId} and roster_id = ${rosterId} and status = ${"placed"}
      `
    )[0];
    return atRiskFrom([row?.n ?? 0]);
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ lock -- */

/**
 * Close the book for a week.
 *
 * Called immediately after the final player refresh before a slate, so the last
 * thing that happens before the door shuts is the price being brought current.
 * Everyone bets against the same last-known state of the world.
 */
export async function lockWeek(leagueId: string, week: number): Promise<void> {
  await ensureWagerSchema();
  const sql = await getSql();
  await sql`
    update ol_leagues set wagers_locked_week = ${week}
    where id = ${leagueId} and wagers_locked_week < ${week}
  `;
}

/* ------------------------------------------------------------- settlement -- */

/**
 * Settle a week against the stored lines.
 *
 * The line a wager was written at is the line it settles on, never a recomputed
 * one — the whole point of storing it is that the number cannot move after the
 * fact. When the pool cannot cover every winner, payouts scale proportionally
 * rather than paying the first few in full and stiffing the rest.
 */
export async function settleWeek(
  leagueId: string,
  week: number,
): Promise<{ settled: number; paid: number; scaled: boolean }> {
  await ensureWagerSchema();
  const sql = await getSql();

  const wagers = await sql<{
    id: string;
    matchup_id: number;
    kind: WagerKind;
    roster_id: number;
    side_roster: number;
    line: number;
    payout_mult: number;
    stake: number;
  }>`
    select id, matchup_id, kind, roster_id, side_roster, line, payout_mult, stake
    from ol_wagers
    where league_id = ${leagueId} and week = ${week} and status = ${"placed"}
  `;
  if (wagers.length === 0) return { settled: 0, paid: 0, scaled: false };

  // ol_matchups carries the pairing, never the score — points are written to
  // ol_week_results when the week is finalised. That is what settles a wager,
  // because it is the same number the standings were computed from.
  const games = await sql<{
    matchup_id: number;
    home_roster: number;
    away_roster: number | null;
  }>`
    select matchup_id, home_roster, away_roster
    from ol_matchups where league_id = ${leagueId} and week = ${week}
  `;
  const results = await sql<{ roster_id: number; points: number }>`
    select roster_id, points from ol_week_results
    where league_id = ${leagueId} and week = ${week}
  `;
  const pts = new Map(results.map((r) => [r.roster_id, r.points]));
  const byGame = new Map(games.map((g) => [g.matchup_id, g]));

  const winners: typeof wagers = [];
  const losers: typeof wagers = [];
  const pushes: typeof wagers = [];

  for (const w of wagers) {
    const g = byGame.get(w.matchup_id);
    if (!g || g.away_roster == null) continue;
    const home = pts.get(g.home_roster);
    const away = pts.get(g.away_roster);
    // No result recorded means the week was never finalised. Leave the wager
    // open rather than settling it against a zero.
    if (home == null || away == null) continue;
    const mine = w.side_roster === g.home_roster ? home : away;
    const theirs = w.side_roster === g.home_roster ? away : home;

    if (w.kind === "moneyline") {
      if (mine > theirs) winners.push(w);
      else if (mine < theirs) losers.push(w);
      else pushes.push(w);
      continue;
    }
    // Spread: the stored line is what the backed side had to cover.
    const margin = mine - theirs + w.line;
    if (Math.abs(margin) < 0.005) pushes.push(w);
    else if (margin > 0) winners.push(w);
    else losers.push(w);
  }

  // Losses fund the pool first, so a week can partly pay for itself.
  // Pool only the cash actually taken — never the full stake when the purse
  // was already short (claim then lose used to mint the gap).
  for (const w of losers) {
    const rows = await sql<{ faab_remaining: number | null }>`
      select faab_remaining from ol_rosters
      where league_id = ${leagueId} and roster_id = ${w.roster_id}
    `;
    const { remaining, poolCredit } = applyLoss(rows[0]?.faab_remaining ?? 0, w.stake);
    await sql`
      update ol_rosters set faab_remaining = ${remaining}
      where league_id = ${leagueId} and roster_id = ${w.roster_id}
    `;
    await movePool(leagueId, poolCredit);
    await sql`
      update ol_wagers set status = ${"lost"}, payout = ${0}, settled_at = now()
      where id = ${w.id} and status = ${"placed"}
    `;
  }

  for (const w of pushes) {
    await sql`
      update ol_wagers set status = ${"push"}, payout = ${0}, settled_at = now()
      where id = ${w.id}
    `;
  }

  // What a winner is owed is the stake times the odds it was written at, not the
  // stake back. A long shot that lands is meant to hurt the pool.
  const due = (w: (typeof wagers)[number]) => Math.floor(w.stake * (w.payout_mult || 1));
  const owed = winners.reduce((t, w) => t + due(w), 0);
  const { balance } = await poolBalance(leagueId);
  const scaled = owed > balance;
  const ratio = scaled && owed > 0 ? balance / owed : 1;

  let paid = 0;
  for (const w of winners) {
    const payout = Math.floor(due(w) * ratio);
    if (payout > 0) {
      await sql`
        update ol_rosters set faab_remaining = coalesce(faab_remaining, 0) + ${payout}
        where league_id = ${leagueId} and roster_id = ${w.roster_id}
      `;
      await movePool(leagueId, -payout);
      paid += payout;
    }
    await sql`
      update ol_wagers set status = ${"won"}, payout = ${payout}, settled_at = now()
      where id = ${w.id}
    `;
  }

  for (const [list, kind] of [
    [winners, "wager_won"],
    [losers, "wager_lost"],
  ] as const) {
    for (const w of list) {
      await recordEvent({
        leagueId,
        week,
        kind,
        actorRoster: w.roster_id,
        subjectRoster: w.side_roster,
        amount: w.stake,
        payload: { wagerKind: w.kind, line: w.line, scaled },
      });
    }
  }

  return { settled: winners.length + losers.length + pushes.length, paid, scaled };
}

function wid(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "wg_";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
