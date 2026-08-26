# Plan 082: Round out queue, waiver, and trade verbs on MCP

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <081's landed SHA>..HEAD -- src/lib/agent/core.ts src/lib/agent/dispatch.ts src/lib/agent/dispatch.test.mjs`
> Plan 081 (the dependency) lands 26 new `case` blocks and 26 new ids in
> these same three files — expected, not drift. If anything **else** in
> these files differs from the "Current state" excerpts below, STOP and
> report.

## Status

- **Priority**: P1
- **Effort**: M (7 new dispatch cases + 7 core.ts ids + tests)
- **Risk**: LOW — every id here is already `mutating: true` in
  `catalog.ts` and already has a real, tested engine function backing it
  (`queueAdd`, `sitPlayer`, `startPlayer`, `dropPlayer`, `voteTrade` are its
  already-wired siblings — this plan wires the other half of each verb
  family: remove/reorder alongside add, cancel alongside vote/claim, claim
  alongside join).
- **Depends on**: plans/081-agent-catalog-safe-reads.md (same three files;
  land 081 first so this plan's diff is clean)
- **Category**: dx / agent-native surface
- **Planned at**: commit `7899535`, 2026-08-26 (081 lands on top before this
  runs — the drift check above accounts for that)

## Why this matters

The MCP surface today lets an agent `queueAdd` a player to a draft queue but
not `queueRemove` or `queueReorder` it. It lets an agent `voteTrade` on a
trade someone else proposed but not `cancelTradeFn` one it proposed itself.
It lets an agent `cancelClaim` — wait, no: `cancelClaim` isn't wired either,
so an agent can place nothing that resembles a waiver claim at all today
(`addDrop`, the actual claim-placing verb, is also unwired). And an agent
invited into someone else's league can't `claimRoster` its own seat — it can
only be told about the invite. Each of these is the missing half of a verb
pair whose other half already ships. This plan wires the seven ids that
complete those pairs:

`queueRemove`, `queueReorder`, `setAutodraft`, `addDrop`, `cancelClaim`,
`cancelTradeFn`, `claimRoster`.

## Current state

Excerpts read directly at commit `7899535` (before 081 lands — 081 only
*adds* cases, it does not move or rewrite these lines, so they remain valid
after 081 lands too).

- `src/lib/agent/core.ts` — see plan 081's "Current state" for the
  pre-081 contents; after 081 lands, this plan appends after 081's
  `// reads (081)` block.
- `src/lib/agent/dispatch.ts` — existing sibling cases to model these on
  (all still present verbatim after 081 lands, since 081 is purely
  additive):
  ```ts
  // queueAdd (already wired) — the pattern queueRemove/queueReorder follow
  case "queueAdd": {
    if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
    const { queueAdd } = await import("@/lib/league/engine.server");
    await queueAdd(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
    return { ok: true };
  }
  // voteTrade (already wired) — the boolean-arg-validation pattern setAutodraft follows
  case "voteTrade": {
    if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
    const { voteTrade } = await import("@/lib/league/ops.server");
    if (typeof args.accept !== "boolean") throw new Error("accept must be boolean");
    await voteTrade(userId, str(args.leagueId, "leagueId"), str(args.tradeId, "tradeId"), args.accept);
    return { ok: true };
  }
  ```

- Underlying functions (confirmed by direct read at `7899535`):
  ```ts
  // src/lib/league/engine.server.ts
  export async function queueRemove(userId: string, leagueId: string, playerId: string): Promise<void>
  export async function queueReorder(userId: string, leagueId: string, playerIds: string[]): Promise<void>
  export async function setAutodraft(userId: string, leagueId: string, on: boolean): Promise<void>
  export async function addDrop(
    userId: string, leagueId: string, addId: string, dropId: string | null, bid = 0,
  ): Promise<{ mode: "claim" | "free_agent" }>
  export async function claimRoster(
    userId: string, leagueId: string, rosterId: number, code?: string | null,
  ): Promise<void>

  // src/lib/league/ops.server.ts
  export async function cancelClaim(userId: string, leagueId: string, claimId: string): Promise<void>
  // (ops.server.ts also exports cancelTrade — the fns.ts wrapper is named
  // cancelTradeFn to avoid a naming collision; the catalog id and dispatch
  // case id are BOTH "cancelTradeFn" — do not call it "cancelTrade")
  export async function cancelTrade(userId: string, leagueId: string, tradeId: string): Promise<void>
  ```
  `queueRemove`/`queueReorder` are in `engine.server.ts` at lines 1550/1565
  (7899535); `setAutodraft` at 1682; `addDrop` at 1888; `claimRoster` at
  2400; `cancelClaim` in `ops.server.ts` at 379.

- `src/lib/league/fns.ts` validator shapes, for exact arg names (already
  read in full at `7899535`):
  ```ts
  queueRemove:   { leagueId: string, playerId: string }
  queueReorder:  { leagueId: string, playerIds: string[] }
  setAutodraft:  { leagueId: string, on: boolean }
  addDrop:       { leagueId: string, addId: string, dropId: string | null, bid?: number }
  cancelClaim:   { leagueId: string, claimId: string }
  cancelTradeFn: { leagueId: string, tradeId: string }
  claimRoster:   { leagueId: string, rosterId: number, code?: string | null }
  ```

- `src/lib/agent/dispatch.test.mjs` — after 081 lands, has the two tests
  081 added, plus the four original ones. Step 3 below extends it further.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | pass |
| Build | `bun run build` | exit 0 |

## Scope

**In scope**:
- `src/lib/agent/core.ts` (add 7 ids)
- `src/lib/agent/dispatch.ts` (add 7 `case` blocks)
- `src/lib/agent/dispatch.test.mjs` (new tests — see Step 3)
- `plans/README.md` (status row) — skip if a reviewer maintains the index

**Out of scope**:
- `src/lib/agent/catalog.ts` / `CATALOG.md` — unchanged, same reasoning as
  081.
- `joinLeague`, `startDraft`, `autoFillDraft`, `processWaivers`,
  `proposeTrade`, or any commish/workflow id — a separate, not-yet-scoped
  batch (see plan 081's maintenance notes). Do not wire these even though
  they sit near the ones in scope in `catalog.ts`.
- Any application source file outside `src/lib/agent/` — every function
  called here already exists and is already exercised by the browser RPC
  path.

## Git workflow

Current branch; one commit, e.g.
`feat(agent): wire queue/waiver/trade completion verbs onto MCP`. Do NOT push.

## Steps

### Step 1: add 7 ids to `src/lib/agent/core.ts`

Append after 081's `// reads (081)` block (or after the file's final entry,
whatever's there when you run this):

```ts
  // verb completion (082)
  "queueRemove",
  "queueReorder",
  "setAutodraft",
  "addDrop",
  "cancelClaim",
  "cancelTradeFn",
  "claimRoster",
]);
```

**Verify**: `grep -c '^  "' src/lib/agent/core.ts` → `53` (46 after 081 + 7).

### Step 2: add 7 `case` blocks to `src/lib/agent/dispatch.ts`

```ts
    case "queueRemove": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { queueRemove } = await import("@/lib/league/engine.server");
      await queueRemove(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "queueReorder": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      if (!Array.isArray(args.playerIds)) throw new Error("playerIds is required");
      const playerIds = args.playerIds.map((v) => String(v));
      const { queueReorder } = await import("@/lib/league/engine.server");
      await queueReorder(userId, str(args.leagueId, "leagueId"), playerIds);
      return { ok: true };
    }
    case "setAutodraft": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      if (typeof args.on !== "boolean") throw new Error("on must be boolean");
      const { setAutodraft } = await import("@/lib/league/engine.server");
      await setAutodraft(userId, str(args.leagueId, "leagueId"), args.on);
      return { ok: true };
    }
    case "addDrop": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { addDrop } = await import("@/lib/league/engine.server");
      const dropId = args.dropId == null ? null : str(args.dropId, "dropId");
      return asJson(
        await addDrop(
          userId,
          str(args.leagueId, "leagueId"),
          str(args.addId, "addId"),
          dropId,
          optNum(args.bid) ?? 0,
        ),
      );
    }
    case "cancelClaim": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { cancelClaim } = await import("@/lib/league/ops.server");
      await cancelClaim(userId, str(args.leagueId, "leagueId"), str(args.claimId, "claimId"));
      return { ok: true };
    }
    case "cancelTradeFn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { cancelTrade } = await import("@/lib/league/ops.server");
      await cancelTrade(userId, str(args.leagueId, "leagueId"), str(args.tradeId, "tradeId"));
      return { ok: true };
    }
    case "claimRoster": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENFF_USER)`);
      const { claimRoster } = await import("@/lib/league/engine.server");
      const code = args.code == null ? null : str(args.code, "code");
      await claimRoster(userId, str(args.leagueId, "leagueId"), num(args.rosterId, "rosterId"), code);
      return { ok: true };
    }
```

**Verify**: `bun run typecheck` → 0; `bun run build` → 0.

### Step 3: tests in `dispatch.test.mjs`

```js
test("082's 7 verb-completion ids reject cleanly without a user", async () => {
  for (const [id, args] of [
    ["queueRemove", { leagueId: "lg_x", playerId: "p1" }],
    ["queueReorder", { leagueId: "lg_x", playerIds: ["p1", "p2"] }],
    ["setAutodraft", { leagueId: "lg_x", on: true }],
    ["addDrop", { leagueId: "lg_x", addId: "p1", dropId: null }],
    ["cancelClaim", { leagueId: "lg_x", claimId: "c1" }],
    ["cancelTradeFn", { leagueId: "lg_x", tradeId: "t1" }],
    ["claimRoster", { leagueId: "lg_x", rosterId: 1 }],
  ]) {
    await assert.rejects(() => dispatch(id, null, args), /OPENFF_USER|signed-in/, id);
  }
});

test("setAutodraft requires a boolean `on`", async () => {
  await assert.rejects(
    () => dispatch("setAutodraft", "user_x", { leagueId: "lg_x", on: "yes" }),
    /boolean/,
  );
});

test("queueReorder requires playerIds to be an array", async () => {
  await assert.rejects(
    () => dispatch("queueReorder", "user_x", { leagueId: "lg_x" }),
    /playerIds/,
  );
});
```

**Verify**: `bun test src/lib/agent` → all pass.

### Step 4: full gate, then commit

`bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run
build` all exit 0. Commit. Update the 082 row in `plans/README.md`.

## Test plan

- The three Step 3 tests.
- `bun test src/lib/agent/catalog.test.mjs` stays green unmodified.
- Full `bun test src scripts` green.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -c '^  "' src/lib/agent/core.ts` → 53
- [ ] All 7 ids appear as `case` blocks in `dispatch.ts`
- [ ] `git diff --stat` (against 081's landed commit) touches only the
      three in-scope files
- [ ] `bun test src/lib/agent` → all pass

## STOP conditions

- Plan 081 has not landed (`AGENT_CORE` has fewer than 46 entries) — land
  081 first; this plan's numbering (53 = 46 + 7) assumes it did.
- The drift check shows anything beyond 081's expected additions.
- Any underlying function signature doesn't match what's cited here once
  you open the real file.
- You find `cancelTrade` (the real export name) and `cancelTradeFn` (the
  catalog/dispatch id) confusing enough to want to rename one — don't; the
  mismatch is intentional (documented in "Current state") and changing
  either name is a bigger, out-of-scope refactor.

## Maintenance notes

- After 081 + 082, `AGENT_CORE` covers 53 of 76 ids (70%). Remaining: the
  migrate-completion batch (083) and the commish/workflow batch (still
  unscoped).
- `addDrop`'s return value (`{ mode: "claim" | "free_agent" }`) is the one
  case in this plan that returns real data instead of `{ ok: true }` —
  worth flagging to whoever writes the `lineup`/`week` skill prompts next,
  since a caller needs to branch on `mode` to know whether their pickup
  landed immediately or entered the waiver queue.
