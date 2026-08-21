/** Pure playoff math — used by the engine and the settings preview. */

export function defaultPlayoffByes(playoffTeams: number): number {
  if (playoffTeams === 7) return 1;
  if (playoffTeams === 6) return 2;
  if (playoffTeams === 5) return 1;
  return 0;
}

export function clampPlayoffByes(playoffTeams: number, byes: number): number {
  const n = Math.max(2, Math.min(8, Math.floor(playoffTeams)));
  const max = Math.max(0, n - 2);
  return Math.max(0, Math.min(max, Math.floor(byes)));
}

/** 1-indexed seed pairings for week 1. Highest remaining vs lowest. */
export function firstRoundSeeds(
  playoffTeams: number,
  byes: number,
): {
  games: Array<[number, number]>;
  byes: number[];
} {
  const n = Math.max(2, Math.min(8, Math.floor(playoffTeams)));
  const byeCount = clampPlayoffByes(n, byes);
  const byeSeeds = Array.from({ length: byeCount }, (_, i) => i + 1);
  const playing = Array.from({ length: n - byeCount }, (_, i) => byeCount + 1 + i);
  if (playing.length % 2 === 1) {
    const extra = playing.shift();
    if (extra != null) byeSeeds.push(extra);
  }
  const games: Array<[number, number]> = [];
  for (let i = 0; i < playing.length / 2; i++) {
    games.push([playing[i]!, playing[playing.length - 1 - i]!]);
  }
  return { games, byes: byeSeeds };
}

/** How many NFL weeks the dance lasts. */
export function playoffRoundCount(playoffTeams: number, byes: number): number {
  let alive = Math.max(2, Math.min(8, Math.floor(playoffTeams)));
  let remainingByes = clampPlayoffByes(alive, byes);
  let rounds = 0;
  while (alive > 1 && rounds < 6) {
    rounds += 1;
    const playing = alive - remainingByes;
    const even = playing - (playing % 2);
    const leftover = playing % 2;
    alive = remainingByes + leftover + even / 2;
    remainingByes = 0;
  }
  return Math.max(1, rounds);
}

export function playoffRoundLabel(
  round: number,
  playoffTeams: number,
  byes: number,
  isBye: boolean,
): string {
  if (isBye) return "Bye";
  const total = playoffRoundCount(playoffTeams, byes);
  if (round >= total) return "Championship";
  if (round === total - 1) return "Semifinal";
  return "Wild card";
}

export function describeBracket(playoffTeams: number, byes: number, startWeek: number): string {
  const first = firstRoundSeeds(playoffTeams, byes);
  const games = first.games.map(([a, b]) => `${a}v${b}`).join(" · ");
  const byeBit = first.byes.length ? ` · #${first.byes.join(", #")} bye` : "";
  const champ = startWeek + playoffRoundCount(playoffTeams, byes) - 1;
  const week1 = games ? `Week ${startWeek}: ${games}${byeBit}` : `Week ${startWeek}`;
  return `${week1}. Reseed each round. Championship week ${champ}.`;
}
