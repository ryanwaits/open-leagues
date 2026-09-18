/**
 * Freeze / grade / Monday call. Pure. A spec is a bid policy derived from
 * labeled (or unlabeled) history; the holdout is the last 4 weeks of the
 * earliest complete season, or the later season when two exist.
 */

import { type MoveRow, type MoveType, round1 } from "./ledger";

export type Motive = "injury_fill" | "bye_stream" | "stash" | "panic" | "nothing" | "other";

export type LabeledMove = MoveRow & {
  leagueId: string;
  season: string;
  pos: string | null;
  playerName: string | null;
  teamName: string | null;
  motive: Motive | null;
  bidAggression: number | null;
  mustMove: number | null;
  jevModel: string | null;
  jevConfidence: number | null;
};

export type HoldoutSplit = {
  discover: LabeledMove[];
  holdout: LabeledMove[];
  holdoutWeeks: { season: string; week: number }[];
};

export type PosBand = { p25: number; p50: number; p75: number; n: number };

export type ManagerSpec = {
  name: string;
  leagueId: string;
  /** Winning-bid as a share of remaining FAAB, by position. */
  bidPctRemaining: Record<string, PosBand>;
  /** Sit out when the top available projection is below this (points). */
  minProj: number;
  holdout: {
    n: number;
    pointsVsNoMove: number;
    faabSpent: number;
    beatNoMove: boolean;
  };
  frozenAt: string;
};

export type Call =
  | { kind: "no-move"; reason: string; source: "spec" | "quantile" }
  | {
      kind: "add";
      playerId: string;
      pos: string | null;
      dropPlayerId: string | null;
      bidLo: number;
      bidHi: number;
      source: "spec" | "quantile";
      comps: number;
    };

export type Candidate = {
  playerId: string;
  pos: string | null;
  sleeperProj: number | null;
  last3: number | null;
  seasonAvg: number | null;
};

export type SeatPlayer = {
  playerId: string;
  name: string | null;
  pos: string | null;
  slot: "starter" | "bench" | "ir" | "taxi";
  injury: string | null;
  bye: boolean;
};

export type Seat = {
  starterSlots: Record<string, number>;
  players: SeatPlayer[];
};

/** Out / IR / doubtful — not Questionable. Q is still a starter you own. */
const OUT = new Set(["out", "ir", "doubtful", "suspended", "pup", "na", "dnr"]);

export function startSlotsFrom(positions: readonly string[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const s of positions) {
    if (s === "QB" || s === "SUPER_FLEX") n.QB = (n.QB ?? 0) + 1;
    else if (s === "RB" || s === "WR" || s === "TE" || s === "K" || s === "DEF") {
      n[s] = (n[s] ?? 0) + 1;
    }
  }
  return n;
}

function isOut(injury: string | null): boolean {
  return OUT.has((injury ?? "").toLowerCase());
}

/**
 * Position is filled when we already have enough healthy (not Out, not bye,
 * not IR) bodies to cover start slots. A Q starter plus a healthy backup is
 * filled. An Out starter with no healthy backup is a hole.
 */
export function posFilled(seat: Seat, pos: string | null): boolean {
  if (!pos) return false;
  const need = seat.starterSlots[pos] ?? 0;
  if (need <= 0) return true;
  const atPos = seat.players.filter((p) => p.pos === pos && p.slot !== "taxi");
  const healthy = atPos.filter((p) => p.slot !== "ir" && !p.bye && !isOut(p.injury));
  return healthy.length >= need;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

export function band(values: number[]): PosBand {
  const s = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return { p25: 0, p50: 0, p75: 0, n: 0 };
  return {
    p25: round1(quantile(s, 0.25)),
    p50: round1(quantile(s, 0.5)),
    p75: round1(quantile(s, 0.75)),
    n: s.length,
  };
}

export function splitHoldout(moves: LabeledMove[]): HoldoutSplit {
  const seasons = [...new Set(moves.map((m) => m.season))].sort();
  if (seasons.length >= 2) {
    const later = seasons[seasons.length - 1];
    const holdout = moves.filter((m) => m.season === later);
    const laterWeeks = new Set(holdout.map((m) => m.week));
    if (laterWeeks.size >= 4) {
      const discover = moves.filter((m) => m.season !== later);
      return { discover, holdout, holdoutWeeks: uniqueWeeks(holdout) };
    }
  }
  const weeks = [...new Set(moves.map((m) => m.week))].sort((a, b) => a - b);
  const cut = weeks.length <= 4 ? Math.max(1, weeks.length - 1) : weeks.length - 4;
  const holdSet = new Set(weeks.slice(cut));
  const discover = moves.filter((m) => !holdSet.has(m.week));
  const holdout = moves.filter((m) => holdSet.has(m.week));
  return { discover, holdout, holdoutWeeks: uniqueWeeks(holdout) };
}

function uniqueWeeks(moves: LabeledMove[]): { season: string; week: number }[] {
  const seen = new Set<string>();
  const out: { season: string; week: number }[] = [];
  for (const m of moves) {
    const k = `${m.season}:${m.week}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ season: m.season, week: m.week });
  }
  return out;
}

/** Winning bids as a percent of remaining, by position, from discover weeks. */
export function bidPctByPos(discover: LabeledMove[]): Record<string, PosBand> {
  const buckets = new Map<string, number[]>();
  for (const m of discover) {
    if (m.type !== "waiver_won" || m.bid == null || m.remainingBefore <= 0) continue;
    const pos = m.pos ?? "UNK";
    const pct = (100 * m.bid) / m.remainingBefore;
    const list = buckets.get(pos) ?? [];
    list.push(pct);
    buckets.set(pos, list);
  }
  const out: Record<string, PosBand> = {};
  for (const [pos, xs] of buckets) out[pos] = band(xs);
  return out;
}

/**
 * Points vs always-no-move: won adds' actual minus the dropped player's actual
 * that week (0 if unknown). Always-no-move scores 0.
 */
export function gradeVsNoMove(holdout: LabeledMove[]): {
  n: number;
  pointsVsNoMove: number;
  faabSpent: number;
  beatNoMove: boolean;
} {
  const wins = holdout.filter((m) => m.type === "waiver_won");
  let points = 0;
  let faab = 0;
  for (const m of wins) {
    points += m.actual ?? 0;
    faab += m.bid ?? 0;
  }
  const n = wins.length;
  const pointsVsNoMove = round1(points);
  return { n, pointsVsNoMove, faabSpent: faab, beatNoMove: n > 0 && pointsVsNoMove > 0 };
}

export function freezeFrom(
  name: string,
  leagueId: string,
  discover: LabeledMove[],
  holdout: LabeledMove[],
  now = new Date().toISOString(),
): ManagerSpec | null {
  const holdoutGrade = gradeVsNoMove(holdout);
  if (!holdoutGrade.beatNoMove) return null;
  const wonProj = discover
    .filter((m) => m.type === "waiver_won" && m.sleeperProj != null)
    .map((m) => m.sleeperProj as number);
  const minProj = wonProj.length ? band(wonProj).p25 : 0;
  return {
    name,
    leagueId,
    bidPctRemaining: bidPctByPos(discover),
    minProj,
    holdout: holdoutGrade,
    frozenAt: now,
  };
}

function scoreOf(c: Candidate): number {
  return c.sleeperProj ?? c.last3 ?? c.seasonAvg ?? 0;
}

export function remainingWindow(remaining: number): { lo: number; hi: number } {
  return { lo: remaining * 0.7, hi: remaining * 1.3 };
}

/** Same filter the bid band uses — the receipt must print this set, not tape order. */
export function comparableMoves(
  history: LabeledMove[],
  pos: string | null,
  remaining: number,
): LabeledMove[] {
  const win = remainingWindow(remaining);
  const out: LabeledMove[] = [];
  for (const m of history) {
    if (m.type !== "waiver_won" || m.bid == null) continue;
    if (pos && m.pos && m.pos !== pos) continue;
    if (m.remainingBefore > 0 && (m.remainingBefore < win.lo || m.remainingBefore > win.hi)) {
      continue;
    }
    out.push(m);
  }
  return out;
}

export function comparableBids(
  history: LabeledMove[],
  pos: string | null,
  remaining: number,
): number[] {
  return comparableMoves(history, pos, remaining).map((m) => m.bid as number);
}

export function decideCall(input: {
  remaining: number;
  candidates: Candidate[];
  history: LabeledMove[];
  spec: ManagerSpec | null;
  seat: Seat;
}): Call {
  const source = input.spec ? "spec" : "quantile";
  if (input.remaining <= 0) return { kind: "no-move", reason: "no FAAB left", source };
  const ranked = [...input.candidates].sort((a, b) => scoreOf(b) - scoreOf(a));
  if (ranked.every((c) => scoreOf(c) <= 0)) {
    return { kind: "no-move", reason: "wire is empty", source };
  }

  const minProj = input.spec?.minProj ?? 0;
  for (const top of ranked) {
    if (scoreOf(top) <= 0) continue;
    if (input.spec && scoreOf(top) < minProj) continue;
    if (posFilled(input.seat, top.pos)) continue;

    const pos = top.pos ?? "UNK";
    const comps = comparableBids(input.history, top.pos, input.remaining);
    let lo: number;
    let hi: number;
    let n = comps.length;
    if (input.spec?.bidPctRemaining[pos] && input.spec.bidPctRemaining[pos].n >= 3) {
      const b = input.spec.bidPctRemaining[pos];
      lo = Math.round((b.p25 / 100) * input.remaining);
      hi = Math.round((b.p75 / 100) * input.remaining);
    } else if (n >= 3) {
      const b = band(comps);
      lo = Math.round(b.p25);
      hi = Math.round(b.p75);
    } else {
      lo = Math.round(input.remaining * 0.05);
      hi = Math.round(input.remaining * 0.15);
      n = comps.length;
    }
    hi = Math.min(hi, input.remaining);
    lo = Math.min(lo, hi);
    if (hi <= 0) continue;

    return {
      kind: "add",
      playerId: top.playerId,
      pos: top.pos,
      dropPlayerId: null,
      bidLo: lo,
      bidHi: hi,
      source,
      comps: n,
    };
  }

  return { kind: "no-move", reason: "no hole on the roster", source };
}

export function asLabeled(
  row: MoveRow,
  extra: Pick<LabeledMove, "leagueId" | "season"> & Partial<LabeledMove>,
): LabeledMove {
  return {
    ...row,
    pos: extra.pos ?? null,
    playerName: extra.playerName ?? null,
    teamName: extra.teamName ?? null,
    motive: extra.motive ?? null,
    bidAggression: extra.bidAggression ?? null,
    mustMove: extra.mustMove ?? null,
    jevModel: extra.jevModel ?? null,
    jevConfidence: extra.jevConfidence ?? null,
    ...extra,
  };
}

export const MOVE_TYPES: MoveType[] = ["waiver_won", "waiver_lost", "fa", "drop"];
