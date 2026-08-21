import type { NflState } from "./types";

export type NflCalendar = {
  season: string;
  seasonNum: number;
  previous: string;
  kind: "pre" | "regular" | "post";
  week: number;
};

/** Fantasy weeks 1–18 always score the regular NFL slate (even in August). */
export function fantasyStatKind(): "regular" {
  return "regular";
}

export function calendarOf(state: NflState): NflCalendar {
  const seasonNum = Number(state.season);
  const previous = String(
    state.previous_season || (Number.isFinite(seasonNum) ? seasonNum - 1 : seasonNum),
  );
  const kind: NflCalendar["kind"] =
    state.season_type === "pre" || state.season_type === "post" ? state.season_type : "regular";
  return {
    season: String(state.season),
    seasonNum: Number.isFinite(seasonNum) ? seasonNum : new Date().getUTCFullYear(),
    previous,
    kind,
    week: Math.max(1, state.display_week || state.week || 1),
  };
}

export function recentSeasons(state: NflState, count = 3): string[] {
  const y = Number(state.season);
  const start = Number.isFinite(y) ? y : new Date().getUTCFullYear();
  return Array.from({ length: count }, (_, i) => String(start - i));
}
