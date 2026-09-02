import type { Projection, RosterPlayer } from "@/lib/data/types";
import { fillLineup } from "@/lib/league/lineup-value";

/**
 * The bench receipt: what you started against the best lineup you could have
 * set, scored on what actually happened. Hindsight, on purpose — a projection
 * is an opinion, a box score is a fact, and the receipt is about facts.
 */
export type BenchMiss = {
  slot: string;
  started: { playerId: string; name: string; points: number } | null;
  best: { playerId: string; name: string; points: number };
  cost: number;
};

export type BenchReceipt = {
  /** Points the starters actually scored. */
  actual: number;
  /** Points the best possible lineup would have scored. */
  optimal: number;
  /** optimal − actual, never negative. */
  left: number;
  /** Slots where a different player would have scored more, biggest first. */
  misses: BenchMiss[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function label(p: RosterPlayer): string {
  return p.full_name ?? p.player_id;
}

/**
 * `players` is the whole roster for the week with `weekPts` filled and
 * `starterSlot` set on the players who actually started. `rosterPositions` is
 * the league's slot list (BN/IR are ignored by the filler).
 */
export function benchReceipt(players: RosterPlayer[], rosterPositions: string[]): BenchReceipt {
  const actualPts: Record<string, Projection> = {};
  for (const p of players) actualPts[p.player_id] = { points: p.weekPts ?? 0, reason: null };

  const eligible = players.filter((p) => p.slot === "starter" || p.slot === "bench");
  const optimal = fillLineup(eligible, rosterPositions, actualPts);

  const starters = players.filter((p) => p.slot === "starter");
  const actual = starters.reduce((n, p) => n + (p.weekPts ?? 0), 0);

  // Who should have been in, who should have been out. The filler may shuffle
  // players between slots, so pair by rank rather than by slot label: the best
  // player who sat against the weakest player who started.
  const optimalIds = new Set(optimal.slots.map((s) => s.player?.player_id).filter(Boolean));
  const startedIds = new Set(starters.map((p) => p.player_id));
  const shouldHaveStarted = optimal.slots
    .filter((s) => s.player && !startedIds.has(s.player.player_id))
    .sort((a, b) => b.points - a.points);
  const shouldHaveSat = starters
    .filter((p) => !optimalIds.has(p.player_id))
    .sort((a, b) => (a.weekPts ?? 0) - (b.weekPts ?? 0));

  const misses: BenchMiss[] = [];
  shouldHaveStarted.forEach((slot, i) => {
    if (!slot.player) return;
    const started = shouldHaveSat[i] ?? null;
    const startedPts = started?.weekPts ?? 0;
    const cost = round1(slot.points - startedPts);
    if (cost <= 0) return;
    misses.push({
      slot: started?.starterSlot ?? slot.slot,
      started: started
        ? { playerId: started.player_id, name: label(started), points: round1(startedPts) }
        : null,
      best: {
        playerId: slot.player.player_id,
        name: label(slot.player),
        points: round1(slot.points),
      },
      cost,
    });
  });
  misses.sort((a, b) => b.cost - a.cost);

  return {
    actual: round1(actual),
    optimal: round1(optimal.total),
    left: round1(Math.max(0, optimal.total - actual)),
    misses,
  };
}
