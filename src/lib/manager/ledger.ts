/**
 * Pure move-ledger math. No I/O. A week of Sleeper txs plus a FAAB budget
 * becomes ordered rows with remaining_before reconstructed from earlier wins.
 */

export type MoveType = "waiver_won" | "waiver_lost" | "fa" | "drop";

export type SleeperTx = {
  transaction_id: string;
  type: string;
  status: string;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  roster_ids?: number[];
  settings?: { waiver_bid?: number; seq?: number } | null;
};

export type MoveSeed = {
  txId: string;
  week: number;
  rosterId: number;
  type: MoveType;
  playerId: string;
  dropPlayerId: string | null;
  bid: number | null;
  seq: number;
};

export type MoveRow = MoveSeed & {
  remainingBefore: number;
  budget: number;
  sleeperProj: number | null;
  last3: number | null;
  seasonAvg: number | null;
  actual: number | null;
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return round1(xs.reduce((a, b) => a + b, 0) / xs.length);
}

export function lastN(xs: number[], n: number): number | null {
  return mean(xs.slice(-n));
}

/** Past seasons, and prior weeks of the current season, are frozen. */
export function weekIsFrozen(
  season: string,
  week: number,
  nfl: { season: string | number; week: number; display_week?: number },
): boolean {
  const curSeason = String(nfl.season);
  if (season < curSeason) return true;
  if (season > curSeason) return false;
  const cur = nfl.display_week ?? nfl.week;
  return week < cur;
}

export function seedsFromTxs(week: number, txs: SleeperTx[]): MoveSeed[] {
  const out: MoveSeed[] = [];
  for (const tx of txs) {
    const adds = Object.entries(tx.adds ?? {});
    const drops = Object.entries(tx.drops ?? {});
    const dropByRoster = new Map<number, string>();
    for (const [pid, rid] of drops) dropByRoster.set(rid, pid);
    const seq = tx.settings?.seq ?? 0;
    const bid = typeof tx.settings?.waiver_bid === "number" ? tx.settings.waiver_bid : null;

    if (tx.type === "waiver" && adds.length) {
      const type: MoveType = tx.status === "complete" ? "waiver_won" : "waiver_lost";
      if (tx.status !== "complete" && tx.status !== "failed") continue;
      for (const [pid, rid] of adds) {
        out.push({
          txId: tx.transaction_id,
          week,
          rosterId: rid,
          type,
          playerId: pid,
          dropPlayerId: dropByRoster.get(rid) ?? null,
          bid,
          seq,
        });
      }
      continue;
    }

    if (tx.type === "free_agent" && tx.status === "complete" && adds.length) {
      for (const [pid, rid] of adds) {
        out.push({
          txId: tx.transaction_id,
          week,
          rosterId: rid,
          type: "fa",
          playerId: pid,
          dropPlayerId: dropByRoster.get(rid) ?? null,
          bid: 0,
          seq,
        });
      }
      continue;
    }

    if (tx.status === "complete" && adds.length === 0 && drops.length) {
      for (const [pid, rid] of drops) {
        out.push({
          txId: tx.transaction_id,
          week,
          rosterId: rid,
          type: "drop",
          playerId: pid,
          dropPlayerId: pid,
          bid: 0,
          seq,
        });
      }
    }
  }
  return out;
}

/**
 * Walk weeks in order. Winning waiver bids spend; lost claims, FA, and drops
 * do not. remaining_before is what that roster had when the bid was filed.
 */
export function attachRemaining(budget: number, seeds: MoveSeed[]): MoveRow[] {
  const spent = new Map<number, number>();
  const byWeek = new Map<number, MoveSeed[]>();
  for (const s of seeds) {
    const list = byWeek.get(s.week) ?? [];
    list.push(s);
    byWeek.set(s.week, list);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const out: MoveRow[] = [];
  for (const week of weeks) {
    const rows = (byWeek.get(week) ?? []).slice();
    rows.sort((a, b) => {
      const aWon = a.type === "waiver_won" ? 0 : 1;
      const bWon = b.type === "waiver_won" ? 0 : 1;
      if (aWon !== bWon) return aWon - bWon;
      return a.seq - b.seq;
    });
    for (const s of rows) {
      const remainingBefore = Math.max(0, budget - (spent.get(s.rosterId) ?? 0));
      if (s.type === "waiver_won" && typeof s.bid === "number") {
        spent.set(s.rosterId, (spent.get(s.rosterId) ?? 0) + s.bid);
      }
      out.push({
        ...s,
        remainingBefore,
        budget,
        sleeperProj: null,
        last3: null,
        seasonAvg: null,
        actual: null,
      });
    }
  }
  return out;
}

export function spentOf(budget: number, rows: MoveRow[], rosterId: number): number {
  let spent = 0;
  for (const r of rows) {
    if (r.rosterId !== rosterId) continue;
    if (r.type === "waiver_won" && typeof r.bid === "number") spent += r.bid;
  }
  return Math.min(budget, spent);
}

export function joinSources(
  rows: MoveRow[],
  weeklyPts: Record<number, Record<string, number>>,
  weeklyProj: Record<number, Record<string, number>>,
  throughWeek: number,
): MoveRow[] {
  return rows.map((r) => {
    const prior: number[] = [];
    for (let w = 1; w < r.week; w++) {
      const p = weeklyPts[w]?.[r.playerId];
      if (typeof p === "number") prior.push(p);
    }
    const actual = r.week < throughWeek ? (weeklyPts[r.week]?.[r.playerId] ?? null) : null;
    return {
      ...r,
      sleeperProj: weeklyProj[r.week]?.[r.playerId] ?? null,
      last3: lastN(prior, 3),
      seasonAvg: mean(prior),
      actual: actual == null ? null : round1(actual),
    };
  });
}
