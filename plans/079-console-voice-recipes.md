# Plan 079: Console voice pass — entity links, zebra, band headers, the search well, hairline badges

> **REVISED 2026-08-26, twice, after two BLOCKED attempts.** Both hit the
> same class of bug: a `@layer components` recipe rule losing to a
> co-located `@layer utilities` Tailwind class on the *same CSS property*.
> Attempt 1 found it on `.field`'s box-shadow/radius and `.badge-default`'s
> background-color; the fix for those was applied in attempt 2, but attempt
> 2 then found the *same bug on a property the first fix didn't touch* —
> `.badge-default`'s `color`, still shadowed by `Badge`'s `text-muted`
> utility class, which the first revision didn't know to remove. That is
> now also fixed below. See "Why the first attempt blocked" — read it before
> touching Step 1 or Step 4, and see "Second collision" immediately after it
> for the additional fix.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ea99611..HEAD -- src/styles.css src/components/player-cell.tsx src/components/matchup-board.tsx src/components/ui/input.tsx src/components/ui/badge.tsx src/routes/league/\$leagueId/standings.tsx src/skin/skin.test.mjs`
> Plan 078 touches `styles.css` (one `@import`) and `skin.test.mjs` (one
> test) — expected. For every other file, compare the "Current state"
> excerpts below against the live code; on a mismatch, STOP and report.
> **If this diff shows anything beyond the 078 changes, a previous attempt's
> uncommitted edits may still be sitting in the tree — check `git status`;
> if you find uncommitted changes to the in-scope files that you did not
> just make, STOP and report rather than building on top of unreviewed work.**

## Why the first attempt blocked

`.ent`, `.zebra`, and `.band-head` worked immediately — verified live via
`getComputedStyle` in a running browser. `.field` and `.badge-default` did
not, despite being present in the DOM and despite `styles.css` containing
exactly the rule the original plan specified. Root cause: Tailwind v4's
`@import "tailwindcss"` fixes a cascade layer order (`theme, base,
components, utilities`) that **beats specificity and source order
unconditionally**. `Input` and `Badge` carry Tailwind utility classes
(`shadow-[0_0_0_1px_var(--color-line-strong)]`, `rounded-md` on Input;
`bg-fg/6` on Badge's default tone) that set the *same CSS properties* the
`.field`/`.badge-default` recipe rules try to set. Those utilities live in
Tailwind's `@layer utilities`; the recipe rules (like every other rule in
this file's `@layer components` block, including the working `.ring-card`
precedent) live in `@layer components`. `utilities` always wins over
`components` regardless of what selector is used inside `components` — so
no rewrite of the `[data-skin="console"] .field` selector can ever beat
`shadow-[...]` or `bg-fg/6` sitting directly on the same element.

**Why `.ring-card` and `.push` don't have this problem**: neither `Input`
nor `Badge`'s existing markup carries a *utility* class for shadow/radius
of the same host element — sorry, correction: `.ring-card`'s host
components carry no *competing* utility for `box-shadow` at all; the
unscoped `.ring-card` rule in `@layer components` (`box-shadow:
var(--shadow-border)`, styles.css ≈ line 337) is the **only** thing setting
that property, so the boxscore/console override (same layer, higher
specificity) wins normally. `Input`/`Badge` are different: their *default*
appearance today is expressed as a co-located Tailwind utility class, not
as an unscoped recipe rule.

**The fix**: give `.field` and `.badge-default` an **unscoped base rule**
in `@layer components` — the same pattern `.ring-card` already uses —
that reproduces today's default appearance byte-for-byte using the same
tokens the utilities already resolve to, then **remove the competing
utility classes** from `Input`/`Badge` so nothing in `@layer utilities`
contests the property anymore. The console-scoped override then wins the
normal way (same layer, higher specificity), exactly like `.ring-card`
does for boxscore. This makes Step 1 and Step 4 below different from a
naive re-read of "class hooks only" — the revised scope explicitly
authorizes removing those two utility fragments as part of the hook.

**General lesson for future skin work (record this in `SKILL.md`'s spirit
even though this plan doesn't touch that file)**: any recipe class meant to
override box-shadow / background-color / border-radius / border / color
needs an unscoped base rule in `@layer components`, and the host component
must not also carry a Tailwind utility class for that same property — if it
does, strip the utility and move its value into the base rule first. Do not
try to win with `!important` or a higher-specificity selector; layer order
beats both. **Check every property the recipe touches, one at a time** —
attempt 2 fixed `.field`'s box-shadow/radius and `.badge-default`'s
background-color, but missed that `Badge`'s `text-muted` utility still
contests `color` on the same element, because `Badge`'s tone map is a
five-way branch and only the `default` branch's *first* utility
(`bg-fg/6`) had an obvious counterpart in the recipe table — its second one
(`text-muted`) is easy to read past.

## Second collision: `.badge-default`'s `color`

`Badge`'s default tone (`ui/badge.tsx`) is `"badge-default text-muted"` as
of attempt 2's fix. `text-muted` is a Tailwind utility (`color:
var(--color-muted)` = `var(--ink-2)`, confirm via
`grep -n 'color-muted' src/styles.css`) living in `@layer utilities` — same
problem as before, on `color` instead of `background-color`/`box-shadow`.
The `[data-skin="console"] .badge-default { color: var(--ink); }` override
(already in styles.css from attempt 2, do not remove it) is correct but
inert, beaten by `text-muted` the same way `shadow-[...]` beat `.field`
originally.

**Fix, same shape as before**: add `color: var(--ink-2)` to the *unscoped*
`.badge-default` base rule (reproducing what `text-muted` currently gives
Ledger/Box Score — `--color-muted` is `var(--ink-2)`, confirm via
`grep -n '\-\-color-muted:' src/styles.css`), and remove `text-muted` from
`ui/badge.tsx`'s `tone === "default"` line. Step 1 and Step 4 below already
have this folded in — do not re-derive it, just follow them.

## Status

- **Priority**: P1
- **Effort**: M (one styles.css block + ~8 one-line class hooks + tests)
- **Risk**: LOW–MED — every new rule is scoped `[data-skin="console"]`; the
  hooks are inert classes for Ledger and Box Score. The one real hazard is
  a box-shadow specificity collision on the input focus ring; the rule below
  is written to dodge it (`:not(:focus-visible)`), and the STOP conditions
  cover it.
- **Depends on**: plans/078-console-skin-tokens.md (the `[data-skin="console"]`
  attribute and tokens must exist — nothing here renders without it)
- **Category**: direction (Console cut, prototyped and locked 2026-08-26)
- **Planned at**: commit `ea99611`, 2026-08-26

## Why this matters

Plan 078 lands Console's colors, radii, and type. What makes Console read as
Console, though, is structural: **entity names carry a real underline**
(records you can open — buttons stay pills, nothing else looks clickable),
**dense tables pair hairlines with zebra**, **table headers sit on a band at
quiet weight**, **the search field gets its one soft "well" ring** (the only
shadow in the skin), and **badges become hairline-ringed pills on white**
instead of tinted fills. All five are expressible as skin-scoped CSS on named
recipe classes — the exact mechanism the codebase already uses for Box Score
(`[data-skin="boxscore"] .microlabel`, `.ring-card`, `.push` overrides in
`src/styles.css` ≈ lines 346–380). No component may name the skin; components
gain only neutral recipe classes.

## Locked design (do not re-decide)

| Recipe | Base behavior (Ledger/Box Score) | Under `[data-skin="console"]` |
|---|---|---|
| `.ent` (entity name: player or team) | no rule — class is inert | resting underline: `text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; text-decoration-color: color-mix(in oklab, var(--ink) 45%, transparent)` |
| `.zebra` (dense row list / tbody) | no rule — inert | `> *:nth-child(even) { background-color: var(--band) }` (rows keep their existing hairline borders — Console pairs both) |
| `.band-head` (table header row group) | no rule — inert | `background-color: var(--band)`; th weight stays whatever the markup says (the header voice class already handles type) |
| `.field` (text input) | **base rule** (Step 1): `border-radius: var(--r-md); box-shadow: 0 0 0 1px var(--hairline-strong);` — byte-faithful reproduction of today's default | on `:not(:focus-visible)` only: `border-radius: var(--r-lg); box-shadow: 0 0 0 1px var(--hairline), 0 0 0 5px var(--paper-sunken)` — the soft well, the skin's single shadow. Focus stays fully utility-driven |
| `.badge-default` (Badge, default tone only) | **base rule** (Step 1): `background-color: color-mix(in oklab, var(--ink) 6%, transparent); color: var(--ink-2);` — byte-faithful reproduction of today's `bg-fg/6 text-muted` | `background-color: var(--paper-raised); box-shadow: inset 0 0 0 1px var(--hairline); color: var(--ink)` |

Also locked:

- Tokens only in the rules (`var(--band)`, `var(--hairline)`, …) so dark mode
  resolves for free. **No literal colors** — the skin contract's layer rule.
- Other tones of `Badge` (`win`, `loss`, `live`, `warn`, `muted`) keep their
  tinted fills under Console — the 14%-fill + hue-text language matches the
  Console study; only the gray `default` tone flips to the hairline pill.
- Hook sites in this plan: PlayerCell's name span, the matchup-board team
  link, the standings team span (`.ent`); the matchup-board row `<ul>` and the
  standings `<tbody>` (`.zebra`); the standings `<thead>` (`.band-head`); the
  shared `Input` (`.field`); `Badge`'s default tone (`.badge-default`).
  Wire/lineup/players lists adopt `.zebra`/`.ent` in a later pass — not here.
- **Not this plan** (structural DOM, → 080+): the head-to-head matchup shell,
  the home stat strip, book price pills and the spread strip, nav changes.
  Player avatars need nothing — `PlayerCell` already renders headshots.

## Current state

All excerpts at `ea99611`; line numbers are anchors, not gospel — match the
code shape.

- `src/styles.css` — the precedent block this plan extends (≈ lines 346–380):
  ```css
  [data-skin="boxscore"] .microlabel { … }
  [data-skin="boxscore"] .microlabel-data { … }
  [data-skin="boxscore"] .ring-card { … }
  [data-skin="boxscore"] .push, … { transform: none; box-shadow: none; }
  ```
  New Console rules go in the same layer, directly after the boxscore
  overrides and before the `/* Flourishes: invisible outside boxscore. */`
  comment.
- `src/components/player-cell.tsx:136-141` — the canonical player-name span:
  ```tsx
  <span
    className={cn(
      "truncate text-sm font-medium text-fg",
      dense && "text-[13px] sm:text-sm",
    )}
  >
  ```
- `src/components/matchup-board.tsx:141-142` — the starter-row list:
  ```tsx
  <ul>
    {rows.map((r, i) => (
  ```
  and `:211-214` — the team-name link:
  ```tsx
  <Link
    to="/league/$leagueId/team/$rosterId"
    params={{ leagueId, rosterId: String(side.rosterId) }}
    className="truncate rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
  >
  ```
- `src/routes/league/$leagueId/standings.tsx:184-192` — the standings table:
  ```tsx
  <div className="overflow-x-auto">
    <table className="w-full min-w-[460px] text-sm">
      <thead className="microlabel-data">
        <tr className="border-b border-line">
  ```
  and `:227` — the team-name span inside a row:
  ```tsx
  <span className="block truncate font-medium">{row.teamName}</span>
  ```
  The single `<tbody>` sits directly after `</thead>`; its rows carry
  `border-b border-line last:border-0` (line ≈ 203).
- `src/components/ui/input.tsx:8-18` — the shared input; note the ring is a
  `shadow-[…]` utility and focus is a `ring-2` utility (both box-shadow —
  this is why the Console rule must exclude `:focus-visible`):
  ```tsx
  <input
    {...props}
    id={fieldId}
    name={name ?? fieldId}
    className={cn(
      "h-10 w-full rounded-md bg-surface px-3 text-base text-fg shadow-[0_0_0_1px_var(--color-line-strong)] placeholder:text-faint sm:text-sm",
      "transition-[box-shadow] duration-150 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
      className,
    )}
  />
  ```
- `src/components/ui/badge.tsx:11-25` — tone map; `default` is the line to
  hook:
  ```tsx
  <span
    className={cn(
      "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium leading-none",
      tone === "default" && "bg-fg/6 text-muted",
      …
  ```
- `src/skin/skin.test.mjs` — source-assertion tests; the shape to copy is
  `"card ring and micro-label recipes are named in representative components"`
  (reads a component file, asserts a class name appears) and the
  `findTsxFiles`-based leak tests.
- Conventions: Biome, `tsc --noEmit`, `.test.mjs` + `node:assert/strict`,
  `bun@1.3.10`. Skin contract in `src/skin/SKILL.md`: components never name a
  skin; literals only in token files — recipe rules reference tokens.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck / lint / test / build | `bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run build` | exit 0 / pass |
| Dev | `bun run dev` (8080) | manual check |
| Force the skin in dev | on `/account` pick **Console** (or `localStorage.setItem("ledger-skin","console")` + reload) | `<html data-skin="console">` |

## Scope

**In scope**:
- `src/styles.css` (the new Console block of five recipes, **plus** two new
  *unscoped* base rules — `.field` and `.badge-default` — see Step 1)
- `src/components/player-cell.tsx`, `src/components/matchup-board.tsx`,
  `src/routes/league/$leagueId/standings.tsx` (class hooks only, unchanged
  from the original plan)
- `src/components/ui/input.tsx`, `src/components/ui/badge.tsx` (class hook
  **plus** removing the one competing Tailwind utility fragment each — see
  Step 4; this is more than "class hooks only" but is the authorized fix
  for the layer collision above, not a scope expansion into new behavior)
- `src/skin/skin.test.mjs` (assertions)
- `plans/README.md` (status row)

**Out of scope** (do not touch):
- `src/skin/tokens.css`, `src/skin/skins/*.css` — no new tokens; if a rule
  seems to need one, STOP.
- The `@theme inline` block; any boxscore-scoped rule; the flourish rules.
- Wire, lineup-board, players, draft, book, matchup routes — later adoption.
- Any visual change under Ledger or Box Score. The hooks must be inert there.

## Git workflow

Current branch; one commit, e.g.
`feat(skin): console voice recipes — ent links, zebra, band heads, field well, hairline badges`. Do NOT push.

## Steps

### Step 1: base rules + the recipe block in `src/styles.css`

First, add two **unscoped** base rules next to the existing `.ring-card` /
`.microlabel` rules (anywhere inside the same `@layer components` block,
before the `[data-skin="boxscore"] …` overrides — grouping them with
`.ring-card` is fine). These reproduce today's Ledger/Box Score default
appearance of `Input` and `Badge`'s default tone, using the exact tokens
those utilities already resolve to (`--color-line-strong` = `var(--hairline-strong)`,
`--radius-md` = `var(--r-md)`, `bg-fg/6` = 6% of `--ink` = `var(--color-fg)`
over transparent):

```css
  /* Unscoped defaults for Input/Badge, so a skin override (below) can win
     via normal same-layer specificity instead of losing to a co-located
     Tailwind utility in @layer utilities. See plan 079's "why the first
     attempt blocked" for why this indirection is required. */
  .field {
    border-radius: var(--r-md);
    box-shadow: 0 0 0 1px var(--hairline-strong);
  }
  .badge-default {
    background-color: color-mix(in oklab, var(--ink) 6%, transparent);
    color: var(--ink-2);
  }
```

Then, insert the console-scoped block after the `[data-skin="boxscore"]
.push` override and before the `/* Flourishes */` comment:

```css
  /* Console voice. The recipe classes (.ent, .zebra, .band-head, .field,
     .badge-default) are inert everywhere else — Console is the only skin
     that styles them. Tokens only; no literals. */
  [data-skin="console"] .ent {
    text-decoration-line: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in oklab, var(--ink) 45%, transparent);
  }
  [data-skin="console"] .zebra > *:nth-child(even) {
    background-color: var(--band);
  }
  [data-skin="console"] .band-head {
    background-color: var(--band);
  }
  [data-skin="console"] .field:not(:focus-visible) {
    border-radius: var(--r-lg);
    box-shadow:
      0 0 0 1px var(--hairline),
      0 0 0 5px var(--paper-sunken);
  }
  [data-skin="console"] .badge-default {
    background-color: var(--paper-raised);
    box-shadow: inset 0 0 0 1px var(--hairline);
    color: var(--ink);
  }
```

**Verify**: `bun run build` → 0; `grep -c 'data-skin="console"' src/styles.css`
→ `5`; `grep -c '^\s*\.field {' src/styles.css` → `1`; `grep -c '^\s*\.badge-default {' src/styles.css` → `1`.

### Step 2: `.ent` hooks (three sites)

1. `player-cell.tsx` name span: `"truncate text-sm font-medium text-fg"` →
   `"ent truncate text-sm font-medium text-fg"`.
2. `matchup-board.tsx` team `Link`: prepend `ent ` to its className string.
3. `standings.tsx` team span: `"block truncate font-medium"` →
   `"ent block truncate font-medium"`.

**Verify**: `bun run typecheck` → 0;
`grep -l '"ent ' src/components/player-cell.tsx src/components/matchup-board.tsx 'src/routes/league/$leagueId/standings.tsx'` → all three.

### Step 3: `.zebra` + `.band-head` hooks

1. `matchup-board.tsx:141`: `<ul>` → `<ul className="zebra">`.
2. `standings.tsx`: `<tbody>` → `<tbody className="zebra">`;
   `<thead className="microlabel-data">` →
   `<thead className="band-head microlabel-data">`.

**Verify**: `bun run typecheck` → 0.

### Step 4: `.field` and `.badge-default` hooks

These two are **not** simple prepends — the base rules from Step 1 replace
two of the utility fragments already in these files, so the fragment must
be removed, not just have a class added alongside it. Everything else in
each className string is untouched.

1. `ui/input.tsx`, the `cn(...)` call's first string:
   ```
   "h-10 w-full rounded-md bg-surface px-3 text-base text-fg shadow-[0_0_0_1px_var(--color-line-strong)] placeholder:text-faint sm:text-sm"
   ```
   becomes
   ```
   "field h-10 w-full bg-surface px-3 text-base text-fg placeholder:text-faint sm:text-sm"
   ```
   (added `field `; removed `rounded-md` and
   `shadow-[0_0_0_1px_var(--color-line-strong)]` — both now come from the
   `.field` base rule in Step 1). Leave the other two `cn(...)` strings
   (`transition-[box-shadow] …`, `focus-visible:outline-none …`) exactly as
   they are — the focus ring must stay fully utility-driven, per the locked
   design.
2. `ui/badge.tsx`:
   ```
   tone === "default" && "bg-fg/6 text-muted"
   ```
   becomes
   ```
   tone === "default" && "badge-default"
   ```
   (added `badge-default`; removed **both** `bg-fg/6` **and** `text-muted` —
   background-color and color now both come from the `.badge-default` base
   rule in Step 1. Do not leave `text-muted` in place — it sets `color` on
   the same element and silently beats the console override the same way
   `bg-fg/6` did, per "Second collision" above.) Every other tone line
   (`win`/`loss`/`live`/`warn`/`muted`) is untouched.

**Verify**: `bun run typecheck` → 0; `bun test src scripts` → pass (the badge
test asserts `doesNotMatch /font-mono/` — untouched);
`grep -n 'rounded-md\|shadow-\[' src/components/ui/input.tsx` → no matches;
`grep -n 'bg-fg/6\|text-muted' src/components/ui/badge.tsx` → no matches
anywhere in the file (neither string appears elsewhere in `badge.tsx` today,
so this is a clean check — the `muted` tone uses `text-faint`, a different
class, and is untouched).

### Step 5: tests in `src/skin/skin.test.mjs`

Add two tests, matching the existing style:

```js
test("console voice recipes exist and are hooked in representative components", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  for (const sel of [".ent", ".zebra", ".band-head", ".field", ".badge-default"]) {
    assert.match(
      styles,
      new RegExp(`\\[data-skin="console"\\][^{]*\\${sel}`),
      `styles.css should scope ${sel} to the console skin`,
    );
  }
  assert.match(readFileSync(join(root, "src/components/player-cell.tsx"), "utf8"), /"ent /);
  assert.match(readFileSync(join(root, "src/components/ui/input.tsx"), "utf8"), /"field /);
  assert.match(readFileSync(join(root, "src/components/ui/badge.tsx"), "utf8"), /badge-default/);
});

test("no component names a skin — recipe classes only", () => {
  const tsxFiles = findTsxFiles(join(root, "src"));
  const leaks = tsxFiles.filter((f) => /data-skin="console"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(leaks, [], "components must stay skin-agnostic; style via recipes in styles.css");
});
```

**Verify**: `bun test src/skin` → all pass.

### Step 6: manual smoke, then commit

`bun run dev`, pick Console on `/account`, then check:

- Standings: banded header, zebra rows over hairlines, underlined team names.
- Matchups board: underlined team links (resting, not only hover), zebra
  starter rows.
- Any player row (roster, box score): player names underlined; meta/points
  untouched.
- Wire or players search: the input shows the 1px hairline + 5px sunken well
  **at rest** — verify with `getComputedStyle` (box-shadow should show two
  shadow layers, border-radius `14px`), not just a visual glance, since this
  exact property is what silently failed last attempt. **Tab into it** — the
  accent focus ring must render exactly as before (utility still wins on
  focus).
- A default-tone badge (e.g. a position tag): white pill with hairline ring —
  again verify `getComputedStyle` for **both** `background-color` (resolves
  to `--paper-raised`, not a translucent ink tint) **and** `color` (resolves
  to `--ink`, not `--ink-2`) — the second collision this plan hit was
  exactly `color` reading as the old `--ink-2` because a leftover utility
  class was still winning.
- **Flip to Ledger and Box Score**: all five surfaces pixel-identical to
  before this change. This is the critical regression check for Step 1/4's
  base-rule rewrite — `Input`'s box-shadow/radius and `Badge`'s default
  background *and text color* must compute to the *same* values as on `main` before this
  plan, just sourced from `.field`/`.badge-default` instead of the removed
  utility classes. Dark mode under Console: zebra and band resolve to the
  dark `--band`, the well to dark `--paper-sunken`.

Commit; update the 079 row in `plans/README.md`.

## Test plan

- The two Step 5 tests.
- Full `bun test src scripts` green — especially the existing skin/brand
  tests and `scripts/wager-testid.test.mjs` (untouched paths, must stay so).

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run build` all exit 0
- [ ] `grep -c '\[data-skin="console"\]' src/styles.css` → 5
- [ ] `grep -c '^\s*\.field {' src/styles.css` → 1; `grep -c '^\s*\.badge-default {' src/styles.css` → 1
- [ ] `grep -n 'rounded-md\|shadow-\[' src/components/ui/input.tsx` → no matches
- [ ] `grep -n 'bg-fg/6\|text-muted' src/components/ui/badge.tsx` → no matches
- [ ] `grep -rn 'data-skin="console"' src --include='*.tsx'` → no matches
- [ ] `git diff --stat` touches only the eight in-scope files
- [ ] Manual smoke checklist above passes in both themes and all three skins,
      **verified via `getComputedStyle` for `.field`/`.badge-default`
      specifically** — a visual glance is not sufficient; this exact check is
      what a prior attempt's source-level tests missed while the recipes
      were silently inert.

## STOP conditions

- The drift check shows the excerpted markup has changed shape (e.g. the
  standings table was rebuilt, `Input` gained its own focus rule).
- Plan 078 has not landed (`src/skin/skins/console.css` missing) — this plan
  styles an attribute that would never be stamped.
- The input focus ring visibly breaks under Console (the `:not(:focus-visible)`
  guard failed against the ring utility) — report; do not start a specificity
  war with `!important`.
- You need a new token or a literal color to hit the design — that's a 078
  amendment, not an inline hack.
- Any Ledger or Box Score surface changes appearance — in particular, after
  Step 4's rewrite, `Input`'s resting box-shadow/border-radius and `Badge`'s
  default background **and color** must compute to the exact same values
  they do on `main` today. If they don't, the token substitution in Step 1's
  base rules is wrong — fix the base rule to match, do not add the utility
  class back (that reintroduces the layer collision).
- `.field` or `.badge-default` compute to anything other than the Step 1/6
  expected values under Console **or** under Ledger/Box Score, for **any**
  property the recipe touches (not just the ones a previous attempt already
  found broken) — check every property in the Locked design table's row for
  that recipe individually with `getComputedStyle`, not just the ones
  mentioned here by name. If any one is wrong, that means the layer-order
  fix itself didn't fully work and this needs a fresh diagnosis, not another
  workaround layered on top. This exact failure mode (a bug found and fixed
  on one property, only to resurface on a sibling property of the same
  recipe that nobody re-checked) is why this plan has now been revised
  twice — do not assume "the properties I already checked are fine" means
  "every property is fine."

## Maintenance notes

- Follow-on adoption: `wire.tsx`, `lineup-board.tsx`, `players.tsx`, and
  `draft.tsx` lists can take `.zebra`/`.ent` hooks the same way when Console
  gets used in anger — one-line edits, no new CSS.
- 080+ (structural, each its own plan): the head-to-head matchup shell, the
  home stat strip, Console styling for the book's `LinePanel`/`WagerTicket`
  (price pills + spread strip), and any nav treatment.
- Review watch: new name renderers should take `.ent`; new dense lists should
  take `.zebra`. The Step 5 leak test keeps skin names out of components.
- Design source (reference only; all values are inlined here): prototype
  https://claude.ai/code/artifact/6ca0391d-2a25-4085-bd0e-fe0f83804ae0, study
  https://claude.ai/code/artifact/584d059b-a5f1-4565-8d35-149b155653f5.
