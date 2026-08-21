import type { RosterPlayer } from "@/lib/data/types";
import type { TradeDelta } from "./lineup-value";

/**
 * One sentence about a trade.
 *
 * Everything here is arrangement: the app computes the numbers, and this picks
 * the two or three worth saying. Deliberately deterministic rather than a model
 * call — the sentence is short, the inputs are numeric, and a language model
 * would add latency and a chance of inventing a figure that is not in the data.
 * If a fuller read is ever wanted, this is the function to swap.
 *
 * It never evaluates. "+2.1 projected" is a fact; "you win this trade" is not
 * something the projection can support.
 */
export function readTrade(input: {
  delta: TradeDelta;
  /** Players entering and leaving, for bye and injury notes. */
  incoming: RosterPlayer[];
  outgoing: RosterPlayer[];
  byes?: Record<string, number>;
  week?: number;
}): string {
  const { delta, incoming, byes, week } = input;
  const clauses: string[] = [];

  if (delta.change === 0) {
    clauses.push("no change to your starters");
  } else {
    const sign = delta.change > 0 ? "+" : "";
    clauses.push(`${sign}${delta.change.toFixed(1)} a week to your starters`);
  }

  let bestGain: (typeof delta.changed)[number] | null = null;
  let bestLoss: (typeof delta.changed)[number] | null = null;
  for (const row of delta.changed) {
    if (row.delta > 0.05 && (!bestGain || row.delta > bestGain.delta)) {
      bestGain = row;
    }
    if (row.delta < 0 && (!bestLoss || row.delta < bestLoss.delta)) {
      bestLoss = row;
    }
  }

  if (bestGain?.to) {
    clauses.push(
      `${shortName(bestGain.to)} upgrades ${bestGain.slot} by ${bestGain.delta.toFixed(1)}`,
    );
  }

  if (bestLoss) {
    if (!bestLoss.to) {
      clauses.push(`${bestLoss.slot} is left empty`);
    } else {
      const cost = Math.abs(bestLoss.delta).toFixed(1);
      clauses.push(`${shortName(bestLoss.to)} has to cover ${bestLoss.slot}, which costs ${cost}`);
    }
  }

  const caveat = pickCaveat(incoming, byes, week);
  if (caveat) clauses.push(caveat);

  // Cap: three clauses + one caveat (caveat already at most one).
  const body = clauses.slice(0, 4);
  if (body.length === 0) return "no change to your starters.";
  return `${body.join("; ")}.`;
}

function shortName(p: RosterPlayer): string {
  const last = p.last_name?.trim();
  if (last) return last;
  const parts = p.full_name.trim().split(/\s+/);
  return parts[parts.length - 1] || p.full_name;
}

function pickCaveat(
  incoming: RosterPlayer[],
  byes: Record<string, number> | undefined,
  week: number | undefined,
): string | null {
  if (byes && week != null) {
    for (const p of incoming) {
      const team = p.team?.toUpperCase();
      if (!team) continue;
      const bye = byes[team];
      if (bye == null) continue;
      if (bye >= week && bye - week <= 3) {
        return `${shortName(p)} is on a bye in week ${bye}`;
      }
    }
  }

  for (const p of incoming) {
    const status = p.injury_status?.trim();
    if (status) {
      return `${shortName(p)} is listed ${status}`;
    }
  }

  return null;
}
