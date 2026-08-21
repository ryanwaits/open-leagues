import { gameForTeam, indexGames } from "./game-index";

export { gameForTeam, indexGames };

export function seasonTypeNum(seasonType?: string | null): number {
  if (seasonType === "pre") return 1;
  if (seasonType === "post") return 3;
  return 2;
}

const pointsCache = new Map<string, { at: number; data: Record<string, number> }>();
const statsCache = new Map<string, { at: number; data: Record<string, Record<string, number>> }>();
const statsInflight = new Map<string, Promise<Record<string, Record<string, number>>>>();

function weekStatsTtlMs(season: string): number {
  const year = Number(season);
  if (Number.isFinite(year) && year < new Date().getFullYear()) return 6 * 60 * 60 * 1000;
  return 12_000;
}

/** Unofficial Sleeper weekly points. Short TTL so Sunday games tick. */
export async function fetchWeekPoints(
  season: string,
  week: number,
  scoring: "ppr" | "half" | "std" | string,
  seasonType: string = "regular",
): Promise<Record<string, number>> {
  const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
  const key = `${kind}:${season}:${week}:${scoring}`;
  const hit = pointsCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const raw = await fetchWeekStats(season, week, kind);
  const statKey = scoring === "std" ? "pts_std" : scoring === "half" ? "pts_half_ppr" : "pts_ppr";
  const data: Record<string, number> = {};
  for (const [id, row] of Object.entries(raw)) {
    const pts = row?.[statKey];
    if (typeof pts === "number") data[id] = pts;
  }
  pointsCache.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchWeekStats(
  season: string,
  week: number,
  seasonType: string = "regular",
): Promise<Record<string, Record<string, number>>> {
  const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
  const key = `raw:${kind}:${season}:${week}`;
  const hit = statsCache.get(key);
  if (hit && Date.now() - hit.at < weekStatsTtlMs(season)) return hit.data;
  const pending = statsInflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/${kind}/${season}/${week}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return hit?.data ?? {};
    const raw = ((await res.json()) as Record<string, Record<string, number>>) ?? {};
    statsCache.set(key, { at: Date.now(), data: raw });
    return raw;
  })();
  statsInflight.set(key, job);
  try {
    return await job;
  } finally {
    statsInflight.delete(key);
  }
}

const seasonCache = new Map<string, { at: number; data: Record<string, Record<string, number>> }>();

/** Full-season Sleeper components. D/ST and K live here; the bundled seed strips them. */
export async function fetchSeasonStats(
  season: string,
  seasonType: string = "regular",
): Promise<Record<string, Record<string, number>>> {
  const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
  const key = `season:${kind}:${season}`;
  const hit = seasonCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.data;
  const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/${kind}/${season}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return hit?.data ?? {};
  const raw = ((await res.json()) as Record<string, Record<string, number>>) ?? {};
  const data: Record<string, Record<string, number>> = {};
  for (const [id, row] of Object.entries(raw)) {
    if (!row || id.startsWith("TEAM_")) continue;
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "number" && Number.isFinite(v)) nums[k] = v;
    }
    data[id] = nums;
  }
  seasonCache.set(key, { at: Date.now(), data });
  return data;
}

const boardCache = new Map<
  string,
  { at: number; data: Awaited<ReturnType<typeof weekBoardUncached>> }
>();

async function weekBoardUncached(season: string, week: number, seasonType?: string | null) {
  const espn = await import("./espn.server");
  const board = await espn.fetchScoreboard({
    week,
    season: Number(season) || undefined,
    seasonType: seasonTypeNum(seasonType),
  });
  const index = indexGames(board.games);
  return {
    live: board.games.some((g) => g.state === "in"),
    index,
    games: board.games,
  };
}

export async function weekBoard(season: string, week: number, seasonType?: string | null) {
  const key = `${season}:${week}:${seasonType ?? ""}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const data = await weekBoardUncached(season, week, seasonType);
  boardCache.set(key, { at: Date.now(), data });
  return data;
}
