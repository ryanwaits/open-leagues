# open-ff

A self-hosted fantasy football league desk. Sign in, create a league, invite
friends to **this** origin. One deploy can host many leagues.

## What this is

open-ff is a headless fantasy football operator, not just another league
app. Postgres is the source of truth, FAAB is conserved (nobody can invent
free money), and every scoring, trade, waiver, and draft decision runs
through one engine — not a UI. Migrate a league in from Sleeper or ESPN, or
rebuild one from a paste/PDF of a historical record, and from then on this
is the source of truth; the old host is done.

What runs on top of that engine isn't fixed. The PWA in this repo is
"client zero," not the product — it ships in three visual skins today
(Ledger, Box Score, Console), proof the same data doesn't dictate one look.
More concretely: an MCP server (stdio for your own box, HTTP with a
personal bearer token for a friend's Claude/Codex/Grok) exposes the league
as callable primitives — 57 of the 76 documented verbs are wired as of this
writing, covering the day-to-day manager loop end to end:

```
context = getAgentContext(leagueId)        # seat, purse, standings, recent events
team    = getTeam(leagueId, context.rosterId, week)
# decide, using getProjections / getWire / getWeekProjections ...
sitPlayer(leagueId, benchedPlayerId)
startPlayer(leagueId, startingPlayerId)
```

Read your team, read the book, set your lineup, work the waiver wire, vote
on a trade, place a wager, migrate a league in — all without a browser. See
[Agent hosts (local)](#agent-hosts-local) below for how to connect one.

## Quickstart

```sh
git clone https://github.com/YOUR_ORG/open-ff.git
cd open-ff
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends to this
origin. That's a running league — see
[Put it on the internet](#put-it-on-the-internet) for env vars and the
Vercel alternative.

Already have a league on Sleeper or ESPN, or just a screenshot/paste of an
old season? See [Migrating your league](#migrating-your-league).

Want to run this with Claude, Codex, or Grok instead of (or alongside) the
web app? Any signed-in member mints their own token from `/account` — see
[Agent hosts (local)](#agent-hosts-local) or
[Agent hosts (hosted)](#agent-hosts-hosted).

## Agent hosts (local)

Point Codex / Claude / Grok at the same catalog over MCP stdio (hosted Postgres only — bun cannot boot PGLite):

```sh
export DATABASE_URL=postgres://…
export OPENFF_USER=<your user id>
codex mcp add openff --command bun --args scripts/mcp.mjs
# Claude: claude mcp add openff -- bun scripts/mcp.mjs
# Grok:   grok mcp add openff -- bun scripts/mcp.mjs
```

`OPENFF_USER` is the Better Auth `user.id` (copy from the `user` table / local seed until settings shows it).

## Agent hosts (hosted)

Same `AGENT_CORE` catalog over Streamable HTTP in **JSON response mode** (request/response; no SSE — Vercel-friendly) with a personal `off_` token (mint in the app; 041):

```sh
export OPENFF_TOKEN=off_…
codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
```

Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`, leave Client ID & Secret blank, authorize with the bearer token. Grok: `--transport http` against the same URL (bearer via env). Cookie sessions are not accepted — `Authorization: Bearer off_…` only.

## Agent skills

Playbooks for migrate / lineup / book / week live under
`src/lib/agent/skills/` (and are mirrored in `.grok/skills/` for this repo).
Copy or symlink into a host skills dir:

```sh
# Codex:  cp -R src/lib/agent/skills/* ~/.codex/skills/
# Claude: cp -R src/lib/agent/skills/* ~/.claude/skills/
# Grok:   already in .grok/skills/ of this repo; else ~/.grok/skills/
```

## Put it on the internet

You need Docker. You do **not** need Bun on the host.

```sh
git clone https://github.com/YOUR_ORG/open-ff.git
cd open-ff
cp .env.example .env   # optional — compose fills a session secret if blank
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends.

| Env | Notes |
|-----|--------|
| `BETTER_AUTH_URL` | Public https origin (no trailing slash). Default `http://localhost:8080`. |
| `BETTER_AUTH_SECRET` | Session signing. Blank → entrypoint generates one and keeps it on the data volume (`/data/better-auth-secret`). |
| `CRON_SECRET` | Optional on Docker (in-process tick). Still gates HTTP `/api/league/tick`. Unset = that route is public — set it on a public host. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. This app's own Google OAuth client (not the Grok broker). Both required. See [Google sign-in](#google-sign-in). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Optional. Web Push. Both key vars required or the toggle stays hidden. See [Notifications](#notifications-web-push). |

Compose sets `OPENFF_SELF_TICK=1` so the league clock runs inside the
container every 2 minutes — no crontab. League data lives on the
`openff-data` volume (`PGLITE_DATA_DIR=/data/pglite`). Do **not** set
`DATABASE_URL` unless you want external Postgres.

After a season (or before you wipe a box), open **Settings → Download
backup** for a JSON export of the league.

Email/password is the self-host login. Optional Google: your own client
([below](#google-sign-in)). Google/X via the Grok broker only appear when
`GROK_AUTH_CLIENT_ID` is set (or on the Grok live preview).

### Vercel instead

Required env on the project: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`CRON_SECRET`, and `DATABASE_URL` (Neon or any Postgres — Vercel has no
durable disk). Optional: `GOOGLE_CLIENT_*`, `VAPID_*` (same as Docker).
Cron is free via `vercel.json` (`/api/league/tick` hourly).
Do **not** set `OPENFF_SELF_TICK` there. Then `bun run db:migrate` runs as
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

Long-lived `bun run dev` can set `OPENFF_SELF_TICK=1` for an in-process
interval (same as Docker). Otherwise wire a cron or systemd timer:

```cron
*/2 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-ff-tick.service
[Service]
Type=oneshot
EnvironmentFile=/etc/open-ff.env
ExecStart=/usr/bin/curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-ff-tick.timer
[Timer]
OnCalendar=*:0/2
Persistent=true
[Install]
WantedBy=timers.target
```

If `CRON_SECRET` is unset, the tick route is public — do not do that on a
public host unless you rely only on the in-process clock behind a firewall.

## Migrating your league

Every source becomes one canonical import pack, then commits into the
ledger once. Connect is one-way: we extract, we don't keep polling the old
host, and after commit **this is the source of truth** — sit/start, FAAB,
trades, and the book all happen here from then on. Sleeper stays the
player/week data pipe either way (outbound HTTPS only; no member needs a
Sleeper account). ESPN cookies are import-only and are never used again
after the import completes.

**From Sleeper** — no login needed, just the league id:

1. `/new` → **Import** → **Sleeper** tab → paste the league id.
2. Review the preview (teams, scoring, rosters) and confirm.
3. Optionally include one prior season's history.

(Same two steps over MCP or an agent skill: `previewImport`, then
`importLeague` with `confirm: true`.)

**From ESPN** — public leagues need only the league id/URL and season:

1. `/new` → **Import** → **ESPN** tab → league id or URL, season.
2. Private league? Either paste SWID + `espn_s2` (one-time, never stored,
   never reused after import), or flip the league public for one minute
   first — a recap paste is simpler still if you only need the names.
3. Review the preview and confirm.

(Same over MCP: `previewEspn`, then `importEspn` with `confirm: true`.)

**From anywhere else** (Yahoo, NFL.com, a spreadsheet, a screenshot, or
just "I remember who won") — the **Draft** tab reconstructs a season from
whatever you can paste or upload:

1. `/new` → **Import** → **Draft** tab → paste an ESPN draft recap, team
   blocks, a CSV, a known-record summary, or upload a PDF (a print-to-PDF
   that's actually an image won't parse — paste the text instead).
2. Review the preview and confirm.

(Same over MCP: `previewRebuild`, then `importRebuild` with
`confirm: true`.)

Manager emails are never pulled from any of these APIs — the invite
allowlist is typed in post-import, by the commissioner, in league settings.

| Source | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
|---|---|---|---|---|---|---|---|
| Sleeper | league id, no auth | Draft-tab paste | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | optional one `previous_league_id` via `includeHistory` (default off) |
| ESPN | public **or** SWID+espn_s2 one-shot, not saved | Draft-tab paste | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
| Draft (paste/PDF/known record) | — | paste, PDF, known recap | yes | scoring **preset** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
| Yahoo | OAuth not shipped | Draft-tab paste | via paste | via paste | via paste | no | no |
| NFL.com | hop: espn.com/importnfl → ESPN import (no HTML scrape) | Draft-tab paste | via ESPN/paste | via ESPN/paste | via ESPN/paste | via ESPN | no |

## Book

Managers can stake FAAB on matchups when the commissioner turns betting **On**
under **The book** in league settings (then Save). Open Matchups to see the
line — live prices open the wager ticket; preseason shows an honest “no price”
empty state.

With `bun run dev` up:

```sh
bun scripts/wager-qa.mjs
```

Signs in with the local seed, creates a throwaway league, enables the book, and
screenshots either a placed ticket or the no-price panel under `screenshots/`.
Stdout JSON `"path":"price"` means a $1 ticket actually submitted; `"path":"no-price"`
is preseason (nothing to quote — do not fake a line). Re-run once a regular-season
week has projections.

## Google sign-in

Self-host can offer **Continue with Google** using *this app's* OAuth client.
Email/password stays on. X native is not shipped (broker or nothing).

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web).
2. Authorized JavaScript origin: `https://YOUR_HOST` (local: `http://127.0.0.1:8080`).
3. Authorized redirect URI (exact):

   ```
   https://YOUR_HOST/api/auth/callback/google
   ```

   Local: `http://127.0.0.1:8080/api/auth/callback/google`. Must match
   `BETTER_AUTH_URL` (scheme + host + port, no trailing slash).
4. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. Never `VITE_`.
5. Restart the container / `bun run dev`.

**Verify**

| Expect | How |
|--------|-----|
| Off, no broker | `/login` is email only. Copy does not mention Google. |
| Both env vars set | `/login` shows **Continue with Google**. Copy: "Google is available on this host." |
| Sign-in | Button → Google account chooser → back on this origin, signed in. |
| Broker already on | One Google button (broker), not two. |

`bun test src/lib/auth/providers.test.mjs` covers the empty-env / both-vars button list.

## Notifications (Web Push)

The draft poll (4s) is only while a tab is open. Closed phone: opt-in push for
**you're on the clock**, **a trade is waiting**, **your waiver claim processed**.
The commissioner cannot force this on a manager.

HTTPS (or localhost). iOS only delivers after **Add to Home Screen**.

```sh
bunx web-push generate-vapid-keys
```

Put the pair in `.env` as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. Optional
`VAPID_SUBJECT` (`mailto:you@league.com`). Never commit real keys. Restart.

**Verify**

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

6. Dry run (no FCM/APNs): `OPENFF_PUSH_DRY=1` on the server. Same events log
   `would send` instead of hitting the network.
7. Opt out one league: other leagues on this phone stay subscribed.

```sh
bun test src/lib/push
```

## Check

```sh
bun test
bun test src/lib/auth/providers.test.mjs   # native Google button gating
bun test src/lib/push                      # SW + no-VAPID no-op
bun run typecheck
bun run lint
```
