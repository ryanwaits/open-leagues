#!/usr/bin/env node
/**
 * Wipe the database this box points at. Everything: leagues, users, tokens,
 * receipts caches, lines, splits, strategies. Migrations re-apply on the next
 * `bun run build`; every other table is created on first use.
 *
 *   DATABASE_URL='postgres://…' bun scripts/db-wipe.mjs --yes
 *   bun scripts/db-wipe.mjs --yes            # no DATABASE_URL → wipes the PGLite dir
 *
 * Refuses without --yes, and prints the host it is about to empty first.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const yes = process.argv.includes("--yes");
const url = (process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log("[wipe] no DATABASE_URL — target is the local PGLite directory.");
  if (!yes) {
    console.log("[wipe] refusing without --yes. This removes the data directory.");
    process.exit(2);
  }
  const r = spawnSync("bun", ["scripts/pglite-reset.mjs"], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

let host = "?";
try {
  host = new URL(url).host;
} catch {
  /* printed as ? */
}
console.log(`[wipe] target: ${host}`);
if (!yes) {
  console.log("[wipe] refusing without --yes. This drops every table and every row.");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
const client = await pool.connect();
try {
  const before = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  await client.query("drop schema public cascade");
  await client.query("create schema public");
  await client.query("grant all on schema public to public");
  console.log(
    `[wipe] dropped ${before.rows[0]?.n ?? "?"} tables on ${host}. Deploy to re-apply migrations.`,
  );
} finally {
  client.release();
  await pool.end();
}
