import type { GameDrive, GamePlay } from "./types";

/**
 * Monotonic "seconds elapsed" for a play: later plays are larger, across
 * quarters. Clock is time *remaining* in the period, so it runs backwards.
 */
export function playWhen(period: number, clock: string): number {
  const [m, s] = clock.split(":").map((n) => Number.parseInt(n, 10));
  const remaining = (Number.isFinite(m) ? m! : 0) * 60 + (Number.isFinite(s) ? s! : 0);
  return (period || 0) * 900 + (900 - remaining);
}

function newestWhen(d: GameDrive): number {
  let max = -1;
  for (const p of d.plays) max = Math.max(max, playWhen(p.period, p.clock));
  return max;
}

/**
 * ESPN ships `previous[]` plus a `current` that can lag behind — the same
 * drive twice, or an already-finished punt still labelled current. Keep one
 * copy per id (the fuller one) and order by when its newest play happened.
 */
function dedupe(drives: GameDrive[]): GameDrive[] {
  const byId = new Map<string, GameDrive>();
  for (const d of drives) {
    const prev = byId.get(d.id);
    if (!prev || d.plays.length >= prev.plays.length) byId.set(d.id, d);
  }
  return [...byId.values()];
}

/** Live feed: newest drive first, newest play of that drive first. */
export function drivesForLiveFeed(drives: GameDrive[], live: boolean): GameDrive[] {
  if (!live) return drives;
  const list = dedupe(drives).sort((a, b) => newestWhen(b) - newestWhen(a));
  const current = list[0];
  if (!current) return list;
  const plays = [...current.plays].sort(
    (a, b) => playWhen(b.period, b.clock) - playWhen(a.period, a.clock),
  );
  return [{ ...current, plays }, ...list.slice(1)];
}

/** The most recent snap across every drive, by game clock rather than array order. */
export function lastPlayText(drives: GameDrive[]): string | null {
  let best: GamePlay | null = null;
  let bestWhen = -1;
  for (const d of drives) {
    for (const p of d.plays) {
      if (!p.text) continue;
      const w = playWhen(p.period, p.clock);
      if (w >= bestWhen) {
        bestWhen = w;
        best = p;
      }
    }
  }
  return best?.text ?? null;
}

/** "9:41 - 3rd" → { clock: "9:41", period: 3 }. */
export function parseDetailClock(detail: string | null | undefined): {
  clock: string;
  period: number;
} | null {
  if (!detail) return null;
  const m = detail.match(/(\d{1,2}:\d{2})\s*-\s*(\d)(?:st|nd|rd|th)?/i);
  if (!m) return null;
  return { clock: m[1]!, period: Number(m[2]) };
}

/**
 * The header's `lastPlay` is often a beat ahead of the drive list. Pin it on
 * top of the live drive as a synthetic play until PBP catches up; never twice.
 */
export function withLiveSnap(
  drives: GameDrive[],
  lastPlay: string | null | undefined,
  detail: string | null | undefined,
): GameDrive[] {
  const head = drives[0];
  if (!head || !lastPlay) return drives;
  const text = lastPlay.trim();
  if (!text || head.plays.some((p) => p.text.trim() === text)) return drives;
  const when = parseDetailClock(detail);
  const newest = head.plays[0];
  const snap: GamePlay = {
    id: "live-snap",
    text,
    type: "",
    scoring: false,
    period: when?.period ?? newest?.period ?? 0,
    clock: when?.clock ?? "",
    awayScore: newest?.awayScore ?? 0,
    homeScore: newest?.homeScore ?? 0,
    yardage: null,
  };
  return [{ ...head, plays: [snap, ...head.plays] }, ...drives.slice(1)];
}

/** Short right-column label for a play: "+11", "-3", "INC", "TD", "FG"… */
export function playYardLabel(
  p: GamePlay,
): { text: string; tone: "pos" | "neg" | "td" | "flat" } | null {
  const t = p.type.toLowerCase();
  if (p.scoring && /touchdown/.test(t)) return { text: "TD", tone: "td" };
  if (/field goal good/.test(t)) return { text: "FG", tone: "td" };
  if (/field goal missed|field goal/.test(t) && !/good/.test(t))
    return { text: "NO GOOD", tone: "neg" };
  if (/interception/.test(t)) return { text: "INT", tone: "neg" };
  if (/fumble/.test(t) && /lost|recovery \(opponent\)/.test(t)) return { text: "FUM", tone: "neg" };
  if (/incompletion|incomplete/.test(t)) return { text: "INC", tone: "neg" };
  if (/sack/.test(t) && typeof p.yardage === "number") {
    return { text: `${p.yardage}`, tone: "neg" };
  }
  if (/punt|kickoff|timeout|end of|two-minute|penalty|coin toss|official/.test(t)) return null;
  if (
    typeof p.yardage === "number" &&
    (/rush|reception|pass|scramble/.test(t) || p.yardage !== 0)
  ) {
    if (p.yardage > 0) return { text: `+${p.yardage}`, tone: "pos" };
    if (p.yardage < 0) return { text: `${p.yardage}`, tone: "neg" };
    return { text: "0", tone: "flat" };
  }
  return null;
}

/**
 * Where the ball is on a 0–100 scale from the offense's own goal line, for a
 * drive start like "HOU 20" and a spot like "LV 38". Null when unparseable.
 */
export function fieldPct(team: string, spot: string | null | undefined): number | null {
  const m = spot?.trim().match(/^([A-Z]{2,4})\s+(\d{1,2})$/i);
  if (!m) return null;
  const side = m[1]!.toUpperCase();
  const yd = Number(m[2]);
  if (yd === 50) return 50;
  return side === team.toUpperCase() ? yd : 100 - yd;
}

/** "2nd & 7 · LV 38" → the spot half, if present. */
export function spotFromSituation(situation: string | null | undefined): string | null {
  if (!situation) return null;
  const bits = situation.split("·").map((s) => s.trim());
  const spot = bits.find((b) => /^[A-Z]{2,4}\s+\d{1,2}$/i.test(b));
  return spot ?? null;
}
