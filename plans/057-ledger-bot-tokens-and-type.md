# Plan 057: Ledger default theme — x.ai/bot tokens, Geist type, ringed cards, no shadows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d370e29..HEAD -- src/skin/tokens.css src/styles.css src/routes/__root.tsx src/components/live-line.tsx src/components/shell.tsx src/skin/skin.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (CSS tokens only; every component reads tokens by reference; Box Score skin overrides every token it touches and must stay pixel-identical)
- **Depends on**: none
- **Category**: direction (design polish)
- **Planned at**: commit `d370e29`, 2026-08-22

## Why this matters

Ryan wants the default "Ledger" theme to read like https://x.ai/bot: white ground, white cards with a 1px hairline ring, 24px corners and no shadows, on an off‑white ground, near‑black ink, a sober green kept only as the identity colour, 500‑weight display type, and Geist/Geist Mono. The design session's artifact (https://claude.ai/code/artifact/4e0119fb-6b78-48ec-9a77-abaf4c55675e, variant "Bot B · ringed cards") is the reference. Decisions locked by Ryan: eyebrows switch from mono tracked caps to sans caps (match the mocks), ship as the **default** (edit `:root`, not a new skin), Geist over Plus Jakarta. Ryan picked variant **B** (off-white ground, white cards with a 1px hairline ring, no shadow); advisor's call accepted by default: `.push` retired in Ledger (primary button becomes a flat ink pill — done in plan 058; this plan only zeroes the `.push` shadow so existing primaries already look flat).

The skin contract (`src/skin/SKILL.md`) puts every literal in `src/skin/tokens.css` and maps them by reference in `src/styles.css` `@theme inline`. So ~90% of the look is this plan: rewrite the token blocks, zero the lift shadow, swap the font link, retune heading weight and the eyebrow voice, fix the three places that hardcode old Ledger literals.

## Current state

Files:

- `src/skin/tokens.css` — the ONLY place raw colour/shadow/radius/font literals live. Light `:root` block (lines 4–46), dark via media query (48–75), dark via attribute (77–102), blue accent ramp ×3 blocks (104–133). **Every token must be defined in both dark blocks** (media + attribute).
- `src/styles.css` — `@theme inline` map (33–75), base rules (77–135), `.hl` highlighter, `.push` (182–213), motion, `@layer components` with `.microlabel` / `.microlabel-data` / `.ring-card` (315–339) and the boxscore overrides (341–375+).
- `src/routes/__root.tsx` — Google Fonts `<link>` (lines 51–56), `theme-color` metas (35–36), `THEME_COLOR` map (62–65).
- `src/components/live-line.tsx` — `TOKEN_FALLBACK` (lines 83–87) duplicates old Ledger hexes.
- `src/components/shell.tsx:189` — live‑dot halo hardcodes the dark alarm colour: `sm:shadow-[0_0_0_3px_rgb(228_112_90/0.18)]`.
- `src/skin/skin.test.mjs` — source‑assertion tests for the contract (must keep passing; do not weaken).
- `src/skin/skins/boxscore.css` — the second skin; **out of scope, must not change** (it redeclares every token it needs, so it is unaffected by `:root` edits — verify visually).

### tokens.css today (light `:root`, lines 4–46 — abridged, values exact)

```css
:root {
  --paper: #f7f4ea;  --paper-raised: #fffdf7;  --paper-sunken: #f0ece0;  --band: #f2eee2;
  --ink: #17191d;  --ink-2: #5b5e60;  --ink-3: #8a8b83;
  --hairline: #e4dfd1;  --hairline-strong: #d2ccba;
  --brand: #6fdc93;  --brand-deep: #3fa765;  --brand-strong: #1d7a45;  --brand-ink: #12251a;  --highlight: #a9e9bd;
  --alarm: #c8503a;  --caution: #c4921a;
  --lift: 0 10px 26px -16px rgb(23 25 29 / 0.3);
  --lift-hover: 0 16px 34px -18px rgb(23 25 29 / 0.4);
  --press-cast: rgb(63 167 101 / 0.4);
  --r-xs: 8px; --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 22px; --r-pill: 999px;
  --font-stack-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-stack-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-stack-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}
```

Dark (both blocks, lines 48–75 and 77–102, identical values):
`--paper #14161a; --paper-raised #1b1e22; --paper-sunken #23272c; --band #1a1d21; --ink #f2f1ea; --ink-2 #a8aba6; --ink-3 #7a7e7b; --hairline #2b2f34; --hairline-strong #3a3f45; --brand #64d68c; --brand-deep #2f8f55; --brand-strong #7fe3a2; --brand-ink #0e1f15; --highlight #2c5c3e; --alarm #e4705a; --caution #e3b341; --lift 0 10px 26px -16px rgb(0 0 0 / 0.7); --lift-hover 0 16px 34px -18px rgb(0 0 0 / 0.8); --press-cast rgb(0 0 0 / 0.5)`.

Blue accent ramp (lines 104–133) overrides only `--brand*`, `--highlight`, `--press-cast`. Keep its structure; it stays as is.

### styles.css today (relevant lines)

```css
/* 69–71 */
  --shadow-border: 0 0 0 1px var(--hairline), var(--lift);
  --shadow-border-hover: 0 0 0 1px var(--hairline-strong), var(--lift-hover);
  --shadow-lift: var(--lift);

/* 108–114 */
  h1, h2, h3 {
    text-wrap: balance;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

/* 182–213  .push — 4px solid edge + cast, hover lift, :active press */
.push {
  box-shadow:
    0 4px 0 0 var(--brand-deep),
    0 6px 12px -3px var(--press-cast);
  ...
}

/* 316–329 */
  .microlabel {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--ink-3);
  }
  .microlabel-data {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-3);
  }
  /* 331–339 */
  .ring-card { box-shadow: var(--shadow-border); }
  .ring-card-h:hover { box-shadow: var(--shadow-border-hover); }
  .ring-card-lit { box-shadow: var(--shadow-border-hover); }

/* 369–375 — the existing pattern for neutralising .push in a skin */
  [data-skin="boxscore"] .push,
  [data-skin="boxscore"] .push:hover:not(:disabled),
  [data-skin="boxscore"] .push:active:not(:disabled),
  [data-skin="boxscore"] .push:disabled {
    transform: none;
    box-shadow: none;
  }
```

### __root.tsx today

```tsx
// 35–36
{ name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f7f4ea" },
{ name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#14161a" },
// 51–56
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
},
// 62–65
const THEME_COLOR = {
  ledger: { light: "#f7f4ea", dark: "#14161a" },
  boxscore: { light: "#fbfaf6", dark: "#141519" },
} as const;
```

### live-line.tsx today (83–87)

```ts
const TOKEN_FALLBACK: Record<string, string> = {
  "--brand": "#6fdc93",
  "--ink-3": "#8a8b83",
  "--alarm": "#c8503a",
};
```

### shell.tsx:189 today

```tsx
className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-live ring-2 ring-bg sm:static sm:ml-0.5 sm:ring-0 sm:shadow-[0_0_0_3px_rgb(228_112_90/0.18)]"
```

### Conventions

- Literals only in `tokens.css`; `styles.css` names tokens by `var()`; components name Tailwind utilities (`bg-surface`, `text-faint`, `rounded-xl`, `ring-card`, `microlabel`). See `src/skin/SKILL.md`.
- Biome is the formatter/linter (`biome.json` has `css.parser.tailwindDirectives: true`). **Never run `bun run lint:fix` bare** — it rewrites the whole repo. Scope: `bunx biome check --write <file>`.
- Commit messages: conventional, imperative, no AI attribution, no "sprint/phase/plan" words. Recent examples: `fix(live): demo-scale window for the matchup chart and drawer line`, `feat(book): line-movement strip in the line panel and ticket`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint (check only) | `bun run lint` | exit 0 (pre-existing errors only in skin‑contract do‑not‑edit files; count must not grow) |
| Tests (clean DB dir; dev server may hold PGLite) | `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` | same pass count as before (319/325 at `d370e29`; the 6 fails are pre-existing db/net) |
| Skin contract tests only | `bun test src/skin` | all pass |
| Build | `bun run build:dev` | exit 0 |
| Dev server (already running on :8080 usually) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 |
| Visual QA | `~/.bun/bin/agent-browser` (see Step 7) | screenshots saved |

## Suggested executor toolkit

- `agent-browser` for screenshots (run with the Bash sandbox disabled; `agent-browser skills get core --full` first). Login is prefilled on `/login` (just click Sign in). League id: `lg_65h3kyr5up`.

## Scope

**In scope** (the only files you should modify):
- `src/skin/tokens.css`
- `src/styles.css`
- `src/routes/__root.tsx` (only lines 35–36, 51–56, 62–65 — font link + theme-color)
- `src/components/live-line.tsx` (only `TOKEN_FALLBACK`)
- `src/components/shell.tsx` (only the live‑dot halo class on line 189)
- `src/skin/skin.test.mjs` (add assertions only — see Test plan)

**Out of scope** (do NOT touch):
- `src/skin/skins/boxscore.css` — the other skin; it must remain pixel‑identical.
- Any component file other than the two single‑line leak fixes above. Button/badge/segmented/nav/input changes are plan 058; mobile layout is plan 059.
- `src/lib/theme.ts`, `NO_FLASH_SCRIPT`, `/account` skin picker — unchanged.
- `public/__grok/**`, `scripts/install-page.html`, `scripts/grok-pwa-*.mjs`, `server/middleware/grok-pwa.ts`, `src/lib/league/engine.server.ts`, `src/lib/auth/**` — skin‑contract do‑not‑edit list.
- `src/routeTree.gen.ts` — generated.

## Git workflow

- Work directly on the current branch (`main`), one commit for the whole plan (or two: tokens+styles, then leaks).
- Message style: `feat(skin): ledger reads like x.ai/bot — off-white ground, ringed cards, Geist` (imperative; no AI attribution; no "plan/sprint" words).
- Do NOT push.

## Steps

### Step 1: Rewrite the Ledger light block in `src/skin/tokens.css`

Replace the values in the `:root` block (keep every token name, keep comments, keep the order) with:

```css
:root {
  /* surface — off-white ground, white ringed cards (x.ai/bot, variant B) */
  --paper: #fafaf8;
  --paper-raised: #ffffff;
  --paper-sunken: #f3f2ef;
  --band: #f6f5f2;

  /* ink */
  --ink: #0a0a0a;
  --ink-2: #5c6066;
  --ink-3: #7d8187;

  /* structure — ink at ~8% / ~15% on white, flattened to hex */
  --hairline: #e9e9e6;
  --hairline-strong: #d6d6d3;

  /* identity — green (mint for lines/meters/tints, sober green for text-on-tint) */
  --brand: #6fdc93;
  --brand-deep: #3fa765;
  --brand-strong: #1f8a65;
  --brand-ink: #0f2a1b;
  --highlight: #b6ecc7;

  --alarm: #e0532f;
  --caution: #b26a00;

  /* no card shadow in Ledger — the edge is the 1px ring */
  --lift: 0 0 0 0 rgb(0 0 0 / 0);
  --lift-hover: 0 0 0 0 rgb(0 0 0 / 0);
  --press-cast: rgb(0 0 0 / 0);

  --r-xs: 10px;
  --r-sm: 12px;
  --r-md: 16px;
  --r-lg: 20px;
  --r-xl: 24px;
  --r-pill: 999px;
  --font-stack-display: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-stack-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-stack-mono: "Geist Mono", ui-monospace, Menlo, monospace;
}
```

Keep the existing comment about the alarm colour ("the only alarm colour…") — just update values.

**Verify**: `grep -c "#fafaf8\|#ffffff\|#0a0a0a" src/skin/tokens.css` → ≥ 3; `grep -n "Plus Jakarta\|JetBrains" src/skin/tokens.css` → no output.

### Step 2: Rewrite BOTH dark blocks in `tokens.css`

Apply the identical value set to the `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` block AND the `[data-theme="dark"] {…}` block:

```css
    --paper: #0d0d0d;
    --paper-raised: #161616;
    --paper-sunken: #202020;
    --band: #121212;

    --ink: #ededed;
    --ink-2: #a3a6aa;
    --ink-3: #7b7f85;

    --hairline: #262626;
    --hairline-strong: #363636;

    --brand: #5fd48a;
    --brand-deep: #2f8f55;
    --brand-strong: #7fe3a2;
    --brand-ink: #0b1f14;
    --highlight: #234c33;

    --alarm: #ef6b4f;
    --caution: #e3a33b;

    --lift: 0 0 0 0 rgb(0 0 0 / 0);
    --lift-hover: 0 0 0 0 rgb(0 0 0 / 0);
    --press-cast: rgb(0 0 0 / 0);
```

Leave the blue accent ramp blocks (lines ~104–133) untouched.

**Verify**: `grep -c "\-\-paper: #0d0d0d" src/skin/tokens.css` → `2`; `grep -c "\-\-lift: 0 0 0 0" src/skin/tokens.css` → `3`.

### Step 3: `src/styles.css` — ringed card edge, heading weight, eyebrow voice, retire `.push` in Ledger

3a. Card edge. Change lines 69–71 to a pure ring whose colour is a token (variant B = 1px hairline ring, no lift; Box Score keeps its own border rules):

```css
  --shadow-border: 0 0 0 1px var(--card-ring, transparent), var(--lift);
  --shadow-border-hover: 0 0 0 1px var(--card-ring-hover, var(--hairline-strong)), var(--lift-hover);
  --shadow-lift: var(--lift);
```

and add to **tokens.css** (all three Ledger blocks: light + both dark) right after `--hairline-strong`:

```css
  /* card edge ring: a hairline at rest, stronger on hover. Set transparent for a flat skin. */
  --card-ring: var(--hairline);
  --card-ring-hover: var(--hairline-strong);
```

(Why a new token instead of leaving `var(--hairline)` inline: it makes "flat vs ringed" a one-token skin decision later. ~111 `ring-card` sites also use `ring-card-h` for hover; hover now shows `hairline-strong`. Box Score overrides `.ring-card` entirely in styles.css:357–367, so it is unaffected — do NOT add the token to `boxscore.css`.)

3b. Headings (lines 108–114): `font-weight: 700` → `font-weight: 500`; `letter-spacing: -0.025em` → `-0.02em`.

3c. Eyebrow voice (lines 316–329):

```css
  .microlabel {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-3);
  }
  .microlabel-data {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-3);
  }
```

(`.microlabel-data` stays mono — it labels figures.)

3d. Retire `.push` in Ledger. Keep the `.push` rules (Box Score and any future skin may re‑enable), but make the **default** flat by making the rules read tokens that are now zero: change the three `box-shadow` declarations in `.push`, `.push:hover`, `.push:active`, `.push:disabled` so the solid edge uses `var(--push-edge, var(--brand-deep))` and add in tokens.css (all three Ledger blocks, next to `--press-cast`): `--push-edge: transparent;`. Also set `transform` on `.push:hover:not(:disabled)` / `.push:active:not(:disabled)` to `translateY(0)` when `--push-lift` is zero — simplest faithful approach: replace the hover transform with `transform: translateY(var(--push-hover-y, -2px));` and the active one with `transform: translateY(var(--push-press-y, 3px));`, and add `--push-hover-y: 0px; --push-press-y: 0px;` to the three Ledger token blocks. Net: in Ledger a `.push` element has no edge, no cast, no motion; the class remains for skins.

Update the header comment above `.push` to say Ledger zeroes it via tokens.

3e. Update the file‑header prose (lines 11–29) one line: "Cream paper" → "Off-white paper, white ringed cards".

**Verify**: `bun test src/skin` → all pass (the contract test asserts `.microlabel {`, `.ring-card {`, `[data-skin="boxscore"] .push` — all still present). `grep -n "card-ring\|push-edge\|push-hover-y" src/styles.css src/skin/tokens.css | wc -l` → ≥ 9.

### Step 4: Fonts — `src/routes/__root.tsx` lines 51–56

Replace the stylesheet href with:

```
https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap
```

(Verified 2026‑08‑22: this URL returns 200 with `font-family: 'Geist'` and `'Geist Mono'`.) Keep both preconnects.

**Verify**: `grep -n "Geist" src/routes/__root.tsx` → 1 line; `grep -n "Jakarta" src/routes/__root.tsx` → none.

### Step 5: theme-color — `src/routes/__root.tsx` lines 35–36 and 62–65

- meta light `#f7f4ea` → `#fafaf8`; meta dark `#14161a` → `#0d0d0d`.
- `THEME_COLOR.ledger` → `{ light: "#fafaf8", dark: "#0d0d0d" }`. Leave `boxscore` as is.

**Verify**: `grep -n "#f7f4ea\|#14161a" src/routes/__root.tsx` → none.

### Step 6: Leak fixes

- `src/components/live-line.tsx` `TOKEN_FALLBACK` → `"--brand": "#6fdc93", "--ink-3": "#7d8187", "--alarm": "#e0532f"`.
- `src/components/shell.tsx:189`: replace `sm:shadow-[0_0_0_3px_rgb(228_112_90/0.18)]` with `sm:shadow-[0_0_0_3px_color-mix(in_oklab,var(--alarm)_18%,transparent)]`.

**Verify**: `grep -rn "228_112_90\|#8a8b83\|#c8503a" src/components` → none. `bun run typecheck` → exit 0. `bunx biome check src/components/live-line.tsx src/components/shell.tsx src/routes/__root.tsx` → no new errors.

### Step 7: Visual QA (both modes, both skins) + gate

1. `bun run typecheck` → 0; `bun run lint` → error count not above baseline (10 at `d370e29`, all in contract files); `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` → 319 pass (same 6 pre‑existing fails); `bun run build:dev` → exit 0.
2. Dev server: if `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` is not 200, start `nohup bun run dev > /tmp/claude-501/dev.log 2>&1 &` and wait for 200 (if it dies with a PGLite WAL error, run `bun run db:repair` once and retry).
3. With agent-browser (sandbox disabled): open `http://localhost:8080/login`, click **Sign in**, then screenshot `http://localhost:8080/league/lg_65h3kyr5up` and `/league/lg_65h3kyr5up/matchups` at viewport 1440×900 and 390×844, in light and dark (toggle via `localStorage.setItem("ledger-theme","dark")` + reload, then `removeItem`), and once with `localStorage.setItem("ledger-skin","boxscore")` + reload. Save to the session scratchpad.
4. Check by eye: off-white ground, white cards with a 1px hairline ring and no shadow; Geist renders (headings 500); eyebrows sans caps; Box Score unchanged (cream `#fbfaf6`, square corners, Helvetica); dark = `#0d0d0d` ground / `#161616` cards with a `#262626` ring.

**Verify**: screenshots exist; report any surface that still shows a shadow or the old cream.

## Test plan

- Extend `src/skin/skin.test.mjs` with one test, modelled on the existing `tokens.css defines the raw shape + type knobs` test:
  - `"ledger default tokens are the x.ai/bot cut"` — assert `tokens.css` matches `/--paper:\s*#fafaf8/`, `/--paper-raised:\s*#ffffff/`, `/--font-stack-sans:\s*"Geist"/`, `/--font-stack-mono:\s*"Geist Mono"/`, `/--r-xl:\s*24px/`, `/--card-ring:/` (≥3 occurrences), `/--push-edge:/` (≥3 occurrences); and `styles.css` matches `/\.microlabel\s*\{[^}]*font-family:\s*var\(--font-sans\)/s` and `/h1,\s*h2,\s*h3\s*\{[^}]*font-weight:\s*500/s`.
  - `"__root.tsx loads Geist and stamps the Ledger theme-color"` — assert `src/routes/__root.tsx` matches `/family=Geist/`, `/#fafaf8/`, `/#0d0d0d/`, and does not match `/Jakarta|JetBrains/`.
- Verification: `bun test src/skin` → all pass incl. 2 new.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test src/skin` passes incl. the 2 new tests
- [ ] `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` → pass count ≥ 319, no new failures
- [ ] `bun run build:dev` exits 0
- [ ] `grep -rn "Jakarta\|JetBrains" src` → no matches
- [ ] `grep -rn "228_112_90\|#8a8b83\|#c8503a\|#f7f4ea\|#14161a" src` → no matches
- [ ] `git diff --stat d370e29..HEAD -- src/skin/skins/boxscore.css` → empty
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] Screenshots captured for light/dark × desktop/mobile + boxscore; Box Score visually unchanged
- [ ] `plans/README.md` status row updated (skip if reviewer maintains the index)

## STOP conditions

Stop and report back if:

- The excerpts in "Current state" don't match the live code (drift).
- `bun test src/skin` fails for a reason other than the two new tests you are adding.
- A `bg-raised`/`bg-surface` element that sits *inside* a card now reads white-on-white (e.g. an input, the segmented track) — list them in NOTES; do not fix component files (that is plan 058).
- The Google Fonts URL does not return Geist (network issue) — do not self-host; report.
- Box Score renders differently after your change (it should not; if it does, a token you added lacks a boxscore override — report which).

## Maintenance notes

- Adding any token to `tokens.css` means adding it to **three** Ledger blocks (light, dark‑media, dark‑attr); if a skin should differ, also to the three blocks in that skin's file.
- `--card-ring` / `--push-edge` / `--push-hover-y` / `--push-press-y` are new knobs; Box Score ignores them because it overrides `.ring-card` and `.push` outright (styles.css:357–375). A future flat skin sets `--card-ring: transparent`.
- Reviewer: scan `git diff` for any literal colour outside `tokens.css`; confirm the 2 `theme-color` metas match `--paper` in both modes.
- Deferred to 058: primary button → ink pill, badge/segmented/nav/input recipes. Deferred to 059: mobile layout fixes.
