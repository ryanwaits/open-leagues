import type { GameChip, LeagueBundle, RosterPlayer, ScoreGame } from "@/lib/data/types";
import { labeledStartSlots, slotAccepts } from "./roster";

/**
 * The four moods of a fantasy week. Everything phase-aware reads from here so
 * the behaviour stays in one testable place instead of being re-derived inside
 * half a dozen components.
 */
export type Phase = "preseason" | "midweek" | "gameday" | "live" | "settled";

export type PhaseInfo = {
  phase: Phase;
  /** Kickoff of the earliest game a starter is still waiting on, if known. */
  nextKickoff: GameChip | null;
  gamesInPlay: number;
  gamesLeft: number;
};

export function resolvePhase(
  bundle: Pick<LeagueBundle, "scoringLive" | "draftStatus">,
  games: ScoreGame[] | undefined,
  nflState?: { season_type?: string } | null,
): PhaseInfo {
  const list = games ?? [];

  // NFL preseason: the scoreboard is full of finished exhibition games, which
  // would otherwise read as a settled fantasy week.
  if (nflState?.season_type === "pre" || nflState?.season_type === "off") {
    return { phase: "preseason", nextKickoff: null, gamesInPlay: 0, gamesLeft: 0 };
  }
  const inPlay = list.filter((g) => g.state === "in").length;
  const pre = list.filter((g) => g.state === "pre").length;
  const done = list.filter((g) => g.state === "post").length;

  let phase: Phase;
  if (bundle.draftStatus === "pending" || bundle.draftStatus === "live") {
    phase = "preseason";
  } else if (bundle.scoringLive || inPlay > 0) {
    phase = "live";
  } else if (pre > 0 && done > 0) {
    // Some games played, some not: the slate is underway but nothing is live.
    phase = "gameday";
  } else if (pre > 0 && done === 0) {
    phase = list.length > 0 ? "gameday" : "midweek";
  } else {
    phase = done > 0 ? "settled" : "midweek";
  }

  return { phase, nextKickoff: null, gamesInPlay: inPlay, gamesLeft: pre };
}

export type LineupIssue = {
  slot: string;
  kind: "empty" | "inactive" | "bye";
  player: RosterPlayer | null;
  reason: string;
};

export type LineupHealth = {
  issues: LineupIssue[];
  /** Starters whose game has not kicked off yet. */
  yetToPlay: number;
  /** True once every starting slot holds a player who can actually score. */
  ok: boolean;
};

const INACTIVE = new Set(["out", "ir", "doubtful", "suspended", "pup", "dnr", "na"]);

function isInactive(p: RosterPlayer): boolean {
  const s = (p.injury_status ?? p.status ?? "").toLowerCase().trim();
  if (!s) return false;
  return INACTIVE.has(s) || s.includes("inactive") || s.includes("injured reserve");
}

/**
 * The only thing in this product that can cost a manager a week with no
 * recourse: a starting slot that cannot score. Empty slots and players who are
 * ruled out both count; questionable does not, because that is a judgement
 * call rather than a mistake.
 */
export function lineupHealth(
  players: RosterPlayer[],
  rosterPositions: string[] | undefined,
  /** Team abbreviation to bye week, derived from the scoreboard. */
  byes?: Record<string, number>,
  week?: number,
): LineupHealth {
  const slots = labeledStartSlots(rosterPositions ?? []);
  const starters = players.filter((p) => p.slot === "starter");
  const bySlot = new Map(starters.map((p) => [p.starterSlot ?? "", p]));
  const issues: LineupIssue[] = [];
  let yetToPlay = 0;

  for (const { label } of slots) {
    const p = bySlot.get(label);
    if (!p) {
      issues.push({ slot: label, kind: "empty", player: null, reason: "No starter" });
      continue;
    }
    if (isInactive(p)) {
      const s = (p.injury_status ?? p.status ?? "out").toUpperCase();
      issues.push({ slot: label, kind: "inactive", player: p, reason: s });
    } else if (onBye(p, byes, week)) {
      // A starter on bye scores zero just as surely as an empty slot does.
      issues.push({ slot: label, kind: "bye", player: p, reason: "BYE" });
    }
    if (!p.game || p.game.state === "pre") yetToPlay += 1;
  }

  return { issues, yetToPlay, ok: issues.length === 0 };
}

export function onBye(
  p: { team?: string | null },
  byes: Record<string, number> | undefined,
  week: number | undefined,
): boolean {
  if (!byes || !week || !p.team) return false;
  return byes[p.team.toUpperCase()] === week;
}

/** Bench players who could legally fill a broken slot, best guess first. */
export function benchFor(slotLabel: string, players: RosterPlayer[]): RosterPlayer[] {
  return players
    .filter((p) => p.slot === "bench" && slotAccepts(p.position, slotLabel))
    .sort((a, b) => (b.weekPts ?? 0) - (a.weekPts ?? 0));
}
