# Notifications (Web Push)

The draft poll (4s) runs only with a tab open. Push is opt-in per manager (the
commissioner cannot force it) for three events: **you're on the clock**, **a
trade is waiting**, **your waiver claim processed**. Needs HTTPS or localhost;
iOS delivers only after **Add to Home Screen**.

```sh
bunx web-push generate-vapid-keys
```

In `.env`: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`; `VAPID_SUBJECT`
(`mailto:you@league.com`) is optional. Never commit real keys. Restart.

## Verify

1. Claim a seat → that league → Settings.
2. VAPID unset: no **Notify me when I'm away**.
3. Both keys set: **On this phone** appears. **Notify me on this phone** →
   allow. Button becomes **Turn off notifications**.
4. Chrome DevTools → Application → Service Workers → `/sw.js` running. Hard
   refresh still loads new JS (the worker is network-only for documents; never
   a cached `index.html`).
5. Opted in, close the tab or lock the phone:

   | Event | How to fire | Notification |
   |-------|-------------|--------------|
   | Clock | Live draft, your pick starts (autodraft off) | "You're on the clock" → `/league/…/draft` |
   | Trade | Another manager proposes a deal that includes you | "A trade is waiting" → `/trades` |
   | Waiver | Commish **Process waivers** (or tick) on a pending claim of yours | won / lost → `/roster` |

6. Dry run (no FCM/APNs): `OPENLEAGUES_PUSH_DRY=1` on the server logs
   `would send` instead of sending.
7. Opting out of one league leaves the others on this phone subscribed.

```sh
bun test src/lib/push
```
