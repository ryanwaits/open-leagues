import { getSql } from "@/lib/db";
import type { PlayerNote } from "./types";

/**
 * RotoWire NFL RSS — the sentence a human wants, joined by ID.
 *
 * The feed is a hard five-item window (limit params are ignored). Poll often,
 * treat gaps as expected. Sleeper's full-map diff is the complete record of
 * *what* changed; this only supplies *why*, when it lands.
 *
 * Links end in the RotoWire player id (`…/mike-evans-9253`). That id is
 * `rotowire_id` on the Sleeper map, persisted on ol_player_status.
 */

const FEED = "https://www.rotowire.com/rss/news.php?sport=NFL";
const POLL_MS = 90_000;
const BOILERPLATE = /Visit RotoWire\.com for more analysis on this update\.?/gi;

const globalRef = globalThis as typeof globalThis & {
  __rwNotesReady__?: boolean;
  __rwNotesAt__?: number;
  __rwNotesInflight__?: Promise<number>;
};

async function ensureSchema(): Promise<void> {
  if (globalRef.__rwNotesReady__) return;
  const sql = await getSql();
  await sql.query(`
    create table if not exists ol_player_notes (
      id text primary key,
      rotowire_id text not null,
      player_id text,
      headline text not null,
      body text not null,
      dated_at timestamptz not null,
      source text not null default 'RotoWire',
      link text,
      fetched_at timestamptz not null default now()
    )
  `);
  await sql.query(
    `create index if not exists ol_player_notes_player_idx on ol_player_notes (player_id, dated_at desc)`,
  );
  globalRef.__rwNotesReady__ = true;
}

type FeedItem = {
  id: string;
  rotowireId: string;
  headline: string;
  body: string;
  date: string;
  link: string;
};

export async function refreshRotowireFeed(opts: { force?: boolean } = {}): Promise<number> {
  const now = Date.now();
  if (!opts.force && globalRef.__rwNotesAt__ && now - globalRef.__rwNotesAt__ < POLL_MS) {
    return 0;
  }
  if (globalRef.__rwNotesInflight__) return globalRef.__rwNotesInflight__;
  globalRef.__rwNotesInflight__ = poll().finally(() => {
    globalRef.__rwNotesInflight__ = undefined;
  });
  return globalRef.__rwNotesInflight__;
}

async function poll(): Promise<number> {
  await ensureSchema();
  const res = await fetch(FEED, {
    headers: { accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`RotoWire feed ${res.status}`);
  const xml = await res.text();
  const items = parseFeed(xml);
  if (items.length === 0) {
    globalRef.__rwNotesAt__ = Date.now();
    return 0;
  }

  const sql = await getSql();
  const rwIds = [...new Set(items.map((i) => i.rotowireId))];
  const owners = await sql<{ player_id: string; rotowire_id: string }>`
    select player_id, rotowire_id from ol_player_status
    where rotowire_id = any(${rwIds})
  `;
  const playerByRw = new Map(owners.map((r) => [r.rotowire_id, r.player_id]));

  let wrote = 0;
  for (const item of items) {
    const playerId = playerByRw.get(item.rotowireId) ?? null;
    await sql`
      insert into ol_player_notes (
        id, rotowire_id, player_id, headline, body, dated_at, source, link
      ) values (
        ${item.id}, ${item.rotowireId}, ${playerId}, ${item.headline},
        ${item.body}, ${item.date}, ${"RotoWire"}, ${item.link}
      )
      on conflict (id) do update set
        player_id = coalesce(excluded.player_id, ol_player_notes.player_id),
        headline = excluded.headline,
        body = excluded.body
    `;
    wrote += 1;
  }
  globalRef.__rwNotesAt__ = Date.now();
  return wrote;
}

export async function notesForPlayers(playerIds: string[]): Promise<Record<string, PlayerNote[]>> {
  if (playerIds.length === 0) return {};
  try {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      player_id: string;
      headline: string;
      body: string;
      dated_at: string;
      source: string;
      link: string | null;
    }>`
      select id, player_id, headline, body, dated_at, source, link
      from ol_player_notes
      where player_id = any(${playerIds})
      order by dated_at desc
    `;
    const out: Record<string, PlayerNote[]> = {};
    for (const r of rows) {
      if (!r.player_id) continue;
      out[r.player_id] ??= [];
      out[r.player_id].push({
        id: r.id,
        headline: r.headline,
        text: r.body,
        date: r.dated_at,
        source: r.source,
        link: r.link,
      });
    }
    return out;
  } catch {
    return {};
  }
}

export async function notesForPlayer(playerId: string): Promise<PlayerNote[]> {
  const all = await notesForPlayers([playerId]);
  return all[playerId] ?? [];
}

function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1] ?? "";
    const link = textOf(block, "link");
    const rotowireId = rotowireIdFromLink(link);
    if (!rotowireId) continue;
    const guid = textOf(block, "guid") || `rw-${rotowireId}-${textOf(block, "pubDate")}`;
    const headline = textOf(block, "title");
    const body = stripBoiler(textOf(block, "description"));
    if (!headline) continue;
    const date = parsePub(textOf(block, "pubDate"));
    out.push({ id: guid, rotowireId, headline, body, date, link });
  }
  return out;
}

function rotowireIdFromLink(link: string): string | null {
  const m = link.trim().match(/-(\d+)\/?$/);
  return m?.[1] ?? null;
}

function textOf(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m?.[1]) return "";
  return decode(m[1]);
}

function decode(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBoiler(s: string): string {
  return s.replace(BOILERPLATE, "").replace(/\s+/g, " ").trim();
}

function parsePub(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
