import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slotBreakdown } from "@/lib/league/roster";
import { dstLabel, START_SLOTS, sleeperAvatar, slotLabel } from "./teams";
import type {
  ActivityItem,
  LeaderRow,
  LeagueBundle,
  LeagueSummary,
  MatchupPair,
  MatchupSide,
  NflState,
  RecapBlock,
  SleeperLeague,
  SleeperRoster,
  SleeperUser,
  SlimPlayer,
  SourceStatus,
  StandingRow,
  StarterLine,
  TeamBundle,
  TrendingPlayer,
  WirePlayer,
  WireScope,
} from "./types";

const SLEEPER = "https://api.sleeper.app/v1";
const mem = new Map<string, { at: number; data: unknown }>();

async function sget<T>(path: string, ttlMs: number): Promise<T> {
  const hit = mem.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const res = await fetch(`${SLEEPER}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper ${path} failed (${res.status})`);
  const data = (await res.json()) as T;
  mem.set(path, { at: Date.now(), data });
  return data;
}

let playersById: Record<string, SlimPlayer> | null = null;
let leaders2025: StatSeed[] | null = null;
let liveStats: StatSeed[] | null = null;
let liveStatsAt = 0;

type StatSeed = Omit<LeaderRow, keyof SlimPlayer> & { player_id: string };

function loadPlayers(): Record<string, SlimPlayer> {
  if (playersById) return playersById;
  playersById = JSON.parse(
    readFileSync(join(process.cwd(), "data/players-slim.json"), "utf8"),
  ) as Record<string, SlimPlayer>;
  return playersById;
}

function loadLeadersSeed(): StatSeed[] {
  if (leaders2025) return leaders2025;
  leaders2025 = JSON.parse(
    readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
  ) as StatSeed[];
  return leaders2025;
}

type RawStat = {
  pts_ppr?: number;
  pts_half_ppr?: number;
  pts_std?: number;
  gp?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  rush_yd?: number;
  rush_td?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  pos_rank_ppr?: number;
};

function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

async function fetchSeasonStatRows(season: string): Promise<StatSeed[]> {
  const raw = await sget<Record<string, RawStat>>(
    `/stats/nfl/regular/${season}`,
    6 * 60 * 60 * 1000,
  );
  const rows: StatSeed[] = [];
  for (const [player_id, s] of Object.entries(raw ?? {})) {
    if (!s || player_id.startsWith("TEAM_")) continue;
    if (typeof s.pts_ppr !== "number") continue;
    rows.push({
      player_id,
      pts_ppr: num(s.pts_ppr),
      pts_half_ppr: num(s.pts_half_ppr),
      pts_std: num(s.pts_std),
      gp: num(s.gp),
      pass_yd: num(s.pass_yd),
      pass_td: num(s.pass_td),
      pass_int: num(s.pass_int),
      rush_yd: num(s.rush_yd),
      rush_td: num(s.rush_td),
      rec: num(s.rec),
      rec_yd: num(s.rec_yd),
      rec_td: num(s.rec_td),
      pos_rank_ppr: typeof s.pos_rank_ppr === "number" ? s.pos_rank_ppr : null,
    });
  }
  rows.sort((a, b) => b.pts_ppr - a.pts_ppr);
  return rows;
}

async function loadStatRows(): Promise<StatSeed[]> {
  const now = Date.now();
  if (liveStats && now - liveStatsAt < 6 * 60 * 60 * 1000) return liveStats;
  try {
    const state = await fetchNflState();
    const season =
      state.season_type === "regular" && state.season_has_scores
        ? state.season
        : state.previous_season || String(Number(state.season) - 1);
    const rows = await fetchSeasonStatRows(season);
    if (rows.length > 40) {
      liveStats = rows;
      liveStatsAt = now;
      return rows;
    }
  } catch {
    /* seed */
  }
  return loadLeadersSeed();
}

export function getPlayer(id: string | null | undefined): SlimPlayer | null {
  if (!id || id === "0") return null;
  return loadPlayers()[id] ?? null;
}

export function playerName(id: string): string {
  const p = getPlayer(id);
  if (p?.full_name) return p.full_name;
  if (p?.position === "DEF" && p.team) return dstLabel(p.team);
  return id;
}

export async function fetchNflState(): Promise<NflState> {
  return sget<NflState>("/state/nfl", 60_000);
}

export async function lookupUser(query: string): Promise<{
  user: { user_id: string; username: string; display_name: string; avatar: string | null };
  leagues: LeagueSummary[];
} | null> {
  const q = query.trim();
  if (!q) return null;
  let user: {
    user_id: string;
    username: string;
    display_name: string;
    avatar: string | null;
  } | null = null;
  try {
    user = await sget(`/user/${encodeURIComponent(q)}`, 120_000);
  } catch {
    user = null;
  }
  if (!user?.user_id) return null;
  const state = await fetchNflState();
  const years = [
    String(state.season),
    String(state.previous_season || Number(state.season) - 1),
    String(Number(state.season) - 2),
  ].filter((y, i, arr) => y && arr.indexOf(y) === i);
  const lists = await Promise.all(
    years.map(async (season) => {
      try {
        return (
          (await sget<SleeperLeague[] | null>(
            `/user/${user!.user_id}/leagues/nfl/${season}`,
            60_000,
          )) ?? []
        );
      } catch {
        return [];
      }
    }),
  );
  return {
    user: {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
    },
    leagues: lists.flat().map((l) => ({
      league_id: l.league_id,
      name: l.name,
      season: l.season,
      status: l.status,
      total_rosters: l.total_rosters,
      avatar: l.avatar ?? null,
    })),
  };
}

export async function fetchLeague(leagueId: string): Promise<SleeperLeague> {
  return sget<SleeperLeague>(`/league/${leagueId}`, 60_000);
}

function pfOf(r: SleeperRoster): number {
  return (r.settings.fpts ?? 0) + (r.settings.fpts_decimal ?? 0) / 100;
}
function paOf(r: SleeperRoster): number {
  return (r.settings.fpts_against ?? 0) + (r.settings.fpts_against_decimal ?? 0) / 100;
}
function teamLabel(user: SleeperUser | undefined, rosterId: number) {
  const manager = user?.display_name ?? `Roster ${rosterId}`;
  return {
    teamName: user?.metadata?.team_name?.trim() || manager,
    manager,
    avatar: sleeperAvatar(user?.metadata?.avatar || user?.avatar),
  };
}
function scoringLabel(s: Record<string, number>): string {
  const rec = s.rec ?? 0;
  return [
    rec >= 0.9 ? "PPR" : rec >= 0.4 ? "Half PPR" : "Standard",
    s.pass_td === 6 ? "6pt pass TD" : s.pass_td === 4 ? "4pt pass TD" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
function formatLabel(league: SleeperLeague): string {
  const t = league.settings.type;
  const kind = t === 2 ? "Dynasty" : t === 1 ? "Keeper" : "Redraft";
  const bb = league.settings.best_ball ? "Best ball" : null;
  return [kind, `${league.settings.num_teams ?? league.total_rosters}-team`, bb]
    .filter(Boolean)
    .join(" · ");
}

type RawMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points?: number;
  starters?: string[];
  starters_points?: number[];
  players_points?: Record<string, number>;
};

export async function loadImportPack(leagueId: string): Promise<{
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  weeks: Array<{
    week: number;
    rows: Array<{
      roster_id: number;
      matchup_id: number | null;
      points: number;
      starters: string[];
      starters_points: number[];
    }>;
  }>;
}> {
  const id = leagueId.trim();
  const league = await fetchLeague(id);
  const [users, rosters] = await Promise.all([
    sget<SleeperUser[]>(`/league/${id}/users`, 60_000),
    sget<SleeperRoster[]>(`/league/${id}/rosters`, 30_000),
  ]);
  const last = Math.max(1, league.settings.last_scored_leg ?? league.settings.leg ?? 1);
  const weeks = [];
  for (let w = 1; w <= Math.min(18, last); w++) {
    try {
      const rows = await sget<RawMatchup[]>(`/league/${id}/matchups/${w}`, 120_000);
      weeks.push({
        week: w,
        rows: (rows ?? []).map((m) => ({
          roster_id: m.roster_id,
          matchup_id: m.matchup_id,
          points: m.points ?? 0,
          starters: m.starters ?? [],
          starters_points: m.starters_points ?? [],
        })),
      });
    } catch {
      weeks.push({ week: w, rows: [] });
    }
  }
  return { league, users, rosters, weeks };
}

export async function loadLeagueBundle(leagueId: string): Promise<LeagueBundle> {
  const [league, users, rosters, state] = await Promise.all([
    fetchLeague(leagueId),
    sget<SleeperUser[]>(`/league/${leagueId}/users`, 60_000),
    sget<SleeperRoster[]>(`/league/${leagueId}/rosters`, 30_000),
    fetchNflState(),
  ]);
  const byUser = new Map(users.map((u) => [u.user_id, u]));
  const standings: StandingRow[] = rosters
    .map((r) => {
      const label = teamLabel(r.owner_id ? byUser.get(r.owner_id) : undefined, r.roster_id);
      return {
        rosterId: r.roster_id,
        ownerId: r.owner_id,
        ...label,
        wins: r.settings.wins ?? 0,
        losses: r.settings.losses ?? 0,
        ties: r.settings.ties ?? 0,
        pf: pfOf(r),
        pa: paOf(r),
        waiverPos: r.settings.waiver_position ?? 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.pf - a.pf);
  const scored = league.settings.last_scored_leg ?? league.settings.leg;
  return {
    league,
    standings,
    currentWeek:
      league.season === state.season
        ? Math.max(1, state.display_week || state.week || 1)
        : Math.max(1, scored || 1),
    scoringLabel: scoringLabel(league.scoring_settings ?? {}),
    formatLabel: formatLabel(league),
    lineup: league.roster_positions?.length ? slotBreakdown(league.roster_positions) : null,
    hosted: false,
    myRosterId: null,
    isCommish: false,
    inviteCode: null,
    draftStatus: "none",
    locked: true,
    scoringLive: false,
  };
}

export async function loadMatchups(leagueId: string, week: number): Promise<MatchupPair[]> {
  const [league, users, rosters, raw] = await Promise.all([
    fetchLeague(leagueId),
    sget<SleeperUser[]>(`/league/${leagueId}/users`, 60_000),
    sget<SleeperRoster[]>(`/league/${leagueId}/rosters`, 30_000),
    sget<RawMatchup[]>(`/league/${leagueId}/matchups/${week}`, 20_000),
  ]);
  const byUser = new Map(users.map((u) => [u.user_id, u]));
  const byRoster = new Map(rosters.map((r) => [r.roster_id, r]));
  const startSlots = (league.roster_positions ?? []).filter((s) => START_SLOTS.has(s));
  function sideOf(m: RawMatchup): MatchupSide {
    const roster = byRoster.get(m.roster_id);
    const label = teamLabel(
      roster?.owner_id ? byUser.get(roster.owner_id) : undefined,
      m.roster_id,
    );
    const ids = m.starters ?? roster?.starters ?? [];
    const starters: StarterLine[] = startSlots.map((slot, i) => {
      const playerId = ids[i] && ids[i] !== "0" ? ids[i]! : null;
      const pts =
        m.starters_points?.[i] ?? (playerId ? (m.players_points?.[playerId] ?? null) : null);
      return {
        slot: slotLabel(slot),
        playerId,
        player: getPlayer(playerId),
        points: pts ?? null,
        game: null,
      };
    });
    return { rosterId: m.roster_id, ...label, points: m.points ?? 0, starters };
  }
  const groups = new Map<number, RawMatchup[]>();
  let orphan = 1000;
  for (const m of raw ?? []) {
    const key = m.matchup_id ?? orphan++;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  const pairs: MatchupPair[] = [];
  for (const [matchupId, arr] of groups) {
    const sorted = [...arr].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    pairs.push({
      matchupId,
      home: sideOf(sorted[0]!),
      away: sorted[1] ? sideOf(sorted[1]) : null,
    });
  }
  pairs.sort((a, b) => a.matchupId - b.matchupId);
  return pairs;
}

export async function loadTeam(
  leagueId: string,
  rosterId: number,
  week: number,
): Promise<TeamBundle> {
  const [league, users, rosters, raw] = await Promise.all([
    fetchLeague(leagueId),
    sget<SleeperUser[]>(`/league/${leagueId}/users`, 60_000),
    sget<SleeperRoster[]>(`/league/${leagueId}/rosters`, 30_000),
    sget<RawMatchup[]>(`/league/${leagueId}/matchups/${week}`, 20_000),
  ]);
  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!roster) throw new Error("Roster not found");
  const label = teamLabel(
    roster.owner_id ? users.find((u) => u.user_id === roster.owner_id) : undefined,
    rosterId,
  );
  const match = (raw ?? []).find((m) => m.roster_id === rosterId);
  const startSlots = (league.roster_positions ?? []).filter((s) => START_SLOTS.has(s));
  const starterIds = match?.starters ?? roster.starters ?? [];
  const ptsMap = match?.players_points ?? {};
  const reserve = new Set(roster.reserve ?? []);
  const taxi = new Set(roster.taxi ?? []);
  const starterSet = new Set(starterIds.filter((id) => id && id !== "0"));
  const players = (roster.players ?? []).map((id) => {
    const p = getPlayer(id);
    const idx = starterIds.indexOf(id);
    const slot = taxi.has(id)
      ? "taxi"
      : reserve.has(id)
        ? "ir"
        : starterSet.has(id)
          ? "starter"
          : "bench";
    return {
      ...(p ?? { player_id: id, full_name: id, position: null, team: null }),
      slot: slot as "starter" | "bench" | "ir" | "taxi",
      starterSlot: idx >= 0 ? slotLabel(startSlots[idx] ?? "FLEX") : undefined,
      weekPts: ptsMap[id] ?? null,
    };
  });
  players.sort((a, b) => {
    const order = { starter: 0, bench: 1, ir: 2, taxi: 3 };
    if (order[a.slot] !== order[b.slot]) return order[a.slot] - order[b.slot];
    return (b.weekPts ?? -1) - (a.weekPts ?? -1);
  });
  return {
    rosterId,
    ...label,
    record: {
      wins: roster.settings.wins ?? 0,
      losses: roster.settings.losses ?? 0,
      ties: roster.settings.ties ?? 0,
      pf: pfOf(roster),
      pa: paOf(roster),
    },
    players,
    week,
  };
}

export async function loadWire(
  leagueId: string,
  position: string,
  query: string,
  scope: WireScope = "available",
): Promise<WirePlayer[]> {
  const [rosters, users, seed] = await Promise.all([
    sget<SleeperRoster[]>(`/league/${leagueId}/rosters`, 30_000),
    sget<SleeperUser[]>(`/league/${leagueId}/users`, 60_000),
    loadStatRows(),
  ]);
  const byUser = new Map(users.map((u) => [u.user_id, u]));
  const ownerByPlayer = new Map<string, { rosterId: number; teamName: string }>();
  for (const r of rosters) {
    const teamName = teamLabel(
      r.owner_id ? byUser.get(r.owner_id) : undefined,
      r.roster_id,
    ).teamName;
    for (const id of r.players ?? []) {
      ownerByPlayer.set(id, { rosterId: r.roster_id, teamName });
    }
  }
  const q = query.trim().toLowerCase();
  const pos = position === "ALL" ? null : position;
  const pts = new Map(seed.map((s) => [s.player_id, s]));
  const seen = new Set<string>();
  const out: WirePlayer[] = [];

  const consider = (p: SlimPlayer | null, points: number | null, rank: number | null) => {
    if (!p || seen.has(p.player_id)) return;
    const ownedBy = ownerByPlayer.get(p.player_id) ?? null;
    // Imports have no waiver window we can read — unowned is a free agent.
    const availability = ownedBy ? "rostered" : "free_agent";
    if (scope === "available" && availability === "rostered") return;
    if (scope === "free_agent" && availability !== "free_agent") return;
    if (p.position === "DEF" && pos && pos !== "DEF") return;
    if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) return;
    if (
      q &&
      !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)
    )
      return;
    seen.add(p.player_id);
    out.push({ ...p, pts: points, rank, availability, ownedBy });
  };

  for (const s of seed) {
    const p = getPlayer(s.player_id);
    consider(p, s.pts_ppr ?? null, s.pos_rank_ppr ?? null);
  }
  if (scope === "all") {
    for (const id of ownerByPlayer.keys()) {
      const s = pts.get(id);
      consider(getPlayer(id), s?.pts_ppr ?? null, s?.pos_rank_ppr ?? null);
    }
  }
  out.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1) || a.full_name.localeCompare(b.full_name));
  return out;
}

export async function loadActivity(leagueId: string, week: number): Promise<ActivityItem[]> {
  type Tx = {
    transaction_id: string;
    type: string;
    status: string;
    created: number;
    adds?: Record<string, number>;
    drops?: Record<string, number>;
    roster_ids?: number[];
    settings?: { waiver_bid?: number };
  };
  const [users, rosters, raw] = await Promise.all([
    sget<SleeperUser[]>(`/league/${leagueId}/users`, 60_000),
    sget<SleeperRoster[]>(`/league/${leagueId}/rosters`, 30_000),
    sget<Tx[]>(`/league/${leagueId}/transactions/${week}`, 20_000),
  ]);
  const byUser = new Map(users.map((u) => [u.user_id, u]));
  const names = new Map<number, string>();
  for (const r of rosters) {
    const user = r.owner_id ? byUser.get(r.owner_id) : undefined;
    names.set(r.roster_id, teamLabel(user, r.roster_id).teamName);
  }
  const items = (raw ?? []).map((tx) => ({
    id: tx.transaction_id,
    type: tx.type,
    status: tx.status,
    created: tx.created,
    adds: Object.keys(tx.adds ?? {}).map((id) => {
      const p = getPlayer(id);
      return {
        playerId: id,
        name: playerName(id),
        pos: p?.position ?? null,
        team: p?.team ?? null,
      };
    }),
    drops: Object.keys(tx.drops ?? {}).map((id) => {
      const p = getPlayer(id);
      return {
        playerId: id,
        name: playerName(id),
        pos: p?.position ?? null,
        team: p?.team ?? null,
      };
    }),
    rosterIds: tx.roster_ids ?? [],
    teamNames: (tx.roster_ids ?? []).map((id) => names.get(id) ?? `Roster ${id}`),
    bid: tx.settings?.waiver_bid ?? null,
  }));
  items.sort((a, b) => b.created - a.created);
  return items.slice(0, 60);
}

export async function loadTrending(): Promise<TrendingPlayer[]> {
  const rows = await sget<Array<{ player_id: string; count: number }>>(
    "/players/nfl/trending/add?lookback_hours=24&limit=16",
    120_000,
  );
  return rows
    .map((r) => {
      const p = getPlayer(r.player_id);
      if (!p) return null;
      return { ...p, adds: r.count };
    })
    .filter((x): x is TrendingPlayer => x != null);
}

export async function loadLeaders(position: string): Promise<LeaderRow[]> {
  const pos = position === "ALL" ? null : position;
  const out: LeaderRow[] = [];
  for (const s of await loadStatRows()) {
    const p = getPlayer(s.player_id);
    if (!p) continue;
    if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
    out.push({ ...p, ...s });
  }
  return out.slice(0, 50);
}

export function searchPlayers(query: string, position: string): SlimPlayer[] {
  const q = query.trim().toLowerCase();
  const pos = position === "ALL" ? null : position;
  if (!q && !pos)
    return Object.values(loadPlayers())
      .filter((p) => p.active && p.team)
      .slice(0, 40);
  const out: SlimPlayer[] = [];
  for (const p of Object.values(loadPlayers())) {
    if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
    if (
      q &&
      !`${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase().includes(q)
    )
      continue;
    out.push(p);
    if (out.length >= 60) break;
  }
  return out;
}

const DEF_ALIASES: Record<string, string> = {
  ari: "ARI",
  arizona: "ARI",
  cardinals: "ARI",
  atl: "ATL",
  atlanta: "ATL",
  falcons: "ATL",
  bal: "BAL",
  baltimore: "BAL",
  ravens: "BAL",
  buf: "BUF",
  buffalo: "BUF",
  bills: "BUF",
  car: "CAR",
  carolina: "CAR",
  panthers: "CAR",
  chi: "CHI",
  chicago: "CHI",
  bears: "CHI",
  cin: "CIN",
  cincinnati: "CIN",
  bengals: "CIN",
  cle: "CLE",
  cleveland: "CLE",
  browns: "CLE",
  dal: "DAL",
  dallas: "DAL",
  cowboys: "DAL",
  den: "DEN",
  denver: "DEN",
  broncos: "DEN",
  det: "DET",
  detroit: "DET",
  lions: "DET",
  gb: "GB",
  greenbay: "GB",
  packers: "GB",
  hou: "HOU",
  houston: "HOU",
  texans: "HOU",
  ind: "IND",
  indianapolis: "IND",
  colts: "IND",
  jax: "JAX",
  jac: "JAX",
  jacksonville: "JAX",
  jaguars: "JAX",
  kc: "KC",
  kansascity: "KC",
  chiefs: "KC",
  lv: "LV",
  lasvegas: "LV",
  raiders: "LV",
  lac: "LAC",
  chargers: "LAC",
  lar: "LAR",
  rams: "LAR",
  mia: "MIA",
  miami: "MIA",
  dolphins: "MIA",
  min: "MIN",
  minnesota: "MIN",
  vikings: "MIN",
  ne: "NE",
  newengland: "NE",
  patriots: "NE",
  no: "NO",
  neworleans: "NO",
  saints: "NO",
  nyg: "NYG",
  giants: "NYG",
  nyj: "NYJ",
  jets: "NYJ",
  phi: "PHI",
  philadelphia: "PHI",
  eagles: "PHI",
  pit: "PIT",
  pittsburgh: "PIT",
  steelers: "PIT",
  sf: "SF",
  sanfrancisco: "SF",
  "49ers": "SF",
  niners: "SF",
  sea: "SEA",
  seattle: "SEA",
  seahawks: "SEA",
  tb: "TB",
  tampabay: "TB",
  buccaneers: "TB",
  bucs: "TB",
  ten: "TEN",
  tennessee: "TEN",
  titans: "TEN",
  was: "WAS",
  wsh: "WAS",
  washington: "WAS",
  commanders: "WAS",
};

function matchDef(q: string): SlimPlayer | null {
  const stripped = q
    .replace(/\b(d st|dst|defense|def)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const key = stripped.replace(/\s+/g, "");
  const abbr = DEF_ALIASES[key] ?? DEF_ALIASES[stripped.split(" ").pop() ?? ""];
  if (!abbr) return null;
  return (
    Object.values(loadPlayers()).find((p) => p.position === "DEF" && p.player_id === abbr) ?? null
  );
}

export function matchPlayerName(raw: string): SlimPlayer | null {
  const q = raw
    .toLowerCase()
    .replace(/['’.`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .trim();
  if (!q) return null;
  const players = Object.values(loadPlayers());
  const def = matchDef(q);
  if (def) return def;
  const compact = q.replace(/\s+/g, "");
  const exact =
    players.find((p) => (p.search_full_name ?? "").replace(/\s+/g, "") === compact) ??
    players.find(
      (p) =>
        (p.full_name ?? "")
          .toLowerCase()
          .replace(/['’.]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim() === q,
    );
  if (exact) return exact;
  const parts = q.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!.replace(/[^a-z]/g, "");
    const first = parts[0]!.replace(/[^a-z]/g, "");
    const cands = players.filter((p) => {
      const ln = (p.last_name ?? "").toLowerCase().replace(/[^a-z]/g, "");
      const fn = (p.first_name ?? "").toLowerCase().replace(/[^a-z]/g, "");
      return ln === last && fn.startsWith(first[0] ?? "");
    });
    if (cands.length === 1) return cands[0]!;
    return (
      cands.find((p) => (p.first_name ?? "").toLowerCase().replace(/[^a-z]/g, "") === first) ?? null
    );
  }
  if (parts.length === 1 && parts[0]!.length > 3) {
    const last = parts[0]!.replace(/[^a-z]/g, "");
    const cands = players.filter(
      (p) => (p.last_name ?? "").toLowerCase().replace(/[^a-z]/g, "") === last,
    );
    if (cands.length === 1) return cands[0]!;
  }
  return null;
}

export function writeRecap(
  leagueName: string,
  week: number,
  pairs: MatchupPair[],
  activity: ActivityItem[],
): RecapBlock {
  const decided = pairs.filter((p) => p.away && (p.home.points > 0 || p.away.points > 0));
  const box = decided
    .map((p) => {
      const a = p.home;
      const b = p.away!;
      const homeWins = a.points >= b.points;
      const winner = homeWins ? a : b;
      const loser = homeWins ? b : a;
      return {
        winner: winner.teamName,
        loser: loser.teamName,
        score: `${winner.points.toFixed(2)}–${loser.points.toFixed(2)}`,
        margin: Math.abs(winner.points - loser.points),
      };
    })
    .sort((a, b) => b.margin - a.margin);
  const sides = decided.flatMap((p) => [p.home, p.away].filter(Boolean));
  const high = [...sides].sort((a, b) => b!.points - a!.points)[0];
  const low = [...sides].sort((a, b) => a!.points - b!.points)[0];
  const blowout = box[0];
  const nail = [...box].sort((a, b) => a.margin - b.margin)[0];
  const headline = blowout
    ? `${blowout.winner} puts ${blowout.loser} in the dirt`
    : `Week ${week} is still blank paper`;
  const dek = high
    ? `The high-water mark was ${high.points.toFixed(1)} from ${high.teamName}. ${low && low !== high ? `${low.teamName} found the floor at ${low.points.toFixed(1)}.` : ""}`
    : "No scores posted yet — lineups are in, the ledger is waiting on kickoff.";
  const bullets: string[] = [];
  if (nail && nail.margin < 8) {
    bullets.push(`Closest call: ${nail.winner} over ${nail.loser} by ${nail.margin.toFixed(2)}.`);
  }
  if (blowout && blowout.margin >= 30) {
    bullets.push(`Statement win: ${blowout.winner} by ${blowout.margin.toFixed(1)}.`);
  }
  if (high) {
    const stud = high.starters
      .filter((s) => s.player && (s.points ?? 0) > 0)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    if (stud?.player) {
      bullets.push(
        `${stud.player.full_name} carried ${high.teamName} with ${stud.points?.toFixed(1)} from the ${stud.slot} slot.`,
      );
    }
  }
  const adds = activity.filter((a) => a.type === "waiver" || a.type === "free_agent");
  const topAdd = adds.flatMap((a) => a.adds)[0];
  const wireNote = topAdd
    ? `On the wire: ${topAdd.name} was claimed. ${adds.length} moves hit the books this week.`
    : adds.length
      ? `${adds.length} waiver moves processed.`
      : null;
  return {
    week,
    leagueName,
    kicker: `Week ${week} dispatch`,
    headline,
    dek,
    bullets,
    box,
    wireNote,
  };
}

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  try {
    return { ok: true as const, ms: Date.now() - t0, value: await fn() };
  } catch (err) {
    return {
      ok: false as const,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "failed",
    };
  }
}

export async function probeSources(): Promise<SourceStatus[]> {
  const [sleeper, espn, nflverse] = await Promise.all([
    timed(async () => {
      const state = await fetchNflState();
      return `${state.season} ${state.season_type} · week ${state.display_week}`;
    }),
    timed(async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
        {
          headers: { accept: "application/json" },
        },
      );
      if (!res.ok) throw new Error(`ESPN ${res.status}`);
      const board = (await res.json()) as { events?: unknown[]; week?: { number?: number } };
      return `${board.events?.length ?? 0} games · week ${board.week?.number ?? "?"}`;
    }),
    timed(async () => {
      const res = await fetch(
        "https://api.github.com/repos/nflverse/nflverse-data/releases/tags/stats_player",
        {
          headers: { accept: "application/vnd.github+json" },
        },
      );
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const rel = (await res.json()) as { assets?: unknown[]; published_at?: string };
      return `${rel.assets?.length ?? 0} files · updated ${rel.published_at ? rel.published_at.slice(0, 10) : "unknown"}`;
    }),
  ]);
  return [
    {
      id: "sleeper",
      name: "Sleeper",
      role: "Leagues, rosters, matchups, players, unofficial stats",
      cost: "$0",
      license: "Free for personal / non-commercial use. No key.",
      ok: sleeper.ok,
      latencyMs: sleeper.ms,
      detail: sleeper.ok ? sleeper.value : sleeper.error,
    },
    {
      id: "espn",
      name: "ESPN public",
      role: "NFL scoreboard, status, headlines",
      cost: "$0",
      license: "Undocumented site API. Personal use only.",
      ok: espn.ok,
      latencyMs: espn.ms,
      detail: espn.ok ? espn.value : espn.error,
    },
    {
      id: "nflverse",
      name: "nflverse",
      role: "Open weekly stats, play-by-play, rosters (nightly)",
      cost: "$0",
      license: "Open data on GitHub. Best archive, not live scoring.",
      ok: nflverse.ok,
      latencyMs: nflverse.ms,
      detail: nflverse.ok ? nflverse.value : nflverse.error,
    },
  ];
}
