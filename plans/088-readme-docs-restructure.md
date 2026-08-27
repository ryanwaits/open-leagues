# Plan 088: Short, showcase-style README with real screenshots + a docs/ split

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b33458a..HEAD -- README.md`
> If any diff exists, compare README.md's current content against the
> "Current state" quote below; on a mismatch, STOP and report.
>
> **Special note on this plan**: unlike every prior plan this session, the
> three binary image files this plan references (`docs/images/*.png`)
> **already exist on disk**, created directly by the reviewer via
> ImageMagick (a deliberate, disclosed exception to the "advisor never
> touches source" rule — image processing isn't source code, and there's
> no other way to hand a binary asset to a text-based plan). Your job is
> to verify they're present and correct, `git add` them, and write the
> markdown that references them — not to regenerate them. If they are
> **not** present at the paths below, STOP and report rather than trying to
> recreate them yourself.

## Status

- **Priority**: P1
- **Effort**: L (one README rewrite + four new docs files + three image
  files to stage — all content is fully authored below, this is transcription
  + verification, not drafting)
- **Risk**: LOW — every section of content below is either moved verbatim
  from the current README (unchanged wording) or newly written short prose
  that makes no new factual claims beyond what's already in the repo
  (the "57 of 76" MCP figure, the three skin names, the agent-token flow)
  — all previously verified in plans 081–086.
- **Depends on**: plans/086 and 087 (the rename — this plan's content uses
  `open-leagues`/`OPENLEAGUES_*` throughout, confirmed landed)
- **Category**: docs
- **Planned at**: commit `b33458a`, 2026-08-26

## Why this matters

The README was 338 lines mixing the product pitch with deep reference
material (full env var tables, verify-step checklists, systemd units, the
test-command list). The operator wants a short, scannable, showcase-style
README with real product screenshots up front, and the reference material
moved to a `docs/` directory. This plan does exactly that — no new claims,
just a reorganization plus real screenshots captured live from
`leagues.waits.dev` (the WIFFL league) earlier this session.

## Current state

`README.md` at commit `b33458a` is the full 338-line file already
containing (in order): title/intro, "What this is", "Quickstart", "Agent
hosts (local)", "Agent hosts (hosted)", "Agent skills", "Put it on the
internet" (+ "Vercel instead"), "Local without Docker", "Advanced: tick
without Docker", "Migrating your league", "Book", "Google sign-in",
"Notifications (Web Push)", "Check". Every word of it has already been
read in full this session (plans 084/085/086) — this plan doesn't need to
re-quote it; Steps 2–6 below give the exact replacement content for each
piece.

**Images already on disk** (confirm each exists and is a valid, non-empty
PNG before proceeding):
```
docs/images/three-skins.png    (1398×204, ~39KB — a 3-panel horizontal strip:
                                 the standings page in Ledger, Box Score, and
                                 Console side by side)
docs/images/boxscore-ledger.png (1400×1914, ~113KB — the full matchup box
                                 score page, Ledger skin)
docs/images/account-skins.png   (1200×900, ~30KB — the /account page showing
                                 the Ledger/Box Score/Console radio picker)
```
**Verify**: `file docs/images/*.png` — all three report `PNG image data`
with the dimensions above; `ls -la docs/images/` shows all three under
150KB each.

- `docs/` directory does not exist yet otherwise — confirmed via `find`
  earlier this session (no prior `docs/` in this repo).
- No test or lint rule references `README.md`'s content or structure —
  confirmed no test in `src/`/`scripts/` reads or asserts on `README.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Confirm images | `file docs/images/*.png` | 3 valid PNGs, dimensions as above |
| Lint (docs aren't Biome-linted, but confirm nothing else broke) | `bun run lint` | matches baseline (10/177/6) |
| Tests | `bun test src scripts` | pass, same shape as baseline |
| Build | `bun run build` | exit 0 |
| Link sanity | see Step 7 | every relative link resolves to a real file |

## Scope

**In scope**:
- `README.md` (full rewrite — content given verbatim in Step 2)
- `docs/self-host.md`, `docs/notifications.md`, `docs/google-sign-in.md`,
  `docs/development.md` (new files — content given verbatim in Steps 3–6)
- `docs/images/three-skins.png`, `docs/images/boxscore-ledger.png`,
  `docs/images/account-skins.png` (already on disk — `git add` only, do
  not regenerate or edit)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- Any source code file.
- Re-cropping, re-compressing, or replacing any of the three images —
  if you think one looks wrong, STOP and report rather than regenerating
  it yourself (see the special note above).
- The `ff_*`/`off_` database-layer rename, the Codex/ChatGPT live-client
  demo, or the X/social post — all separate, later work.
- `AGENTS.project.md`, `PRODUCT.md`, `DESIGN.md`, `src/lib/agent/context-prompt.md`
  — untouched by this plan; their content stays as plan 086 left it.

## Git workflow

Current branch; one commit, e.g.
`docs: short showcase README + docs/ split with real screenshots`. Do NOT
push (standing rule — pushes to `main` auto-deploy to `leagues.waits.dev`).

## Steps

### Step 1: verify the images, create `docs/`

```sh
file docs/images/*.png
ls -la docs/images/
```

Confirm all three files exist, are valid PNGs, and roughly match the sizes
in "Current state." If any is missing, corrupt, or wildly different in
size, STOP and report — do not attempt to generate a replacement.

### Step 2: replace `README.md` with this exact content

```markdown
# open-leagues

<img src="docs/images/three-skins.png" alt="The same league in three different skins — Ledger, Box Score, and Console" width="100%">

**A headless fantasy football operator.** Postgres holds the league and
enforces the rules — conserved FAAB, one scoring book, no UI required.
Migrate a league in once from Sleeper, ESPN, or a pasted/PDF rebuild, and
from then on this is the source of truth. What runs on top isn't fixed:
the reference PWA above ships in three skins, and an MCP server exposes
the same league as callable primitives for Claude, Codex, or Grok —
57 of 76 documented verbs wired as of this writing:

```
context = getAgentContext(leagueId)        # seat, purse, standings, recent events
team    = getTeam(leagueId, context.rosterId, week)
# decide, using getProjections / getWire / getWeekProjections ...
sitPlayer(leagueId, benchedPlayerId)
startPlayer(leagueId, startingPlayerId)
```

Read your team, set your lineup, work the waiver wire, vote on a trade,
place a wager, migrate a league in — all without a browser. MIT licensed,
self-hosted, one deploy can host many leagues.

## Quickstart

```sh
git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends to this
origin. That's a running league. Env vars, the Vercel alternative, and
running without Docker: [docs/self-host.md](docs/self-host.md).

<img src="docs/images/boxscore-ledger.png" alt="The box score page — score card, live starters, full bench" width="100%">

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

## Connect an agent

Any signed-in member mints their own token from `/account` — no commish
gate. Point Codex / Claude / Grok at the league over MCP:

```sh
# local (your own box, hosted Postgres only — bun cannot boot PGLite)
export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your user id>
codex mcp add open-leagues --command bun --args scripts/mcp.mjs

# hosted (a friend's Codex/Claude/Grok, over HTTP with a personal token)
export OPENLEAGUES_TOKEN=off_…
codex mcp add open-leagues --url https://HOST/api/mcp --bearer-token-env-var OPENLEAGUES_TOKEN
```

Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`,
leave Client ID & Secret blank, authorize with the bearer token. Cookie
sessions are never accepted on this route — bearer token only.

Four playbooks (migrate, lineup, book, week) live under
`src/lib/agent/skills/` — copy or symlink into a host skills dir
(`~/.codex/skills/`, `~/.claude/skills/`; already in `.grok/skills/` here).

<img src="docs/images/account-skins.png" alt="Picking a skin and minting an agent token from /account" width="70%">

## Docs

- [Self-hosting in depth](docs/self-host.md) — env vars, Vercel, running
  without Docker, the tick clock, backups
- [Notifications (Web Push)](docs/notifications.md)
- [Google sign-in](docs/google-sign-in.md)
- [Development](docs/development.md) — test/lint/typecheck, the book's QA script

## License

MIT.
```

**Verify**: `wc -l README.md` → roughly 100–110 lines (down from 338);
`grep -c '<img src="docs/images' README.md` → `3`.

### Step 3: create `docs/self-host.md` with this exact content

```markdown
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
```

**Verify**: `wc -l docs/self-host.md` → roughly 85–95 lines.

### Step 4: create `docs/notifications.md` with this exact content

```markdown
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
```

**Verify**: `wc -l docs/notifications.md` → roughly 35–40 lines.

### Step 5: create `docs/google-sign-in.md` with this exact content

```markdown
# Google sign-in

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

## Verify

| Expect | How |
|--------|-----|
| Off, no broker | `/login` is email only. Copy does not mention Google. |
| Both env vars set | `/login` shows **Continue with Google**. Copy: "Google is available on this host." |
| Sign-in | Button → Google account chooser → back on this origin, signed in. |
| Broker already on | One Google button (broker), not two. |

`bun test src/lib/auth/providers.test.mjs` covers the empty-env / both-vars button list.
```

**Verify**: `wc -l docs/google-sign-in.md` → roughly 20–24 lines.

### Step 6: create `docs/development.md` with this exact content

```markdown
# Development

## Check

```sh
bun test
bun test src/lib/auth/providers.test.mjs   # native Google button gating
bun test src/lib/push                      # SW + no-VAPID no-op
bun run typecheck
bun run lint
```

## Testing the book (wagers)

Managers can stake FAAB on matchups when the commissioner turns betting **On**
under **The book** in league settings (then Save). Open Matchups to see the
line — live prices open the wager ticket; preseason shows an honest "no price"
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
```

**Verify**: `wc -l docs/development.md` → roughly 20–24 lines.

### Step 7: link sanity + full gate, then commit

Confirm every relative link resolves:
- README.md's four `docs/*.md` links and three `docs/images/*.png` `<img
  src>` paths — all relative to the repo root, so `README.md`'s own
  location (repo root) means `docs/self-host.md` etc. resolve directly.
- `docs/self-host.md`'s two links (`google-sign-in.md`, `notifications.md`)
  are relative to `docs/`, so they resolve as siblings in the same
  directory — confirm both files exist there.

```sh
ls docs/self-host.md docs/notifications.md docs/google-sign-in.md docs/development.md docs/images/*.png
```

All six paths must exist. Then:

`bun run lint` (compare to `b33458a` baseline — 10/177/6, unaffected since
markdown/images aren't Biome-linted) · `bun test src scripts` (same
pass/fail shape as baseline; if you hit a PGLite "corrupt WAL" error, run
`bun run db:repair` once — pre-existing environmental issue) · `bun run
build` → exit 0.

`git add README.md docs/` (this stages the new/moved markdown **and** the
three pre-existing image files together). Commit (message above). Update
the 088 row in `plans/README.md`.

## Test plan

- No new automated tests — this is a docs/content reorganization with no
  existing test harness around `README.md` or `docs/`.
- Manual: open `README.md` in a plain markdown viewer (or just read the
  raw file) and confirm the three images render as sensible inline content
  (not broken paths) and the prose reads coherently top to bottom.

## Done criteria

- [ ] `README.md` is roughly 100–115 lines (down from 338) and contains
      exactly 3 `<img src="docs/images/...">` tags
- [ ] `docs/self-host.md`, `docs/notifications.md`, `docs/google-sign-in.md`,
      `docs/development.md` all exist with the content given above
- [ ] `docs/images/three-skins.png`, `boxscore-ledger.png`,
      `account-skins.png` are staged in the commit (`git show --stat HEAD`
      lists all three)
- [ ] Every relative link/image path in README.md and docs/self-host.md
      resolves to a file that actually exists (Step 7)
- [ ] `bun run lint` · `bun test src scripts` · `bun run build` show no
      change from the `b33458a` baseline
- [ ] `git diff --stat` touches only `README.md` and files under `docs/`

## STOP conditions

- The drift check shows `README.md` no longer matches its state at
  `b33458a` (someone edited it concurrently) — reconcile is not your call.
- Any of the three `docs/images/*.png` files is missing, zero-byte, or not
  a valid PNG — STOP and report; do not attempt to generate a replacement
  yourself (per the special note at the top of this plan).
- You find yourself wanting to rewrite or "improve" any of the moved
  content beyond the exact text given in Steps 2–6 — don't; every word
  above was deliberately chosen or moved verbatim from already-reviewed
  copy. Flag a suggestion in NOTES instead of acting on it.
- You find yourself wanting to add more images, resize the existing ones,
  or reorder the README's sections beyond what's given — out of scope;
  this plan's layout is final for this pass.

## Maintenance notes

- If the MCP catalog coverage figure changes again (currently "57 of 76"),
  both this README and the source-of-truth check
  (`grep -c '^  "' src/lib/agent/core.ts`) need to move together — same
  coupling plan 084 already noted.
- The three committed images came from a live screenshot pass against
  `leagues.waits.dev` (the WIFFL league) earlier this session, processed
  with ImageMagick (`-trim`, resize, 128-color PNG8 quantization) to keep
  file size small. If the product's visual design changes meaningfully,
  these will need re-capturing — there's no automated process for that
  yet.
- Next steps after this plan (per the operator's own sequencing): the
  `ff_*`/`off_` database-layer rename (still separately gated, not yet
  scoped as a numbered plan), then a live Codex/ChatGPT connector demo
  against the renamed MCP server, then circling back to the X/social post
  using this session's corrected copy as the source of truth for claims.
