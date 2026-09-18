import { getSql } from "@/lib/db";
import { buildMoveLedger } from "./ledger.server";
import { freezeFrom, gradeVsNoMove, type ManagerSpec, splitHoldout } from "./spec";

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_manager_specs (
    id text primary key,
    league_id text not null,
    name text not null,
    spec_json text not null,
    frozen_at timestamptz not null default now()
  )`);
  await sql.query(
    `create index if not exists ol_manager_specs_league on ol_manager_specs (league_id)`,
  );
  ready = true;
}

function newId(): string {
  return `ms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function freezeManagerSpec(
  leagueId: string,
  name: string,
): Promise<
  | { spec: ManagerSpec; id: string }
  | { refused: true; reason: string; holdout: ReturnType<typeof gradeVsNoMove> }
> {
  const ledger = await buildMoveLedger(leagueId);
  const split = splitHoldout(ledger.moves);
  const spec = freezeFrom(name, leagueId, split.discover, split.holdout);
  if (!spec) {
    return {
      refused: true,
      reason: "holdout did not beat always-no-move",
      holdout: gradeVsNoMove(split.holdout),
    };
  }
  await ensure();
  const sql = await getSql();
  const id = newId();
  await sql`
    insert into ol_manager_specs (id, league_id, name, spec_json, frozen_at)
    values (${id}, ${leagueId}, ${name}, ${JSON.stringify(spec)}, ${spec.frozenAt})
  `;
  return { spec, id };
}

export async function getManagerSpec(
  leagueId: string,
): Promise<{ id: string; spec: ManagerSpec } | null> {
  await ensure();
  const sql = await getSql();
  const row = (
    await sql<{ id: string; spec_json: string }>`
      select id, spec_json from ol_manager_specs
      where league_id = ${leagueId}
      order by frozen_at desc
      limit 1
    `
  )[0];
  if (!row) return null;
  return { id: row.id, spec: JSON.parse(row.spec_json) as ManagerSpec };
}

export async function gradeManagerSpec(leagueId: string): Promise<{
  specId: string | null;
  holdout: ReturnType<typeof gradeVsNoMove>;
  split: { discover: number; holdout: number };
}> {
  const ledger = await buildMoveLedger(leagueId);
  const split = splitHoldout(ledger.moves);
  const stored = await getManagerSpec(leagueId);
  return {
    specId: stored?.id ?? null,
    holdout: gradeVsNoMove(split.holdout),
    split: { discover: split.discover.length, holdout: split.holdout.length },
  };
}
