# Migrating your league

One import pack per source, committed to the ledger once. Import is one-way:
it extracts once and never polls the old host. After commit the league box is
the source of truth for sit/start, FAAB, trades, and the book. Sleeper stays
the player/week data source over outbound HTTPS; no member needs a Sleeper
account. ESPN cookies are used once, for the import.

**Sleeper** (league id, no login):

1. `/new` → **Import** → **Sleeper** tab → paste the league id.
2. Review the preview (teams, scoring, rosters) and confirm.
3. Optional: include one prior season.

MCP or skill: `previewImport`, then `importLeague` with `confirm: true`.

**ESPN** (league id or URL, season):

1. `/new` → **Import** → **ESPN** tab → league id or URL, season.
2. Private league: paste SWID + `espn_s2` (used once, never stored), or set
   the league public for one minute. Names only: paste a recap.
3. Review the preview and confirm.

MCP: `previewEspn`, then `importEspn` with `confirm: true`.

**Anywhere else** (Yahoo, NFL.com, a spreadsheet, a screenshot, a remembered
record): the **Draft** tab rebuilds a season.

1. `/new` → **Import** → **Draft** tab → paste an ESPN draft recap, team
   blocks, a CSV, or a known-record summary, or upload a PDF. An image-only
   PDF does not parse; paste the text.
2. Review the preview and confirm.

MCP: `previewRebuild`, then `importRebuild` with `confirm: true`.

Manager emails are never pulled. The commissioner types the invite allowlist
in league settings after import.

| Source | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
|---|---|---|---|---|---|---|---|
| Sleeper | league id, no auth | Draft-tab paste | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | optional one `previous_league_id` via `includeHistory` (default off) |
| ESPN | public **or** SWID+espn_s2 one-shot, not saved | Draft-tab paste | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
| Draft (paste/PDF/known record) | none | paste, PDF, known recap | yes | scoring **preset** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
| Yahoo | OAuth not shipped | Draft-tab paste | via paste | via paste | via paste | no | no |
| NFL.com | hop: espn.com/importnfl → ESPN import (no HTML scrape) | Draft-tab paste | via ESPN/paste | via ESPN/paste | via ESPN/paste | via ESPN | no |
