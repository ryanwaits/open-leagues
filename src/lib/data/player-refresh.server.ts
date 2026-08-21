import { getSql } from "@/lib/db";
import type { PlayerNote, RosterPlayer } from "./types";

/**
 * Keeping player status current.
 *
 * `data/players-slim.json` is a static file committed to the repo and read once
 * per process. Names and headshots live there. Designations, timestamps, body
 * parts, depth and the RotoWire join key do not — those come from Sleeper's
 * full player map, pulled at most once a day.
 *
 * Persist the fields the map already carries. Do not poll the map faster for
 * news; that is what the RotoWire feed is for.
 */

const SLEEPER_PLAYERS = "https://api.sleeper.app/v1/players/nfl";

/** Sleeper's guidance is once per day; this leaves room for an hourly cron to no-op. */
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

export type StatusOverlay = {
  injuryStatus: string | null;
  status: string | null;
  team: string | null;
  newsUpdated: string | null;
  injuryBodyPart: string | null;
  injuryNotes: string | null;
  practiceParticipation: string | null;
  practiceDescription: string | null;
  depthChartOrder: number | null;
  rotowireId: string | null;
};

let ready = false;

async function ensureSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(
    `create table if not exists ff_player_status (
      player_id text primary key,
      injury_status text,
      status text,
      team text,
      news_updated timestamptz,
      injury_body_part text,
      injury_notes text,
      practice_participation text,
      practice_description text,
      depth_chart_order int,
      rotowire_id text,
      updated_at timestamptz not null default now())`,
  );
  await sql.query(`alter table ff_player_status add column if not exists news_updated timestamptz`);
  await sql.query(`alter table ff_player_status add column if not exists injury_body_part text`);
  await sql.query(`alter table ff_player_status add column if not exists injury_notes text`);
  await sql.query(
    `alter table ff_player_status add column if not exists practice_participation text`,
  );
  await sql.query(
    `alter table ff_player_status add column if not exists practice_description text`,
  );
  await sql.query(`alter table ff_player_status add column if not exists depth_chart_order int`);
  await sql.query(`alter table ff_player_status add column if not exists rotowire_id text`);
  await sql.query(
    `create table if not exists ff_refresh_log (
      key text primary key,
      at timestamptz not null default now(),
      note text)`,
  );
  ready = true;
}

async function lastRunAt(key: string): Promise<number | null> {
  const sql = await getSql();
  const row = (await sql<{ at: string }>`select at from ff_refresh_log where key = ${key}`)[0];
  return row ? new Date(row.at).getTime() : null;
}

type SleeperPlayer = {
  player_id?: string;
  injury_status?: string | null;
  status?: string | null;
  team?: string | null;
  news_updated?: number | string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  practice_participation?: string | null;
  practice_description?: string | null;
  depth_chart_order?: number | string | null;
  rotowire_id?: string | number | null;
};

/**
 * Pull the player map and store the fields that change.
 *
 * Returns players whose *injury designation* moved, so the caller can write
 * league events. Depth and notes are persisted but are not events — a 2→1
 * is useful on a card, not as a ledger row.
 */
export async function refreshPlayerStatus(opts: { force?: boolean } = {}): Promise<{
  skipped: boolean;
  scanned: number;
  changed: { playerId: string; from: string | null; to: string | null }[];
}> {
  await ensureSchema();
  const sql = await getSql();

  let force = Boolean(opts.force);
  if (!force) {
    const seeded = (
      await sql<{
        ok: number;
      }>`select 1 as ok from ff_player_status where rotowire_id is not null limit 1`
    )[0];
    if (!seeded) force = true;
  }

  if (!force) {
    const last = await lastRunAt("players");
    if (last != null && Date.now() - last < REFRESH_AFTER_MS) {
      return { skipped: true, scanned: 0, changed: [] };
    }
  }

  const res = await fetch(SLEEPER_PLAYERS, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper players ${res.status}`);
  const map = (await res.json()) as Record<string, SleeperPlayer>;

  const prior = new Map(
    (
      await sql<{ player_id: string; injury_status: string | null }>`
        select player_id, injury_status from ff_player_status
      `
    ).map((r) => [r.player_id, r.injury_status]),
  );

  const changed: { playerId: string; from: string | null; to: string | null }[] = [];
  let scanned = 0;

  for (const [id, p] of Object.entries(map)) {
    if (!p || typeof p !== "object") continue;
    scanned += 1;
    const injury = norm(p.injury_status);
    const status = norm(p.status);
    const team = norm(p.team);
    const newsUpdated = epochToIso(p.news_updated);
    const bodyPart = norm(p.injury_body_part);
    const notes = norm(p.injury_notes);
    const practice = norm(p.practice_participation);
    const practiceDesc = norm(p.practice_description);
    const depth = intOrNull(p.depth_chart_order);
    const rotowireId =
      p.rotowire_id != null && String(p.rotowire_id).trim() !== "" ? String(p.rotowire_id) : null;

    if (prior.has(id)) {
      const was = prior.get(id) ?? null;
      if (was !== injury) changed.push({ playerId: id, from: was, to: injury });
    }

    await sql`
      insert into ff_player_status (
        player_id, injury_status, status, team, news_updated,
        injury_body_part, injury_notes, practice_participation,
        practice_description, depth_chart_order, rotowire_id, updated_at
      ) values (
        ${id}, ${injury}, ${status}, ${team}, ${newsUpdated},
        ${bodyPart}, ${notes}, ${practice},
        ${practiceDesc}, ${depth}, ${rotowireId}, now()
      )
      on conflict (player_id) do update set
        injury_status = excluded.injury_status,
        status = excluded.status,
        team = excluded.team,
        news_updated = excluded.news_updated,
        injury_body_part = excluded.injury_body_part,
        injury_notes = excluded.injury_notes,
        practice_participation = excluded.practice_participation,
        practice_description = excluded.practice_description,
        depth_chart_order = excluded.depth_chart_order,
        rotowire_id = excluded.rotowire_id,
        updated_at = now()
    `;
  }

  await sql`
    insert into ff_refresh_log (key, at, note)
    values (${"players"}, now(), ${`${scanned} scanned, ${changed.length} changed`})
    on conflict (key) do update set at = now(), note = excluded.note
  `;

  return { skipped: false, scanned, changed };
}

export async function statusOverlay(playerIds: string[]): Promise<Record<string, StatusOverlay>> {
  if (playerIds.length === 0) return {};
  try {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql<{
      player_id: string;
      injury_status: string | null;
      status: string | null;
      team: string | null;
      news_updated: string | null;
      injury_body_part: string | null;
      injury_notes: string | null;
      practice_participation: string | null;
      practice_description: string | null;
      depth_chart_order: number | null;
      rotowire_id: string | null;
    }>`
      select player_id, injury_status, status, team, news_updated,
        injury_body_part, injury_notes, practice_participation,
        practice_description, depth_chart_order, rotowire_id
      from ff_player_status
      where player_id = any(${playerIds})
    `;
    const out: Record<string, StatusOverlay> = {};
    for (const r of rows) {
      out[r.player_id] = {
        injuryStatus: r.injury_status,
        status: r.status,
        team: r.team,
        newsUpdated: r.news_updated,
        injuryBodyPart: r.injury_body_part,
        injuryNotes: r.injury_notes,
        practiceParticipation: r.practice_participation,
        practiceDescription: r.practice_description,
        depthChartOrder: r.depth_chart_order,
        rotowireId: r.rotowire_id,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Paint overlay + latest RotoWire note onto roster rows. Mutates in place. */
export async function decorateRoster(players: RosterPlayer[]): Promise<void> {
  const ids = players.map((p) => p.player_id);
  const [overlay, notes] = await Promise.all([
    statusOverlay(ids),
    import("./rotowire.server").then((m) => m.notesForPlayers(ids)),
  ]);
  for (const p of players) {
    const o = overlay[p.player_id];
    if (o) {
      if (o.injuryStatus) p.injury_status = o.injuryStatus;
      if (o.status) p.status = o.status;
      if (o.team) p.team = o.team;
      if (o.depthChartOrder != null) p.depth_chart_order = o.depthChartOrder;
      p.news_updated = o.newsUpdated;
      p.injury_body_part = o.injuryBodyPart;
      p.injury_notes = o.injuryNotes;
    }
    const list: PlayerNote[] = notes[p.player_id] ?? [];
    p.latest_note = list[0] ?? null;
  }
}

function norm(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

function intOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function epochToIso(v: number | string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
