import { applyBook } from "@/lib/league/scoring";
import type { SourceValues } from "./sources";

/**
 * The three open sources, valued under the league's own book:
 *   sleeper_proj — Sleeper's weekly projection for that week (they keep history)
 *   last3        — mean of the player's actual points over the three prior weeks
 *   season_avg   — mean over every prior week of the season
 * All three were knowable before kickoff, which is the whole point.
 */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function sourceValues(input: {
  leagueId: string;
  season: string;
  week: number;
  playerIds: string[];
}): Promise<Record<string, SourceValues>> {
  const ids = [...new Set(input.playerIds)];
  const out: Record<string, SourceValues> = {};
  for (const id of ids) out[id] = { sleeper_proj: null, last3: null, season_avg: null };
  if (ids.length === 0) return out;

  const { scoringBookFor } = await import("@/lib/data/projections.server");
  const book = await scoringBookFor(input.leagueId);

  // Sleeper's projection for that week, refreshed on demand (throttled).
  try {
    const feed = await import("@/lib/data/projection-feed.server");
    let rows = await feed.projectionsFor(input.season, input.week, ids);
    if (Object.keys(rows).length === 0) {
      await feed.refreshProjections(input.season, input.week);
      rows = await feed.projectionsFor(input.season, input.week, ids);
    }
    for (const id of ids) {
      const bag = rows[id];
      if (bag) out[id].sleeper_proj = round1(applyBook(book, bag));
    }
  } catch {
    /* no projection is an honest null */
  }

  // Actual points in prior weeks, under this book.
  try {
    const live = await import("@/lib/data/live.server");
    const prior = Array.from({ length: Math.max(0, input.week - 1) }, (_, i) => i + 1);
    const weekly = await Promise.all(
      prior.map((w) =>
        live
          .fetchWeekStats(input.season, w, "regular")
          .catch((): Record<string, Record<string, number>> => ({})),
      ),
    );
    for (const id of ids) {
      const pts: number[] = [];
      for (const stats of weekly) {
        const bag = stats[id];
        if (bag && Object.keys(bag).length) pts.push(applyBook(book, bag));
      }
      if (pts.length) {
        out[id].season_avg = round1(pts.reduce((a, b) => a + b, 0) / pts.length);
        const tail = pts.slice(-3);
        out[id].last3 = round1(tail.reduce((a, b) => a + b, 0) / tail.length);
      }
    }
  } catch {
    /* stats down — leave the nulls */
  }

  return out;
}
