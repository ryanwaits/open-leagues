# Plan 080: Console voice, part 2 — entity links on the two remaining score cards

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2969bf2..HEAD -- src/routes/league/\$leagueId/matchup/\$week/\$matchupId.tsx src/components/matchup-card.tsx src/skin/skin.test.mjs`
> If any of these three files changed since `2969bf2`, compare the "Current
> state" excerpts below against the live code before proceeding; on a
> mismatch, STOP and report.

## Status

- **Priority**: P2
- **Effort**: S (two one-line class hooks + one test)
- **Risk**: LOW — `.ent` is an existing, already-shipped recipe class
  (landed in plan 079, commit `2969bf2`) that is inert everywhere except
  `[data-skin="console"]`. This plan only extends its use to two more team-
  name spans; it adds no new CSS and no new tokens.
- **Depends on**: plans/079-console-voice-recipes.md (the `.ent` recipe
  class must exist in `styles.css` — it does, landed at `2969bf2`)
- **Category**: direction (Console cut, prototyped and locked 2026-08-26)
- **Planned at**: commit `2969bf2`, 2026-08-26

## Why this matters

Plan 079 wired Console's `.ent` recipe (a resting underline that marks a
name as "a record you can open") onto three of the app's entity-name
sites — `PlayerCell`, `MatchupBoard`'s `BandSide`, and the standings table.
Two more team-name sites render the exact same kind of link — a team name
that opens `/league/$leagueId/team/$rosterId` — but were out of scope for
079: `ScoreRow` (the head-to-head score card on the matchup detail page,
`$matchupId.tsx`) and `SideRow` (the "upcoming matchup" widget on the
league home page, `matchup-card.tsx`). This plan closes that gap so Console
reads consistently everywhere a team name is a link, not just in three of
five places.

**Scope note, read before starting**: an earlier planning pass considered
rebuilding these two score cards into the Console prototype's side-by-side
"duel" layout (two avatars flanking a big centered score pair, plus a
win-probability bar under the card). That layout does not match the app's
actual `Scoreboard`/`ScoreRow` and `MatchupCard`/`SideRow` — both are a
**stacked**, winner-row-first design that was deliberately locked by the
Box Score plans (065–067, spec artifact
https://claude.ai/code/artifact/9f879d2c-915d-4bdb-bdfd-69ef2f4fb950). This
plan is scoped down to the additive-only increment (recipe-class hooks) so
it does not reopen that locked layout decision. A side-by-side redesign, if
ever wanted, is separate work with its own review — not this plan.

## Locked design (do not re-decide)

Nothing new. This plan reuses the `.ent` recipe class exactly as it already
exists in `src/styles.css` (landed at `2969bf2`):

```css
[data-skin="console"] .ent {
  text-decoration-line: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in oklab, var(--ink) 45%, transparent);
}
```

No new tokens, no new recipe classes, no changes to `styles.css` at all in
this plan — see Scope below.

## Current state

All excerpts read directly from the file at `2969bf2` (this plan's own
`git rev-parse --short HEAD` at write time).

- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx:737-794` — the
  `ScoreRow` component (renders one team's row inside the `Scoreboard` card
  on the matchup detail page):
  ```tsx
  function ScoreRow({
    side,
    leagueId,
    record,
    score,
    leading,
    winner,
  }: {
    side: MatchupSide;
    leagueId: string;
    record: StandingRow | undefined;
    score: number;
    leading: boolean;
    winner: boolean;
  }) {
    return (
      <div className="flex items-center gap-3">
        <Link
          to="/league/$leagueId/team/$rosterId"
          params={{ leagueId, rosterId: String(side.rosterId) }}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-1"
        >
          <Avatar
            src={side.avatar}
            name={side.teamName}
            className="size-8"
            textClassName="text-[10px]"
            tint
          />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-sm sm:text-base",
                  winner ? "font-semibold text-fg" : leading ? "text-fg" : "text-muted",
                )}
              >
                {side.teamName}
              </span>
              {winner ? <Badge tone="win">W</Badge> : null}
            </span>
            <span className="block truncate font-mono text-[11px] text-faint">
              {side.manager}
              {record ? ` · ${fmtRecord(record.wins, record.losses, record.ties)}` : ""}
            </span>
          </span>
        </Link>
        <span
          className={cn(
            "shrink-0 font-mono text-[28px] tabular-nums sm:text-3xl",
            leading ? "text-fg" : "text-muted",
          )}
        >
          {formatPts(score, 1)}
        </span>
      </div>
    );
  }
  ```
  The `<Link>` at line 754 wraps the avatar *and* the whole name/meta
  block — it is not the right hook site (`.ent`'s underline is meant to sit
  under the name text only, matching the precedent in `standings.tsx` and
  `player-cell.tsx`, both of which put `.ent` on the innermost text span,
  not on a wrapping element that also contains an avatar). The correct hook
  site is the inner `<span>` at line 768-773, whose className is currently:
  ```
  "truncate text-sm sm:text-base"
  ```

- `src/components/matchup-card.tsx:172-215` — the `SideRow` component
  (renders one team's row inside the "upcoming matchup" card on the league
  home page):
  ```tsx
  function SideRow({
    side,
    standings,
    pts,
    me = false,
  }: {
    side: MatchupSide;
    standings: StandingRow[];
    pts: number | null;
    me?: boolean;
  }) {
    const idx = standings.findIndex((s) => s.rosterId === side.rosterId);
    const row = idx >= 0 ? standings[idx] : null;
    return (
      <div className="flex items-center gap-3 border-t border-line px-5 py-2.5 first-of-type:border-t-0">
        <Avatar src={side.avatar} name={side.teamName} className="size-7" tint />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm tracking-[-0.01em]",
              me ? "font-semibold" : "font-medium text-muted",
            )}
          >
            {side.teamName}
          </span>
          {row ? (
            <span className="block font-mono text-[10px] tabular-nums text-faint">
              {fmtRecord(row.wins, row.losses, row.ties)} · {idx + 1}
              {ordinalSuffix(idx + 1)}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-lg tabular-nums",
            me ? "font-bold" : "font-medium text-muted",
            pts == null && "text-faint",
          )}
        >
          {pts != null ? formatPts(pts, 1) : "—"}
        </span>
      </div>
    );
  }
  ```
  Note: `SideRow` itself is **not** wrapped in a `<Link>` at all (unlike
  `ScoreRow`) — the whole card links out via the "Full box score →" /
  "Full preview →" footer link instead, one level up in `MatchupCard`. So
  `.ent`'s "this text opens a record" semantics are slightly looser here
  (the name itself isn't individually clickable), but 079's precedent in
  `standings.tsx` already established that `.ent` marks *entity identity*,
  not literal per-element clickability — the standings team-name span is
  inside a clickable row wrapper the same way this one sits inside a
  non-interactive card. Apply it for visual consistency with every other
  team-name rendering in the app; this is a deliberate, not an accidental,
  choice — see STOP conditions if this reasoning turns out to be wrong.
  Hook site: the inner `<span>` at line 189-194, whose className is
  currently:
  ```
  "block truncate text-sm tracking-[-0.01em]"
  ```

- `src/skin/skin.test.mjs` — the pattern to copy is the existing
  `"console voice recipes exist and are hooked in representative
  components"` test (added in plan 079) — it already asserts `/"ent /`
  against `player-cell.tsx`; this plan adds the same style of assertion for
  the two new files.
- Conventions: Biome (`bun run lint`), TypeScript strict (`bun run
  typecheck`), tests are `.test.mjs` with `node:assert/strict`,
  packageManager `bun@1.3.10`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | pass |
| Build | `bun run build` | exit 0 |
| Dev server | `bun run dev` (port 8080) | manual check |
| Force the skin in dev | on `/account` pick **Console** (or `localStorage.setItem("ledger-skin","console")` + reload) | `<html data-skin="console">` |

## Scope

**In scope**:
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (one class
  hook, `ScoreRow` only)
- `src/components/matchup-card.tsx` (one class hook, `SideRow` only)
- `src/skin/skin.test.mjs` (one new assertion, or extend the existing 079
  test — see Step 3)
- `plans/README.md` (status row) — skip if a reviewer tells you they
  maintain the index

**Out of scope** (do not touch, even where it looks related):
- Any layout change to `Scoreboard`, `ScoreRow`, `MatchupCard`, or
  `SideRow` beyond the one className edit each — no side-by-side grid, no
  avatar repositioning, no win-probability bar, no dividers between rows.
  See "Why this matters" above for why that's deliberately deferred.
- `src/components/matchup-board.tsx` — already has `.ent` (landed in 079);
  nothing to change there.
- `src/skin/tokens.css`, `src/skin/skins/*.css`, and the `.ent` rule itself
  in `src/styles.css` — this plan reuses the existing recipe, it does not
  modify it.
- `matchup-edge.tsx`, `slot-pts.tsx`, `GamePill`, the mini-scorebar, or
  anything else in the matchup surface not named above.
- Any visual change under Ledger or Box Score — `.ent` is already proven
  inert there by 079's tests; this plan doesn't touch the rule, only adds
  two more (inert-elsewhere) call sites.

## Git workflow

Current branch; one commit, e.g.
`feat(skin): console .ent on the score-card team names`. Do NOT push.

## Steps

### Step 1: `ScoreRow` hook

In `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`, the `cn(...)`
call inside `ScoreRow` (≈ line 769):

```
"truncate text-sm sm:text-base"
```

becomes

```
"ent truncate text-sm sm:text-base"
```

Leave the second string in that same `cn(...)` call (the
`winner ? ... : ...` conditional) untouched.

**Verify**: `bun run typecheck` → 0;
`grep -n '"ent truncate text-sm sm:text-base"' src/routes/league/'$leagueId'/matchup/'$week'/'$matchupId'.tsx` → one match.

### Step 2: `SideRow` hook

In `src/components/matchup-card.tsx`, the `cn(...)` call inside `SideRow`
(≈ line 191):

```
"block truncate text-sm tracking-[-0.01em]"
```

becomes

```
"ent block truncate text-sm tracking-[-0.01em]"
```

Leave the second string in that same `cn(...)` call (the `me ? ... : ...`
conditional) untouched.

**Verify**: `bun run typecheck` → 0;
`grep -n '"ent block truncate text-sm tracking' src/components/matchup-card.tsx` → one match.

### Step 3: test in `src/skin/skin.test.mjs`

Extend the existing `"console voice recipes exist and are hooked in
representative components"` test (added in plan 079) with two more
assertions, right after its existing `player-cell.tsx` assertion:

```js
assert.match(
  readFileSync(join(root, "src/routes/league/$leagueId/matchup/$week/$matchupId.tsx"), "utf8"),
  /"ent /,
);
assert.match(readFileSync(join(root, "src/components/matchup-card.tsx"), "utf8"), /"ent /);
```

(Do not write a new `test(...)` block — add these two lines into the body
of the existing test, since it already exists specifically to track where
`.ent` is hooked.)

**Verify**: `bun test src/skin` → all pass (existing count + no new test
count, since this extends an existing test rather than adding one).

### Step 4: manual smoke, then commit

`bun run dev` → pick **Console** on `/account` →

- League home page: the "upcoming matchup" card's two team names (`SideRow`)
  show a resting underline.
- Matchup detail page: both team names in the score card (`ScoreRow`) show
  a resting underline; the avatar and the point total do **not** gain an
  underline (only the name text).
- **Flip to Ledger and Box Score**: both surfaces pixel-identical to before
  this change (the `.ent` class is inert there, already proven by 079's
  tests — this is a sanity check, not new proof).

Commit (message above). Update the 080 row in `plans/README.md`.

## Test plan

- The two assertions added to 079's existing skin.test.mjs test (Step 3).
- Full `bun test src scripts` must stay green — no regressions expected
  since this only prepends a class name to two existing strings.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` ·
      `bun run build` all exit 0
- [ ] `grep -n '"ent truncate text-sm sm:text-base"' src/routes/league/'$leagueId'/matchup/'$week'/'$matchupId'.tsx` → one match
- [ ] `grep -n '"ent block truncate text-sm tracking' src/components/matchup-card.tsx` → one match
- [ ] `git diff --stat` touches only the three in-scope files (four if the
      README status row counts separately)
- [ ] Manual smoke: both score-card surfaces show the resting underline
      under Console, are pixel-identical under Ledger/Box Score

## STOP conditions

- The drift check shows either component file no longer matches the
  "Current state" excerpts (e.g. `ScoreRow`/`SideRow` were restructured by
  other work) — reconcile is not your call.
- The `.ent` rule is missing from `src/styles.css` (078/079 not actually
  landed on this branch) — STOP, this plan has nothing to attach to.
- You find yourself wanting to add a divider, reorder rows, add a
  win-probability bar, or otherwise touch layout in `Scoreboard`/`ScoreRow`
  or `MatchupCard`/`SideRow` beyond the one className each — that is the
  deferred "full side-by-side redesign" explicitly out of scope for this
  plan (see "Why this matters").
- Any Ledger or Box Score surface changes appearance.

## Maintenance notes

- This closes the `.ent` rollout for every team-name rendering in the
  matchup surface. If a new team-name-as-link component is added later, it
  should get `.ent` on its name span at creation time rather than waiting
  for a follow-up plan.
- The deferred side-by-side "duel" layout (avatars flanking a big
  centered score pair + win-probability bar, matching the Console
  prototype's `.k-duel` block) remains a real, separate idea if the
  maintainer wants it — it would mean reopening the Box Score's locked
  stacked-row design, so treat it as new direction work with its own
  review, not a continuation of this plan.
- Remaining named 080+ items from plan 079's maintenance notes, still
  unauthored: the home stat strip, Console styling for the book's
  `LinePanel`/`WagerTicket` (price pills + spread strip), and any nav
  treatment. Each is its own plan.
- Design source (reference only; nothing new is inlined beyond what 079
  already locked): prototype
  https://claude.ai/code/artifact/6ca0391d-2a25-4085-bd0e-fe0f83804ae0
  (see the `.k-duel` block for the deferred side-by-side layout, and
  `.k-link`/entity-name treatment for what `.ent` already captures).
