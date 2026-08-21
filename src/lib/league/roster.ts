import { START_SLOTS, slotLabel } from "@/lib/data/teams";

export type SlotKey =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "FLEX"
  | "WRRB_FLEX"
  | "REC_FLEX"
  | "SUPER_FLEX"
  | "K"
  | "DEF"
  | "BN"
  | "IR";

export const SLOT_STEPPERS: Array<{
  key: SlotKey;
  label: string;
  hint: string;
  max: number;
  starter: boolean;
}> = [
  { key: "QB", label: "QB", hint: "Quarterback", max: 2, starter: true },
  { key: "RB", label: "RB", hint: "Running back", max: 4, starter: true },
  { key: "WR", label: "WR", hint: "Wide receiver", max: 5, starter: true },
  { key: "TE", label: "TE", hint: "Tight end", max: 3, starter: true },
  { key: "FLEX", label: "FLEX", hint: "RB / WR / TE", max: 3, starter: true },
  { key: "WRRB_FLEX", label: "W/R", hint: "RB / WR only", max: 2, starter: true },
  { key: "REC_FLEX", label: "W/T", hint: "WR / TE only", max: 2, starter: true },
  { key: "SUPER_FLEX", label: "SFLEX", hint: "QB / RB / WR / TE", max: 2, starter: true },
  { key: "K", label: "K", hint: "Kicker", max: 2, starter: true },
  { key: "DEF", label: "D/ST", hint: "Team defense", max: 2, starter: true },
  { key: "BN", label: "Bench", hint: "Reserves", max: 12, starter: false },
  { key: "IR", label: "IR", hint: "Injured reserve", max: 4, starter: false },
];

export const ROSTER_PRESETS: Array<{ id: string; label: string; slots: string[] }> = [
  {
    id: "classic",
    label: "Classic",
    slots: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "K",
      "DEF",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
    ],
  },
  {
    id: "3wr",
    label: "3 WR",
    slots: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "K",
      "DEF",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
    ],
  },
  {
    id: "3wr-wr",
    label: "3 WR + W/R",
    slots: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "WR",
      "TE",
      "WRRB_FLEX",
      "K",
      "DEF",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
    ],
  },
  {
    id: "superflex",
    label: "Superflex",
    slots: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "SUPER_FLEX",
      "K",
      "DEF",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
    ],
  },
  {
    id: "2qb",
    label: "2 QB",
    slots: [
      "QB",
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "K",
      "DEF",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
    ],
  },
];

export type SlotCounts = Record<SlotKey, number>;

const EMPTY_COUNTS: SlotCounts = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  FLEX: 0,
  WRRB_FLEX: 0,
  REC_FLEX: 0,
  SUPER_FLEX: 0,
  K: 0,
  DEF: 0,
  BN: 0,
  IR: 0,
};

export function countsFromSlots(slots: string[]): SlotCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const s of slots) {
    if (s in counts) counts[s as SlotKey] += 1;
  }
  return counts;
}

export function slotsFromCounts(counts: Partial<SlotCounts>): string[] {
  const out: string[] = [];
  for (const row of SLOT_STEPPERS) {
    const n = Math.max(0, Math.min(row.max, Math.floor(counts[row.key] ?? 0)));
    for (let i = 0; i < n; i++) out.push(row.key);
  }
  return out;
}

export function describeSlots(slots: string[]): string {
  const counts = countsFromSlots(slots);
  const parts: string[] = [];
  for (const row of SLOT_STEPPERS) {
    const n = counts[row.key];
    if (!n) continue;
    parts.push(n === 1 ? row.label : `${n} ${row.label}`);
  }
  return parts.join(" · ");
}

/**
 * The same information as {@link describeSlots}, but still in pieces.
 *
 * A joined string has to be re-parsed or wrapped as one long run to be shown,
 * which is what made the house-rules card crowded. Handing the caller the parts
 * lets it lay them out as chips, a table, or a truncated list as it likes.
 */
export function slotBreakdown(slots: string[]): {
  starters: { key: SlotKey; label: string; count: number }[];
  bench: number;
  ir: number;
  /** Total bodies that start each week. */
  startCount: number;
} {
  const counts = countsFromSlots(slots);
  const starters: { key: SlotKey; label: string; count: number }[] = [];
  for (const row of SLOT_STEPPERS) {
    if (!row.starter) continue;
    const n = counts[row.key];
    if (n) starters.push({ key: row.key, label: row.label, count: n });
  }
  return {
    starters,
    bench: counts.BN,
    ir: counts.IR,
    startCount: starters.reduce((t, s) => t + s.count, 0),
  };
}

export function labeledStartSlots(slots: string[]): { key: string; label: string }[] {
  const seen: Record<string, number> = {};
  return slots
    .filter((s) => START_SLOTS.has(s))
    .map((key) => {
      seen[key] = (seen[key] ?? 0) + 1;
      const n = seen[key]!;
      const base = slotLabel(key);
      return { key, label: n === 1 ? base : `${base}${n}` };
    });
}

export function invertSlotKey(label: string | null | undefined): string {
  if (!label) return "FLEX";
  const stripped = String(label).replace(/\d+$/, "");
  if (stripped === "FLX") return "FLEX";
  if (stripped === "DST") return "DEF";
  if (stripped === "SF") return "SUPER_FLEX";
  if (stripped === "W/R") return "WRRB_FLEX";
  if (stripped === "W/T") return "REC_FLEX";
  return stripped;
}

/** Can this position occupy this starter slot key (QB, FLEX, WR2, …). */
export function slotAccepts(
  pos: string | null | undefined,
  slot: string | null | undefined,
): boolean {
  const p = (pos ?? "").toUpperCase();
  if (!p) return false;
  const s = invertSlotKey(slot);
  if (s === p) return true;
  if (s === "DEF") return p === "DEF" || p === "DST";
  if (s === "FLEX") return p === "RB" || p === "WR" || p === "TE";
  if (s === "WRRB_FLEX") return p === "RB" || p === "WR";
  if (s === "REC_FLEX") return p === "WR" || p === "TE";
  if (s === "SUPER_FLEX") return p === "QB" || p === "RB" || p === "WR" || p === "TE";
  return false;
}

export function normalizeSlots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...ROSTER_PRESETS[0]!.slots];
  const allowed = new Set(SLOT_STEPPERS.map((s) => s.key));
  const slots = raw.filter((s): s is string => typeof s === "string" && allowed.has(s as SlotKey));
  const starters = slots.filter((s) => START_SLOTS.has(s));
  if (starters.length < 5 || starters.length > 16) return [...ROSTER_PRESETS[0]!.slots];
  const benches = slots.filter((s) => s === "BN" || s === "IR");
  return [...starters, ...benches];
}

export function presetIdOf(slots: string[]): string | null {
  const a = slots.join(",");
  return ROSTER_PRESETS.find((p) => p.slots.join(",") === a)?.id ?? null;
}
