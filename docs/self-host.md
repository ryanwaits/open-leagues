# Self-hosting open-leagues

## Docker

Needs Docker, not Bun.

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
cp .env.example .env   # optional; compose fills a session secret if blank
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends.

| Env | Notes |
|-----|--------|
| `BETTER_AUTH_URL` | Public https origin, no trailing slash. Default `http://localhost:8080`. |
| `BETTER_AUTH_SECRET` | Session signing. Blank → entrypoint generates one and keeps it on the data volume (`/data/better-auth-secret`). |
| `CRON_SECRET` | Gates HTTP `/api/league/tick`. Optional on Docker (in-process tick). Unset leaves the route public; set it on a public host. |
| `OPENLEAGUES_MCP_AUTH` | `token` (default): this box mints and checks its own `ol_` bearers. `proxy`: your edge authenticates the caller and passes the user id on a header. |
| `OPENLEAGUES_MCP_USER_HEADER` | `proxy` only. Header carrying the user id (default `x-openleagues-user`). |
| `OPENLEAGUES_MCP_PROXY_SECRET` | `proxy` only. Value your proxy sends as `x-openleagues-proxy-secret`. Unset: the box warns once and trusts the header; safe only when nothing else can reach the origin. |
| `OPENLEAGUES_SPLITS_SOURCE` | Off by default. Comma-separated: `actionnetwork` (consensus, history from 2023), `dknetwork` (DraftKings' own handle/bet share, current slate), `wiseguyteam` (multi-book aggregate, book named, current slate). Lab box: `actionnetwork,dknetwork,wiseguyteam`. Undocumented web endpoints; every pulled week is kept. Unset, `getBettingSplits` returns no games. |
| `OPENLEAGUES_MODE` | Unset = `substrate`, the public box's shape: receipts, open data, the lab, and `/api/mcp` for anyone; no accounts, tokens, or leagues; the auth API returns 404 and sign-in/league routes show a notice. `league` = the whole product; docker-compose and `bun run dev` set it. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. This app's own Google OAuth client (not the Grok broker). Both required. See [Google sign-in](google-sign-in.md). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Optional. Web Push. Both keys required or the toggle stays hidden. See [Notifications](notifications.md). |

Compose sets `OPENLEAGUES_SELF_TICK=1`: the league clock ticks in the
container every 2 minutes, no crontab. Data lives on the `open-leagues-data`
volume (`PGLITE_DATA_DIR=/data/pglite`). Set `DATABASE_URL` only for external
Postgres. **Settings → Download backup** exports the league as JSON.

Login is email/password. Google is optional, with your own client
([Google sign-in](google-sign-in.md)). Google and X via the Grok broker appear
only with `GROK_AUTH_CLIENT_ID` set (or on the Grok live preview).

## Vercel instead

Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRON_SECRET`, `DATABASE_URL`
(Neon or any Postgres; Vercel has no durable disk). Optional:
`GOOGLE_CLIENT_*`, `VAPID_*`. Cron runs from `vercel.json`
(`/api/league/tick` hourly); do not set `OPENLEAGUES_SELF_TICK`.
`bun run db:migrate` runs inside `bun run build`.

## Local without Docker

Needs [Bun](https://bun.sh) 1.3 (`packageManager` in `package.json`).

```sh
bun install
bun run dev
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

1. `/login`: sign in with email or create an account. An empty email table
   gets a seed account.
2. `/new`: make a league and invite friends to this origin.
3. Without `DATABASE_URL`, the league lives in `data/pglite` and survives
   restart. Postgres: set `DATABASE_URL=postgres://…`, run
   `bun run db:migrate`. A PGLite `Aborted()` WASM panic on `bun run dev`
   means a corrupt WAL checkpoint; run `bun run db:repair`.

Copy `.env.example` to `.env`; fill only what you need.

## Tick without Docker

The clock is `GET` or `POST` `/api/league/tick`. With `CRON_SECRET` set, send
it as `Authorization: Bearer …` or `?secret=`; unset, the route is public.
`OPENLEAGUES_SELF_TICK=1` on a long-lived `bun run dev` ticks in-process, as
Docker does. Otherwise, cron or systemd:

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
