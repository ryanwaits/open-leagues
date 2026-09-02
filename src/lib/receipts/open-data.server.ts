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
  await sql.query(`create table if not exists ol_wire_prices (
  season text not null,
  week int not null,
  computed_at timestamptz not null default now(),
  leagues int not null,
  prices_json text not null,
  primary key (season, week)
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

export type WirePrice = {
  player_id: string;
  name: string | null;
  position: string | null;
  /** Winning bids across leagues, in dollars. */
  n: number;
  median: number;
  p25: number;
  p75: number;
  max: number;
};

export type WirePrices = {
  season: string;
  week: number;
  /** Leagues that contributed at least one cleared claim. */
  leagues: number;
  computedAt: string;
  prices: WirePrice[];
};

const PRICES_TTL_MS = 60 * 60 * 1000;
const MAX_LEAGUES = 400; // stay well under Sleeper's 1000/min per IP

type SleeperTx = {
  type: string;
  status: string;
  adds: Record<string, number> | null;
  settings: { waiver_bid?: number } | null;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const v = sorted[lo] ?? 0;
  const w = sorted[hi] ?? v;
  return Math.round((v + (w - v) * (pos - lo)) * 10) / 10;
}

async function computeWirePrices(season: string, week: number): Promise<WirePrices> {
  await ensure();
  const sql = await getSql();
  const leagues = await sql<{ league_id: string }>`
    select league_id from ol_pasted_leagues
    where season = ${season} or season is null
    order by last_seen desc
    limit ${MAX_LEAGUES}
  `;

  const bids = new Map<string, number[]>();
  let contributing = 0;
  await Promise.all(
    leagues.map(async ({ league_id }) => {
      try {
        const res = await fetch(
          `https://api.sleeper.app/v1/league/${league_id}/transactions/${week}`,
          {
            headers: { accept: "application/json" },
          },
        );
        if (!res.ok) return;
        const txs = (await res.json()) as SleeperTx[];
        let any = false;
        for (const t of txs) {
          if (t.type !== "waiver" || t.status !== "complete" || !t.adds) continue;
          const bid = t.settings?.waiver_bid;
          if (typeof bid !== "number") continue;
          for (const pid of Object.keys(t.adds)) {
            const list = bids.get(pid) ?? [];
            list.push(bid);
            bids.set(pid, list);
            any = true;
          }
        }
        if (any) contributing += 1;
      } catch {
        /* one league down is not a reason to have no prices */
      }
    }),
  );

  const sleeper = await import("@/lib/data/sleeper.server");
  const prices: WirePrice[] = [...bids.entries()]
    .map(([player_id, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      const p = sleeper.getPlayer(player_id);
      return {
        player_id,
        name: p?.full_name ?? null,
        position: p?.position ?? null,
        n: sorted.length,
        median: quantile(sorted, 0.5),
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1] ?? 0,
      };
    })
    .sort((a, b) => b.median - a.median || b.n - a.n);

  return { season, week, leagues: contributing, computedAt: new Date().toISOString(), prices };
}

/** Cached for an hour; the wire clears once a week, so this is generous. */
export async function wirePrices(season: string, week: number): Promise<WirePrices> {
  await ensure();
  const sql = await getSql();
  const hit = (
    await sql<{ computed_at: string; leagues: number; prices_json: string }>`
      select computed_at, leagues, prices_json from ol_wire_prices
      where season = ${season} and week = ${week}
    `
  )[0];
  if (hit && hit.leagues > 0 && Date.now() - new Date(hit.computed_at).getTime() < PRICES_TTL_MS) {
    return {
      season,
      week,
      leagues: hit.leagues,
      computedAt: new Date(hit.computed_at).toISOString(),
      prices: JSON.parse(hit.prices_json) as WirePrice[],
    };
  }
  const fresh = await computeWirePrices(season, week);
  // Nothing to say yet is not worth remembering for an hour.
  if (fresh.leagues === 0) return fresh;
  await sql`
    insert into ol_wire_prices (season, week, computed_at, leagues, prices_json)
    values (${season}, ${week}, now(), ${fresh.leagues}, ${JSON.stringify(fresh.prices)})
    on conflict (season, week) do update set
      computed_at = now(), leagues = excluded.leagues, prices_json = excluded.prices_json
  `;
  return fresh;
}
