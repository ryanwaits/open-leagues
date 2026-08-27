import { hashPassword } from "better-auth/crypto";
import type { Sql } from "@/lib/db";
import { LOCAL_SEED } from "./local-seed";

/** Insert the local test account if the user table is empty of this email. */
export async function seedLocalAccount(sql: Sql): Promise<void> {
  const existing = await sql`select id from "user" where email = ${LOCAL_SEED.email}`;
  if (existing[0]) return;
  const password = await hashPassword(LOCAL_SEED.password);
  const now = new Date().toISOString();
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (
      ${LOCAL_SEED.userId}, ${LOCAL_SEED.name}, ${LOCAL_SEED.email},
      ${true}, ${now}, ${now}
    )
  `;
  await sql`
    insert into account (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) values (
      ${"acct_ryan"}, ${LOCAL_SEED.userId}, ${"credential"},
      ${LOCAL_SEED.userId}, ${password}, ${now}, ${now}
    )
  `;
}

/**
 * Empty local PGLite → import WIFFL and sit Ryan on hands.
 * Skips when any league already exists. Neon/prod never calls this.
 */
export async function seedLocalWiffl(): Promise<void> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql`select id from ol_leagues limit 1`;
  if (existing[0]) return;
  const { WIFFL_2026 } = await import("@/lib/league/recaps/wiffl-2026");
  const claimRosterId = WIFFL_2026.teams.findIndex((t) => t.teamName === "hands") + 1;
  const { importRebuild } = await import("@/lib/league/engine.server");
  await importRebuild({
    userId: LOCAL_SEED.userId,
    known: WIFFL_2026.id,
    name: WIFFL_2026.name,
    season: WIFFL_2026.season,
    scoring: WIFFL_2026.scoring,
    claimRosterId: claimRosterId > 0 ? claimRosterId : 6,
  });
}
