import type { ActivityItem, LeagueBundle, MatchupPair, TeamBundle } from "@/lib/data/types";
import { isHostedLeague } from "@/lib/data/types";
import { type BenchReceipt, benchReceipt } from "./bench";

/**
 * A receipt is one roster's week, stated as facts: the score, what was left on
 * the bench, what the wire cost. It reads a hosted league through the engine
 * and a raw Sleeper id through the public passthrough; the shape is the same.
 *
 * Names are team names. A manager's display name never appears on a receipt
 * unless the team name IS the display name, in which case the roster number
 * stands in — a public card must not be a directory of usernames.
 */

export type ReceiptSide = { rosterId: number; name: string; points: number };

export type WireMove = {
  kind: "waiver" | "free_agent" | "trade" | "other";
  add: string | null;
  drop: string | null;
  bid: number | null;
  won: boolean;
};

export type Receipt = {
  league: { id: string; name: string; season: string; hosted: boolean };
  week: number;
  currentWeek: number;
  roster: ReceiptSide;
  opponent: ReceiptSide | null;
  outcome: "win" | "loss" | "tie" | "pending";
  bench: BenchReceipt;
  wire: { moves: WireMove[]; spent: number };
  /** The minute the lead changed. Filled by the flip reconstruction. */
  flip: null;
  generatedAt: string;
};

export type WeekBoardRow = {
  matchupId: number;
  home: ReceiptSide;
  away: ReceiptSide | null;
  outcome: "home" | "away" | "tie" | "pending";
};

export type WeekBoard = {
  league: { id: string; name: string; season: string; hosted: boolean };
  week: number;
  currentWeek: number;
  rows: WeekBoardRow[];
};

type Loaders = {
  bundle: () => Promise<LeagueBundle>;
  matchups: (week: number) => Promise<MatchupPair[]>;
  team: (rosterId: number, week: number) => Promise<TeamBundle>;
  activity: (week: number) => Promise<ActivityItem[]>;
};

async function loadersFor(leagueId: string, userId: string | null): Promise<Loaders> {
  if (isHostedLeague(leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    return {
      bundle: () => eng.loadLeagueBundle(leagueId, userId, { tick: false }),
      matchups: (week) => eng.loadMatchups(leagueId, week),
      team: (rosterId, week) => eng.loadTeam(leagueId, rosterId, week),
      activity: (week) => eng.loadActivity(leagueId, week),
    };
  }
  const sleeper = await import("@/lib/data/sleeper.server");
  return {
    bundle: () => sleeper.loadLeagueBundle(leagueId),
    matchups: (week) => sleeper.loadMatchups(leagueId, week),
    team: (rosterId, week) => sleeper.loadTeam(leagueId, rosterId, week),
    activity: (week) => sleeper.loadActivity(leagueId, week),
  };
}

/** Team name, or the roster number when the team name is just the username. */
export function publicName(teamName: string, manager: string, rosterId: number): string {
  const t = teamName.trim();
  if (!t || t === manager.trim()) return `Roster ${rosterId}`;
  return t;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sideOf(
  s: { rosterId: number; teamName: string; manager: string; points: number } | null,
): ReceiptSide | null {
  if (!s) return null;
  return {
    rosterId: s.rosterId,
    name: publicName(s.teamName, s.manager, s.rosterId),
    points: round1(s.points),
  };
}

function settled(week: number, currentWeek: number, a: number, b: number): boolean {
  if (week < currentWeek) return true;
  return a > 0 || b > 0;
}

function moveKind(type: string): WireMove["kind"] {
  if (type === "waiver") return "waiver";
  if (type === "free_agent") return "free_agent";
  if (type === "trade") return "trade";
  return "other";
}

export async function buildReceipt(
  leagueId: string,
  week: number,
  rosterId: number,
  userId: string | null,
): Promise<Receipt> {
  const L = await loadersFor(leagueId, userId);
  const [bundle, pairs, team, activity] = await Promise.all([
    L.bundle(),
    L.matchups(week),
    L.team(rosterId, week),
    L.activity(week).catch(() => [] as ActivityItem[]),
  ]);

  const pair = pairs.find((p) => p.home.rosterId === rosterId || p.away?.rosterId === rosterId);
  const mine = pair
    ? pair.home.rosterId === rosterId
      ? pair.home
      : (pair.away ?? pair.home)
    : null;
  const theirs = pair ? (pair.home.rosterId === rosterId ? pair.away : pair.home) : null;

  const roster: ReceiptSide = sideOf(mine) ?? {
    rosterId,
    name: publicName(team.teamName, team.manager, rosterId),
    points: 0,
  };
  const opponent = sideOf(theirs);

  const currentWeek = bundle.currentWeek;
  let outcome: Receipt["outcome"] = "pending";
  if (opponent && settled(week, currentWeek, roster.points, opponent.points)) {
    outcome =
      roster.points > opponent.points ? "win" : roster.points < opponent.points ? "loss" : "tie";
  }

  const positions = bundle.league.roster_positions ?? [];
  const bench = benchReceipt(team.players, positions);

  const moves: WireMove[] = activity
    .filter((a) => a.rosterIds.includes(rosterId))
    .map((a) => ({
      kind: moveKind(a.type),
      add: a.adds[0]?.name ?? null,
      drop: a.drops[0]?.name ?? null,
      bid: a.bid,
      won: a.status === "complete",
    }));
  const spent = moves
    .filter((m) => m.kind === "waiver" && m.won && m.bid != null)
    .reduce((n, m) => n + (m.bid ?? 0), 0);

  return {
    league: {
      id: leagueId,
      name: bundle.league.name,
      season: String(bundle.league.season),
      hosted: isHostedLeague(leagueId),
    },
    week,
    currentWeek,
    roster,
    opponent,
    outcome,
    bench,
    wire: { moves, spent },
    flip: null,
    generatedAt: new Date().toISOString(),
  };
}

export async function buildWeekBoard(
  leagueId: string,
  week: number | null,
  userId: string | null,
): Promise<WeekBoard> {
  const L = await loadersFor(leagueId, userId);
  const bundle = await L.bundle();
  const currentWeek = bundle.currentWeek;
  const w = week ?? currentWeek;
  const pairs = await L.matchups(w);

  const rows: WeekBoardRow[] = pairs.map((p) => {
    const home = sideOf(p.home) as ReceiptSide;
    const away = sideOf(p.away);
    let outcome: WeekBoardRow["outcome"] = "pending";
    if (away && settled(w, currentWeek, home.points, away.points)) {
      outcome = home.points > away.points ? "home" : home.points < away.points ? "away" : "tie";
    }
    return { matchupId: p.matchupId, home, away, outcome };
  });

  return {
    league: {
      id: leagueId,
      name: bundle.league.name,
      season: String(bundle.league.season),
      hosted: isHostedLeague(leagueId),
    },
    week: w,
    currentWeek,
    rows,
  };
}
