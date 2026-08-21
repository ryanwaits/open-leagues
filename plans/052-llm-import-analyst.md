# Plan 052: BYOK AI foundation + LLM import analyst (AI SDK, multi-provider)

> **Executor instructions**: Follow step by step; verify each step. STOP
> conditions binding. Reviewer maintains `plans/README.md`.
>
> **Step 0 — discard a previous run's abandoned UNCOMMITTED work first**:
> `git checkout -- bun.lock package.json render.yaml src/lib/agent/CATALOG.md src/lib/agent/catalog.ts src/lib/league/fns.ts src/routes/import.tsx && rm -f src/lib/league/import-analyze.server.ts src/lib/league/import-analyze.test.mjs`
> Then verify `git status --short` shows only `plans/` entries. (That WIP
> was an env-var single-provider design, superseded by this plan.)
>
> **Drift check**: `git diff --stat 0e0017b..HEAD -- src/routes/import.tsx src/routes/account.tsx src/lib/league src/lib/db.ts package.json`
> Non-empty after Step 0 → compare Current state; mismatch → STOP.

## Status

- P2 · Effort L · Risk MED (stores encrypted user secrets; feature-gated)
- Depends on: none · Planned at `0e0017b`, 2026-08-20

## Why this matters

The app is growing LLM features (import analysis now; desk news, recap
prose, agent flows later). Operator decision: **BYOK** — each commissioner/
creator supplies their own API key in-app, multi-provider via the Vercel
AI SDK, instead of one host-level env key. This plan builds the BYOK
foundation (per-user key, encrypted at rest, provider+model choice, /account
UI) and ships its first consumer: extracting league SETTINGS (scoring book,
slots, name, season, playoffs) from pasted/PDF import text — today
`packFromRebuild` hardcodes `bookFromPreset` and commissioners re-type
their real rules by hand.

## Current state

- `src/routes/import.tsx:90-117` — `readDroppedFile`: PDF → latin1 string
  extraction into `paste`; known-pack shortcut (`907798861` / WIFFL+"draft
  recap") returns `{known:"wiffl-2026"}` skipping parse. Review step at
  `step === "review"` before `commitImportPack`.
- `src/lib/league/import-pack.ts:327-340` — `packFromRebuild`: line ~336
  `const book = bookFromPreset(input.scoring);` ← the settings gap. This
  file stays READ-ONLY; merging happens in import.tsx.
- `src/lib/league/scoring.ts` — `ScoringBook` = Record<string,number>;
  canonical keys in the `CLASSIC` constant (~lines 60-122: pass_yd,
  pass_td, rec, rec_yd, bonus_pass_yd_300, fgm_40_49, pts_allow_0, …);
  `bookFromPreset`, `presetOf` exported.
- `src/lib/league/wagers.server.ts` — `ensureWagerSchema()` is the
  create-table-if-not-exists pattern to copy (works on PGLite AND pg).
- `src/lib/league/fns.ts` — server fns: `createServerFn` + `authMiddleware`
  + zod validator; copy the `saveSettings` shape (~line 435). `context.userId`
  is the authed user.
- `src/routes/account.tsx` — sectioned page: AppearancePanel, then
  `<AgentTokensPanel />` (~line 30), `<InstallDrawerButton />`. Section
  headers use `font-mono text-[11px] uppercase tracking-[0.16em] text-faint`
  → NOTE: after the voice codemod that exact recipe is now the class
  `microlabel` — match whatever account.tsx actually uses.
- `BETTER_AUTH_SECRET` is guaranteed present in every deployment
  (docker-entrypoint generates/persists it; local dev has it via auth).
- Bun package manager; check versions before adding deps
  (`npm view <pkg> version`).

## Design

### 1. Per-user AI config, encrypted at rest — `src/lib/league/ai.server.ts`

- Table (ensure-pattern, copy ensureWagerSchema):
  `ff_user_ai (user_id text primary key, provider text not null, model
  text not null, key_enc text not null, updated_at timestamptz not null
  default now())`
- Crypto (node:crypto, pure + testable):
  `encryptSecret(plain, secret)` / `decryptSecret(payload, secret)` —
  AES-256-GCM, key = `scryptSync(secret, "open-leagues-ai", 32)`, payload
  `iv.cipher.tag` base64 joined with ":". Runtime secret =
  `process.env.BETTER_AUTH_SECRET` (throw a clean error if unset).
- Providers: `"anthropic" | "openai" | "google"`. Model is a free string;
  default prefill ONLY for anthropic: `"claude-sonnet-5"` (operator's model
  choice); other providers get placeholder text, user types the model id.
- API: `saveUserAi(userId, {provider, model, apiKey?})` (apiKey omitted =
  keep stored key), `getUserAiMasked(userId)` → `{provider, model,
  keyLast4} | null` (NEVER the key), `deleteUserAi(userId)`,
  `modelForUser(userId)` → AI-SDK LanguageModel | null via
  `createAnthropic({apiKey})(model)` / `createOpenAI(...)` /
  `createGoogleGenerativeAI(...)`, `testUserAi(userId)` → tiny
  `generateText` ("reply with OK"), returns `{ok, message}` with provider
  errors SANITIZED (never echo the key; truncate messages to 200 chars).

### 2. Import analyst — same module or `import-analyze.server.ts`

zod `Analysis` schema: `{leagueName: string|null, season: string|null,
scoring: Record<string,number>|null, slots: string[]|null, playoffTeams:
number|null, confidence: "high"|"medium"|"low", notes: string}`.
`analyzeImportText(userId, text)`: model = `modelForUser(userId)`; null →
return null. Call AI SDK `generateObject({model, schema, system: SYSTEM,
prompt: text.slice(0, 200_000)})` → return `object`. Write SYSTEM in full:
extraction rules ("only what the text supports; null when absent"), the
complete CLASSIC key glossary with one-phrase meanings, 2 worked
micro-examples ("Half PPR" → rec: 0.5; "Passing TD: 6" → pass_td: 6).
Export pure `mergeAnalysis(pack, analysis)`: overlay scoring keys filtered
to the CLASSIC key set; slots/name/season/playoffTeams fill only defaults;
null analysis → pack unchanged.

### 3. Server fns (fns.ts)

`getAiSettings` (GET, masked), `saveAiSettings` (POST: provider, model,
apiKey optional `z.string().min(10).max(300).optional()`),
`deleteAiSettings` (POST), `testAiSettings` (POST), `analyzeImport` (POST:
`{text: z.string().min(40).max(400_000)}` → `{available, analysis}`;
catch errors → `{available: true, analysis: null}` — never surface raw
provider errors/HTML to the toast).

### 4. UI

- `/account`: new "AI" section between Appearance and Agent tokens —
  provider pill-select (3), model text input (prefill per provider rule),
  key password input (write-only; when a key is stored show
  "•••• {last4} saved" + Remove), Save + Test buttons with toast feedback.
  Copy: "Your key powers AI features on desks you run — imports, news,
  recaps. Stored encrypted; never shown again."
- `import.tsx` review step: when paste text exists (INCLUDING the
  known-pack shortcut — pass extracted strings anyway), fire `analyzeImport`
  once; status line: analyzing → "Detected: Half PPR · 6-pt pass TD ·
  3 bonuses · 9 starters" (build from the merged book via `presetOf` +
  notable diffs) or "No settings found". `available:false` → one quiet
  line linking to /account: "Add an AI key to auto-read league settings."
  Merge via `mergeAnalysis` before commit; user edits in review always win.

## Steps

1. Step 0 cleanup (above) → `git status` clean except plans/.
2. `bun add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google` (latest;
   `npm view ai version` first). VERIFY the call shapes against the
   installed package (`node_modules/ai/README.md` or its .d.ts):
   `generateObject({model, schema, system, prompt})` and `generateText` —
   v5 renamed some options (e.g. maxOutputTokens); use what the installed
   types say, not memory. Verify: `bun run typecheck` → 0.
3. `ai.server.ts` (schema, crypto, CRUD, modelForUser, testUserAi).
   Verify: typecheck 0.
4. Analyst (`Analysis`, SYSTEM, analyzeImportText, mergeAnalysis).
   Verify: typecheck 0.
5. Server fns. Verify: typecheck 0.
6. /account AI section. Verify: typecheck 0; scoped biome no NEW findings.
7. import.tsx wiring. Verify: typecheck 0; scoped biome no NEW findings.
8. Tests `src/lib/league/ai.test.mjs` (node:test, pattern
   `src/lib/push/sw.test.mjs` for pure logic + `src/skin/brand.test.mjs`
   for source asserts): crypto roundtrip + tamper (bad tag throws) with an
   injected secret; mergeAnalysis (overlay, unknown-key drop, null =
   unchanged); source asserts — `getUserAiMasked` never selects/returns
   key_enc plaintext (assert the masked shape / keyLast4 in source),
   default model string `claude-sonnet-5` present, account.tsx has the AI
   section, import.tsx calls analyzeImport, fns.ts exports the five fns.
   Verify: `bun test src scripts` → pass (1 baseline import.meta.glob
   error is pre-existing).
9. Live check (agent-browser, sandbox disabled, dev :8080, seed sign-in):
   /account → AI section renders; save a FAKE key ("sk-test-not-real…") →
   masked state appears, reload persists mask, Remove works. Test button
   with the fake key → clean sanitized failure toast (no key echoed, no
   raw HTML). If ANTHROPIC_API_KEY or an `ant auth` profile exists in THIS
   environment, optionally run one real `analyzeImportText` smoke test via
   `bun -e` with a synthetic recap ("Half PPR. Passing TD: 6. INT: -2.
   Lineup: QB RB RB WR WR TE FLEX K DEF, 6 bench.") — expect rec 0.5,
   pass_td 6, pass_int −2, 9 slots; else SKIP and say so.

## Scope

**In**: package.json/bun.lock · `src/lib/league/ai.server.ts` +
`import-analyze.server.ts` (or one module) + `ai.test.mjs` (create) ·
`src/lib/league/fns.ts` · `src/routes/account.tsx` ·
`src/routes/import.tsx`.
**Out**: `import-pack.ts`, `import-commit.ts`, engine/auth/db.ts core,
`render.yaml` (NO env key in this design), `src/lib/agent/**`, `plans/**`.

## Done criteria

- [ ] typecheck / `bun test src scripts` / build exit 0
- [ ] Step-0 litter gone; `git status` only in-scope files (+ plans/)
- [ ] `grep -rn "claude-sonnet-5" src/lib/league` ≥ 1
- [ ] No plaintext key path: `grep -n "key_enc" src/lib/league/fns.ts` → 0
      (fns return masked shapes only)
- [ ] Browser check done (masked persistence + sanitized test failure)
- [ ] No behavior change for users with no stored key

## STOP conditions

- AI SDK's installed `generateObject`/`generateText` shapes differ beyond
  option renames and you'd have to guess → STOP with what you found.
- Any code path would return or log a decrypted key beyond the provider
  client constructor → STOP.
- The work seems to need `render.yaml`, auth tables, or `import-pack.ts`
  edits → STOP.

## Maintenance notes

- Future consumers call `modelForUser` (or a league-scoped
  `modelForCommish(leagueId)` helper — follow-up) — desk news, recap
  prose, agent features. Keep SYSTEM prompts stable for provider caching.
- League-level key override and non-commish visibility rules: follow-up.
- Key rotation = paste a new key (upsert). Losing BETTER_AUTH_SECRET
  orphans stored keys (decrypt fails) — surface as "re-enter your key".
- Reviewer scrutiny: crypto (GCM tag verified), no key in logs/toasts,
  masked-only reads.
