# Plan 049: Voice codemod — semantic label/card classes so skins own their voice

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the expected result before the next step. On any STOP
> condition, stop and report — do not improvise. Reviewer maintains
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 505ccb2..HEAD -- src/styles.css src/skin 'src/**/*.tsx'`
> Non-empty → compare Current state excerpts before proceeding; mismatch → STOP.

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: MED (wide shallow diff; no logic)
- **Depends on**: plan 047 (DONE `303e7a0` — skin axis + tokens exist)
- **Category**: tech-debt / dx
- **Planned at**: commit `505ccb2`, 2026-08-20

## Why this matters

047 made tokens (colors/radii/fonts) swap per skin, but a skin's VOICE is
hardcoded inline ~260 times: mono-caps micro-labels, the lifted-ring card
recipe, the 3D `.push` button. Box Score therefore renders as "Ledger in
blue" — Courier shouting caps, push edges under blue pills. This plan names
the recipes once (`.microlabel`, `.microlabel-data`, `.ring-card`,
`.ring-card-h`) and gives `[data-skin="boxscore"]` its own definitions:
italic kickers, agate caps, ink-ruled cards, flat pills. Ledger must remain
visually equivalent (see Normalization).

## Current state (census at `505ccb2` — re-verify counts before editing)

- Micro-label recipes in `src/**/*.tsx` (~260 sites), all shaped
  `font-mono text-[Npx] uppercase tracking-<T>[ text-faint|text-muted]`:
  - 78× `text-[11px] … tracking-[0.16em] text-faint` · 16× `text-[11px] … tracking-wide`
  - 32× `text-[10px] … tracking-[0.12em] text-faint` · 22× `text-[10px] … tracking-wide`
  - tail: 9px/8.5px/10.5px sizes; tracking `[0.12em]/[0.14em]/[0.18em]`
  - Exemplar: `src/routes/account.tsx:24`
    `<p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">You</p>`
- Card ring: 96× `shadow-[var(--shadow-border)]` + 9× hover
  `shadow-[var(--shadow-border-hover)]` in `src/**/*.tsx`. Classes are often
  interleaved with padding utils — match the shadow class alone, not a
  contiguous recipe. Exemplar: `src/components/team-masthead.tsx:36`
  `className="grid grid-cols-4 rounded-xl bg-surface shadow-[var(--shadow-border)]"`.
- `.push` defined in `src/styles.css` (~line 187) with hover/active/disabled
  blocks; used in phase-hero, ui/button, slot-pts, player-feed, settings.
- `.hl` highlighter: token-driven (`var(--highlight)`) — 047's boxscore
  tokens already recolor it. NO change needed.
- `src/lib/auth/gates.tsx` has ZERO micro-label sites (verified) — stays
  untouched.
- `src/styles.css`: Tailwind v4; custom classes go in `@layer components`
  so utility classes (later layer) can still override color etc. inline.
- Radius is already per-skin (`--r-*`, 047) — do NOT touch radius utilities.
- Test exemplar: `src/skin/skin.test.mjs` (node:test source assertions).

## Normalization (deliberate, say so in the commit)

Variants collapse to two canonical roles:
- size 11px → `.microlabel` (kicker voice): mono 11px / caps / 0.16em / `--ink-3`
- size ≤10.5px → `.microlabel-data` (data/agate voice): mono 10px / caps / 0.12em / `--ink-3`
Ledger labels may shift ≤1px or ≤0.04em tracking. ALLOWED. Gate is
"visually equivalent", not byte-identical. Trailing `text-faint` is dropped
(class default); any OTHER color utility (`text-muted`, `text-accent-strong`,
`text-live`, …) is KEPT inline after the class.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src scripts` | pass (1 pre-existing `import.meta.glob` error is baseline) |
| Build | `bun run build` | exit 0 (chains db:migrate; writes gitignored `data/pglite`) |
| Lint | scoped `npx biome check <files>` | no NEW findings (repo-wide `bun run lint` is a known-red baseline) |
| Dev | `bun run dev` (:8080) | serves |

## Scope

**In**: `src/styles.css` · every `src/**/*.tsx` classname matching the two
recipes · `src/skin/skin.test.mjs` (extend).
**Out**: `src/lib/auth/gates.tsx`, all non-`.tsx` files, engine/league/push
logic, radius/font utilities, `.hl`, `plans/**`, canvas/scratch files.

## Git workflow

Branch main, conventional commits, do NOT push. One commit for CSS+tests,
one for the codemod sweep is fine.

## Steps

### Step 1: class definitions in styles.css

Append inside a new `@layer components` block (after the base layer):

```css
@layer components {
  /* The label voice. Skins own it; components only name the role. */
  .microlabel { font-family: var(--font-mono); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-3); }
  .microlabel-data { font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); }
  /* The card edge. Ledger: lifted ring. */
  .ring-card { box-shadow: var(--shadow-border); }
  .ring-card-h:hover { box-shadow: var(--shadow-border-hover); }

  [data-skin="boxscore"] .microlabel { font-family: var(--font-stack-sans);
    font-style: italic; font-size: 12px; text-transform: none;
    letter-spacing: 0; color: var(--ink); }
  [data-skin="boxscore"] .microlabel-data { font-family: var(--font-stack-sans);
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em;
    color: var(--ink-2); }
  [data-skin="boxscore"] .ring-card { box-shadow: none;
    border-top: 1.5px solid var(--hairline-strong);
    border-bottom: 1px solid var(--hairline-strong); }
  [data-skin="boxscore"] .ring-card-h:hover { box-shadow: none; }
  [data-skin="boxscore"] .push,
  [data-skin="boxscore"] .push:hover:not(:disabled),
  [data-skin="boxscore"] .push:active:not(:disabled),
  [data-skin="boxscore"] .push:disabled { transform: none; box-shadow: none; }
}
```

**Verify**: `bun run build` → exit 0.

### Step 2: codemod — card ring (mechanical, whole-word)

Across `src/**/*.tsx` (NOT gates.tsx — it has no sites, but keep the
exclusion explicit): replace class token
`shadow-[var(--shadow-border)]` → `ring-card`, and
`hover:shadow-[var(--shadow-border-hover)]` → `ring-card-h`.
If any `shadow-[var(--shadow-border-hover)]` remains without `hover:`
prefix, replace with `ring-card-h` too and note it.

**Verify**: `grep -rE 'shadow-\[var\(--shadow-border' src --include='*.tsx' | wc -l` → `0`.
`bun run typecheck` → exit 0.

### Step 3: codemod — micro-labels

Across `src/**/*.tsx`: replace each token run matching
`font-mono text-[<size>px] uppercase tracking-<T>` (+ optional trailing
` text-faint`) with:
- size 11 → `microlabel` · size 8.5/9/9.5/10/10.5 → `microlabel-data`
- drop trailing ` text-faint`; keep any other utilities in place.
Use ordered regex replaces (longest first) — e.g. perl:
`s/font-mono text-\[11px\] uppercase tracking-\[[0-9.]+em\] text-faint/microlabel/g`
then the no-color and tracking-wide forms, then the ≤10px family →
`microlabel-data`. After the sweep, hand-check any residuals.

**Verify**: `grep -rE 'font-mono text-\[[0-9.]+px\] uppercase' src --include='*.tsx' | wc -l` → `0`.
`bun run typecheck` → exit 0. Scoped biome on touched files → no NEW findings.

### Step 4: tests

Extend `src/skin/skin.test.mjs`:
1. `styles.css` defines `.microlabel`, `.microlabel-data`, `.ring-card`,
   and a `[data-skin="boxscore"] .push` block.
2. Zero-residual asserts (read all `src/**/*.tsx`): no
   `shadow-[var(--shadow-border` and no `font-mono text-[` +`uppercase` runs.
3. Spot assert: `src/components/team-masthead.tsx` contains `ring-card`;
   `src/routes/account.tsx` contains `microlabel`.

**Verify**: `bun test src/skin` → all pass; then `bun test src scripts` → pass.

### Step 5: browser verification (agent-browser, sandbox disabled)

Dev server; sign in (seed creds prefilled on /login).
- Ledger `/account` + a league standings page: compare against pre-codemod
  screenshots — visually equivalent (≤1px label-size normalization allowed;
  layout, colors, cards, buttons unchanged).
- Toggle Box Score: labels render italic sans (kickers) / small bold agate
  caps (data), cards show top+bottom ink rules with no drop shadow, the
  primary buttons are flat (no 3D edge), in light AND dark.

## Done criteria

- [ ] typecheck / `bun test src scripts` / build all exit 0
- [ ] Residual greps (Steps 2–3) both `0`
- [ ] `git status`: only styles.css + `.tsx` files + skin.test.mjs modified
- [ ] Ledger visually equivalent; Box Score shows the new voice (screenshots)
- [ ] gates.tsx untouched (`git diff --name-only | grep gates` → empty)

## STOP conditions

- styles.css `@layer components` classes fail to apply (check specificity
  vs utilities) — STOP, do not sprinkle `!important`.
- A replace would change a non-className string (comment, test fixture) —
  skip that site, list it in NOTES.
- Any file outside scope needs edits → STOP.
- Residual grep still nonzero after hand-check and the leftovers are NOT
  legitimate (e.g. a deliberately different recipe) → STOP and list them.

## Maintenance notes

- New components must use `.microlabel`/`.microlabel-data`/`.ring-card`,
  never the old inline recipes — the zero-residual test enforces it.
- Plan 050 (ghost numerals, slot rails, agate spec tables, recap stamp)
  builds on these classes.
- Reviewer scrutiny: sites where `text-faint` was dropped but a sibling
  utility depended on ordering; boxscore card rules on odd hosts (toasts).
