import { getSql } from "@/lib/db";
import type { StakingPolicy } from "./bankroll";
import type { Bet, GameFilter, Market, Side } from "./bets";

/**
 * A strategy is frozen once. The discover skill writes it after it has a
 * record on seasons it did not tune on; the run skill grades exactly this
 * spec on weeks the discovery never saw. Freezing is what keeps a Tuesday
 * digest honest — the rule cannot drift toward what worked last week.
 *
 * Owned by a user, not a league: a strategy is a person's, and it can be
 * about real games or about a fantasy book.
 */
export type StrategySpec = {
  /** The words the person used. Kept verbatim. */
  words: string;
  seasons: { discovered: number[]; holdout: number[] };
  filter: GameFilter;
  bet: { market: Market; side: Side; stake?: number };
  staking: StakingPolicy;
  bankroll: number;
};

export type Strategy = {
  id: string;
  userId: string;
  name: string;
  spec: StrategySpec;
  frozenAt: string;
};

export type LabRun = {
  id: string;
  strategyId: string;
  /** "discover" for the freezing record, "weekly" for a Tuesday, "season" for a to-date pass. */
  kind: "discover" | "weekly" | "season";
  season: number | null;
  week: number | null;
  /** summarizeRun's output, verbatim. */
  summary: Record<string, unknown>;
  /** simulateBankroll's output, verbatim, when the run staked. */
  bankroll: Record<string, unknown> | null;
  /** The bets graded, so a run can be re-checked. */
  bets: Bet[];
  /** The digest as written, if the agent wrote one. */
  digest: string | null;
  at: string;
};

let ready = false;
async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_lab_strategies (
  id text primary key,
  user_id text not null,
  name text not null,
  spec_json text not null,
  frozen_at timestamptz not null default now()
)`);
  await sql.query(
    `create index if not exists ol_lab_strategies_user on ol_lab_strategies (user_id)`,
  );
  await sql.query(`create table if not exists ol_lab_runs (
  id text primary key,
  strategy_id text not null,
  user_id text not null,
  kind text not null,
  season int,
  week int,
  summary_json text not null,
  bankroll_json text,
  bets_json text not null default '[]',
  digest text,
  at timestamptz not null default now()
)`);
  await sql.query(
    `create index if not exists ol_lab_runs_strategy on ol_lab_runs (strategy_id, at)`,
  );
  ready = true;
}

const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export async function freezeStrategy(
  userId: string,
  name: string,
  spec: StrategySpec,
): Promise<Strategy> {
  await ensure();
  const sql = await getSql();
  const id = newId("lab");
  await sql`
    insert into ol_lab_strategies (id, user_id, name, spec_json) values (${id}, ${userId}, ${name}, ${JSON.stringify(spec)})
  `;
  return { id, userId, name, spec, frozenAt: new Date().toISOString() };
}

type StratRow = { id: string; user_id: string; name: string; spec_json: string; frozen_at: string };
const toStrategy = (r: StratRow): Strategy => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  spec: JSON.parse(r.spec_json) as StrategySpec,
  frozenAt: new Date(r.frozen_at).toISOString(),
});

export async function listStrategies(userId: string): Promise<Strategy[]> {
  await ensure();
  const sql = await getSql();
  const rows = await sql<StratRow>`
    select id, user_id, name, spec_json, frozen_at from ol_lab_strategies where user_id = ${userId} order by frozen_at desc
  `;
  return rows.map(toStrategy);
}

export async function getStrategy(userId: string, id: string): Promise<Strategy | null> {
  await ensure();
  const sql = await getSql();
  const row = (
    await sql<StratRow>`
      select id, user_id, name, spec_json, frozen_at from ol_lab_strategies where id = ${id} and user_id = ${userId}
    `
  )[0];
  return row ? toStrategy(row) : null;
}

export async function deleteStrategy(userId: string, id: string): Promise<{ deleted: boolean }> {
  await ensure();
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    delete from ol_lab_strategies where id = ${id} and user_id = ${userId} returning id
  `;
  if (rows.length)
    await sql`delete from ol_lab_runs where strategy_id = ${id} and user_id = ${userId}`;
  return { deleted: rows.length > 0 };
}

export async function recordLabRun(
  userId: string,
  input: Omit<LabRun, "id" | "at">,
): Promise<LabRun> {
  await ensure();
  const sql = await getSql();
  const own = await getStrategy(userId, input.strategyId);
  if (!own) throw new Error("Strategy not found");
  const id = newId("run");
  await sql`
    insert into ol_lab_runs (id, strategy_id, user_id, kind, season, week, summary_json, bankroll_json, bets_json, digest)
    values (${id}, ${input.strategyId}, ${userId}, ${input.kind}, ${input.season}, ${input.week},
            ${JSON.stringify(input.summary)}, ${input.bankroll ? JSON.stringify(input.bankroll) : null},
            ${JSON.stringify(input.bets)}, ${input.digest})
  `;
  return { ...input, id, at: new Date().toISOString() };
}

type RunRow = {
  id: string;
  strategy_id: string;
  kind: string;
  season: number | null;
  week: number | null;
  summary_json: string;
  bankroll_json: string | null;
  bets_json: string;
  digest: string | null;
  at: string;
};

export async function getLabRuns(userId: string, strategyId: string): Promise<LabRun[]> {
  await ensure();
  const sql = await getSql();
  const rows = await sql<RunRow>`
    select id, strategy_id, kind, season, week, summary_json, bankroll_json, bets_json, digest, at
    from ol_lab_runs where strategy_id = ${strategyId} and user_id = ${userId} order by at
  `;
  return rows.map((r) => ({
    id: r.id,
    strategyId: r.strategy_id,
    kind: r.kind as LabRun["kind"],
    season: r.season,
    week: r.week,
    summary: JSON.parse(r.summary_json) as Record<string, unknown>,
    bankroll: r.bankroll_json ? (JSON.parse(r.bankroll_json) as Record<string, unknown>) : null,
    bets: JSON.parse(r.bets_json) as Bet[],
    digest: r.digest,
    at: new Date(r.at).toISOString(),
  }));
}
