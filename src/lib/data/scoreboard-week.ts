/** ESPN season-type numbers. Omit (undefined) to let the scoreboard pick current. */
export type ScoreboardKind = "pre" | "regular" | "post";

export type ScoreboardNow = {
  week: number;
  season: number;
  seasonType: ScoreboardKind;
};

export type ScoreboardSearch = {
  week?: number;
  season?: number;
  kind?: ScoreboardKind;
};

export function seasonTypeNum(kind: ScoreboardKind | undefined): number | undefined {
  if (kind === "pre") return 1;
  if (kind === "post") return 3;
  if (kind === "regular") return 2;
  return undefined;
}

/**
 * Which scoreboard tab to show.
 *
 * ESPN's unfiltered board is the current NFL week (pre week 3 in August, not
 * Sleeper's display_week). A kind toggle that is the current season type stays
 * on that week; a kind that is not yet/no longer current opens week 1 of that
 * slate instead of carrying the previous week number across.
 */
export function resolveScoreboard(
  search: ScoreboardSearch,
  now: ScoreboardNow | null | undefined,
): ScoreboardNow | null {
  const kind = search.kind ?? now?.seasonType;
  const season = search.season ?? now?.season;
  if (!kind || season == null || !Number.isFinite(season)) return null;
  const week = search.week ?? (now && kind === now.seasonType ? now.week : now ? 1 : undefined);
  if (week == null || !Number.isFinite(week) || week < 1) return null;
  return { week, season, seasonType: kind };
}

export function asScoreboardKind(value: string | null | undefined): ScoreboardKind | undefined {
  if (value === "pre" || value === "regular" || value === "post") return value;
  return undefined;
}

export function scoreboardIsNow(
  cursor: ScoreboardNow | null | undefined,
  now: ScoreboardNow | null | undefined,
): boolean {
  if (!cursor || !now) return false;
  return (
    cursor.seasonType === now.seasonType && cursor.week === now.week && cursor.season === now.season
  );
}
