import { canonTeam, isDefense, playerTeam } from "./teams";
import type { GameSummary, MatchupPair, MatchupSide, SlimPlayer } from "./types";

/** A fantasy-relevant player in this game: one of yours, or your opponent's. */
export type TrackedPlayer = {
  player: SlimPlayer;
  side: "mine" | "opp";
  slot: string;
  /** Manager/team name the player is started by. */
  club: string;
  points: number | null;
  stats: Record<string, number> | null;
};

/**
 * Starters from your matchup whose NFL team is playing in this game. Your
 * side first, then the opponent's; each in slot order.
 */
export function trackedForGame(
  pair: MatchupPair | null | undefined,
  myRosterId: number | null | undefined,
  game: Pick<GameSummary, "home" | "away">,
  stats: Record<string, Record<string, number>> | null | undefined,
): TrackedPlayer[] {
  if (!pair || myRosterId == null) return [];
  const mineSide =
    pair.home.rosterId === myRosterId
      ? pair.home
      : pair.away?.rosterId === myRosterId
        ? pair.away
        : null;
  if (!mineSide) return [];
  const oppSide = mineSide === pair.home ? pair.away : pair.home;
  const teams = new Set(
    [game.home.abbr, game.away.abbr]
      .map((a) => canonTeam(a))
      .filter((a): a is string => Boolean(a)),
  );
  const out: TrackedPlayer[] = [];
  const push = (side: TrackedPlayer["side"], s: MatchupSide | null) => {
    if (!s) return;
    for (const line of s.starters) {
      const p = line.player;
      if (!p) continue;
      const team = playerTeam(p);
      if (!team || !teams.has(team)) continue;
      out.push({
        player: p,
        side,
        slot: line.slot,
        club: s.teamName,
        points: line.points,
        stats: line.stats ?? stats?.[p.player_id] ?? null,
      });
    }
  };
  push("mine", mineSide);
  push("opp", oppSide);
  return out;
}

export type PlaySegment =
  | { kind: "text"; text: string; start: number }
  | { kind: "player"; text: string; start: number; tracked: TrackedPlayer };

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ESPN play text names people as "C.Stroud" / "N.Collins"; scoring summaries
 * use "Woody Marks". Match either, by first initial + last name, never by last
 * name alone — "Smith" is not a player.
 */
function patternsFor(p: SlimPlayer): RegExp[] {
  if (isDefense(p.position)) return [];
  const parts = p.full_name.trim().split(/\s+/);
  const first = (p.first_name ?? parts[0] ?? "").trim();
  const lastRaw = (p.last_name ?? parts.slice(1).join(" ") ?? "").trim();
  // "St. Brown" / "Van Jefferson" keep their spaces; drop a Jr./III suffix.
  const last = lastRaw.replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, "").trim();
  if (!first || last.length < 2) return [];
  const fi = esc(first[0]!);
  // Apostrophes and hyphens vary by feed; let any of them match.
  const lastPat = esc(last)
    .replace(/['’`-]/g, "['’`-]?")
    .replace(/\\\./g, "\\.?")
    .replace(/\s+/g, "\\s?");
  return [
    new RegExp(`\\b${fi}\\.\\s?${lastPat}(?![A-Za-z])`, "i"),
    new RegExp(`\\b${esc(first)}\\s+${lastPat}(?![A-Za-z])`, "i"),
  ];
}

/** Split a play's text into plain runs and tagged player mentions. */
export function tagPlayText(text: string, tracked: TrackedPlayer[]): PlaySegment[] {
  if (!text) return [];
  if (!tracked.length) return [{ kind: "text", text, start: 0 }];
  const hits: Array<{ start: number; end: number; tracked: TrackedPlayer }> = [];
  for (const t of tracked) {
    for (const re of patternsFor(t.player)) {
      const g = new RegExp(re.source, `${re.flags}g`);
      for (const m of text.matchAll(g)) {
        if (m.index == null) continue;
        hits.push({ start: m.index, end: m.index + m[0].length, tracked: t });
      }
    }
  }
  if (!hits.length) return [{ kind: "text", text, start: 0 }];
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PlaySegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue; // overlap with a longer earlier match
    if (h.start > cursor)
      out.push({ kind: "text", text: text.slice(cursor, h.start), start: cursor });
    out.push({
      kind: "player",
      text: text.slice(h.start, h.end),
      start: h.start,
      tracked: h.tracked,
    });
    cursor = h.end;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor), start: cursor });
  return out;
}

export function playMentionsTracked(text: string, tracked: TrackedPlayer[]): boolean {
  return tagPlayText(text, tracked).some((s) => s.kind === "player");
}
