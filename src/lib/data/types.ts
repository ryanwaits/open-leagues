export type SlimPlayer = {
  player_id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  position: string | null;
  fantasy_positions?: string[] | null;
  team: string | null;
  number?: number | null;
  status?: string | null;
  injury_status?: string | null;
  age?: number | null;
  years_exp?: number | null;
  espn_id?: string | number | null;
  search_full_name?: string | null;
  depth_chart_order?: number | null;
  college?: string | null;
  active?: boolean | null;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string; avatar?: string };
  avatar?: string | null;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    waiver_position?: number;
  };
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  sport?: string;
  season_type?: string;
  total_rosters?: number;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
  previous_league_id?: string | null;
  avatar?: string | null;
  settings: {
    num_teams?: number;
    playoff_teams?: number;
    playoff_week_start?: number;
    type?: number;
    last_scored_leg?: number;
    leg?: number;
    waiver_type?: number;
    taxi_slots?: number;
    reserve_slots?: number;
    best_ball?: number;
  };
};

export type NflState = {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
  leg?: number;
  season_has_scores?: boolean;
  previous_season?: string;
};

export type LeagueSummary = {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters?: number;
  avatar?: string | null;
};

export type StandingRow = {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  manager: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  waiverPos: number;
};

export type GameChip = {
  state: "pre" | "in" | "post";
  detail: string;
  opp: string | null;
  gameId: string | null;
  /** Team abbreviation that currently has the ball. Live games only. */
  possession?: string | null;
  /** Down/distance, e.g. "2nd & 7". Live games only. */
  situation?: string | null;
  redZone?: boolean;
  /** This team's score minus the opponent's. Live/post when known. */
  margin?: number | null;
};

export type LeagueBundle = {
  league: SleeperLeague;
  standings: StandingRow[];
  currentWeek: number;
  scoringLabel: string;
  formatLabel: string;
  /** Starting slots broken out, so the rules card can lay them out rather than print one long line. */
  lineup?: {
    starters: { key: string; label: string; count: number }[];
    bench: number;
    ir: number;
    startCount: number;
  } | null;
  hosted: boolean;
  myRosterId: number | null;
  isCommish: boolean;
  inviteCode: string | null;
  draftStatus: "none" | "pending" | "live" | "complete";
  locked: boolean;
  scoringLive: boolean;
  faabRemaining?: number | null;
  /** Staked on wagers that have not settled; unavailable to claims. */
  faabAtRisk?: number;
  ops?: {
    waiverType: string;
    faabBudget: number;
    tradeDeadlineWeek: number;
    playoffStartWeek: number;
    regularWeeks: number;
    playoffByes: number;
    lastWaiverWeek: number;
    waiversOpen: boolean;
  };
};

export type StarterLine = {
  slot: string;
  playerId: string | null;
  player: SlimPlayer | null;
  points: number | null;
  game: GameChip | null;
  stats?: Record<string, number> | null;
  /** Set when `points` is a forecast rather than unofficial/live. */
  forecast?: "proj" | "bye" | "out";
  /** Expected final, live-adjusted. Unstarted = weekly proj. */
  expected?: number | null;
};

export type MatchupSide = {
  rosterId: number;
  teamName: string;
  manager: string;
  avatar: string | null;
  points: number;
  starters: StarterLine[];
};

export type MatchupPair = {
  matchupId: number;
  home: MatchupSide;
  away: MatchupSide | null;
  kind?: "regular" | "playoff";
  playoffRound?: number | null;
  label?: string | null;
};

export type RosterPlayer = SlimPlayer & {
  slot: "starter" | "bench" | "ir" | "taxi";
  starterSlot?: string;
  weekPts: number | null;
  game?: GameChip | null;
  news_updated?: string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  latest_note?: PlayerNote | null;
};

export type TeamBundle = {
  rosterId: number;
  teamName: string;
  manager: string;
  avatar: string | null;
  record: { wins: number; losses: number; ties: number; pf: number; pa: number };
  players: RosterPlayer[];
  week: number;
};

export type WireScope = "all" | "available" | "free_agent";

export type WireAvailability = "rostered" | "waiver" | "free_agent";

export type WireOwner = { rosterId: number; teamName: string };

export type WirePlayer = SlimPlayer & {
  pts: number | null;
  rank: number | null;
  availability: WireAvailability;
  ownedBy: WireOwner | null;
};

export type ActivityItem = {
  id: string;
  type: string;
  status: string;
  created: number;
  adds: { playerId: string; name: string; pos: string | null; team: string | null }[];
  drops: { playerId: string; name: string; pos: string | null; team: string | null }[];
  rosterIds: number[];
  teamNames: string[];
  bid: number | null;
};

export type LeaderRow = SlimPlayer & {
  pts_ppr: number;
  pts_half_ppr: number;
  pts_std: number;
  gp: number;
  pass_yd: number;
  pass_td: number;
  pass_int: number;
  rush_yd: number;
  rush_td: number;
  rec: number;
  rec_yd: number;
  rec_td: number;
  pos_rank_ppr: number | null;
};

export type ScoreTeam = {
  abbr: string;
  name: string;
  logo: string;
  score: string;
  winner: boolean | null;
  record: string | null;
};

export type ScoreGame = {
  id: string;
  name: string;
  shortName: string;
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  week: number;
  season: number;
  seasonType: string;
  home: ScoreTeam;
  away: ScoreTeam;
  /** Down/distance + spot, live games only. */
  situation?: string | null;
  /** Team abbreviation that currently has the ball. */
  possession?: string | null;
  redZone?: boolean;
};

export type GamePlay = {
  id: string;
  text: string;
  type: string;
  scoring: boolean;
  period: number;
  clock: string;
  awayScore: number;
  homeScore: number;
  yardage: number | null;
};

export type GameDrive = {
  id: string;
  team: string;
  logo: string | null;
  result: string;
  description: string;
  start: string;
  plays: GamePlay[];
};

export type BoxRow = {
  id: string;
  name: string;
  jersey: string | null;
  headshot: string | null;
  stats: string[];
};

export type BoxGroup = {
  name: string;
  label: string;
  headers: string[];
  rows: BoxRow[];
};

export type TeamBox = {
  abbr: string;
  name: string;
  logo: string;
  groups: BoxGroup[];
  teamStats: { label: string; value: string }[];
};

export type ScoringPlay = {
  id: string;
  team: string;
  logo: string | null;
  text: string;
  type: string;
  period: number;
  clock: string;
  awayScore: number;
  homeScore: number;
};

export type GameSummary = {
  id: string;
  name: string;
  shortName: string;
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  week: number;
  season: number;
  seasonType: string;
  home: ScoreTeam;
  away: ScoreTeam;
  situation: string | null;
  /** Abbreviation of the team with the ball. Live games only. */
  possession: string | null;
  lastPlay: string | null;
  scoring: ScoringPlay[];
  drives: GameDrive[];
  box: TeamBox[];
};

export type NewsItem = {
  id: string;
  headline: string;
  description: string;
  published: string;
  image: string | null;
  link: string | null;
};

/** Player-specific note (ESPN / RotoWire). Not league-wide headlines. */
export type PlayerNote = {
  id: string;
  headline: string;
  text: string;
  date: string;
  source: string;
  link?: string | null;
};

/** One week on a team's regular-season slate. */
export type PlayerScheduleGame = {
  week: number;
  date: string;
  opp: string;
  detail: string;
  state: "pre" | "in" | "post";
  bye: boolean;
};

export type TrendingPlayer = SlimPlayer & { adds: number };

export type Pulse = {
  state: NflState;
  games: ScoreGame[];
  news: NewsItem[];
  trending: TrendingPlayer[];
};

export type SourceStatus = {
  id: "sleeper" | "espn" | "nflverse";
  name: string;
  role: string;
  cost: string;
  license: string;
  ok: boolean;
  latencyMs: number;
  detail: string;
};

export type RecapBlock = {
  week: number;
  leagueName: string;
  kicker: string;
  headline: string;
  dek: string;
  bullets: string[];
  box: { winner: string; loser: string | null; score: string; margin: number }[];
  wireNote: string | null;
};

export const DEMO_LEAGUE_ID = "1180228818907533312";
export const DEMO_LEAGUE_NAME = "Schwabbies (Year 13)";
export const LIVE_2026_LEAGUE_ID = "1383225688680583168";
export const LIVE_2026_LEAGUE_NAME = "#SFB16 — Forza";

export type Projection = {
  points: number;
  /** Why it is zero — or that the number is a season average, not a weekly feed. */
  reason: "bye" | "out" | "no-data" | "season-avg" | null;
};

export function isHostedLeague(id: string): boolean {
  return id.startsWith("lg_");
}
