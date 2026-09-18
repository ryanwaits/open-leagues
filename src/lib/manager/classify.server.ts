import { classifyOne, typesafeKey } from "./jev.server";
import { buildMoveLedger, writeLabels } from "./ledger.server";
import type { LabeledMove } from "./spec";

export async function classifyMoves(
  leagueId: string,
): Promise<{ classified: number; skipped: number; reason: string | null; moves: LabeledMove[] }> {
  const key = typesafeKey();
  const ledger = await buildMoveLedger(leagueId);
  if (!key) {
    return {
      classified: 0,
      skipped: ledger.moves.length,
      reason: "no TYPESAFE_API_KEY",
      moves: ledger.moves,
    };
  }
  const unlabeled = ledger.moves.filter((m) => m.motive == null && m.type !== "drop");
  const labeled: LabeledMove[] = [];
  for (const m of unlabeled) {
    try {
      labeled.push(await classifyOne(m, key));
    } catch {
      labeled.push(m);
    }
  }
  const bySeason = new Map<string, LabeledMove[]>();
  for (const m of labeled) {
    const list = bySeason.get(`${m.leagueId}:${m.season}`) ?? [];
    list.push(m);
    bySeason.set(`${m.leagueId}:${m.season}`, list);
  }
  for (const [k, rows] of bySeason) {
    const [id, season] = k.split(":");
    if (id && season) await writeLabels(id, season, rows);
  }
  const next = await buildMoveLedger(leagueId);
  return {
    classified: labeled.filter((m) => m.motive != null).length,
    skipped: 0,
    reason: null,
    moves: next.moves,
  };
}
