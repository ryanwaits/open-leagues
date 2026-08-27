import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { getSql } from "@/lib/db";

/**
 * BYOK AI foundation.
 *
 * The app never holds a host-level provider key: each commissioner/creator
 * supplies their own, encrypted at rest with the app's own runtime secret.
 * `getUserAiMasked` is the only read path callers outside this module should
 * use — it never returns the decrypted key, only a last-4 fingerprint.
 */

export type AiProvider = "anthropic" | "openai" | "google";

/** Operator's model choice — the only provider with a sensible universal default. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

export type UserAiMasked = {
  provider: AiProvider;
  model: string;
  keyLast4: string;
};

let ready = false;

async function ensureAiSchema(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ol_user_ai (
    user_id text primary key,
    provider text not null,
    model text not null,
    key_enc text not null,
    updated_at timestamptz not null default now())`);
  ready = true;
}

/* --------------------------------------------------------------- crypto -- */

function runtimeSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret?.trim()) return secret;
  // Dev-only fallback: local `bun run dev` often has no BETTER_AUTH_SECRET in
  // the shell env (better-auth itself falls back to an in-memory secret that
  // never reaches process.env). Every real deployment sets BETTER_AUTH_SECRET
  // via docker-entrypoint.sh before the app boots, so production always hits
  // the throw path below instead of this constant.
  if (process.env.NODE_ENV !== "production") return "open-leagues-dev-secret";
  throw new Error("BETTER_AUTH_SECRET is unset — cannot encrypt AI keys.");
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "open-leagues-ai", 32);
}

/** AES-256-GCM. Payload is `iv.cipher.tag`, each segment base64. */
export function encryptSecret(plain: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), enc.toString("base64"), tag.toString("base64")].join(":");
}

/** Inverse of `encryptSecret`. Throws (bad tag) if `payload` was tampered with. */
export function decryptSecret(payload: string, secret: string): string {
  const [ivB64, encB64, tagB64] = payload.split(":");
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Malformed AI key payload.");
  const key = deriveKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}

/* ------------------------------------------------------------------ CRUD -- */

type AiRow = { user_id: string; provider: string; model: string; key_enc: string };

export async function saveUserAi(
  userId: string,
  input: { provider: AiProvider; model: string; apiKey?: string },
): Promise<void> {
  await ensureAiSchema();
  const sql = await getSql();
  const secret = runtimeSecret();
  if (input.apiKey) {
    const keyEnc = encryptSecret(input.apiKey, secret);
    await sql.query(
      `insert into ol_user_ai (user_id, provider, model, key_enc, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (user_id) do update set
         provider = excluded.provider, model = excluded.model,
         key_enc = excluded.key_enc, updated_at = now()`,
      [userId, input.provider, input.model, keyEnc],
    );
    return;
  }
  // No new key — keep the stored one, only update provider/model.
  await sql.query(
    `update ol_user_ai set provider = $2, model = $3, updated_at = now() where user_id = $1`,
    [userId, input.provider, input.model],
  );
}

export async function getUserAiMasked(userId: string): Promise<UserAiMasked | null> {
  await ensureAiSchema();
  const sql = await getSql();
  const row = (
    await sql<Pick<AiRow, "provider" | "model" | "key_enc">>`
      select provider, model, key_enc from ol_user_ai where user_id = ${userId}`
  )[0];
  if (!row) return null;
  const secret = runtimeSecret();
  let keyLast4 = "????";
  try {
    const plain = decryptSecret(row.key_enc, secret);
    keyLast4 = plain.slice(-4);
  } catch {
    keyLast4 = "????"; // orphaned by a rotated BETTER_AUTH_SECRET; UI should ask to re-enter
  }
  return { provider: row.provider as AiProvider, model: row.model, keyLast4 };
}

export async function deleteUserAi(userId: string): Promise<void> {
  await ensureAiSchema();
  const sql = await getSql();
  await sql.query(`delete from ol_user_ai where user_id = $1`, [userId]);
}

/* -------------------------------------------------------------- provider -- */

async function loadUserAiForModel(
  userId: string,
): Promise<{ provider: AiProvider; model: string; apiKey: string } | null> {
  await ensureAiSchema();
  const sql = await getSql();
  const row = (
    await sql<Pick<AiRow, "provider" | "model" | "key_enc">>`
      select provider, model, key_enc from ol_user_ai where user_id = ${userId}`
  )[0];
  if (!row) return null;
  const secret = runtimeSecret();
  const apiKey = decryptSecret(row.key_enc, secret);
  return { provider: row.provider as AiProvider, model: row.model, apiKey };
}

/** Returns null when the user has no stored key (feature-gated no-op path). */
export async function modelForUser(userId: string): Promise<LanguageModel | null> {
  const cfg = await loadUserAiForModel(userId);
  if (!cfg) return null;
  if (cfg.provider === "anthropic") return createAnthropic({ apiKey: cfg.apiKey })(cfg.model);
  if (cfg.provider === "openai") return createOpenAI({ apiKey: cfg.apiKey })(cfg.model);
  return createGoogleGenerativeAI({ apiKey: cfg.apiKey })(cfg.model);
}

function sanitizeProviderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Never let a provider error echo the key back to the client.
  const noSecrets = msg
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
    .replace(/AIza[A-Za-z0-9_-]{6,}/g, "AIza***");
  return noSecrets.length > 200 ? `${noSecrets.slice(0, 200)}…` : noSecrets;
}

export async function testUserAi(userId: string): Promise<{ ok: boolean; message: string }> {
  const model = await modelForUser(userId);
  if (!model) return { ok: false, message: "No AI key saved yet." };
  try {
    await generateText({ model, prompt: "Reply with exactly: OK" });
    return { ok: true, message: "Connected." };
  } catch (err) {
    return { ok: false, message: sanitizeProviderError(err) };
  }
}
