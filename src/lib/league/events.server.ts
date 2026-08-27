import { getSql } from "@/lib/db";

/**
 * The league's memory.
 *
 * `ol_moves`, `ol_claims` and `ol_trades` all record transactions, but they
 * record them *for the mechanic* — enough to process a waiver or settle a
 * trade, and no more. A waiver row knows the winning bid; it does not know the
 * bid was a panic buy the day after that manager's starting back went down.
 *
 * This table records the same moments *for the story*, plus the ones no table
 * owns at all: an injury appearing, a lineup left unset, a lead surrendered
 * after the late window. It is append-only and never read by any mechanic, so
 * nothing downstream can break by writing to it.
 *
 * Written before anything reads it, on purpose. Events can only be captured as
 * they happen — a season run without this is a season that cannot be recovered.
 */

export type LeagueEventKind =
  /** A claim was filed, with the bid the manager was willing to pay. */
  | "claim_filed"
  /** A claim was withdrawn before waivers ran. */
  | "claim_pulled"
  /** Waivers ran and the claim won. `amount` is what it actually cost. */
  | "claim_won"
  /** Waivers ran and the claim lost — outbid, unaffordable, or player gone. */
  | "claim_lost"
  /** A free-agent add outside the waiver window. */
  | "free_agent_add"
  /** Someone was dropped, by any route. */
  | "drop"
  | "trade_proposed"
  | "trade_accepted"
  | "trade_rejected"
  | "trade_cancelled"
  /** A player was moved into a starting slot, displacing whoever was there. */
  | "lineup_set"
  /** A starter was sent to the bench, leaving the slot he held empty. */
  | "lineup_benched"
  /** A player's injury designation changed between two daily refreshes. */
  | "injury_changed"
  /** FAAB was staked on a matchup. */
  | "wager_placed"
  /** A wager was withdrawn before the book closed. */
  | "wager_pulled"
  | "wager_won"
  | "wager_lost";

export type LeagueEvent = {
  leagueId: string;
  week: number;
  kind: LeagueEventKind;
  /** The roster that did the thing. */
  actorRoster: number | null;
  /** The roster it was done to or with, where there is one. */
  subjectRoster?: number | null;
  playerId?: string | null;
  /** Dollars, where the event has a price. */
  amount?: number | null;
  /** Anything else worth keeping. Shape is per-kind and deliberately loose. */
  payload?: Record<string, unknown> | null;
};

let ready = false;

export async function ensureEventSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists ol_events (
      id text primary key,
      league_id text not null,
      week int not null,
      kind text not null,
      actor_roster int,
      subject_roster int,
      player_id text,
      amount int,
      payload_json text not null default '{}',
      at timestamptz not null default now())`,
  );
  await sql.query(
    `create index if not exists ol_events_league_at on ol_events (league_id, at desc)`,
  );
  ready = true;
}

function eid(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "ev_";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Record one event.
 *
 * Never throws. A ledger write failing must not take down the add, the trade or
 * the waiver run that triggered it — losing one line of history is a far smaller
 * problem than refusing a transaction because the diary was full.
 */
export async function recordEvent(event: LeagueEvent): Promise<void> {
  try {
    await ensureEventSchema();
    const sql = await getSql();
    await sql`
      insert into ol_events
        (id, league_id, week, kind, actor_roster, subject_roster, player_id, amount, payload_json)
      values (
        ${eid()}, ${event.leagueId}, ${event.week}, ${event.kind},
        ${event.actorRoster}, ${event.subjectRoster ?? null},
        ${event.playerId ?? null}, ${event.amount ?? null},
        ${JSON.stringify(event.payload ?? {})}
      )
    `;
  } catch {
    // Deliberately silent. See the note above.
  }
}

/** Fire several at once without letting one failure stop the rest. */
export async function recordEvents(events: LeagueEvent[]): Promise<void> {
  await Promise.all(events.map((e) => recordEvent(e)));
}

export type StoredEvent = {
  id: string;
  week: number;
  kind: LeagueEventKind;
  actorRoster: number | null;
  subjectRoster: number | null;
  playerId: string | null;
  amount: number | null;
  payload: Record<string, unknown>;
  at: string;
};

/**
 * Read the ledger back, newest first.
 *
 * Nothing consumes this yet. It exists so the derived-facts layer and the desk
 * have something to build on when they arrive, and so the table can be
 * inspected while the writes are being verified.
 */
export async function readEvents(
  leagueId: string,
  opts: { limit?: number; sinceWeek?: number } = {},
): Promise<StoredEvent[]> {
  await ensureEventSchema();
  const sql = await getSql();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const since = opts.sinceWeek ?? 0;
  const rows = await sql<{
    id: string;
    week: number;
    kind: string;
    actor_roster: number | null;
    subject_roster: number | null;
    player_id: string | null;
    amount: number | null;
    payload_json: string;
    at: string;
  }>`
    select * from ol_events
    where league_id = ${leagueId} and week >= ${since}
    order by at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    week: r.week,
    kind: r.kind as LeagueEventKind,
    actorRoster: r.actor_roster,
    subjectRoster: r.subject_roster,
    playerId: r.player_id,
    amount: r.amount,
    payload: safeParse(r.payload_json),
    at: r.at,
  }));
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
