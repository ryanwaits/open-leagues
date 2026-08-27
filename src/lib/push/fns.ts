import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";

function publicVapid(): { configured: boolean; publicKey: string | null } {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || null;
  const configured = Boolean(publicKey && privateKey);
  return { configured, publicKey: configured ? publicKey : null };
}

/** Public VAPID key only — the private key never leaves the server. */
export const pushPublicKey = createServerFn({ method: "GET" }).handler(async () => publicVapid());

export const pushStatus = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const vapid = publicVapid();
    let subscribed = false;
    let hasSeat = false;
    if (vapid.configured && context.userId) {
      const eng = await import("@/lib/league/engine.server");
      const mine = await eng.rosterIdOwnedBy(data.leagueId, context.userId);
      hasSeat = mine != null;
      if (hasSeat) {
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const rows = await sql<{ endpoint: string }>`
          select endpoint from ol_push_subs
          where user_id = ${context.userId} and league_id = ${data.leagueId}
          limit 1
        `;
        subscribed = Boolean(rows[0]);
      }
    }
    return { ...vapid, subscribed, hasSeat };
  });

export const subscribePush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      endpoint: z.string().min(1),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    const vapid = publicVapid();
    if (!vapid.configured) return { ok: false as const };
    const eng = await import("@/lib/league/engine.server");
    const mine = await eng.rosterIdOwnedBy(data.leagueId, context.userId);
    if (mine == null) throw new Error("You don't have a seat.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into ol_push_subs (endpoint, user_id, league_id, p256dh, auth)
      values (${data.endpoint}, ${context.userId}, ${data.leagueId}, ${data.p256dh}, ${data.auth})
      on conflict (endpoint, league_id) do update
        set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
    `;
    return { ok: true as const };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      delete from ol_push_subs
      where user_id = ${context.userId} and league_id = ${data.leagueId}
    `;
    return { ok: true as const };
  });
