import { sendNotification, setVapidDetails } from "web-push";
import { getSql } from "@/lib/db";

export type PushKind = "clock" | "trade" | "waiver";

export type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
};

type SubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

function vapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || "mailto:open-leagues@localhost";
}

/**
 * Notify the owner of a roster. No-op without VAPID keys, an unowned seat, or
 * zero subscriptions. Never throws — draft / trade / waiver writes stay intact.
 *
 * OPENLEAGUES_PUSH_DRY=1 prints "would send" and skips the network.
 */
export async function notifyRoster(
  leagueId: string,
  rosterId: number,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!vapidConfigured()) return;
    const sql = await getSql();
    const seat = (
      await sql<{ owner_id: string | null }>`
        select owner_id from ff_rosters
        where league_id = ${leagueId} and roster_id = ${rosterId}
        limit 1
      `
    )[0];
    if (!seat?.owner_id) return;
    const rows = await sql<SubRow>`
      select endpoint, p256dh, auth from ff_push_subs
      where user_id = ${seat.owner_id} and league_id = ${leagueId}
    `;
    if (!rows.length) return;
    await sendToSubs(leagueId, rows, payload);
  } catch {
    /* fail quiet */
  }
}

async function sendToSubs(leagueId: string, rows: SubRow[], payload: PushPayload): Promise<void> {
  if (process.env.OPENLEAGUES_PUSH_DRY === "1") {
    // dry-run: a local subscribe round-trip without hitting FCM/APNs
    console.info("would send", payload.kind, payload.title, payload.url, rows.length);
    return;
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return;
  setVapidDetails(vapidSubject(), publicKey, privateKey);
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
  });
  const sql = await getSql();
  for (const row of rows) {
    try {
      await sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
      );
    } catch (err) {
      const status = (err as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) {
        await sql`
          delete from ff_push_subs
          where endpoint = ${row.endpoint} and league_id = ${leagueId}
        `;
      }
    }
  }
}
