# Plan 083: Complete the "migrate any league in" story on MCP — ESPN + rebuild

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <082's landed SHA>..HEAD -- src/lib/agent/core.ts src/lib/agent/dispatch.ts src/lib/agent/dispatch.test.mjs`
> Plans 081 and 082 (both dependencies) land additive `case` blocks and ids
> in these same three files — expected, not drift. If anything **else**
> differs from the "Current state" excerpts below, STOP and report.

## Status

- **Priority**: P2
- **Effort**: M (4 new dispatch cases + 4 core.ts ids + tests — two of the
  four have real argument-shape complexity, and two carry a genuine
  security requirement, not just plumbing)
- **Risk**: MED — not because the underlying functions are new (they
  aren't) but because `previewEspn`/`importEspn` pass ESPN session cookies
  (`swid`/`espnS2`) through the call, and the catalog's own description for
  both already says **"Never log swid/espnS2; not for traces."** Getting the
  plumbing right is easy; the discipline of never letting those two fields
  reach a log line, error message, or trace span is the actual risk this
  plan carries. Read the STOP conditions before Step 2.
- **Depends on**: plans/081-agent-catalog-safe-reads.md and
  plans/082-agent-catalog-verb-completion.md (same three files; land both
  first so this plan's diff is clean)
- **Category**: dx / agent-native surface, direction (headless "migrate any
  league" positioning)
- **Planned at**: commit `7899535`, 2026-08-26 (081 + 082 land on top before
  this runs — the drift check above accounts for that)

## Why this matters

Only Sleeper import (`previewImport`/`importLeague`) is reachable over MCP
today. `previewEspn`/`importEspn` (ESPN) and `previewRebuild`/`importRebuild`
(paste/PDF rebuild of a historical league with no live source) are fully
built and used by the web app's `/import` flow, but an agent hits `Unknown
tool` for all four. If the product's pitch is "migrate your league in, from
wherever it lives today," Sleeper-only is a visibly incomplete version of
that claim. This plan wires the other two source paths.

## Current state

Excerpts read directly at commit `7899535`.

- `src/lib/agent/core.ts` — after 081+082 land, ends with 082's
  `// verb completion (082)` block; this plan appends after it.
- `src/lib/agent/dispatch.ts` — the existing `previewImport`/`importLeague`
  cases (lines 209–232) are the direct precedent to model these four on:
  ```ts
  case "previewImport": {
    const { previewSleeperImport } = await import("@/lib/league/engine.server");
    const includeHistory = args.includeHistory === true;
    return asJson(await previewSleeperImport(str(args.sleeperId, "sleeperId"), includeHistory));
  }
  case "importLeague": {
    if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
    if (args.confirm !== true) {
      throw new Error("importLeague requires confirm: true");
    }
    const { importSleeperLeague } = await import("@/lib/league/engine.server");
    const claim =
      args.claimRosterId == null || args.claimRosterId === ""
        ? null
        : num(args.claimRosterId, "claimRosterId");
    return asJson(
      await importSleeperLeague({
        userId,
        sleeperId: str(args.sleeperId, "sleeperId"),
        claimRosterId: claim,
        includeHistory: args.includeHistory === true,
      }),
    );
  }
  ```
  Note `importLeague` requires an explicit `confirm: true` in args — a
  deliberate two-step commit gate for any import, not something 038/044
  invented per-source. **All four new cases in this plan need the same
  `confirm: true` gate on their import (mutating) half**; the preview half
  never mutates and never needs it.

- Underlying functions (confirmed by direct read at `7899535`):
  ```ts
  // src/lib/league/engine.server.ts
  export async function previewEspnImport(input: {
    leagueId: string; season: string; swid?: string; espnS2?: string;
  }): Promise<{ sleeperId: string; name: string; season: string; status: string;
    teamCount: number; scoringLabel: string;
    teams: { rosterId: number; teamName: string; manager: string; players: number;
      unmatched?: string[]; record?: string | null }[] }>

  export async function importEspnLeague(input: {
    userId: string; leagueId: string; season: string; claimRosterId: number | null;
    swid?: string; espnS2?: string;
  }): Promise<unknown> // same return shape family as importSleeperLeague

  export async function previewRebuild(input: {
    paste?: string; known?: string; pdfBase64?: string;
    teams?: { teamName: string; manager: string; wins: number | null; losses: number | null;
      ties: number | null; pf: number | null; pa: number | null; names: string[] }[];
    name: string; season: string; scoring: "ppr" | "half" | "std";
  }): Promise<unknown>

  export async function importRebuild(input: {
    userId: string; paste?: string; known?: string; pdfBase64?: string;
    teams?: { teamName: string; manager: string; wins: number | null; losses: number | null;
      ties: number | null; pf: number | null; pa: number | null; names: string[] }[];
    name: string; season: string; scoring: "ppr" | "half" | "std"; claimRosterId: number | null;
  }): Promise<unknown>
  // CORRECTED after an executor STOP: importRebuild's own input type DOES
  // accept an optional pdfBase64 (confirmed by direct read,
  // engine.server.ts:2156-2175) — the "Current state" table below was
  // wrong to say otherwise. It's still correct that this plan's dispatch
  // case should NOT pass pdfBase64 through for importRebuild: the field
  // is optional, and the browser's own fns.ts contract (below) never sends
  // one for this verb either — only previewRebuild's validator has a
  // pdfBase64 field. This plan mirrors the browser RPC's argument surface
  // for behavior parity, not the engine function's full accepted input
  // space, exactly like every other case in 081/082/083. Proceed with
  // Step 2's code as written — the omission is intentional and correct.
  ```

- `src/lib/league/fns.ts` — the exact args each browser call sends (this is
  the contract this plan reproduces; already read in full at `7899535`):
  ```ts
  previewEspn:   { leagueId, season, swid?, espnS2? }               — authMiddleware, but
                                                                       handler never reads
                                                                       context.userId
  importEspn:    { leagueId, season, claimRosterId, swid?, espnS2? } — authMiddleware, uses
                                                                       context.userId
  previewRebuild: { paste?, known?, pdfBase64?, teams?, name, season, scoring } — authMiddleware,
                                                                       handler never reads
                                                                       context.userId
  importRebuild: { paste?, known?, teams?, name, season, scoring, claimRosterId } — authMiddleware,
                                                                       uses context.userId
                                                                       (note: no pdfBase64 field
                                                                       here — only previewRebuild
                                                                       has it; match this exactly,
                                                                       don't add it to importRebuild)
  ```
  **Important, easy to miss**: `previewEspn` and `previewRebuild` are
  `kind: "read"` in `catalog.ts`, but their `fns.ts` wrappers use
  `authMiddleware` (requires a real session), not `optionalAuthMiddleware`
  — the handler bodies just never happen to *read* `context.userId`. This
  is the same shape as `exportLeague` (081) and `listMyLeagues`: a "read"
  that still requires a signed-in caller. Both new preview cases need
  `if (!userId) throw new Error(...)`, exactly like those two.

- `src/lib/agent/dispatch.test.mjs` — after 081+082, has 9 tests. Step 3
  below extends it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | pass |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `src/lib/agent/core.ts` (add 4 ids)
- `src/lib/agent/dispatch.ts` (add 4 `case` blocks)
- `src/lib/agent/dispatch.test.mjs` (new tests — see Step 3)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- `src/lib/agent/catalog.ts` / `CATALOG.md` — unchanged; both already
  document these 4 ids with the "Never log swid/espnS2" language.
- `src/lib/data/espn-ff.server.ts`, `src/lib/league/import-pack.ts`, or any
  other import-pipeline internals — this plan adds a second caller to
  existing, already-shipped functions, it does not touch how ESPN/rebuild
  import actually works.
- `createLeague`, `joinLeague`, or any commish/workflow id — separate,
  unscoped batch.
- The `open-ff-migrate` skill (`src/lib/agent/skills/open-ff-migrate/SKILL.md`)
  — it already documents ESPN/rebuild as routed to the PWA `/import` page
  "since those commit verbs aren't on MCP." That sentence becomes stale
  once this plan lands, but updating the skill doc is a docs pass, not this
  plan — flag it in your NOTES for the reviewer, don't edit it yourself.

## Git workflow

Current branch; one commit, e.g.
`feat(agent): wire ESPN + rebuild import onto MCP`. Do NOT push.

## Steps

### Step 1: add 4 ids to `src/lib/agent/core.ts`

```ts
  // migrate completion (083)
  "previewEspn",
  "importEspn",
  "previewRebuild",
  "importRebuild",
]);
```

**Verify**: `grep -c '^  "' src/lib/agent/core.ts` → `57` (53 after 082 + 4).

### Step 2: add 4 `case` blocks to `src/lib/agent/dispatch.ts`

```ts
    case "previewEspn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { previewEspnImport } = await import("@/lib/league/engine.server");
      return asJson(
        await previewEspnImport({
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          swid: optStr(args.swid),
          espnS2: optStr(args.espnS2),
        }),
      );
    }
    case "importEspn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      if (args.confirm !== true) throw new Error("importEspn requires confirm: true");
      const { importEspnLeague } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importEspnLeague({
          userId,
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          claimRosterId: claim,
          swid: optStr(args.swid),
          espnS2: optStr(args.espnS2),
        }),
      );
    }
    case "previewRebuild": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const scoring = args.scoring;
      if (scoring !== "ppr" && scoring !== "half" && scoring !== "std") {
        throw new Error("scoring must be ppr, half, or std");
      }
      const { previewRebuild } = await import("@/lib/league/engine.server");
      return asJson(
        await previewRebuild({
          paste: optStr(args.paste),
          known: optStr(args.known),
          pdfBase64: optStr(args.pdfBase64),
          teams: Array.isArray(args.teams) ? args.teams : undefined,
          name: str(args.name, "name"),
          season: str(args.season, "season"),
          scoring,
        }),
      );
    }
    case "importRebuild": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      if (args.confirm !== true) throw new Error("importRebuild requires confirm: true");
      const scoring = args.scoring;
      if (scoring !== "ppr" && scoring !== "half" && scoring !== "std") {
        throw new Error("scoring must be ppr, half, or std");
      }
      const { importRebuild } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importRebuild({
          userId,
          paste: optStr(args.paste),
          known: optStr(args.known),
          teams: Array.isArray(args.teams) ? args.teams : undefined,
          name: str(args.name, "name"),
          season: str(args.season, "season"),
          scoring,
          claimRosterId: claim,
        }),
      );
    }
```

Note `importEspn`/`importRebuild` both need the same `confirm: true` gate
`importLeague` already uses — this plan adds it explicitly per case (there
is no shared helper for it yet; do not add one here, that's a separate
refactor).

**Verify**: `bun run typecheck` → 0; `bun run build` → 0.

### Step 3: tests in `dispatch.test.mjs`

```js
test("083's 4 migrate-completion ids reject cleanly without a user", async () => {
  for (const [id, args] of [
    ["previewEspn", { leagueId: "e1", season: "2025" }],
    ["importEspn", { leagueId: "e1", season: "2025", confirm: true }],
    ["previewRebuild", { name: "L", season: "2025", scoring: "ppr" }],
    ["importRebuild", { name: "L", season: "2025", scoring: "ppr", confirm: true }],
  ]) {
    await assert.rejects(() => dispatch(id, null, args), /OPENFF_USER|signed-in/, id);
  }
});

test("importEspn / importRebuild require confirm: true", async () => {
  await assert.rejects(
    () => dispatch("importEspn", "user_x", { leagueId: "e1", season: "2025" }),
    /confirm/,
  );
  await assert.rejects(
    () => dispatch("importRebuild", "user_x", { name: "L", season: "2025", scoring: "ppr" }),
    /confirm/,
  );
});

test("previewRebuild / importRebuild reject a bad scoring value", async () => {
  await assert.rejects(
    () => dispatch("previewRebuild", "user_x", { name: "L", season: "2025", scoring: "bogus" }),
    /scoring/,
  );
});
```

**Verify**: `bun test src/lib/agent` → all pass.

### Step 4: full gate, then commit

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0. Commit. Update the 083 row in `plans/README.md`. In your
NOTES, flag that `src/lib/agent/skills/open-ff-migrate/SKILL.md` now has a
stale sentence (see Scope) for the reviewer to route to a docs plan.

## Test plan

- The three Step 3 tests.
- `bun test src/lib/agent/catalog.test.mjs` stays green unmodified — it
  already has a dedicated test (`"previewEspn / importEspn never log
  swid/espnS2"`) asserting the catalog description carries the warning;
  this plan doesn't touch that description, so it should already pass.
- Full `bun test src scripts` green.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -c '^  "' src/lib/agent/core.ts` → 57
- [ ] All 4 ids appear as `case` blocks in `dispatch.ts`
- [ ] `git diff --stat` (against 082's landed commit) touches only the
      three in-scope files
- [ ] `bun test src/lib/agent` → all pass
- [ ] `grep -rn 'swid\|espnS2' src/lib/agent/dispatch.ts` shows these two
      identifiers used **only** as pass-through variable names/object keys
      — never inside a template string, `console.*` call, thrown `Error`
      message, or comment that would put a real cookie value in a log

## STOP conditions

- Plans 081/082 have not both landed (`AGENT_CORE` has fewer than 53
  entries) — land them first; this plan's numbering (57 = 53 + 4) assumes
  both did.
- The drift check shows anything beyond 081+082's expected additions.
- Any underlying function signature doesn't match what's cited here once
  you open the real file.
- **You find yourself writing `console.log`, a debug print, or an error
  message that includes `args.swid` or `args.espnS2` (or the resolved
  `swid`/`espnS2` locals) anywhere, even temporarily while debugging** —
  remove it before moving on; do not commit with it present even
  commented out. This is the one hard line in this plan.
- You're unsure whether an error thrown deep inside `previewEspnImport`/
  `importEspnLeague` might itself embed the cookie value in its message
  (e.g. an upstream HTTP error echoing the request) — if you observe this
  while testing, STOP and report rather than swallowing/rewriting the
  error yourself; that's a pre-existing concern in `engine.server.ts`, not
  something this plan is scoped to fix, but it must be reported, not hidden.

## Maintenance notes

- After 081 + 082 + 083, `AGENT_CORE` covers 57 of 76 ids (75%). Remaining
  19 are all commish/workflow-tier (`createLeague`, `joinLeague`,
  `startDraft`, `autoFillDraft`, `saveSettings`, allowlist management,
  `processWaivers`, `saveWeekSchedule`/`rebuildSchedule`, `proposeTrade`)
  plus the two that should likely stay permanently excluded
  (`deleteLeague`, `advanceWeek`) plus the BYOK AI-settings tools
  (`getAiSettings`/`saveAiSettings`/`deleteAiSettings`/`testAiSettings`/
  `analyzeImport`, lower priority — config for the app's own AI features,
  not obviously agent-relevant).
- `src/lib/agent/skills/open-ff-migrate/SKILL.md` (and its mirrors in
  `.claude/skills/` / `.grok/skills/`) should be updated in a follow-up docs
  plan to route ESPN/rebuild through MCP now that the commit verbs exist —
  today it explicitly tells the model to route those to the PWA `/import`
  page.
- If a hosted (non-operator) MCP client ever calls `importEspn`, the
  bearer-token auth path (`src/routes/api/mcp.ts`) is what supplies
  `userId` — same as every other mutating tool. Nothing new here, just
  confirming this plan doesn't need a new auth path.
