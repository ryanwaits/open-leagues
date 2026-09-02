import { getSql } from "@/lib/db";

/**
 * Five counters, no third party. The funnel a receipt has to survive:
 * paste → card → unfurl → import → token. Rows, not a dashboard; the counts go
 * in the write-up good or bad, and nothing here identifies a person.
 */
export type MetricKind = "paste" | "card" | "unfurl" | "import" | "token";

let ready = false;

async function ensure(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_metrics (
  id bigserial primary key,
  kind text not null,
  league_id text,
  at timestamptz not null default now()
)`);
  await sql.query(`create index if not exists ol_metrics_kind_at on ol_metrics (kind, at)`);
  ready = true;
}

/** Fire-and-forget. A metric must never cost a page its render. */
export function count(kind: MetricKind, leagueId?: string | null): void {
  void (async () => {
    try {
      await ensure();
      const sql = await getSql();
      await sql`insert into ol_metrics (kind, league_id) values (${kind}, ${leagueId ?? null})`;
    } catch {
      /* counters are best-effort */
    }
  })();
}

/** Totals by kind, for the case study and nothing else. */
export async function totals(): Promise<Record<MetricKind, number>> {
  await ensure();
  const sql = await getSql();
  const rows = await sql<{ kind: MetricKind; n: number }>`
    select kind, count(*)::int as n from ol_metrics group by kind
  `;
  const out: Record<MetricKind, number> = { paste: 0, card: 0, unfurl: 0, import: 0, token: 0 };
  for (const r of rows) out[r.kind] = r.n;
  return out;
}
