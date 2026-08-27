# Notifications (Web Push)

The draft poll (4s) is only while a tab is open. Closed phone: opt-in push for
**you're on the clock**, **a trade is waiting**, **your waiver claim processed**.
The commissioner cannot force this on a manager.

HTTPS (or localhost). iOS only delivers after **Add to Home Screen**.

```sh
bunx web-push generate-vapid-keys
```

Put the pair in `.env` as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. Optional
`VAPID_SUBJECT` (`mailto:you@league.com`). Never commit real keys. Restart.

## Verify

1. Claim a seat. Open that league → Settings.
2. With VAPID unset: **Notify me when I'm away** is absent.
3. With both keys set: section **On this phone** appears. **Notify me on this phone**
   → allow notifications. Button becomes **Turn off notifications**.
4. Chrome DevTools → Application → Service Workers → `/sw.js` running.
   Hard refresh still loads new JS (the worker is network-only for documents;
   it must not serve a cached `index.html`).
5. Stay opted in. Close the tab (or lock the phone).

   | Event | How to fire | Notification |
   |-------|-------------|--------------|
   | Clock | Live draft, your pick starts (autodraft off) | "You're on the clock" → `/league/…/draft` |
   | Trade | Another manager proposes a deal that includes you | "A trade is waiting" → `/trades` |
   | Waiver | Commish **Process waivers** (or tick) on a pending claim of yours | won / lost → `/roster` |

6. Dry run (no FCM/APNs): `OPENLEAGUES_PUSH_DRY=1` on the server. Same events log
   `would send` instead of hitting the network.
7. Opt out one league: other leagues on this phone stay subscribed.

```sh
bun test src/lib/push
```
