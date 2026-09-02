import type { ActivityItem, LeagueBundle, MatchupPair, TeamBundle } from "@/lib/data/types";
import { isHostedLeague } from "@/lib/data/types";
import { type BenchReceipt, benchReceipt } from "./bench";
import { computeFlip, type FlipSide, gameStatesAt, scoresAt, type TimelineEvent } from "./flip";
import { agreementLine, callsFor } from "./sources";

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
  addId: string | null;
  drop: string | null;
  bid: number | null;
  won: boolean;
  /** Median winning bid across pasted leagues, when at least three had one. */
  median: number | null;
  leagues: number | null;
};

/** The minute the matchup was decided, reconstructed from play-by-play. */
export type ReceiptFlip = {
  /** Wall clock of the last lead change, ISO. */
  at: string;
  /** "4:07pm ET" */
  atLabel: string;
  /** Roster that took the lead for good. */
  to: number;
  toName: string;
  /** The play, when it was a scoring play. */
  play: string | null;
  /** The player whose stat line moved the lead, by name. */
  by: string | null;
  scores: [number, number];
  /** Lead changes across the whole week. */
  changes: number;
  /** This roster's win probability half an hour before the flip, 0–1. Null when unmodelled. */
  probBefore: number | null;
  beforeLabel: string | null;
};

/** A write an agent ran on this roster this week, through a credential. */
export type AgentAction = { tool: string; actor: string; at: string; atLabel: string };

export type Receipt = {
  league: { id: string; name: string; season: string; hosted: boolean };
  week: number;
  currentWeek: number;
  roster: ReceiptSide;
  opponent: ReceiptSide | null;
  outcome: "win" | "loss" | "tie" | "pending";
  bench: BenchReceipt;
  wire: { moves: WireMove[]; spent: number };
  flip: ReceiptFlip | null;
  /** Only a hosted league can know this; the passthrough has no ledger. */
  agent: { actions: AgentAction[] };
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

/** Kickoff-time convention: fantasy talks in Eastern. */
export function etLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  const m = parts.find((p) => p.type === "minute")?.value ?? "";
  const ap = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();
  return `${h}:${m}${ap} ET`;
}

const HALF_HOUR_MS = 30 * 60 * 1000;

/** "2025_14_KC_LAC" → the two teams, as Sleeper knows them. */
function teamsOfGame(gameId: string): string[] {
  const parts = gameId.split("_");
  return parts.length >= 4
    ? [parts[2] ?? "", parts[3] ?? ""].map((t) => (t === "LA" ? "LAR" : t))
    : [];
}

async function flipFor(input: {
  leagueId: string;
  season: string;
  week: number;
  pair: MatchupPair;
  mine: number;
}): Promise<ReceiptFlip | null> {
  const { pair } = input;
  if (!pair.away) return null;
  const pbp = await import("./pbp.server");
  // First receipt for a season pulls the whole play log once; later requests
  // hit the throttle and cost one query. A crosswalk version bump re-ingests.
  try {
    const r = await pbp.ensureTimelines(input.season);
    if (!r.skipped) console.info(`[receipts] pbp ${input.season}: ${r.games} games`);
  } catch (err) {
    console.warn(`[receipts] pbp ${input.season} ingest failed:`, err);
    if (!(await pbp.hasTimeline(input.season, input.week))) return null;
  }
  if (!(await pbp.hasTimeline(input.season, input.week))) return null;
  const events: TimelineEvent[] = await pbp.timelineFor(input.season, input.week);
  if (events.length === 0) return null;

  const { scoringBookFor } = await import("@/lib/data/projections.server");
  const book = await scoringBookFor(input.leagueId);
  const side = (m: MatchupPair["home"]): FlipSide => ({
    rosterId: m.rosterId,
    name: publicName(m.teamName, m.manager, m.rosterId),
    starters: m.starters.map((l) => l.playerId).filter((id): id is string => Boolean(id)),
  });
  const home = side(pair.home);
  const away = side(pair.away);
  const flip = computeFlip({ home, away, events, book });
  if (!flip.decided) return null;
  const d = flip.decided;

  const sleeper = await import("@/lib/data/sleeper.server");
  const byName = d.playerId ? (sleeper.getPlayer(d.playerId)?.full_name ?? null) : null;

  // Win probability, from this roster's side, half an hour before the flip.
  let probBefore: number | null = null;
  let beforeLabel: string | null = null;
  try {
    const beforeAt = new Date(new Date(d.at).getTime() - HALF_HOUR_MS).toISOString();
    const states = gameStatesAt(events, beforeAt);
    const gameOfTeam = new Map<string, string>();
    for (const g of Object.keys(states)) for (const t of teamsOfGame(g)) gameOfTeam.set(t, g);
    const { outlooksFor } = await import("@/lib/data/projections.server");
    const ids = [...home.starters, ...away.starters];
    const outlooks = await outlooksFor({
      leagueId: input.leagueId,
      season: input.season,
      playerIds: ids,
    });
    const toOutlook = (ids: string[]) =>
      ids.map((id) => {
        const p = sleeper.getPlayer(id);
        const team = p?.team ?? (p?.position === "DEF" ? id : null);
        const g = team ? gameOfTeam.get(team) : undefined;
        const st = g ? states[g] : undefined;
        const o = outlooks[id];
        return {
          playerId: id,
          team,
          position: p?.position ?? null,
          mean: o?.mean ?? 0,
          sd: o?.sd ?? 0,
          game: st ? { state: st.state, detail: st.detail, opp: null, gameId: g ?? null } : null,
        };
      });
    const { winProbability } = await import("@/lib/league/win-probability");
    const scores = scoresAt({ home, away, events, book }, beforeAt);
    const wp = winProbability({
      scores,
      starters: [toOutlook(home.starters), toOutlook(away.starters)],
    });
    const pHome = wp.probability;
    probBefore = input.mine === home.rosterId ? pHome : 1 - pHome;
    beforeLabel = etLabel(beforeAt);
  } catch {
    probBefore = null;
  }

  return {
    at: d.at,
    atLabel: etLabel(d.at),
    to: d.to,
    toName: d.to === home.rosterId ? home.name : away.name,
    play: d.desc
      ? d.desc
          .replace(/^\([^)]*\)\s*/, "")
          .replace(/\s+/g, " ")
          .trim()
      : null,
    by: byName,
    scores: input.mine === home.rosterId ? d.scores : [d.scores[1], d.scores[0]],
    changes: flip.changes.length,
    probBefore,
    beforeLabel,
  };
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

  // Name the sources on a settled week: what each would have called, and
  // whether it was right. Open sources only; a paid source is never rendered.
  if (outcome !== "pending" && bench.misses.length > 0) {
    try {
      const { sourceValues } = await import("./sources.server");
      const ids = bench.misses.flatMap((m) => [m.best.playerId, m.started?.playerId ?? null]);
      const values = await sourceValues({
        leagueId,
        season: String(bundle.league.season),
        week,
        playerIds: ids.filter((id): id is string => Boolean(id)),
      });
      for (const m of bench.misses) {
        m.sources = callsFor(m.started?.playerId ?? null, m.best.playerId, values);
        m.sourceLine = agreementLine(m.sources, m.best.name, m.started?.name ?? null);
      }
    } catch {
      /* sources are a courtesy; the receipt stands without them */
    }
  }

  const moves: WireMove[] = activity
    .filter((a) => a.rosterIds.includes(rosterId))
    .map((a) => ({
      kind: moveKind(a.type),
      add: a.adds[0]?.name ?? null,
      addId: a.adds[0]?.playerId ?? null,
      drop: a.drops[0]?.name ?? null,
      bid: a.bid,
      won: a.status === "complete",
      median: null,
      leagues: null,
    }));
  // What the same player cleared for elsewhere. Only for raw Sleeper leagues,
  // only when enough leagues have pasted to say something.
  if (!isHostedLeague(leagueId) && moves.some((m) => m.kind === "waiver" && m.won)) {
    try {
      const { wirePrices } = await import("./open-data.server");
      const prices = await wirePrices(String(bundle.league.season), week);
      const byId = new Map(prices.prices.map((p) => [p.player_id, p]));
      for (const m of moves) {
        const p = m.addId ? byId.get(m.addId) : undefined;
        if (p && p.n >= 3) {
          m.median = p.median;
          m.leagues = p.n;
        }
      }
    } catch {
      /* prices are a courtesy */
    }
  }
  const spent = moves
    .filter((m) => m.kind === "waiver" && m.won && m.bid != null)
    .reduce((n, m) => n + (m.bid ?? 0), 0);

  const season = String(bundle.league.season);

  // The receipt names the agent: every write that came through a credential.
  let agentActions: AgentAction[] = [];
  if (isHostedLeague(leagueId)) {
    try {
      const { readEvents } = await import("@/lib/league/events.server");
      const events = await readEvents(leagueId, { sinceWeek: week, limit: 500 });
      agentActions = events
        .filter((e) => e.kind === "agent_action" && e.week === week && e.actorRoster === rosterId)
        .map((e) => ({
          tool: String(e.payload.tool ?? "unknown"),
          actor: String(e.payload.actor ?? "agent"),
          at: e.at,
          atLabel: etLabel(e.at),
        }))
        .sort((a, b) => (a.at < b.at ? -1 : 1));
    } catch {
      agentActions = [];
    }
  }

  const flip =
    pair && outcome !== "pending"
      ? await flipFor({ leagueId, season, week, pair, mine: rosterId }).catch(() => null)
      : null;

  return {
    league: {
      id: leagueId,
      name: bundle.league.name,
      season,
      hosted: isHostedLeague(leagueId),
    },
    week,
    currentWeek,
    roster,
    opponent,
    outcome,
    bench,
    wire: { moves, spent },
    flip,
    agent: { actions: agentActions },
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
