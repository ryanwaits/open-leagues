# Plan 047: `data-skin` runtime skins — Ledger default, Box Score behind a per-user picker

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before the next step. On any STOP
> condition, stop and report — do not improvise. When done, update this
> plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 8f04751..HEAD -- src/styles.css src/skin src/lib/theme.ts src/routes/__root.tsx src/routes/account.tsx src/components/theme-toggle.tsx`
> Any changed in-scope file → compare the "Current state" excerpts below
> against live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (this slice)
- **Risk**: MED (touches global CSS contract; mitigated by no-visual-change gates)
- **Depends on**: none. **Plan 048 must run AFTER this plan** (both edit `src/routes/account.tsx`).
- **Category**: dx / direction
- **Planned at**: commit `8f04751`, 2026-08-20

## Why this matters

The app has one skin ("Ledger": cream, rounded, green) restyled only by
editing files. A second full design ("Box Score": paper white, ink rules,
electric blue, square corners — designed on the Box Score canvas, artifact
`a9ee7f62`) needs to coexist at runtime, per user, without forking components.
This plan builds the axis: a `data-skin` attribute beside `data-theme`, the
token contract widened so radii/fonts swap with it, and a token-level Box
Score skin behind an `/account` picker. Ledger stays byte-identical and
default.

**This plan is slice 1 only.** The label-voice codemod ("Phase C": `.microlabel`,
`.card`, `.push`/`.hl` per-skin styling, ~155 uppercase-tracking sites, 94
shadow-border sites) and the Box Score flourishes ("Phase E": ghost numerals,
slot rails, agate tables) are **deferred to follow-up plans** written after
this lands (see Maintenance notes). Until then Box Score renders as a
token-level reskin — correct colors/radii/fonts, Ledger's label voice. That is
acceptable and expected.

## Current state

- `src/skin/tokens.css` — raw color/shadow values on `:root`. Light
  `:root` ends ~line 35; last token is `--press-cast: rgb(63 167 101 / 0.4)`
  at line 34 — add radius/font tokens **there**, not after the dark
  `--press-cast` at line 90. Dark via `[data-theme="dark"]` +
  `prefers-color-scheme`. Accent ramp at `[data-accent="blue"]`
  (lines 96–122). No radius/font tokens. No `data-skin` anywhere in
  `src/` (verified: 0 hits).
- `src/styles.css` — Tailwind v4; maps tokens via `@theme inline`. Radii and
  fonts are LITERALS today:

  ```css
  /* src/styles.css:56-66 */
  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  ...
  --radius-xs: 8px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --radius-pill: 999px;
  ```

  Imports at top: `@import "tailwindcss";` / `@import "tw-animate-css";` /
  `@import "./skin/tokens.css";` (line 3).
- `src/lib/theme.ts` — theme store: `THEME_KEY = "ledger-theme"` (line 6),
  `NO_FLASH_SCRIPT` (line 13, inline pre-paint stamper), `readPref`,
  `setThemePref`, `useTheme` via `useSyncExternalStore` + a module-level
  `listeners` Set. Copy these patterns exactly for skin.
- `src/routes/__root.tsx` — inlines `NO_FLASH_SCRIPT` in `<head>`; hardcoded
  `theme-color` metas (lines ~30–31: `#f7f4ea` light / `#14161a` dark);
  mounts `<PushRegister />` (leave alone); Google Fonts link (leave — Box
  Score uses system Helvetica, loads nothing).
- `src/components/theme-toggle.tsx` — segmented `role="radiogroup"` control;
  the structural exemplar for the skin picker.
- `src/routes/account.tsx` — "You" header (line 22), user blurb, then
  `<AgentTokensPanel />` (line 28), then `<InstallCoach />` (line 30).
  The "Agent tokens" `h2` lives inside the panel (line 72). There is NO
  appearance section today; insert one **between the user blurb and
  `<AgentTokensPanel />`**. Section headers use
  `font-mono text-[11px] uppercase tracking-[0.16em] text-faint` — match.
- `src/skin/brand.test.mjs` — node:test source-assertion pattern; model new
  tests on it.
- Cascade fact: `[data-accent="blue"]` and `[data-skin="boxscore"]` have equal
  specificity (0,1,0). `boxscore.css` is imported AFTER `tokens.css`, so with
  both attributes present the skin wins. Intended; do not "fix".

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Tests | `bun test src scripts` | all pass |
| Build | `bun run build` | exit 0. NOTE: chains `db:migrate`, which writes the local `data/pglite` dir — expected, not an error. |
| Dev server | `bun run dev` (port 8080) | serves app |

Package manager is **bun** (`packageManager: bun@1.3.10`). No installs needed.

## Scope

**In scope** (only files you may modify/create):
- `src/skin/tokens.css` (add radius/font raw tokens)
- `src/skin/skins/boxscore.css` (create)
- `src/styles.css` (var indirection + one import line)
- `src/lib/theme.ts` (skin store + NO_FLASH extension)
- `src/routes/__root.tsx` (theme-color sync ONLY)
- `src/routes/account.tsx` (Appearance section)
- `src/skin/skin.test.mjs` (create)
- `src/skin/SKILL.md` (rewrite)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/lib/league/**`, `src/lib/auth/**`, `server/**`, `public/__grok/**`,
  `public/sw.js`, `src/components/push-register.tsx`, `<PreviewHostBridge />`
- `src/components/theme-toggle.tsx` (read as exemplar only; theme control
  stays in the header — do NOT move it to /account)
- `src/lib/auth/gates.tsx` (no new menu rows in this plan)
- Every `.tsx` component classname (the codemod is a later plan)
- `src/components/install-coach.tsx` (plan 048's file)

## Git workflow

- Work directly on the current branch. Commit per step, conventional style
  (repo examples: `feat: restyle claims and moves on the roster page`,
  `fix: keep push sub when leaving one league`). Do not push.

## Steps

### Step 1: Raw radius + font tokens in tokens.css

In `src/skin/tokens.css`, inside the existing `:root` block (after
`--press-cast`), add:

```css
  /* shape + type — per-skin knobs; Tailwind's @theme reads these names */
  --r-xs: 8px;
  --r-sm: 10px;
  --r-md: 14px;
  --r-lg: 18px;
  --r-xl: 22px;
  --r-pill: 999px;
  --font-stack-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-stack-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-stack-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
```

Do NOT add them to the `[data-theme="dark"]` blocks (shape/type don't vary by
mode).

**Verify**: `grep -c "\-\-r-xs" src/skin/tokens.css` → `1`

### Step 2: styles.css points at the vars

In `src/styles.css` `@theme inline`, replace the literals from the excerpt
above with references — value-for-value, nothing else in the block changes:

```css
  --font-display: var(--font-stack-display);
  --font-sans: var(--font-stack-sans);
  --font-mono: var(--font-stack-mono);
  ...
  --radius-xs: var(--r-xs);
  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --radius-lg: var(--r-lg);
  --radius-xl: var(--r-xl);
  --radius-pill: var(--r-pill);
```

**Verify**: `bun run typecheck && bun run lint` → both exit 0.
`grep -n "radius-xs: 8px" src/styles.css` → no matches.
Then `bun run dev`, load `http://localhost:8080` — cards still rounded,
fonts unchanged (Ledger must look identical).

### Step 3: skin store in theme.ts

Append to `src/lib/theme.ts`, copying its own patterns (same `listeners` set,
same try/catch localStorage guards):

```ts
export type SkinPref = "ledger" | "boxscore";
export const SKIN_KEY = "ledger-skin";   // the ONE key; no other spelling

export function readSkin(): SkinPref { /* localStorage[SKIN_KEY]==="boxscore" ? "boxscore" : "ledger" */ }
export function setSkinPref(s: SkinPref) {
  // "ledger" → removeItem + removeAttribute("data-skin")  (absent = default,
  // same convention as data-accent); "boxscore" → setItem + setAttribute.
  // Then emit().
}
export function useSkin() { /* useSyncExternalStore(subscribe, readSkin, () => "ledger") */ }
```

Extend `NO_FLASH_SCRIPT` (keep it one literal string): inside the existing
try block, after the theme stamp, add the equivalent of:
`var s=localStorage.getItem("ledger-skin");if(s==="boxscore")document.documentElement.setAttribute("data-skin",s);`

**Verify**: `bun run typecheck` → exit 0.

### Step 4: boxscore skin file

Create `src/skin/skins/boxscore.css` with EXACTLY this contract (palette of
record: Box Score canvas Tokens/DarkTokens artboards):

```css
/* Box Score — ink rules, one electric blue, square corners. Loaded after
   tokens.css so it outranks the accent ramp at equal specificity. */
[data-skin="boxscore"] {
  --paper: #fbfaf6;
  --paper-raised: #ffffff;
  --paper-sunken: #f1f0ea;
  --band: #e9e8e1;
  --ink: #101114;
  --ink-2: #54565a;
  --ink-3: #8f9194;
  --hairline: #cfcec5;
  --hairline-strong: #101114;
  --brand: #2118c8;
  --brand-deep: #150e9e;
  --brand-strong: #2b46e0;
  --brand-ink: #f5f6ff;
  --highlight: #b9c0ee;
  --alarm: #d2422e;
  --caution: #c4921a;
  --lift: 0 0 0 0 rgb(0 0 0 / 0);
  --lift-hover: 0 0 0 0 rgb(0 0 0 / 0);
  --press-cast: rgb(33 24 200 / 0.25);
  --r-xs: 0px; --r-sm: 0px; --r-md: 0px; --r-lg: 0px; --r-xl: 0px;
  --r-pill: 999px;
  --font-stack-display: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-stack-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-stack-mono: "Courier New", Courier, monospace;
}

@media (prefers-color-scheme: dark) {
  [data-skin="boxscore"]:not([data-theme="light"]) { /* dark block below */ }
}
[data-skin="boxscore"][data-theme="dark"] { /* same dark block */ }
```

Dark block values (colors only — shape/type don't redeclare):
paper `#141519`, paper-raised `#1a1b20`, paper-sunken `#1f2024`, band
`#26272b`, ink `#ecebe4`, ink-2 `#a4a5aa`, ink-3 `#6f7177`, hairline
`#2e2f34`, hairline-strong `#ecebe4`, brand `#2a2bdc`, brand-deep `#1b16b8`,
brand-strong `#8691f7`, brand-ink `#f5f6ff`, highlight `#2c3384`, alarm
`#ee6a52`, caution `#e3b341`, lift/lift-hover `0 0 0 0 rgb(0 0 0 / 0)`,
press-cast `rgb(0 0 0 / 0.5)`.

In `src/styles.css` add directly after line 3's tokens import:
`@import "./skin/skins/boxscore.css";`

**Verify**: `bun run build` → exit 0. In the dev app run
`document.documentElement.setAttribute("data-skin","boxscore")` in the
console → page turns paper-white/blue with square cards; removing the
attribute restores Ledger exactly.

### Step 5: theme-color meta sync

In `RootDocument` (`src/routes/__root.tsx`), add a `useEffect` keyed on
`useSkin()` + `useTheme().resolved` that rewrites both `meta[name=theme-color]`
elements' `content`: ledger `#f7f4ea`/`#14161a`, boxscore `#fbfaf6`/`#141519`.
Leave the SSR'd meta values (Ledger) as-is for first paint.

**Verify**: `bun run typecheck` → exit 0.

### Step 6: /account Appearance section + picker

In `src/routes/account.tsx`, insert a new section between the header and
"Agent tokens": `h2` labeled `Appearance` (match the mono-caps section-header
classes quoted in Current state), containing a two-option segmented control
labeled `Ledger` / `Box Score` bound to `useSkin()` — structure and classes
modeled on `src/components/theme-toggle.tsx` (`role="radiogroup"`, pill
buttons, `mounted` guard for SSR agreement).

**Verify**: `bun run typecheck && bun run lint` → exit 0. In dev: `/account`
shows the control; toggling reskins instantly and survives reload (pre-paint,
no flash: hard-reload with boxscore selected must not flash cream).

### Step 7: tests

Create `src/skin/skin.test.mjs` modeled on `src/skin/brand.test.mjs`
(node:test + readFileSync source assertions):

1. `styles.css` contains `var(--r-xs)` and `var(--font-stack-sans)` and does
   NOT contain `--radius-xs: 8px`.
2. `tokens.css` defines all of: `--r-xs --r-sm --r-md --r-lg --r-xl --r-pill
   --font-stack-display --font-stack-sans --font-stack-mono`.
3. `skins/boxscore.css` defines every name in the full contract list (loop
   over: paper, paper-raised, paper-sunken, band, ink, ink-2, ink-3,
   hairline, hairline-strong, brand, brand-deep, brand-strong, brand-ink,
   highlight, alarm, caution, lift, press-cast, r-pill, font-stack-sans).
4. `theme.ts` exports `SKIN_KEY` = `"ledger-skin"` and `NO_FLASH_SCRIPT`
   mentions `data-skin`.

**Verify**: `bun test src/skin` → all pass (existing brand tests included).

### Step 8: rewrite src/skin/SKILL.md

Replace the fork-and-edit + grok.me content: document (a) the three-layer
token system, (b) how to author a new skin = one CSS file defining the Step 4
contract under `[data-skin="<name>"]` + registering the pref value, (c) keep
the existing "Do not edit" engine/auth list verbatim. DELETE: Grok install
tutorial references, host-slug PWA naming, `git merge -X ours` fork guidance.
Do NOT delete anything about the manifest or `public/__grok` file mechanics —
they are load-bearing (PWA install path).

**Verify**: `grep -ci "grok.me" src/skin/SKILL.md` → `0`.

## Test plan

Covered by Step 7 (contract tests) + existing suite. Manual: screenshot pass
with agent-browser (per your environment rules) of `/` and a league standings
page in ledger-light, ledger-dark, boxscore-light, boxscore-dark; ledger
shots must be indistinguishable from pre-change (this is the no-regression
gate for Steps 1–2; capture "before" shots before Step 1).

## Done criteria

- [ ] `bun run typecheck`, `bun run lint`, `bun test src scripts`, `bun run build` all exit 0
- [ ] `grep -rn "data-skin" src/lib/theme.ts src/skin | wc -l` ≥ 3
- [ ] `grep -n "radius-xs: 8px" src/styles.css` → no matches
- [ ] Ledger before/after screenshots indistinguishable
- [ ] Boxscore toggles live from `/account`, persists, no first-paint flash
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` row updated

## STOP conditions

- Drift check shows changes to `src/styles.css` or `src/skin/tokens.css`
  that contradict the Current state excerpts.
- After Step 2 the dev app's radii or fonts visibly change in Ledger →
  the `@theme inline` var indirection is not resolving; STOP, report, do not
  work around with duplicate literals.
- Plan 048 has already modified `src/routes/account.tsx` (check
  `git log --oneline -3 -- src/routes/account.tsx`) → STOP and report the
  ordering conflict.
- Any step seems to require editing a component `.tsx` classname → that is
  Phase C (a later plan); STOP.

## Maintenance notes

- **Deferred follow-ups** (write as plans 049/050 after this lands, per the
  operator's "flourishes ship with first Box Score release" decision — the
  release is not cut until they land): (1) voice codemod — `.microlabel` /
  `.field-label` / `.card` utilities replacing ~155 `uppercase tracking-[`
  sites and ~94 `shadow-[var(--shadow-border)]` sites, plus per-skin `.push`
  and `.hl`; re-census counts first. (2) Box Score flourishes — `GhostNum`
  component (new; zero refs today), slot rails, agate spec tables, recap
  stamp, all gated on `[data-skin="boxscore"]`; spec against the canvas.
- `data-accent` remains a Ledger-internal knob; skin file order in
  `styles.css` is what beats it — a reviewer reordering imports breaks that.
- Reviewer scrutiny: the NO_FLASH_SCRIPT string (it is un-typechecked JS in a
  string) and the Step 2 diff being value-for-value.

## Decisions log (operator, 2026-08-19/20)

Per-user pref only · accent knob kept · Ledger default · Box Score fonts =
Helvetica system stack per the mocks · flourishes ship with the first Box
Score release (via follow-up plans) · SKILL.md rewritten, grok.me pruned,
PWA untouched.
