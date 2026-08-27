import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";

const RAW_PREFIX = "ol_";

let tableReady = false;

/** SHA-256 hex of the plaintext token. Never store plaintext. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Display prefix shown after mint (e.g. ol_a1b2c3d4). */
export function displayPrefix(raw: string): string {
  return raw.slice(0, 12);
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_agent_tokens (
  id text primary key,
  user_id text not null,
  name text not null default 'codex',
  prefix text not null,
  hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
)`);
  await sql.query(
    `create index if not exists ol_agent_tokens_hash on ol_agent_tokens (hash) where revoked_at is null`,
  );
  tableReady = true;
}

export async function mintToken(
  userId: string,
  name: string,
): Promise<{ id: string; token: string; prefix: string }> {
  await ensureTable();
  const sql = await getSql();
  const id = `at_${randomBytes(12).toString("hex")}`;
  const token = `${RAW_PREFIX}${randomBytes(32).toString("hex")}`;
  const prefix = displayPrefix(token);
  const hash = hashToken(token);
  const label = name.trim() || "codex";
  await sql`
    insert into ol_agent_tokens (id, user_id, name, prefix, hash)
    values (${id}, ${userId}, ${label}, ${prefix}, ${hash})
  `;
  return { id, token, prefix };
}

/** Resolve a raw bearer to userId, or null if unknown / revoked / wrong prefix. */
export async function lookupToken(raw: string): Promise<string | null> {
  if (!raw.startsWith(RAW_PREFIX)) return null;
  await ensureTable();
  const sql = await getSql();
  const hash = hashToken(raw);
  const row = (
    await sql`
      select user_id from ol_agent_tokens
      where hash = ${hash} and revoked_at is null
      limit 1
    `
  )[0] as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export async function revokeToken(userId: string, id: string): Promise<void> {
  await ensureTable();
  const sql = await getSql();
  await sql`
    update ol_agent_tokens
    set revoked_at = now()
    where id = ${id} and user_id = ${userId} and revoked_at is null
  `;
}

export async function listTokens(
  userId: string,
): Promise<{ id: string; name: string; prefix: string; createdAt: string }[]> {
  await ensureTable();
  const sql = await getSql();
  const rows = await sql`
    select id, name, prefix, created_at
    from ol_agent_tokens
    where user_id = ${userId} and revoked_at is null
    order by created_at desc
  `;
  return rows.map((r) => {
    const row = r as {
      id: string;
      name: string;
      prefix: string;
      created_at: string | Date;
    };
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    };
  });
}
