#!/usr/bin/env bun
/**
 * Wipe the local PGLite dir. Next `bun run dev` remigrates and comes up empty
 * — sign up, then create or migrate a league. Set OPENLEAGUES_DEV_SEED=1 to
 * get the maintainer's account and league back.
 *
 * Stop the dev server first — two PGLite writers corrupt the WAL.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.PGLITE_DATA_DIR?.trim() || join(root, "data/pglite");

if (!existsSync(dataDir)) {
  console.log(`[reset] nothing at ${dataDir}`);
  process.exit(0);
}

rmSync(dataDir, { recursive: true, force: true });
console.log(`[reset] removed ${dataDir}`);
console.log("[reset] restart bun run dev — the box comes up empty");
console.log("[reset] OPENLEAGUES_DEV_SEED=1 bun run dev seeds the dev fixture");
