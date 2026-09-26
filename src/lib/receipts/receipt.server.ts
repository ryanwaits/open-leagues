import type { ActivityItem, LeagueBundle, MatchupPair, TeamBundle } from "@/lib/data/types";
import { isHostedLeague } from "@/lib/data/types";
import { type BenchReceipt, benchReceipt } from "./bench";
import {
  computeFlip,
  type FlipSide,
  gameStatesAt,
  sampleTimes,
  scoreAt,
  scoreSeries,
  type TimelineEvent,
} from "./flip";
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
  /** The league's FAAB budget, so a bid can be read as a share. */
  budget: number | null;
  /** This bid as a share of budget, 0–100. */
  bidPct: number | null;
  /** Median winning share of budget across pasted leagues, once another league has cleared one. */
  medianPct: number | null;
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
  /** The lead moved on a box-score settlement at the final whistle, not a play. */
  settled: boolean;
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

export async function loadersFor(leagueId: string, userId: string | null): Promise<Loaders> {
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

/** The week's play log, ingesting the season's once if needed. Null when there is none. */
async function timelineOf(season: string, week: number): Promise<TimelineEvent[] | null> {
  const pbp = await import("./pbp.server");
  // First request for a season pulls the whole play log once; later requests
  // hit the throttle and cost one query. A crosswalk version bump re-ingests.
  try {
    const r = await pbp.ensureTimelines(season);
    if (!r.skipped) console.info(`[receipts] pbp ${season}: ${r.games} games`);
  } catch (err) {
    console.warn(`[receipts] pbp ${season} ingest failed:`, err);
  }
  if (!(await pbp.hasTimeline(season, week))) return null;
  const events: TimelineEvent[] = await pbp.timelineFor(season, week);
  return events.length ? events : null;
}

function flipSide(m: MatchupPair["home"]): FlipSide {
  return {
    rosterId: m.rosterId,
    name: publicName(m.teamName, m.manager, m.rosterId),
    starters: m.starters.map((l) => l.playerId).filter((id): id is string => Boolean(id)),
  };
}

/**
 * The win-probability model for one matchup, ready to ask at any moment: the
 * starters' outlooks are fetched once (they are the expensive part), then each
 * call reads the games' states at `at` and returns home's chance, 0–1.
 */
async function winModel(input: {
  leagueId: string;
  season: string;
  events: TimelineEvent[];
  home: FlipSide;
  away: FlipSide;
}): Promise<(at: string, scores: [number, number]) => number> {
  const sleeper = await import("@/lib/data/sleeper.server");
  const { outlooksFor } = await import("@/lib/data/projections.server");
  const { winProbability } = await import("@/lib/league/win-probability");
  const ids = [...input.home.starters, ...input.away.starters];
  const outlooks = await outlooksFor({
    leagueId: input.leagueId,
    season: input.season,
    playerIds: ids,
  });
  const teamOf = new Map<string, string | null>();
  const posOf = new Map<string, string | null>();
  for (const id of ids) {
    const p = sleeper.getPlayer(id);
    teamOf.set(id, p?.team ?? (p?.position === "DEF" ? id : null));
    posOf.set(id, p?.position ?? null);
  }
  const gameOfTeam = new Map<string, string>();
  for (const e of input.events) for (const t of teamsOfGame(e.g)) gameOfTeam.set(t, e.g);
  // only the games these starters play in: states are read per sample
  const games = new Set<string>();
  for (const id of ids) {
    const t = teamOf.get(id);
    const g = t ? gameOfTeam.get(t) : undefined;
    if (g) games.add(g);
  }
  const events = input.events.filter((e) => games.has(e.g));
  return (at, scores) => {
    const states = gameStatesAt(events, at);
    const toOutlook = (list: string[]) =>
      list.map((id) => {
        const team = teamOf.get(id) ?? null;
        const g = team ? gameOfTeam.get(team) : undefined;
        const st = g ? states[g] : undefined;
        const o = outlooks[id];
        return {
          playerId: id,
          team,
          position: posOf.get(id) ?? null,
          mean: o?.mean ?? 0,
          sd: o?.sd ?? 0,
          game: st ? { state: st.state, detail: st.detail, opp: null, gameId: g ?? null } : null,
        };
      });
    return winProbability({
      scores,
      starters: [toOutlook(input.home.starters), toOutlook(input.away.starters)],
    }).probability;
  };
}

/** A play description without its formation prefix: "(Shotgun) ..." -> "...". */
function playText(desc: string | null): string | null {
  return desc
    ? desc
        .replace(/^\([^)]*\)\s*/, "")
        .replace(/\s+/g, " ")
        .trim()
    : null;
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
  const events = await timelineOf(input.season, input.week);
  if (!events) return null;

  const { scoringBookFor } = await import("@/lib/data/projections.server");
  const book = await scoringBookFor(input.leagueId);
  const home = flipSide(pair.home);
  const away = flipSide(pair.away);
  const flip = computeFlip({ home, away, events, book });
  if (!flip.decided) return null;
  const d = flip.decided;
  const points = scoreSeries({ home, away, events, book });

  const sleeper = await import("@/lib/data/sleeper.server");
  const byName = d.playerId ? (sleeper.getPlayer(d.playerId)?.full_name ?? null) : null;

  // Win probability, from this roster's side, half an hour before the flip.
  let probBefore: number | null = null;
  let beforeLabel: string | null = null;
  try {
    const beforeAt = new Date(new Date(d.at).getTime() - HALF_HOUR_MS).toISOString();
    const model = await winModel({
      leagueId: input.leagueId,
      season: input.season,
      events,
      home,
      away,
    });
    const pHome = model(beforeAt, scoreAt(points, beforeAt));
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
    play: playText(d.desc),
    by: byName,
    settled: d.settled,
    scores: input.mine === home.rosterId ? d.scores : [d.scores[1], d.scores[0]],
    changes: flip.changes.length,
    probBefore,
    beforeLabel,
  };
}

/* ------------------------------------------------------ win-prob series -- */

export type WinProbPoint = {
  at: string;
  /** "Sun 4:07pm ET" */
  atLabel: string;
  /** Home, away. */
  scores: [number, number];
  /** Home's chance to win at this moment, 0–1. Null when unmodelled. */
  pHome: number | null;
  /** The scoring play at this moment, when there was one. */
  play: string | null;
  /** The starter whose stat line moved the score here, by name. */
  by: string | null;
  /** The lead changed hands here. */
  leadChange: boolean;
  /** A box-score settlement at the final whistle, not a play. */
  settled: boolean;
};

export type WinProbSeries = {
  leagueId: string;
  season: string;
  week: number;
  matchupId: number;
  home: { rosterId: number; name: string; points: number };
  away: { rosterId: number; name: string; points: number };
  /** Every moment the curve was evaluated, in time order. */
  points: WinProbPoint[];
  /** Lead changes across the week. */
  changes: number;
  /** The lowest chance the eventual winner had at any sampled moment. Null when unmodelled or tied. */
  winnerLow: number | null;
  /** False when the play log or the model was unavailable; points then carry scores only. */
  modelled: boolean;
};

/** Sample every quarter hour while a starter's game is on. */
const SERIES_STEP_MS = 15 * 60 * 1000;

function dayLabel(iso: string): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(new Date(iso));
  return `${day} ${etLabel(iso)}`;
}

/**
 * One matchup's week as a curve: each side's score and home's chance to win,
 * Thursday to Monday, from the same play log and model as the receipt's flip.
 * Sampled at kickoffs, every scoring play and lead change, and every quarter
 * hour while a starter's game is on.
 */
export async function buildWinProbSeries(
  leagueId: string,
  week: number,
  matchupId: number,
  userId: string | null,
): Promise<WinProbSeries> {
  const L = await loadersFor(leagueId, userId);
  const [bundle, pairs] = await Promise.all([L.bundle(), L.matchups(week)]);
  const pair = pairs.find((p) => p.matchupId === matchupId);
  if (!pair) throw new Error(`No matchup ${matchupId} in week ${week}.`);
  if (!pair.away) throw new Error(`Matchup ${matchupId} in week ${week} is a bye.`);
  const season = String(bundle.league.season);
  const home = flipSide(pair.home);
  const away = flipSide(pair.away);
  const base = {
    leagueId,
    season,
    week,
    matchupId,
    home: { rosterId: home.rosterId, name: home.name, points: round1(pair.home.points) },
    away: { rosterId: away.rosterId, name: away.name, points: round1(pair.away.points) },
  };

  const events = await timelineOf(season, week);
  if (!events) return { ...base, points: [], changes: 0, winnerLow: null, modelled: false };

  const { scoringBookFor } = await import("@/lib/data/projections.server");
  const book = await scoringBookFor(leagueId);
  const scored = scoreSeries({ home, away, events, book });

  // the games these starters play in, first to last event
  const starters = new Set([...home.starters, ...away.starters]);
  const sleeper = await import("@/lib/data/sleeper.server");
  const teams = new Set<string>();
  for (const id of starters) {
    const p = sleeper.getPlayer(id);
    const t = p?.team ?? (p?.position === "DEF" ? id : null);
    if (t) teams.add(t);
  }
  const span = new Map<string, [string, string]>();
  for (const e of events) {
    if (!teamsOfGame(e.g).some((t) => teams.has(t))) continue;
    const s = span.get(e.g);
    if (!s) span.set(e.g, [e.t, e.t]);
    else {
      if (e.t < s[0]) s[0] = e.t;
      if (e.t > s[1]) s[1] = e.t;
    }
  }
  const times = sampleTimes({ points: scored, spans: [...span.values()], stepMs: SERIES_STEP_MS });

  let model: ((at: string, scores: [number, number]) => number) | null = null;
  try {
    model = await winModel({ leagueId, season, events, home, away });
  } catch (err) {
    console.warn(`[receipts] win model ${leagueId} wk${week} m${matchupId}:`, err);
  }
  const byAt = new Map(scored.map((p) => [p.at, p]));
  const points: WinProbPoint[] = times.map((at) => {
    const scores = scoreAt(scored, at);
    const p = byAt.get(at);
    let pHome: number | null = null;
    if (model) {
      try {
        pHome = model(at, scores);
      } catch {
        pHome = null;
      }
    }
    return {
      at,
      atLabel: dayLabel(at),
      scores,
      pHome,
      play: p ? playText(p.desc) : null,
      by: p ? (sleeper.getPlayer(p.playerId)?.full_name ?? null) : null,
      leadChange: p?.leadChange ?? false,
      settled: p?.settled ?? false,
    };
  });

  const final = scored.length
    ? (scored[scored.length - 1] as (typeof scored)[number]).scores
    : null;
  const homeWon = final ? final[0] > final[1] : null;
  const winnerChances = points
    .map((p) => (p.pHome === null || homeWon === null ? null : homeWon ? p.pHome : 1 - p.pHome))
    .filter((v): v is number => v !== null);
  return {
    ...base,
    points,
    changes: scored.filter((p) => p.leadChange).length,
    winnerLow:
      final && final[0] !== final[1] && winnerChances.length ? Math.min(...winnerChances) : null,
    modelled: model !== null && winnerChances.length > 0,
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
      budget: null,
      bidPct: null,
      medianPct: null,
      leagues: null,
    }));
  // What the same player cleared for elsewhere. Only for raw Sleeper leagues,
  // only when enough leagues have pasted to say something.
  if (!isHostedLeague(leagueId) && moves.some((m) => m.kind === "waiver")) {
    try {
      const sleeper = await import("@/lib/data/sleeper.server");
      const budget = (await sleeper.fetchLeague(leagueId)).settings?.waiver_budget ?? 100;
      for (const m of moves) {
        if (m.bid == null) continue;
        m.budget = budget;
        m.bidPct = budget > 0 ? Math.round((1000 * m.bid) / budget) / 10 : null;
      }
      if (moves.some((m) => m.kind === "waiver" && m.won)) {
        const { wirePrices } = await import("./open-data.server");
        const prices = await wirePrices(String(bundle.league.season), week);
        const byId = new Map(prices.prices.map((p) => [p.player_id, p]));
        for (const m of moves) {
          const p = m.addId ? byId.get(m.addId) : undefined;
          if (p && p.n >= 2) {
            m.medianPct = p.median_pct;
            m.leagues = p.n;
          }
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
