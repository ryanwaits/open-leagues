import type { Projection, RosterPlayer } from "@/lib/data/types";
import { fillLineup } from "@/lib/league/lineup-value";
import { invertSlotKey } from "@/lib/league/roster";
import type { SourceCall } from "./sources";

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
  /** What each pre-kickoff source would have called. Filled by the receipt. */
  sources?: SourceCall[];
  /** "Sleeper projection said start X; Last 3 weeks said hold Y." */
  sourceLine?: string | null;
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

  // Who should have been in, who should have been out. A miss must be a legal
  // swap, and the optimal lineup already encodes the legal moves: the bench
  // player took slot X; whoever held X either sat (a direct swap) or moved to
  // slot Y in the optimal, displacing whoever held Y, and so on until a
  // starter is out. Follow that chain and pair the bench player with the
  // starter it finally displaced. A bench RB in a league with no FLEX can never
  // reach a WR; with a FLEX it can, through the shuffle a real manager would make.
  const optimalIds = new Set(optimal.slots.map((s) => s.player?.player_id).filter(Boolean));
  const startedIds = new Set(starters.map((p) => p.player_id));
  const pool = (slotLabel: string | undefined | null) => invertSlotKey(slotLabel ?? "");
  const actualByPool = new Map<string, RosterPlayer[]>();
  for (const p of starters) {
    const k = pool(p.starterSlot);
    actualByPool.set(k, [...(actualByPool.get(k) ?? []), p]);
  }
  const optimalPoolOf = new Map<string, string>();
  for (const s of optimal.slots) if (s.player) optimalPoolOf.set(s.player.player_id, pool(s.slot));

  const shouldHaveStarted = optimal.slots
    .filter((s) => s.player && !startedIds.has(s.player.player_id))
    .sort((a, b) => b.points - a.points);

  const taken = new Set<string>();
  const displacedFrom = (startPool: string): RosterPlayer | null => {
    const seen = new Set<string>();
    const queue = [startPool];
    while (queue.length) {
      const k = queue.shift() as string;
      if (seen.has(k)) continue;
      seen.add(k);
      const held = actualByPool.get(k) ?? [];
      const out = held
        .filter((p) => !optimalIds.has(p.player_id) && !taken.has(p.player_id))
        .sort((a, b) => (a.weekPts ?? 0) - (b.weekPts ?? 0))[0];
      if (out) return out;
      for (const p of held) {
        const moved = optimalPoolOf.get(p.player_id);
        if (moved && moved !== k) queue.push(moved);
      }
    }
    return null;
  };

  const misses: BenchMiss[] = [];
  for (const slot of shouldHaveStarted) {
    if (!slot.player) continue;
    const started = displacedFrom(pool(slot.slot));
    if (!started) continue; // nobody legal to have sat for him; `left` still counts it
    taken.add(started.player_id);
    const startedPts = started.weekPts ?? 0;
    const cost = round1(slot.points - startedPts);
    if (cost <= 0) continue;
    misses.push({
      slot:
        pool(slot.slot) === pool(started.starterSlot)
          ? (started.starterSlot ?? slot.slot)
          : slot.slot,
      started: { playerId: started.player_id, name: label(started), points: round1(startedPts) },
      best: {
        playerId: slot.player.player_id,
        name: label(slot.player),
        points: round1(slot.points),
      },
      cost,
    });
  }
  misses.sort((a, b) => b.cost - a.cost);

  return {
    actual: round1(actual),
    optimal: round1(optimal.total),
    left: round1(Math.max(0, optimal.total - actual)),
    misses,
  };
}
