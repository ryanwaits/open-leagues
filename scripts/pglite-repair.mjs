#!/usr/bin/env bun
/**
 * Repair a PGLite data dir that fails to open with:
 *   RuntimeError: Aborted()
 *   PANIC: could not locate a valid checkpoint record
 *
 * Unclean Vite/bun death leaves a corrupt WAL checkpoint. This copies the
 * data dir aside, runs Postgres 18 `pg_resetwal -f`, then verifies PGLite
 * can open it. Heap rows (leagues, rosters, book) stay; in-flight writes
 * after the last good checkpoint may be lost.
 *
 * Needs `pg_resetwal` on PATH (postgresql@18) or Docker (`postgres:18`).
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.PGLITE_DATA_DIR?.trim() || join(root, "data/pglite"));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return r;
}

function findResetwal() {
  const local = run("sh", ["-c", "command -v pg_resetwal"]).stdout?.trim();
  if (local) return { kind: "bin", bin: local };
  const brew = run("sh", ["-c", "brew --prefix postgresql@18 2>/dev/null"]).stdout?.trim();
  if (brew && existsSync(join(brew, "bin/pg_resetwal"))) {
    return { kind: "bin", bin: join(brew, "bin/pg_resetwal") };
  }
  const docker = run("sh", ["-c", "command -v docker"]).stdout?.trim();
  if (docker) return { kind: "docker" };
  return null;
}

async function verify(dir) {
  const pg = new PGlite({ dataDir: dir });
  await pg.waitReady;
  const leagues = await pg.query("select id, name from ol_leagues").catch(() => ({ rows: [] }));
  await pg.close();
  return leagues.rows ?? [];
}

async function main() {
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    console.error(`[repair] no PGLite data dir at ${dataDir}`);
    process.exit(1);
  }

  const tool = findResetwal();
  if (!tool) {
    console.error("[repair] need pg_resetwal (brew install postgresql@18) or Docker.");
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = join(root, "data", `pglite-corrupt-${stamp}`);
  mkdirSync(dirname(backup), { recursive: true });
  console.log(`[repair] backing up ${dataDir} → ${backup}`);
  cpSync(dataDir, backup, { recursive: true });
  rmSync(join(dataDir, "postmaster.pid"), { force: true });

  console.log("[repair] pg_resetwal -f");
  let reset;
  if (tool.kind === "bin") {
    reset = run(tool.bin, ["-f", dataDir]);
  } else {
    const uid = `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
    reset = run("docker", [
      "run",
      "--rm",
      "-v",
      `${dataDir}:/data`,
      "-u",
      uid,
      "postgres:18",
      "pg_resetwal",
      "-f",
      "/data",
    ]);
  }
  if (reset.status !== 0) {
    console.error(reset.stderr || reset.stdout || "pg_resetwal failed");
    console.error(`[repair] original copy is at ${backup}`);
    process.exit(reset.status ?? 1);
  }
  if (reset.stdout) process.stdout.write(reset.stdout);
  if (reset.stderr) process.stderr.write(reset.stderr);

  try {
    const leagues = await verify(dataDir);
    console.log(
      `[repair] opened OK. leagues: ${
        leagues.length ? leagues.map((r) => r.name ?? r.id).join(", ") : "(none)"
      }`,
    );
  } catch (err) {
    console.error("[repair] still will not open:", err);
    console.error(`[repair] restore with: rm -rf ${dataDir} && mv ${backup} ${dataDir}`);
    process.exit(1);
  }
}

await main();
