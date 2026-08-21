export type TeamMeta = {
  abbr: string;
  city: string;
  nick: string;
  espn: string;
};

export const TEAMS: Record<string, TeamMeta> = {
  ARI: { abbr: "ARI", city: "Arizona", nick: "Cardinals", espn: "ari" },
  ATL: { abbr: "ATL", city: "Atlanta", nick: "Falcons", espn: "atl" },
  BAL: { abbr: "BAL", city: "Baltimore", nick: "Ravens", espn: "bal" },
  BUF: { abbr: "BUF", city: "Buffalo", nick: "Bills", espn: "buf" },
  CAR: { abbr: "CAR", city: "Carolina", nick: "Panthers", espn: "car" },
  CHI: { abbr: "CHI", city: "Chicago", nick: "Bears", espn: "chi" },
  CIN: { abbr: "CIN", city: "Cincinnati", nick: "Bengals", espn: "cin" },
  CLE: { abbr: "CLE", city: "Cleveland", nick: "Browns", espn: "cle" },
  DAL: { abbr: "DAL", city: "Dallas", nick: "Cowboys", espn: "dal" },
  DEN: { abbr: "DEN", city: "Denver", nick: "Broncos", espn: "den" },
  DET: { abbr: "DET", city: "Detroit", nick: "Lions", espn: "det" },
  GB: { abbr: "GB", city: "Green Bay", nick: "Packers", espn: "gb" },
  HOU: { abbr: "HOU", city: "Houston", nick: "Texans", espn: "hou" },
  IND: { abbr: "IND", city: "Indianapolis", nick: "Colts", espn: "ind" },
  JAX: { abbr: "JAX", city: "Jacksonville", nick: "Jaguars", espn: "jax" },
  KC: { abbr: "KC", city: "Kansas City", nick: "Chiefs", espn: "kc" },
  LV: { abbr: "LV", city: "Las Vegas", nick: "Raiders", espn: "lv" },
  LAC: { abbr: "LAC", city: "Los Angeles", nick: "Chargers", espn: "lac" },
  LAR: { abbr: "LAR", city: "Los Angeles", nick: "Rams", espn: "lar" },
  MIA: { abbr: "MIA", city: "Miami", nick: "Dolphins", espn: "mia" },
  MIN: { abbr: "MIN", city: "Minnesota", nick: "Vikings", espn: "min" },
  NE: { abbr: "NE", city: "New England", nick: "Patriots", espn: "ne" },
  NO: { abbr: "NO", city: "New Orleans", nick: "Saints", espn: "no" },
  NYG: { abbr: "NYG", city: "New York", nick: "Giants", espn: "nyg" },
  NYJ: { abbr: "NYJ", city: "New York", nick: "Jets", espn: "nyj" },
  PHI: { abbr: "PHI", city: "Philadelphia", nick: "Eagles", espn: "phi" },
  PIT: { abbr: "PIT", city: "Pittsburgh", nick: "Steelers", espn: "pit" },
  SF: { abbr: "SF", city: "San Francisco", nick: "49ers", espn: "sf" },
  SEA: { abbr: "SEA", city: "Seattle", nick: "Seahawks", espn: "sea" },
  TB: { abbr: "TB", city: "Tampa Bay", nick: "Buccaneers", espn: "tb" },
  TEN: { abbr: "TEN", city: "Tennessee", nick: "Titans", espn: "ten" },
  WAS: { abbr: "WAS", city: "Washington", nick: "Commanders", espn: "wsh" },
};

/** ESPN / historical codes that should resolve to a Sleeper team. */
const TEAM_ALIASES: Record<string, string> = {
  // ESPN play-by-play text spells a few clubs its own way.
  HST: "HOU",
  BLT: "BAL",
  CLV: "CLE",
  ARZ: "ARI",
  WSH: "WAS",
  WAS: "WAS",
  JAC: "JAX",
  JAX: "JAX",
  LA: "LAR",
  LAR: "LAR",
  STL: "LAR",
  OAK: "LV",
  LV: "LV",
  SD: "LAC",
  LAC: "LAC",
};

export function canonTeam(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const u = abbr.toUpperCase();
  return TEAM_ALIASES[u] ?? TEAMS[u]?.abbr ?? u;
}

/** Every code that should hit the same game chip. */
export function teamKeys(abbr: string | null | undefined): string[] {
  const canon = canonTeam(abbr);
  if (!canon) return [];
  const keys = new Set<string>([canon]);
  for (const [alias, target] of Object.entries(TEAM_ALIASES)) {
    if (target === canon) keys.add(alias);
  }
  return [...keys];
}

/** ESPN site-API team slug (`wsh` for WAS, `lar` for LAR). */
export function espnTeamSlug(abbr: string | null | undefined): string | null {
  const canon = canonTeam(abbr);
  if (!canon) return null;
  return TEAMS[canon]?.espn ?? canon.toLowerCase();
}

export function teamLogo(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const meta = TEAMS[canonTeam(abbr) ?? abbr.toUpperCase()];
  const slug = meta?.espn ?? abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`;
}

export function teamName(abbr: string | null | undefined): string {
  if (!abbr) return "FA";
  const meta = TEAMS[canonTeam(abbr) ?? abbr.toUpperCase()];
  return meta ? `${meta.city} ${meta.nick}` : abbr;
}

/** Nickname only — Packers, not GB or Green Bay Packers. */
export function teamNick(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  return TEAMS[canonTeam(abbr) ?? abbr.toUpperCase()]?.nick ?? null;
}

/** Roster/matchup label for a D/ST. */
export function dstLabel(abbr: string | null | undefined): string {
  const nick = teamNick(abbr);
  if (nick) return `${nick} D/ST`;
  return abbr ? `${abbr} D/ST` : "D/ST";
}

export function isDefense(pos?: string | null): boolean {
  return pos === "DEF" || pos === "DST";
}

/** NFL team for a player. D/ST ids are the team abbreviation. */
export function playerTeam(
  player: { position?: string | null; team?: string | null; player_id?: string } | null | undefined,
): string | null {
  if (!player) return null;
  if (player.team) return canonTeam(player.team) ?? player.team;
  if (isDefense(player.position)) return canonTeam(player.player_id) ?? player.player_id ?? null;
  return null;
}

export function playerHeadshot(playerId: string, espnId?: string | number | null): string {
  if (espnId) {
    return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

export function sleeperAvatar(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("http")) return avatar;
  return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
}

export const SLOT_LABEL: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  FLEX: "FLX",
  SUPER_FLEX: "SF",
  WRRB_FLEX: "W/R",
  REC_FLEX: "W/T",
  IDP_FLEX: "IDP",
  K: "K",
  DEF: "DST",
  DL: "DL",
  LB: "LB",
  DB: "DB",
  BN: "BN",
  IR: "IR",
  TAXI: "TAXI",
};

export function slotLabel(slot: string): string {
  return SLOT_LABEL[slot] ?? slot;
}

/**
 * The slot without its ordinal — `RB2` → `RB`, `WR3` → `WR`.
 *
 * The number distinguishes one roster spot from another, which is what you need
 * when you are putting a player into one. On a board you are only reading, the
 * rows are already in order, so the second RB is evidently the second RB and the
 * digit is just a smaller thing to read. Display only: the numbered label is
 * still the identity everything else matches on.
 */
export function baseSlotLabel(slot: string | null | undefined): string {
  return (slot ?? "").replace(/\d+$/, "");
}

export const START_SLOTS = new Set([
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPER_FLEX",
  "WRRB_FLEX",
  "REC_FLEX",
  "IDP_FLEX",
  "K",
  "DEF",
  "DL",
  "LB",
  "DB",
]);
