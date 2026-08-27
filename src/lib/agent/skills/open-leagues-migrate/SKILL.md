---
name: open-leagues-migrate
description: >
  Migrate a fantasy league into open-ff. Use when importing from Sleeper,
  ESPN, Yahoo, NFL.com, or a paste/PDF rebuild, or when the user says
  "import league", "migrate", "bring over my sleeper league", or
  "set up from ESPN".
---

# Migrate a league

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md). Start with
`getAgentContext` when a league already exists; for a fresh import,
ask the source first.

Every source becomes one import pack (teams, managers, slots, scoring,
rosters, weeks). After commit we are the source of truth — one-way
extract only. **Never invent manager emails** from these APIs; allowlist
is a post-import step the commish types in settings.

## Source decision tree

1. **Ask which source**, then pick a path. **File/paste is always
   option 2** if connect fails or the source is unsupported.

| Source | Connect | File fallback |
|---|---|---|
| **Sleeper** | League id → `previewImport` then `importLeague` (`confirm: true`) on MCP | Paste/PDF rebuild on MCP or PWA `/import` |
| **ESPN** | League id + season → `previewEspn` then `importEspn` (`confirm: true`) on MCP; private leagues need SWID+espnS2 **once** (never saved, never echoed) | Same rebuild path, below |
| **Rebuild (paste/PDF/known record)** | `previewRebuild` then `importRebuild` (`confirm: true`) on MCP | Same, via PWA `/import` if MCP isn't available |
| **Yahoo** | OAuth **not shipped** (YDN app not approved) | Paste standings/rosters on `/import` |
| **NFL.com** | Do **not** scrape. Hop: espn.com/importnfl → our ESPN import | Or paste on `/import` |

2. **Sleeper (MCP):** call `previewImport` with the Sleeper id. Optional
   includeHistory=true walks at most one previous_league_id (records
   only). Show unmatched / warnings. Stop if the preview is messy.
3. After the human says yes, call `importLeague` with
   `confirm: true`. Never commit without that flag. Default
   includeHistory is false.
4. **ESPN:** call `previewEspn` with the league id + season (swid/espnS2
   only if the league is private — ask once, never store it, never echo it
   back in any message). Show the preview; after they say yes, call
   `importEspn` with `confirm: true`.
5. **Paste/PDF rebuild:** call `previewRebuild` with whatever they can give
   you (paste, a known-record summary, or a base64 PDF). Show the preview;
   after they say yes, call `importRebuild` with `confirm: true`.
6. **Yahoo / NFL.com:** still commit-only on the PWA `/import` page — Yahoo
   has no OAuth app approved, and NFL.com is a hop through the ESPN import,
   not a direct MCP path. Point them there. Never ask them to paste cookies
   into chat; never echo cookies. Never fetch `fantasy.nfl.com` HTML.
7. Optional invite allowlist: `addAllowlistEmail` is PWA settings
   only — not MCP. Point them at league settings. **No emails from
   Sleeper/ESPN/Yahoo APIs.**

Do not invent import tools. Do not call tick. Do not sync back to the
old host after import.
