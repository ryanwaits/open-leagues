import type { GameDrive, GamePlay } from "./types";

/** Later in the game → larger. Clock counts down within a period. */
export function playWhen(period: number, clock: string): number {
  const m = clock.trim().match(/^(\d+):(\d+)/);
  const left = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return period * 3600 + (3600 - Math.min(3599, left));
}

function driveWhen(d: GameDrive): number {
  let t = 0;
  for (const p of d.plays) t = Math.max(t, playWhen(p.period, p.clock));
  return t;
}

export function parseStatusClock(
  detail: string | null | undefined,
): { clock: string; period: number } | null {
  if (!detail) return null;
  const m = detail.match(/(\d+:\d+)\s*-\s*(\d+)/);
  if (!m || m[1] == null || m[2] == null) return null;
  return { clock: m[1], period: Number(m[2]) };
}

/**
 * Live feed: the drive with the latest snap first, that snap first.
 * ESPN often leaves `drives.current` on a finished drive after the header has
 * moved on — array order is not recency.
 */
export function drivesForLiveFeed(drives: GameDrive[], live: boolean): GameDrive[] {
  if (!live || drives.length === 0) return drives;
  const unique = new Map<string, GameDrive>();
  for (const d of drives) unique.set(d.id, d);
  const list = [...unique.values()].sort((a, b) => driveWhen(b) - driveWhen(a));
  const current = list[0];
  if (!current) return drives;
  return [{ ...current, plays: [...current.plays].reverse() }, ...list.slice(1)];
}

export function lastPlayText(drives: GameDrive[]): string | null {
  const live = drivesForLiveFeed(drives, true);
  return live[0]?.plays[0]?.text ?? null;
}

/** Pin the header's last play to the top when PBP has not caught up. */
export function withLiveSnap(
  drives: GameDrive[],
  lastPlay: string | null | undefined,
  detail: string | null | undefined,
): GameDrive[] {
  const text = lastPlay?.trim();
  if (!text || drives.length === 0) return drives;
  const top = drives[0];
  if (!top) return drives;
  if (top.plays.some((p) => p.text === text)) return drives;
  const clock = parseStatusClock(detail);
  const snap: GamePlay = {
    id: "live-snap",
    text,
    type: "Play",
    scoring: false,
    period: clock?.period ?? top.plays[0]?.period ?? 0,
    clock: clock?.clock ?? top.plays[0]?.clock ?? "",
    awayScore: top.plays[0]?.awayScore ?? 0,
    homeScore: top.plays[0]?.homeScore ?? 0,
    yardage: null,
  };
  return [{ ...top, plays: [snap, ...top.plays] }, ...drives.slice(1)];
}
