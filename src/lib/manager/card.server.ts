import { getSql } from "@/lib/db";
import { buildMoveLedger, remainingFor } from "./ledger.server";
import { type Call, decideCall, type LabeledMove } from "./spec";
import { getManagerSpec } from "./spec.server";

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_advice_receipts (
    id text primary key,
    league_id text not null,
    roster_id int not null,
    week int not null,
    payload_json text not null,
    at timestamptz not null default now()
  )`);
  ready = true;
}

function newId(): string {
  return `adv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type WireCard = {
  leagueId: string;
  rosterId: number;
  week: number;
  remaining: number;
  budget: number;
  call: Call;
  receiptId: string;
  generatedAt: string;
};

export async function getWireCard(
  leagueId: string,
  rosterId: number,
  week?: number,
): Promise<WireCard> {
  const sleeper = await import("@/lib/data/sleeper.server");
  const nfl = await sleeper.fetchNflState();
  const wk = week ?? nfl.display_week ?? nfl.week;
  const [ledger, purse, stored, wire] = await Promise.all([
    buildMoveLedger(leagueId),
    remainingFor(leagueId, rosterId),
    getManagerSpec(leagueId),
    sleeper.loadWire(leagueId, "ALL", "", "available").catch(() => []),
  ]);
  const candidates = wire.slice(0, 40).map((p) => ({
    playerId: p.player_id,
    pos: p.position ?? null,
    sleeperProj: typeof p.pts === "number" ? p.pts : null,
    last3: null as number | null,
  }));
  const call = decideCall({
    remaining: purse.remaining,
    candidates,
    history: ledger.moves,
    spec: stored?.spec ?? null,
  });
  const receipt = {
    leagueId,
    rosterId,
    week: wk,
    remaining: purse.remaining,
    budget: purse.budget,
    call,
    specId: stored?.id ?? null,
    comps:
      call.kind === "add"
        ? ledger.moves.filter((m) => m.type === "waiver_won" && m.pos === call.pos).slice(0, 25)
        : ledger.moves.filter((m) => m.type === "waiver_won").slice(0, 15),
    sources: ["sleeper_proj", "last3", "season_avg"],
  };
  await ensure();
  const sql = await getSql();
  const receiptId = newId();
  await sql`
    insert into ol_advice_receipts (id, league_id, roster_id, week, payload_json, at)
    values (${receiptId}, ${leagueId}, ${rosterId}, ${wk}, ${JSON.stringify(receipt)}, now())
  `;
  return {
    leagueId,
    rosterId,
    week: wk,
    remaining: purse.remaining,
    budget: purse.budget,
    call,
    receiptId,
    generatedAt: new Date().toISOString(),
  };
}

export type AdviceReceipt = {
  leagueId: string;
  rosterId: number;
  week: number;
  remaining: number;
  budget: number;
  call: Call;
  specId: string | null;
  comps: LabeledMove[];
  sources: string[];
};

export async function getAdviceReceipt(id: string): Promise<AdviceReceipt> {
  await ensure();
  const sql = await getSql();
  const row = (
    await sql<{ payload_json: string }>`
      select payload_json from ol_advice_receipts where id = ${id}
    `
  )[0];
  if (!row) throw new Error("unknown receipt");
  return JSON.parse(row.payload_json) as AdviceReceipt;
}
