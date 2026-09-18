import { getSql } from "@/lib/db";
import { buildMoveLedger, remainingFor } from "./ledger.server";
import {
  band,
  type Call,
  comparableMoves,
  decideCall,
  type LabeledMove,
  remainingWindow,
  type Seat,
  startSlotsFrom,
} from "./spec";
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

export type SeatFact = {
  starterSlots: Record<string, number>;
  players: {
    name: string | null;
    pos: string | null;
    slot: string;
    injury: string | null;
    bye: boolean;
  }[];
  lastAddAtPos: LabeledMove | null;
};

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

export type AdviceReceipt = {
  leagueId: string;
  rosterId: number;
  week: number;
  remaining: number;
  budget: number;
  call: Call;
  specId: string | null;
  seat: SeatFact;
  comps: LabeledMove[];
  compBand: {
    n: number;
    p25: number;
    p50: number;
    p75: number;
    remainingLo: number;
    remainingHi: number;
  } | null;
  candidateSources: {
    playerId: string;
    sleeperProj: number | null;
    last3: number | null;
    seasonAvg: number | null;
  } | null;
  sources: string[];
};

function lastAddAtPos(
  moves: LabeledMove[],
  rosterId: number,
  pos: string | null,
): LabeledMove | null {
  if (!pos) return null;
  const hits = moves.filter(
    (m) => m.rosterId === rosterId && m.pos === pos && (m.type === "waiver_won" || m.type === "fa"),
  );
  hits.sort((a, b) => b.week - a.week || b.seq - a.seq);
  return hits[0] ?? null;
}

export async function getWireCard(
  leagueId: string,
  rosterId: number,
  week?: number,
): Promise<WireCard> {
  const sleeper = await import("@/lib/data/sleeper.server");
  const nfl = await sleeper.fetchNflState();
  const wk = week ?? nfl.display_week ?? nfl.week;
  const season = String(nfl.season);
  const [ledger, purse, stored, wire, team, bundle, byes] = await Promise.all([
    buildMoveLedger(leagueId),
    remainingFor(leagueId, rosterId),
    getManagerSpec(leagueId),
    sleeper.loadWire(leagueId, "ALL", "", "available").catch(() => []),
    sleeper.loadTeam(leagueId, rosterId, wk).catch(() => null),
    sleeper.loadLeagueBundle(leagueId).catch(() => null),
    import("@/lib/data/byes.server").then((b) =>
      b.byeWeeks(season).catch((): Record<string, number> => ({})),
    ),
  ]);

  const positions = bundle?.league.roster_positions ?? [];
  const seat: Seat = {
    starterSlots: startSlotsFrom(positions),
    players: (team?.players ?? []).map((p) => ({
      playerId: p.player_id,
      name: p.full_name ?? null,
      pos: p.position ?? null,
      slot: p.slot,
      injury: p.injury_status ?? null,
      bye: Boolean(p.team && byes[p.team] === wk),
    })),
  };

  const ids = wire.slice(0, 80).map((p) => p.player_id);
  const { sourceValues } = await import("@/lib/receipts/sources.server");
  const values = await sourceValues({ leagueId, season, week: wk, playerIds: ids });
  const candidates = ids.map((id) => {
    const p = sleeper.getPlayer(id);
    const v = values[id];
    return {
      playerId: id,
      pos: p?.position ?? null,
      sleeperProj: v?.sleeper_proj ?? null,
      last3: v?.last3 ?? null,
      seasonAvg: v?.season_avg ?? null,
    };
  });

  const call = decideCall({
    remaining: purse.remaining,
    candidates,
    history: ledger.moves,
    spec: stored?.spec ?? null,
    seat,
  });

  const comps = call.kind === "add" ? comparableMoves(ledger.moves, call.pos, purse.remaining) : [];
  const win = remainingWindow(purse.remaining);
  const bids = comps.map((m) => m.bid).filter((n): n is number => typeof n === "number");
  const picked = call.kind === "add" ? candidates.find((c) => c.playerId === call.playerId) : null;

  const receipt: AdviceReceipt = {
    leagueId,
    rosterId,
    week: wk,
    remaining: purse.remaining,
    budget: purse.budget,
    call,
    specId: stored?.id ?? null,
    seat: {
      starterSlots: seat.starterSlots,
      players: seat.players.map((p) => ({
        name: p.name,
        pos: p.pos,
        slot: p.slot,
        injury: p.injury,
        bye: p.bye,
      })),
      lastAddAtPos: call.kind === "add" ? lastAddAtPos(ledger.moves, rosterId, call.pos) : null,
    },
    comps,
    compBand:
      call.kind === "add"
        ? { ...band(bids), remainingLo: Math.round(win.lo), remainingHi: Math.round(win.hi) }
        : null,
    candidateSources: picked
      ? {
          playerId: picked.playerId,
          sleeperProj: picked.sleeperProj,
          last3: picked.last3,
          seasonAvg: picked.seasonAvg,
        }
      : null,
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
