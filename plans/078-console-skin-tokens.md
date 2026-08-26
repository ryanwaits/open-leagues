# Plan 078: "Console" — third runtime skin, tokens + registration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ea99611..HEAD -- src/skin src/styles.css src/lib/theme.ts src/routes/account.tsx src/routes/__root.tsx`
> Any diff in those paths since `ea99611` → compare the "Current state"
> excerpts below against the live code; on a mismatch, STOP and report.

## Status

- **Priority**: P1
- **Effort**: S–M (one new CSS file + five small registration edits + one test)
- **Risk**: LOW — purely additive. Ledger stays the default and must remain
  byte-identical with no `data-skin` attribute; Box Score untouched.
- **Depends on**: nothing open (the skin system itself shipped as direction 047;
  Box Score is the worked example)
- **Category**: direction (Console cut, prototyped and locked 2026-08-26)
- **Planned at**: commit `ea99611`, 2026-08-26

## Why this matters

The "Console" visual direction (white console ground, hairline-and-zebra
tables, one data-blue accent, system grotesque, tighter radii) was iterated in
a clickable prototype and **locked**. This plan lands the token layer as a
third runtime skin behind `data-skin="console"`, switchable on `/account`,
exactly the way Box Score landed. Everything a token can express ships here;
everything structural (underlined entity links, zebra rows, the head-to-head
matchup shell, the book strip styling) is component work and **explicitly not
this plan** — it comes later as 079+ so this change stays trivially safe.

All design values are inlined below. You do not need the prototype to execute.

## Locked design (do not re-decide)

The full token contract for `[data-skin="console"]`, both modes:

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#fcfcfd` | `#131316` |
| `--paper-raised` | `#ffffff` | `#1b1b1f` |
| `--paper-sunken` | `#f2f2f4` | `#232328` |
| `--band` | `#f7f7f8` | `#202024` |
| `--ink` | `#1c1c1f` | `#ececef` |
| `--ink-2` | `#6e6e76` | `#9d9da6` |
| `--ink-3` | `#a2a2aa` | `#6b6b74` |
| `--hairline` | `#e6e6ea` | `#2a2a30` |
| `--hairline-strong` | `#d8d8de` | `#38383f` |
| `--brand` | `#4a72f5` | `#7c96ff` |
| `--brand-deep` | `#3b5fd9` | `#5b78e8` |
| `--brand-strong` | `#2f4bb8` | `#93a8ff` |
| `--brand-ink` | `#f5f7ff` | `#10173a` |
| `--highlight` | `#c9d4fb` | `#2c3a6e` |
| `--alarm` | `#d64b2a` | `#ef6b4f` |
| `--caution` | `#b26a00` | `#e3a33b` |
| `--lift` / `--lift-hover` | `0 0 0 0 rgb(0 0 0 / 0)` (both) | same |
| `--press-cast` | `rgb(59 95 217 / 0.3)` | `rgb(0 0 0 / 0.5)` |
| `--r-xs / sm / md / lg / xl` | `8px / 10px / 12px / 14px / 16px` | same |
| `--r-pill` | `999px` | same |
| `--font-stack-display` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif` | same |
| `--font-stack-sans` | same as display | same |
| `--font-stack-mono` | `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` | same |

Other locked calls:

- **No `--ghost`.** The ghost-number flourish is scoped
  `[data-skin="boxscore"]` in `styles.css` (≈ lines 390–408); Console does not
  opt in. Do not add the token or touch those rules.
- **No `--card-ring` / `--push-*` redeclarations.** `tokens.css` defines
  `--card-ring: var(--hairline)` by reference — it re-resolves against
  Console's `--hairline` automatically. Box Score doesn't redeclare them
  either; match that.
- **Cards stay flat** (ring, zero lift) — Console's one soft shadow (the
  search "well") is component work, not a token, and is out of scope.
- **Fonts are the system stack.** Do NOT remove the Geist `<link>` in
  `__root.tsx` — Ledger still needs it. Console simply doesn't reference Geist.
- **theme-color** for Console: light `#fcfcfd`, dark `#131316` (equal to
  `--paper`).
- Picker label: **"Console"**. Pref value / attribute value: **"console"**.

## Current state

- `src/skin/SKILL.md` — the skin contract; read it first. Summary: (1) raw
  literals only in `tokens.css` + one CSS file per skin; (2) `styles.css`
  `@theme inline` maps utilities by reference — never touch it here; (3)
  components name tokens only.
- `src/skin/skins/boxscore.css` (81 lines) — **the exemplar to copy.** Three
  blocks: `[data-skin="boxscore"] { … }` (light),
  `@media (prefers-color-scheme: dark) { [data-skin="boxscore"]:not([data-theme="light"]) { … } }`,
  and `[data-skin="boxscore"][data-theme="dark"] { … }` — so a stamped
  preference and a bare OS signal both resolve.
- `src/styles.css:1-4`:
  ```css
  @import "tailwindcss";
  @import "tw-animate-css";
  @import "./skin/tokens.css";
  @import "./skin/skins/boxscore.css";
  ```
- `src/lib/theme.ts:8-9`:
  ```ts
  export type SkinPref = "ledger" | "boxscore";
  export const SKIN_KEY = "ledger-skin"; // the ONE key; no other spelling
  ```
  `NO_FLASH_SCRIPT` (lines 16–20) ends with:
  ```
  …var s=localStorage.getItem(${JSON.stringify(SKIN_KEY)});if(s==="boxscore")document.documentElement.setAttribute("data-skin",s)}catch(e){}})()
  ```
  and `isSkinPref` (line 100–102):
  ```ts
  function isSkinPref(v: unknown): v is SkinPref {
    return v === "boxscore";
  }
  ```
  (`readSkin`/`paintSkin`/`setSkinPref`/`useSkin` below it are generic over
  `SkinPref` — no changes needed there.)
- `src/routes/account.tsx:51-54`:
  ```ts
  const SKIN_OPTIONS: { value: SkinPref; label: string }[] = [
    { value: "ledger", label: "Ledger" },
    { value: "boxscore", label: "Box Score" },
  ];
  ```
- `src/routes/__root.tsx:62-65` — **crashes on an unregistered skin key**
  (`THEME_COLOR[skin]` would be `undefined`, then `.dark` throws in the
  `useEffect`):
  ```ts
  const THEME_COLOR = {
    ledger: { light: "#fafaf8", dark: "#0d0d0d" },
    boxscore: { light: "#fbfaf6", dark: "#141519" },
  } as const;
  ```
- `src/skin/skin.test.mjs` — source-assertion tests (`node:test` style, run by
  `bun test`). The pattern to copy is the
  `"boxscore skin defines the full token contract"` test (lines 45–71): reads
  the skin file, asserts a list of `--name:` declarations.
- Conventions: Biome (`bun run lint`), TypeScript strict (`bun run typecheck`),
  tests are `.test.mjs` with `node:assert/strict`, packageManager `bun@1.3.10`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | pass |
| Build | `bun run build` | exit 0 |
| Dev server | `bun run dev` (port 8080) | manual check |

## Scope

**In scope**:
- `src/skin/skins/console.css` (create)
- `src/styles.css` (one `@import` line)
- `src/lib/theme.ts` (`SkinPref`, `isSkinPref`, `NO_FLASH_SCRIPT`)
- `src/routes/account.tsx` (`SKIN_OPTIONS` entry)
- `src/routes/__root.tsx` (`THEME_COLOR` entry)
- `src/skin/skin.test.mjs` (one new test)
- `plans/README.md` (status row)

**Out of scope** (do not touch, even where it looks related):
- Any component or route beyond the two registration edits above — the
  Console structural signatures (underlined links, zebra tables, stat strip,
  soft-ring search, h2h matchup shell, book styling, player avatars) are
  plans 079+.
- `src/skin/tokens.css` (Ledger) and `src/skin/skins/boxscore.css`.
- The `@theme inline` block and every class rule in `styles.css`.
- The Geist font `<link>` in `__root.tsx`; `brand.ts`; favicon/OG assets.
- Anything in SKILL.md's "Do not edit" list (auth, engine, `__grok` PWA).

## Git workflow

Current branch; one commit, e.g.
`feat(skin): console skin — tokens and registration`. Do NOT push.

## Steps

### Step 1: `src/skin/skins/console.css`

Create the file by copying `boxscore.css`'s three-block structure with
selector `[data-skin="console"]` and the values from the Locked design table.
Header comment, matching the house voice:

```css
/* Console — white console ground, hairline structure, one data-blue accent,
   system grotesque. Loaded after tokens.css so it outranks the accent ramp
   at equal specificity. Structural signatures (underlined links, zebra,
   the h2h shell) are component work — plans 079+. */
```

All three blocks carry the **full** contract (every token in the table,
including `--lift`, `--lift-hover`, `--press-cast`, all five radii, `--r-pill`,
and the three font stacks — repeat the shape/type tokens in the dark blocks
exactly the way `boxscore.css` repeats them). No `--ghost`, no `--card-ring`,
no `--push-*`.

**Verify**: `grep -c 'data-skin="console"' src/skin/skins/console.css` → `3`.

### Step 2: import it

`src/styles.css` line 5, directly after the boxscore import:

```css
@import "./skin/skins/console.css";
```

**Verify**: `bun run build` → exit 0.

### Step 3: `src/lib/theme.ts`

1. `export type SkinPref = "ledger" | "boxscore" | "console";`
2. `isSkinPref`: `return v === "boxscore" || v === "console";`
3. In `NO_FLASH_SCRIPT`, change the stamp condition:
   `if(s==="boxscore")` → `if(s==="boxscore"||s==="console")`.
   Touch nothing else in the string — it must remain a single inline literal.

**Verify**: `bun run typecheck` → 0;
`grep -n 's==="boxscore"||s==="console"' src/lib/theme.ts` → one match.

### Step 4: `src/routes/account.tsx`

Append to `SKIN_OPTIONS`: `{ value: "console", label: "Console" }`.

**Verify**: `bun run typecheck` → 0.

### Step 5: `src/routes/__root.tsx`

Add to `THEME_COLOR`: `console: { light: "#fcfcfd", dark: "#131316" },`.

**Verify**: `bun run typecheck` → 0.

### Step 6: contract test

In `src/skin/skin.test.mjs`, add a test mirroring the boxscore one:

```js
test("console skin defines the full token contract in all three blocks", () => {
  const console_ = readFileSync(join(root, "src/skin/skins/console.css"), "utf8");
  for (const name of [
    "paper", "paper-raised", "paper-sunken", "band",
    "ink", "ink-2", "ink-3", "hairline", "hairline-strong",
    "brand", "brand-deep", "brand-strong", "brand-ink", "highlight",
    "alarm", "caution", "lift", "press-cast", "r-pill", "font-stack-sans",
  ]) {
    assert.match(console_, new RegExp(`--${name}:`), `console.css should define --${name}`);
  }
  const blocks = console_.match(/\[data-skin="console"\]/g) ?? [];
  assert.ok(blocks.length >= 3, "expected the light, media-dark, and stamped-dark blocks");
  const registered = readFileSync(join(root, "src/lib/theme.ts"), "utf8");
  assert.match(registered, /"console"/);
});
```

(Name the local `console_` — shadowing the global `console` trips Biome.)

**Verify**: `bun test src/skin` → all pass (including the pre-existing 20).

### Step 7: manual smoke, then commit

`bun run dev` → `/account` → Appearance shows Ledger · Box Score · Console.
Picking Console: ground goes white-blue-gray (`#fcfcfd`), links/accents blue,
type system-sans; toggle dark in the same panel → `#131316` ground, `#7c96ff`
accent. Reload → choice sticks with no light-flash (the NO_FLASH stamp).
Pick Ledger again → `data-skin` attribute is **removed** (inspect `<html>`),
page is pixel-identical to before this change.

Commit (message above). Update the 078 row in `plans/README.md`.

## Test plan

- New: the Step 6 contract test.
- Existing: full `bun test src scripts` must stay green — especially
  `skin.test.mjs` ("ledger default tokens are the x.ai/bot cut" proves Ledger
  untouched) and `brand.test.mjs`.

## Done criteria

- [ ] `bun run typecheck` · `bun run lint` · `bun test src scripts` · `bun run build` all exit 0
- [ ] `grep -c '\[data-skin="console"\]' src/skin/skins/console.css` → ≥ 3
- [ ] `grep -n 'console' src/styles.css` → only the new `@import` line
- [ ] `grep -n '"console"' src/lib/theme.ts src/routes/account.tsx src/routes/__root.tsx` → all three files match
- [ ] `git diff --stat` touches only the seven in-scope files
- [ ] With no `data-skin` attribute, computed `--paper` is still `#fafaf8` (Ledger identical)

## STOP conditions

- The drift check shows `theme.ts`, `account.tsx`, `__root.tsx`, or
  `styles.css` no longer match the excerpts (someone landed another skin or
  reworked the store) — reconcile is not your call.
- `NO_FLASH_SCRIPT` no longer contains the literal `s==="boxscore"` check.
- Any existing test fails **before** your change (dirty baseline).
- You find yourself wanting to edit a component to "make Console look right" —
  that is 079+, not this plan.

## Maintenance notes

- Next in the series: **079+** — Console structural signatures as skin-scoped
  `styles.css` rules and token-routed component classes (underlined entity
  links, zebra rows, band table headers, the stat strip, soft-ring search,
  h2h matchup shell, book price pills). Those must follow the contract: no
  component may name the skin; extend the indirection in `styles.css` instead
  (the `[data-skin="boxscore"] .push` override is the precedent).
- Anyone adding a fourth skin repeats exactly these five registration
  touchpoints; if that happens twice more, consider a registry module so
  `THEME_COLOR` and the NO_FLASH condition derive from one list.
- The prototype that locked this direction lives at
  https://claude.ai/code/artifact/6ca0391d-2a25-4085-bd0e-fe0f83804ae0 (and the
  token study at https://claude.ai/code/artifact/584d059b-a5f1-4565-8d35-149b155653f5)
  — reference only; every value an executor needs is inlined above.
