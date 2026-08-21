import { canonTeam, teamKeys } from "./teams";
import type { GameChip, ScoreGame } from "./types";

export function indexGames(games: ScoreGame[]): Map<string, GameChip> {
  const out = new Map<string, GameChip>();
  for (const g of games) {
    const homeAbbr = canonTeam(g.home.abbr) ?? g.home.abbr.toUpperCase();
    const awayAbbr = canonTeam(g.away.abbr) ?? g.away.abbr.toUpperCase();
    const live =
      g.state === "in"
        ? {
            possession: g.possession ?? null,
            situation: g.situation ?? null,
            redZone: Boolean(g.redZone),
          }
        : { possession: null, situation: null, redZone: false };
    const hs = Number(g.home.score);
    const as = Number(g.away.score);
    const have = Number.isFinite(hs) && Number.isFinite(as);
    const homeChip: GameChip = {
      state: g.state,
      detail: g.detail,
      opp: `vs ${awayAbbr}`,
      gameId: g.id,
      ...live,
      margin: have ? hs - as : null,
    };
    const awayChip: GameChip = {
      state: g.state,
      detail: g.detail,
      opp: `@ ${homeAbbr}`,
      gameId: g.id,
      ...live,
      margin: have ? as - hs : null,
    };
    for (const key of teamKeys(g.home.abbr)) out.set(key, homeChip);
    for (const key of teamKeys(g.away.abbr)) out.set(key, awayChip);
  }
  return out;
}

export function gameForTeam(
  index: Map<string, GameChip>,
  team: string | null | undefined,
): GameChip | null {
  if (!team) return null;
  const u = team.toUpperCase();
  return index.get(u) ?? index.get(canonTeam(u) ?? u) ?? null;
}
