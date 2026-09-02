import type { MatchupPair } from "@/lib/data/types";
import { fromSleeperSettings, type ScoringBook } from "@/lib/league/scoring";

/** How often a live week re-reads scores. */
export const LIVE_POLL_MS = 15_000;

/** A pairing is live when any starter's game is in progress. */
export function pairingIsLive(pair: MatchupPair): boolean {
  return [pair.home, pair.away].some((side) =>
    side?.starters.some((line) => line.game?.state === "in"),
  );
}

/** The league's scoring settings as a book the scorer can apply. */
export function bookFromLeague(settings?: Record<string, number> | null): ScoringBook {
  return fromSleeperSettings(settings);
}
