/**
 * Named sources on the bench receipt. Each source is a number a manager could
 * have looked at before kickoff; the receipt says what each one would have
 * called, and whether it was right. Names and values, never a bare count —
 * "Sleeper's projection said start him" is what a league chat repeats.
 */
export type SourceId = "sleeper_proj" | "last3" | "season_avg";

export const SOURCE_LABEL: Record<SourceId, string> = {
  sleeper_proj: "Sleeper projection",
  last3: "Last 3 weeks",
  season_avg: "Season average",
};

/** What each source said about one player, pre-kickoff, under the league's book. */
export type SourceValues = {
  sleeper_proj: number | null;
  last3: number | null;
  season_avg: number | null;
};

export type SourceCall = {
  source: SourceId;
  label: string;
  /** The source's number for the player who started. Null when it had none. */
  started: number | null;
  /** The source's number for the player who should have. */
  best: number | null;
  /** "start" = it favoured the bench player; "hold" = it favoured the starter. */
  pick: "start" | "hold" | "none";
};

const ORDER: SourceId[] = ["sleeper_proj", "last3", "season_avg"];

export function callsFor(
  startedId: string | null,
  bestId: string,
  values: Record<string, SourceValues>,
): SourceCall[] {
  return ORDER.map((source) => {
    const best = values[bestId]?.[source] ?? null;
    const started = startedId ? (values[startedId]?.[source] ?? null) : null;
    let pick: SourceCall["pick"] = "none";
    if (best != null && (started == null || best > started)) pick = "start";
    else if (best != null && started != null && best <= started) pick = "hold";
    return { source, label: SOURCE_LABEL[source], started, best, pick };
  });
}

/** "2 of 3 said start." */
export function agreement(calls: SourceCall[]): { start: number; hold: number; of: number } {
  const voting = calls.filter((c) => c.pick !== "none");
  return {
    start: voting.filter((c) => c.pick === "start").length,
    hold: voting.filter((c) => c.pick === "hold").length,
    of: voting.length,
  };
}

/** One line for a card: who said start, who said hold, by name. */
export function agreementLine(
  calls: SourceCall[],
  bestName: string,
  startedName: string | null,
): string | null {
  const said = calls.filter((c) => c.pick !== "none");
  if (said.length === 0) return null;
  const starts = said.filter((c) => c.pick === "start").map((c) => c.label);
  const holds = said.filter((c) => c.pick === "hold").map((c) => c.label);
  const parts: string[] = [];
  if (starts.length) parts.push(`${list(starts)} said start ${bestName}`);
  if (holds.length && startedName) parts.push(`${list(holds)} said hold ${startedName}`);
  return parts.length ? `${parts.join("; ")}.` : null;
}

function list(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}
