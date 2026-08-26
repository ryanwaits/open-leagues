# Plan 081: Wire the 26 safe read-only primitives onto MCP

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7899535..HEAD -- src/lib/agent/core.ts src/lib/agent/dispatch.ts src/lib/agent/dispatch.test.mjs`
> If any diff exists, compare the "Current state" excerpts below against the
> live code before proceeding; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: L (26 new dispatch cases + 26 core.ts ids + tests — mechanical
  but high-volume; no new schema, no new server-side logic)
- **Risk**: LOW — every tool added here is `kind: "read"` in `catalog.ts`
  already (`mutating: false`), and every underlying function already exists
  and is already exposed to the browser via `createServerFn` in
  `src/lib/data/fns.ts` / `src/lib/league/fns.ts`. This plan does not write
  new business logic — it adds a `dispatch.ts` case per id that calls the
  exact same underlying function the browser RPC already calls, bypassing
  only the `createServerFn`/middleware wrapper (which the 20 already-wired
  ids already do identically).
- **Depends on**: none (it's additive to `core.ts`/`dispatch.ts`, which are
  otherwise untouched by any open plan)
- **Category**: dx / agent-native surface
- **Planned at**: commit `7899535`, 2026-08-26

## Why this matters

`src/lib/agent/catalog.ts` documents 76 named primitives an agent may call.
`src/lib/agent/core.ts` (`AGENT_CORE`) is the subset actually reachable over
MCP — today that's 20 ids (confirmed by `grep -c '^  tool(' catalog.ts` → 76,
`grep -c '^  "' core.ts` → 20). Everything else throws `Unknown tool` from
`dispatch.ts`'s `default` case, even though the underlying function is fully
built and already used by the web app every day. This plan closes that gap
for the **26 tools that are pure reads with zero mutation risk** — the
single largest, lowest-risk increment available. It does not touch anything
commish-level or destructive (that's explicitly out of scope — see below).

The 26 ids, in the order this plan wires them:

**Group A — no leagueId, no auth** (13): `getPulse`, `getScores`,
`getGameSummary`, `getWeekStats`, `getLiveWire`, `findSleeperUser`,
`getByeWeeks`, `getLeaders`, `getPlayerSearch`, `getSources`,
`getProjections`, `getOutlooks`, `getPlayerProfile`.

**Group B — leagueId + `assertLeagueViewer`, hosted-only** (5):
`getLeagueBundle`, `getTicks`, `getActivity`, `getRecap`,
`getWeekProjections`.

**Group C — league-domain reads from `src/lib/league/fns.ts`** (8):
`previewInvite`, `getDesk`, `getMockPool`, `getClaims`, `getTrades`,
`getTradablePicks`, `getSchedule`, and `exportLeague` (the one exception:
`kind: "read"` in the catalog, but — like the already-wired
`listMyLeagues` — it requires a real signed-in user, not just a viewer,
because it returns a full data snapshot of a league the caller commissions).

## Current state

All excerpts read directly from the file at commit `7899535`.

- `src/lib/agent/catalog.ts` — **unchanged by this plan.** All 26 ids are
  already present with `kind: "read"` (confirmed: `grep -n '"getPulse"\|"getScores"\|...' catalog.ts` finds every one already `tool(..., "read")`). Do not
  edit this file.
- `src/lib/agent/core.ts` (29 lines, full file):
  ```ts
  export const AGENT_CORE: ReadonlySet<string> = new Set([
    // reads
    "getAgentContext",
    "listMyLeagues",
    "getTeam",
    "getBook",
    "getMatchups",
    "getWire",
    "getDraft",
    "getSettings",
    "getEvents",
    "getLeagueFacts",
    // atoms
    "sitPlayer",
    "startPlayer",
    "dropPlayer",
    "placeWager",
    "pullWager",
    "makePick",
    "queueAdd",
    "voteTrade",
    // migrate
    "previewImport",
    "importLeague",
  ]);
  ```
- `src/lib/agent/dispatch.ts` (237 lines, full file) — the pattern every new
  case must follow exactly. Three existing cases show the three shapes
  you'll repeat:

  No-leagueId read (`listMyLeagues`, lines 61–65):
  ```ts
  case "listMyLeagues": {
    if (!userId) throw new Error("listMyLeagues requires a signed-in user (OPENFF_USER)");
    const { listMyLeagues } = await import("@/lib/league/engine.server");
    return asJson(await listMyLeagues(userId));
  }
  ```

  leagueId + viewer-gated read (`getTeam`, lines 66–73):
  ```ts
  case "getTeam": {
    const eng = await import("@/lib/league/engine.server");
    const leagueId = str(args.leagueId, "leagueId");
    await eng.assertLeagueViewer(leagueId, uid);
    return asJson(
      await eng.loadTeam(leagueId, num(args.rosterId, "rosterId"), num(args.week, "week")),
    );
  }
  ```

  Helper functions already defined at the top of the file (lines 6–31, do
  not redefine): `str(v, name)`, `num(v, name)`, `optNum(v)`, `optStr(v)`,
  `asJson(result)`. `uid` (line 54) is `userId ?? null`, already in scope
  inside `dispatch()`.

  The `switch` statement's `default` case (lines 233–235) is what currently
  catches all 26 of these ids — every new `case` goes **before** `default`,
  anywhere in the switch (grouping near related existing cases is fine but
  not required).

- `src/lib/agent/dispatch.test.mjs` (45 lines, full file) — read it; Step 3
  extends it.

- Underlying functions this plan calls (all confirmed by direct read at
  `7899535` — signatures are exact, not guessed):

  **Group A** — all in `src/lib/data/*.server.ts`, all already imported
  exactly this way by `src/lib/data/fns.ts`:
  ```ts
  // src/lib/data/fns.ts, the handler bodies this plan replicates 1:1
  getPulse: no args. sleeper.fetchNflState(), espn.fetchScoreboard(),
    espn.fetchNews(), sleeper.loadTrending() in parallel via Promise.all,
    plus a fire-and-forget refreshPlayerStatus() and refreshRotowireFeed()
    (do not await these — match the original: void the player-status one,
    swallow the rotowire one's rejection into 0). Returns
    { state, games: board.games, news, trending }.
  getScores: args { week?, season?, seasonType? } → espn.fetchScoreboard(args).
  getGameSummary: args { gameId } (required) → espn.fetchGameSummary(gameId).
  getWeekStats: args { season (required string), week (required number),
    kind? } → live.fetchWeekStats(season, week, kind ?? "regular").
  getLiveWire: args { week?, season?, kind? } — this one has real logic
    (leader-board assembly), copy `src/lib/data/fns.ts:56-104` verbatim into
    the dispatch case (see Step 1 template — it's the one Group-A case with
    a full function body, not a one-liner).
  findSleeperUser: args { query (required) } → sleeper.lookupUser(query).
  getByeWeeks: args { season (required string) } → byes.byeWeeks(season).
  getProjections: args { leagueId (required), season (required), week
    (required), players (required array) } → proj.projectPlayers(args) —
    **no auth call in the original; do not add one.**
  getOutlooks: args { leagueId (required), season (required), playerIds
    (required array of string) } → proj.outlooksFor(args) — **no auth call
    in the original; do not add one.**
  getPlayerProfile: args { leagueId (required), playerId (required),
    season? } → profile.loadPlayerProfile(args) — **no auth call in the
    original; do not add one.**
  getLeaders: args { position (required string) } → sleeper.loadLeaders(position).
  getPlayerSearch: args { query (required), position (required) } →
    sleeper.searchPlayers(query, position).
  getSources: no args → sleeper.probeSources().
  ```
  Import paths: `@/lib/data/sleeper.server`, `@/lib/data/espn.server`,
  `@/lib/data/live.server`, `@/lib/data/byes.server`,
  `@/lib/data/projections.server`, `@/lib/data/player-profile.server`,
  `@/lib/data/teams` (only `playerTeam`, needed inside `getLiveWire`'s
  logic), `@/lib/data/player-refresh.server` (only for the fire-and-forget
  call inside `getPulse`), `@/lib/data/rotowire.server` (only inside
  `getPulse`).

  **Group B** — leagueId + `assertLeagueViewer`, then the hosted engine
  path (this plan does **not** port the non-hosted/Sleeper-read branch
  those functions also have in `fns.ts` — every already-wired read in
  `dispatch.ts` today makes the same simplification, e.g. `getTeam`/`getWire`/
  `getDraft`/`getMatchups` only support hosted leagues over MCP; match that
  precedent, don't re-open it):
  ```
  getLeagueBundle: args { leagueId } → assertLeagueViewer, then
    eng.loadLeagueBundle(leagueId, uid).
  getTicks: args { leagueId, week, matchupId } → assertLeagueViewer, then
    (await import("@/lib/league/ticks.server")).readTicks(leagueId, week, matchupId).
  getActivity: args { leagueId, week } → assertLeagueViewer, then
    eng.loadActivity(leagueId, week).
  getRecap: args { leagueId, week } → assertLeagueViewer, then
    eng.loadDispatch(leagueId, week).
  getWeekProjections: args { leagueId, season, week } → assertLeagueViewer,
    then reproduce `src/lib/data/fns.ts:256-311`'s hosted branch exactly
    (loads matchups, collects starter+rostered player ids via a raw
    `ff_spots` query through `getSql()` from `@/lib/db`, then calls
    `proj.projectPlayers({ ...args, players })`) — this is the one Group-B
    case with a real function body; see Step 1's template.
  ```
  All via `const eng = await import("@/lib/league/engine.server")` +
  `await eng.assertLeagueViewer(leagueId, uid)`, exactly like every existing
  case.

  **Group C** — from `src/lib/league/engine.server.ts` / `ops.server.ts`:
  ```
  previewInvite: args { code } → eng.previewInvite(code) — no auth, no leagueId.
  getDesk: args { leagueId, week } → assertLeagueViewer, then eng.loadDesk(leagueId, week).
  getMockPool: args { leagueId } → assertLeagueViewer, then reproduce
    `src/lib/league/fns.ts:146-182` exactly (reads `data/stats-2025.json`
    off disk via `node:fs`/`node:path`, scores it through
    `scoringBookFor`/`perGameUnder` from `@/lib/data/projections.server`
    and `getPlayer` from `@/lib/data/sleeper.server`) — the one Group-C
    case with a real function body.
  getClaims: args { leagueId } → assertLeagueViewer, then
    eng.rosterIdOwnedBy(leagueId, uid), then
    (await import("@/lib/league/ops.server")).listClaims(leagueId, mine).
  getTrades: args { leagueId } → assertLeagueViewer, then
    (await import("@/lib/league/ops.server")).listTrades(leagueId).
  getTradablePicks: args { leagueId } → assertLeagueViewer, then
    (await import("@/lib/league/ops.server")).listTradablePicks(leagueId).
  getSchedule: args { leagueId } → assertLeagueViewer, then
    eng.loadSchedule(leagueId, uid).
  exportLeague: args { leagueId } → **requires a real userId**, like
    `listMyLeagues` — `if (!userId) throw new Error("exportLeague requires
    a signed-in user (OPENFF_USER)")`, then `eng.exportLeague(userId,
    leagueId)`. This is the one Group-C exception: `kind: "read"` in the
    catalog but auth-required in behavior, exactly like `listMyLeagues`
    already is.
  ```

- Conventions: Biome (`bun run lint`), TypeScript strict (`bun run
  typecheck`), tests are `.test.mjs` + `node:test`/`node:assert/strict`,
  `bun@1.3.10`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | pass |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `src/lib/agent/core.ts` (add 26 ids to the `Set`)
- `src/lib/agent/dispatch.ts` (add 26 `case` blocks)
- `src/lib/agent/dispatch.test.mjs` (new tests — see Step 3)
- `plans/README.md` (status row) — skip if a reviewer tells you they
  maintain the index

**Out of scope** (do not touch, even where it looks related):
- `src/lib/agent/catalog.ts` — already has all 76 ids; this plan changes
  nothing about the catalog, only what's reachable.
- `src/lib/agent/CATALOG.md` — mirrors `catalog.ts`, not `core.ts`; no
  change needed (confirm with `bun test src/lib/agent/catalog.test.mjs` —
  it must still pass unmodified).
- Any `*.fns.ts`, `*.server.ts`, or other application source file — every
  function this plan calls already exists; you are only adding a second
  caller (the MCP dispatcher) to code that already runs today.
- Any tool not in the 26-id list above, including the "Group C exception"
  list's siblings that look similar (e.g. do **not** wire `getAiSettings` /
  `saveAiSettings` / `analyzeImport` here — those are a separate, unscoped
  batch).
- `scripts/mcp.mjs`, `src/routes/api/mcp.ts` — the transport layer is
  unchanged; both already call `dispatch()` generically and pick up new ids
  automatically once `AGENT_CORE` includes them.

## Git workflow

Current branch; one commit, e.g.
`feat(agent): wire 26 read-only primitives onto MCP`. Do NOT push.

## Steps

### Step 1: add the 26 ids to `src/lib/agent/core.ts`

Append them under a new `// reads (081)` comment, after the existing
`// migrate` block, keeping the file a single flat `Set`:

```ts
  // migrate
  "previewImport",
  "importLeague",
  // reads (081)
  "getPulse",
  "getScores",
  "getGameSummary",
  "getWeekStats",
  "getLiveWire",
  "findSleeperUser",
  "getByeWeeks",
  "getLeaders",
  "getPlayerSearch",
  "getSources",
  "getProjections",
  "getOutlooks",
  "getPlayerProfile",
  "getLeagueBundle",
  "getTicks",
  "getActivity",
  "getRecap",
  "getWeekProjections",
  "previewInvite",
  "getDesk",
  "getMockPool",
  "getClaims",
  "getTrades",
  "getTradablePicks",
  "getSchedule",
  "exportLeague",
]);
```

**Verify**: `grep -c '^  "' src/lib/agent/core.ts` → `46` (20 existing + 26 new).

### Step 2: add 26 `case` blocks to `src/lib/agent/dispatch.ts`

Add every case from the "Current state" section above, before the `default`
case. Two worked-out examples to anchor the pattern (copy these verbatim;
derive the rest the same way from the descriptions above):

```ts
    case "getScores": {
      const espn = await import("@/lib/data/espn.server");
      return asJson(
        await espn.fetchScoreboard({
          week: optNum(args.week),
          season: optNum(args.season),
          seasonType: optNum(args.seasonType),
        }),
      );
    }
    case "getLeagueBundle": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadLeagueBundle(leagueId, uid));
    }
```

For the three cases flagged above as having "a real function body" —
`getLiveWire`, `getWeekProjections`, `getMockPool` — copy the referenced
source lines from `src/lib/data/fns.ts` / `src/lib/league/fns.ts` into the
case body **as-is**, just replacing `data.X` with `args.X` (using `str`/
`num`/`optStr`/`optNum` for required/optional coercion the same way every
other case does) and dropping the `{ data, context }` destructuring in favor
of the already-available `args`/`uid` locals. Do not "simplify" or rewrite
their logic — copy-then-adapt only the argument plumbing.

For `getPulse` and `getSources` (no args at all), the case body takes no
`args` reads whatsoever — just the async logic, verbatim.

**Verify**: `bun run typecheck` → 0 (this catches wrong import paths / wrong
function names immediately — resolve any error before moving on, do not
guess a fix without re-reading the "Current state" section's exact
signature); `bun run build` → 0.

### Step 3: tests in `dispatch.test.mjs`

Add two new tests, matching the file's existing style:

```js
test("81's 26 new ids are reachable — not Unknown tool", async () => {
  // Args are intentionally missing required fields — this proves the
  // switch case exists and reaches argument validation, without touching
  // the database. getPulse/getSources take no args and would actually run
  // (network/DB calls), so they're checked by membership only, below.
  const needsArgs = [
    "getScores",
    "getGameSummary",
    "getWeekStats",
    "getLiveWire",
    "findSleeperUser",
    "getByeWeeks",
    "getProjections",
    "getOutlooks",
    "getPlayerProfile",
    "getLeaders",
    "getPlayerSearch",
    "getLeagueBundle",
    "getTicks",
    "getActivity",
    "getRecap",
    "getWeekProjections",
    "previewInvite",
    "getDesk",
    "getMockPool",
    "getClaims",
    "getTrades",
    "getTradablePicks",
    "getSchedule",
  ];
  for (const id of needsArgs) {
    await assert.rejects(() => dispatch(id, "user_x", {}), (err) => {
      assert.doesNotMatch(err.message, /Unknown tool/, id);
      return true;
    });
  }
  for (const id of ["getPulse", "getSources"]) {
    assert.ok(AGENT_CORE.has(id), id);
  }
});

test("exportLeague requires a signed-in user, like listMyLeagues", async () => {
  await assert.rejects(
    () => dispatch("exportLeague", null, { leagueId: "lg_x" }),
    /signed-in/,
  );
});
```

**Verify**: `bun test src/lib/agent` → all pass, including the two new
tests and the pre-existing four.

### Step 4: full gate, then commit

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0. Commit (message above). Update the 081 row in
`plans/README.md`.

## Test plan

- The two Step 3 tests.
- `bun test src/lib/agent/catalog.test.mjs` must stay green unmodified —
  proves this plan didn't touch `catalog.ts`/`CATALOG.md`.
- Full `bun test src scripts` green.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -c '^  "' src/lib/agent/core.ts` → 46
- [ ] All 26 ids from the "Why this matters" list appear as `case` blocks in
      `src/lib/agent/dispatch.ts` (spot-check with
      `grep -c 'case "' src/lib/agent/dispatch.ts` → should have grown by 26
      from its pre-plan count)
- [ ] `git diff --stat` touches only the three in-scope files
- [ ] `bun test src/lib/agent` → all pass

## STOP conditions

- The drift check shows `core.ts` or `dispatch.ts` no longer match the
  excerpts (someone else landed a catalog change concurrently) — reconcile
  is not your call.
- Any underlying function's actual signature (once you open the real file)
  doesn't match what's described here — STOP and report the mismatch rather
  than guessing new argument shapes.
- You find yourself wanting to add an auth check (`assertLeagueViewer`) to
  `getProjections`, `getOutlooks`, or `getPlayerProfile` because "it seems
  safer" — the plan explicitly says not to; that's a real behavior change
  beyond this plan's scope (parity with the existing browser RPC, not a
  security hardening pass). Flag it in NOTES instead of doing it.
- `bun run typecheck` reports an error you can't resolve by re-reading the
  cited source file's actual export — STOP rather than casting/`any`-ing
  around it.

## Maintenance notes

- After this plan, `AGENT_CORE` covers 46 of 76 cataloged ids (61%). The
  remaining 30 are: the verb-completion batch (082), the migrate-completion
  batch (083), and the commish/workflow batch (`createLeague`, `startDraft`,
  `autoFillDraft`, `saveSettings`, allowlist management, `processWaivers`,
  `saveWeekSchedule`/`rebuildSchedule`, `proposeTrade`) — deliberately not
  scoped yet, needs an explicit scope decision before a plan is written for
  it. `deleteLeague`/`advanceWeek` should very likely never be wired
  (irreversible season-state actions, same class as `tick`).
- If a future primitive needs an *actual* new capability (not yet built
  anywhere), that's a different kind of plan than this one — this plan
  only exposes existing, already-shipped logic to a second caller.
