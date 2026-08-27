# Migrating your league

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
