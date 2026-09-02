# Self-hosting open-leagues

## Docker

You need Docker. You do **not** need Bun on the host.

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
cp .env.example .env   # optional — compose fills a session secret if blank
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends.

| Env | Notes |
|-----|--------|
| `BETTER_AUTH_URL` | Public https origin (no trailing slash). Default `http://localhost:8080`. |
| `BETTER_AUTH_SECRET` | Session signing. Blank → entrypoint generates one and keeps it on the data volume (`/data/better-auth-secret`). |
| `CRON_SECRET` | Optional on Docker (in-process tick). Still gates HTTP `/api/league/tick`. Unset = that route is public — set it on a public host. |
| `OPENLEAGUES_MCP_AUTH` | Optional. `token` (default) — this box mints and checks its own `ol_` bearers. `proxy` — your edge authenticated the caller and passes their user id on a header. |
| `OPENLEAGUES_MCP_USER_HEADER` | Optional, `proxy` only. Header carrying the user id (default `x-openleagues-user`). |
| `OPENLEAGUES_MCP_PROXY_SECRET` | Optional, `proxy` only. Value your proxy sends as `x-openleagues-proxy-secret` to prove the request came through it. Unset = the box warns once and trusts the header — only safe when nothing else can reach the origin. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. This app's own Google OAuth client (not the Grok broker). Both required. See [Google sign-in](google-sign-in.md). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Optional. Web Push. Both key vars required or the toggle stays hidden. See [Notifications](notifications.md). |

Compose sets `OPENLEAGUES_SELF_TICK=1` so the league clock runs inside the
container every 2 minutes — no crontab. League data lives on the
`open-leagues-data` volume (`PGLITE_DATA_DIR=/data/pglite`). Do **not** set
`DATABASE_URL` unless you want external Postgres.

After a season (or before you wipe a box), open **Settings → Download
backup** for a JSON export of the league.

Email/password is the self-host login. Optional Google: your own client
([Google sign-in](google-sign-in.md)). Google/X via the Grok broker only
appear when `GROK_AUTH_CLIENT_ID` is set (or on the Grok live preview).

## Vercel instead

Required env on the project: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`CRON_SECRET`, and `DATABASE_URL` (Neon or any Postgres — Vercel has no
durable disk). Optional: `GOOGLE_CLIENT_*`, `VAPID_*` (same as Docker).
Cron is free via `vercel.json` (`/api/league/tick` hourly).
Do **not** set `OPENLEAGUES_SELF_TICK` there. Then `bun run db:migrate` runs as
part of `bun run build`.

## Local without Docker

You need [Bun](https://bun.sh) 1.3 (see `packageManager` in `package.json`).

```sh
bun install
bun run dev
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

1. Go to `/login` and sign in with email (or create an account).
2. Go to `/new`, make a league, and invite friends to this origin.
3. Without `DATABASE_URL`, the league lives in `data/pglite` and survives
   restart. For Postgres, set `DATABASE_URL=postgres://…` and run
   `bun run db:migrate`. If `bun run dev` dies with a PGLite `Aborted()`
   WASM panic, the WAL checkpoint is corrupt — `bun run db:repair`.

A local seed account is created on an empty email table. Copy
`.env.example` to `.env` and fill only what you need.

## Advanced: tick without Docker

The league clock is `GET` (or `POST`) `/api/league/tick`. When
`CRON_SECRET` is set, the request must send that value as
`Authorization: Bearer …` or `?secret=`.

Long-lived `bun run dev` can set `OPENLEAGUES_SELF_TICK=1` for an in-process
interval (same as Docker). Otherwise wire a cron or systemd timer:

```cron
*/2 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-leagues-tick.service
[Service]
Type=oneshot
EnvironmentFile=/etc/open-leagues.env
ExecStart=/usr/bin/curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-leagues-tick.timer
[Timer]
OnCalendar=*:0/2
Persistent=true
[Install]
WantedBy=timers.target
```

If `CRON_SECRET` is unset, the tick route is public — do not do that on a
public host unless you rely only on the in-process clock behind a firewall.
