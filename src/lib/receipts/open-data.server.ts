import { getSql } from "@/lib/db";

/**
 * The open-data half of receipts: things a human screenshots that a script can
 * fetch instead. Two endpoints ride on this module.
 *
 *   /api/players.json          — the player-ID crosswalk hobby tools hand-build
 *   /api/wire/:season/:week.json — what each player actually cleared for on
 *                                waivers, across every league that has pasted
 *
 * Both are anonymous aggregates. No league id, no manager, no roster appears in
 * either payload.
 */

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_pasted_leagues (
  league_id text primary key,
  season text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
)`);
  ready = true;
}

/** A raw Sleeper league someone asked about. Never a hosted one. */
export function recordPaste(leagueId: string, season: string | null): void {
  if (leagueId.startsWith("lg_")) return;
  void (async () => {
    try {
      await ensure();
      const sql = await getSql();
      await sql`
        insert into ol_pasted_leagues (league_id, season, first_seen, last_seen)
        values (${leagueId}, ${season}, now(), now())
        on conflict (league_id) do update set last_seen = now(), season = coalesce(excluded.season, ol_pasted_leagues.season)
      `;
    } catch {
      /* best-effort */
    }
  })();
}

/* ── crosswalk ───────────────────────────────────────────────────────── */

export type CrosswalkRow = {
  sleeper_id: string;
  gsis_id: string | null;
  espn_id: string | null;
  yahoo_id: string | null;
  rotowire_id: string | null;
  sportradar_id: string | null;
  name: string | null;
  team: string | null;
  position: string | null;
};

export async function playersCrosswalk(): Promise<CrosswalkRow[]> {
  const pbp = await import("./pbp.server");
  await pbp.ensureCrosswalk();
  const sql = await getSql();
  const rows = await sql<CrosswalkRow>`
    select sleeper_id, gsis_id, espn_id, yahoo_id, rotowire_id, sportradar_id, name, team, position
    from ol_player_ids
    order by sleeper_id
  `;
  return rows;
}

/* ── clearing prices ─────────────────────────────────────────────────── */

/**
 * A dollar is not a unit. A $50 bid is half of a $100 league and a twentieth
 * of a $1,000 one, and $50 with $52 left is a different act than $50 with
 * $400 left. Every claim is stored with the budget it came from and the
 * bidder's remaining purse at the time, and every published price is a share
 * of budget. Raw dollars only appear inside a single-budget cohort.
 */
export type WireCohort = {
  /** Roster count in the league, e.g. 12. */
  rosters?: number;
  /** Scoring shape from the receptions value: ppr | half | std. */
  format?: "ppr" | "half" | "std";
  superflex?: boolean;
};

export type WirePrice = {
  player_id: string;
  name: string | null;
  position: string | null;
  /** Winning bids behind this price. */
  n: number;
  /** Share of the league's FAAB budget, 0–100. */
  median_pct: number;
  p25_pct: number;
  p75_pct: number;
  max_pct: number;
  /** Share of what the winning bidder had left when they bid, 0–100. */
  median_pct_remaining: number;
  /** Dollars, only when every bid behind this price came from the same budget. */
  dollars: { budget: number; median: number } | null;
};

export type WirePrices = {
  season: string;
  week: number;
  /** Leagues that contributed at least one cleared claim. */
  leagues: number;
  /** How many contributing leagues run each budget, e.g. { "100": 9, "200": 3 }. */
  budgets: Record<string, number>;
  cohort: WireCohort;
  computedAt: string;
  prices: WirePrice[];
};

type Claim = {
  league_id: string;
  week: number;
  roster_id: number;
  player_id: string;
  bid: number;
  budget: number;
  remaining_before: number;
  rosters: number;
  format: "ppr" | "half" | "std";
  superflex: boolean;
};

const CLAIMS_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LEAGUES = 400; // stay well under Sleeper's 1000/min per IP

type SleeperTx = {
  type: string;
  status: string;
  status_updated?: number;
  adds: Record<string, number> | null;
  settings: { waiver_bid?: number; seq?: number } | null;
};

async function ensureClaims(): Promise<void> {
  const sql = await getSql();
  await sql.query(`create table if not exists ol_wire_claims (
  league_id text not null,
  season text not null,
  week int not null,
  roster_id int not null,
  player_id text not null,
  bid int not null,
  budget int not null,
  remaining_before int not null,
  rosters int not null,
  format text not null,
  superflex boolean not null,
  primary key (league_id, season, week, roster_id, player_id)
)`);
  await sql.query(`create table if not exists ol_wire_claims_log (
  league_id text not null,
  season text not null,
  at timestamptz not null default now(),
  primary key (league_id, season)
)`);
}

function formatOf(scoring: Record<string, number> | undefined): Claim["format"] {
  const rec = scoring?.rec ?? 0;
  if (rec >= 1) return "ppr";
  if (rec > 0) return "half";
  return "std";
}

/**
 * Pull one league-season's cleared claims once (≤18 calls), with each bidder's
 * remaining purse reconstructed from their own earlier wins. Refreshed every
 * six hours for the current season; past seasons are read once.
 */
async function ensureLeagueClaims(leagueId: string, season: string, throughWeek: number) {
  const sql = await getSql();
  const log = (
    await sql<{ at: string }>`
      select at from ol_wire_claims_log where league_id = ${leagueId} and season = ${season}
    `
  )[0];
  if (log && Date.now() - new Date(log.at).getTime() < CLAIMS_TTL_MS) return;

  const sleeper = await import("@/lib/data/sleeper.server");
  const league = await sleeper.fetchLeague(leagueId);
  const budget = league.settings?.waiver_budget ?? 100;
  const rosters = league.total_rosters ?? league.settings?.num_teams ?? 0;
  const format = formatOf(league.scoring_settings);
  const superflex = (league.roster_positions ?? []).includes("SUPER_FLEX");

  const spent = new Map<number, number>();
  for (let w = 1; w <= Math.min(throughWeek, 18); w++) {
    let txs: SleeperTx[] = [];
    try {
      const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${w}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) continue;
      txs = (await res.json()) as SleeperTx[];
    } catch {
      continue;
    }
    const won = txs
      .filter((t) => t.type === "waiver" && t.status === "complete" && t.adds)
      .sort((a, b) => (a.settings?.seq ?? 0) - (b.settings?.seq ?? 0));
    for (const t of won) {
      const bid = t.settings?.waiver_bid;
      if (typeof bid !== "number" || !t.adds) continue;
      for (const [pid, rosterId] of Object.entries(t.adds)) {
        const before = budget - (spent.get(rosterId) ?? 0);
        await sql`
          insert into ol_wire_claims
            (league_id, season, week, roster_id, player_id, bid, budget, remaining_before, rosters, format, superflex)
          values (${leagueId}, ${season}, ${w}, ${rosterId}, ${pid}, ${bid}, ${budget}, ${Math.max(0, before)},
                  ${rosters}, ${format}, ${superflex})
          on conflict (league_id, season, week, roster_id, player_id) do update set
            bid = excluded.bid, budget = excluded.budget, remaining_before = excluded.remaining_before,
            rosters = excluded.rosters, format = excluded.format, superflex = excluded.superflex
        `;
        spent.set(rosterId, (spent.get(rosterId) ?? 0) + bid);
      }
    }
  }
  await sql`
    insert into ol_wire_claims_log (league_id, season, at) values (${leagueId}, ${season}, now())
    on conflict (league_id, season) do update set at = now()
  `;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const v = sorted[lo] ?? 0;
  const w = sorted[hi] ?? v;
  return Math.round((v + (w - v) * (pos - lo)) * 10) / 10;
}

const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : 0);

/**
 * Clearing prices for a week across every league that has pasted, as shares
 * of budget. Not cached beyond the claims themselves; the aggregate is cheap.
 */
export async function wirePrices(
  season: string,
  week: number,
  cohort: WireCohort = {},
): Promise<WirePrices> {
  await ensure();
  await ensureClaims();
  const sql = await getSql();
  const leagues = await sql<{ league_id: string }>`
    select league_id from ol_pasted_leagues
    where season = ${season} or season is null
    order by last_seen desc
    limit ${MAX_LEAGUES}
  `;
  // Refresh each league's claims (a no-op inside the TTL), a few at a time.
  for (let i = 0; i < leagues.length; i += 4) {
    await Promise.all(
      leagues
        .slice(i, i + 4)
        .map(({ league_id }) => ensureLeagueClaims(league_id, season, week).catch(() => undefined)),
    );
  }

  const rows = await sql<Claim>`
    select league_id, week, roster_id, player_id, bid, budget, remaining_before, rosters, format, superflex
    from ol_wire_claims
    where season = ${season} and week = ${week}
  `;
  const claims = rows.filter(
    (c) =>
      (cohort.rosters == null || c.rosters === cohort.rosters) &&
      (cohort.format == null || c.format === cohort.format) &&
      (cohort.superflex == null || c.superflex === cohort.superflex),
  );

  const byPlayer = new Map<string, Claim[]>();
  const leagueSet = new Set<string>();
  const budgets: Record<string, number> = {};
  const seenBudget = new Set<string>();
  for (const c of claims) {
    leagueSet.add(c.league_id);
    if (!seenBudget.has(c.league_id)) {
      seenBudget.add(c.league_id);
      budgets[String(c.budget)] = (budgets[String(c.budget)] ?? 0) + 1;
    }
    const list = byPlayer.get(c.player_id) ?? [];
    list.push(c);
    byPlayer.set(c.player_id, list);
  }

  const sleeper = await import("@/lib/data/sleeper.server");
  const prices: WirePrice[] = [...byPlayer.entries()]
    .map(([player_id, list]) => {
      const shares = list.map((c) => pct(c.bid, c.budget)).sort((a, b) => a - b);
      const remaining = list.map((c) => pct(c.bid, c.remaining_before)).sort((a, b) => a - b);
      const budgetsHere = new Set(list.map((c) => c.budget));
      const p = sleeper.getPlayer(player_id);
      return {
        player_id,
        name: p?.full_name ?? null,
        position: p?.position ?? null,
        n: list.length,
        median_pct: quantile(shares, 0.5),
        p25_pct: quantile(shares, 0.25),
        p75_pct: quantile(shares, 0.75),
        max_pct: shares[shares.length - 1] ?? 0,
        median_pct_remaining: quantile(remaining, 0.5),
        dollars:
          budgetsHere.size === 1
            ? {
                budget: list[0]?.budget ?? 0,
                median: quantile(
                  list.map((c) => c.bid).sort((a, b) => a - b),
                  0.5,
                ),
              }
            : null,
      };
    })
    .sort((a, b) => b.median_pct - a.median_pct || b.n - a.n);

  return {
    season,
    week,
    leagues: leagueSet.size,
    budgets,
    cohort,
    computedAt: new Date().toISOString(),
    prices,
  };
}
