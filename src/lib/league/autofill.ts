import { gameHasStarted } from "@/lib/data/matchup-view";
import type { Projection, RosterPlayer } from "@/lib/data/types";
import { onBye } from "./phase";
import { labeledStartSlots, slotAccepts } from "./roster";

export type Swap = {
  slot: string;
  /** Who is coming in. */
  inPlayer: RosterPlayer;
  /** Who they replace, if the slot is occupied. */
  outPlayer: RosterPlayer | null;
};

/**
 * Fills every slot that cannot score, best available first.
 *
 * "Best" is the projection, which is season points per game under this league's
 * book with the unavailable zeroed out. Deliberately conservative: it only ever
 * touches slots that are already broken, so pressing the button can never
 * downgrade a lineup you set on purpose. A bench player who also cannot play is
 * never a candidate.
 */
export function planAutoFill(input: {
  players: RosterPlayer[];
  rosterPositions: string[];
  projections: Record<string, Projection>;
  byes?: Record<string, number>;
  week?: number;
}): Swap[] {
  const { players, rosterPositions, projections, byes, week } = input;
  const slots = labeledStartSlots(rosterPositions);
  const starters = players.filter((p) => p.slot === "starter");
  const bySlot = new Map(starters.map((p) => [p.starterSlot ?? "", p]));

  const proj = (p: RosterPlayer) => projections[p.player_id]?.points ?? 0;
  const locked = (p: RosterPlayer) => gameHasStarted(p.game);
  const canPlay = (p: RosterPlayer) => {
    if (locked(p)) return false;
    const r = projections[p.player_id]?.reason;
    if (r === "bye" || r === "out") return false;
    return !onBye(p, byes, week) && !isOut(p);
  };

  const pool = players
    .filter((p) => p.slot === "bench" && canPlay(p))
    .sort((a, b) => proj(b) - proj(a));

  const used = new Set<string>();
  const swaps: Swap[] = [];

  for (const { label } of slots) {
    const current = bySlot.get(label);
    // A started game is locked in that slot, even if the player is now out.
    if (current && locked(current)) continue;
    const broken = !current || !canPlay(current);
    if (!broken) continue;

    const pick = pool.find(
      (p) => !used.has(p.player_id) && slotAccepts(p.position, label) && proj(p) > 0,
    );
    if (!pick) continue;

    used.add(pick.player_id);
    swaps.push({ slot: label, inPlayer: pick, outPlayer: current ?? null });
  }

  return swaps;
}

const OUT = new Set(["out", "ir", "doubtful", "suspended", "pup", "na", "dnr"]);
function isOut(p: RosterPlayer): boolean {
  const s = (p.injury_status ?? p.status ?? "").toLowerCase().trim();
  return s.length > 0 && OUT.has(s);
}
