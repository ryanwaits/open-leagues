# Plan 050: Box Score flourishes — ghost numerals, slot rails, stamp

> **Executor instructions**: Follow step by step; verify each step before the
> next. STOP conditions are binding. Reviewer maintains `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 06091c8..HEAD -- src/styles.css src/skin src/components/lineup-board.tsx src/components/player-profile.tsx src/routes/scores.tsx 'src/routes/league/**'`
> Non-empty → compare Current state excerpts; mismatch → STOP.

## Status

- P2 · Effort M · Risk LOW (all additions gated on `[data-skin="boxscore"]`;
  Ledger must not change by one pixel)
- Depends on: 047 (skin axis) + 049 (voice classes) — both DONE
- Planned at: commit `06091c8`, 2026-08-20

## Why this matters

047 gave Box Score its tokens, 049 its voice. What's left is the layer that
makes it feel designed rather than themed — the signature details from the
Box Score design canvas: a giant faded numeral behind page heroes, gray
plate "rails" on lineup slot labels, and a rotated red OFFICIAL RECORD stamp
reserved for the weekly recap. All are additive and invisible in Ledger.
This is the last plan before the Box Score release is cut.

## Current state

- `src/skin/skins/boxscore.css` — the skin token file (light block +
  two dark blocks). Add a `--ghost` token here (light `#eceae2`, dark
  `#1d1e23`) in all three blocks.
- `src/styles.css` — has the 049 `@layer components` block (`.microlabel`,
  `.microlabel-data`, `.ring-card`, `.ring-card-h`, `.ring-card-lit`,
  boxscore overrides). Extend that block.
- `src/components/lineup-board.tsx:206` — starter slot label:
  `<span className="w-9 shrink-0 microlabel-data">{label}</span>`
  (line 280 is the BENCH position label — leave it alone).
- `src/components/player-profile.tsx` — `ProfileIdentity` renders the hero
  (avatar + h1 + role line); `player.number` (jersey) is available on
  `SlimPlayer`. `Stat` cells already read agate via `microlabel-data`
  (line ~102) — no table work needed in this plan.
- `src/routes/scores.tsx` — page header block contains the `h1` ("NFL
  scores"); `resolvedWeek` is in scope in the component.
- `src/routes/league/$leagueId/recap.tsx:73-76` — lead article header:
  `<p className="microlabel">{lead.kicker}</p>` then the `hl` headline.
  A `week` value is in scope on the page (search param / current week).
- Test exemplar: `src/skin/skin.test.mjs`.
- Convention: components hold NO skin conditionals — skin gating lives in
  CSS (`display:none` by default, visible under `[data-skin="boxscore"]`).

## Commands

Same as plans 047–049: `bun run typecheck` (0) · `bun test src scripts`
(pass; 1 baseline `import.meta.glob` error; `bun run db:repair` if a PGLite
WAL error appears) · `bun run build` (0; writes gitignored data/pglite) ·
scoped `npx biome check` (no NEW findings; repo-wide lint is known-red) ·
dev on :8080 (a server may already run — reuse).

## Scope

**In**: `src/styles.css` · `src/skin/skins/boxscore.css` ·
`src/components/ghost-num.tsx` (create: `GhostNum` + `Stamp`) ·
`src/components/player-profile.tsx` (mount) · `src/routes/scores.tsx`
(mount) · `src/routes/league/$leagueId/recap.tsx` (stamp mount) ·
`src/components/lineup-board.tsx` (one classname) · `src/skin/skin.test.mjs`.
**Out**: everything else — no other mounts, no engine/auth, no gates.tsx,
no Ledger-visible change anywhere, `plans/**`.

## Steps

### Step 1: tokens + CSS

`boxscore.css`: add `--ghost: #eceae2;` to the light block and
`--ghost: #1d1e23;` to BOTH dark blocks.

`styles.css` `@layer components` (extend the existing block):

```css
  /* Flourishes: invisible outside boxscore. */
  .ghost-host { position: relative; }
  .ghost-num, .stamp { display: none; }
  [data-skin="boxscore"] .ghost-host { overflow: hidden; }
  [data-skin="boxscore"] .ghost-num { display: block; position: absolute;
    right: -0.04em; top: -0.28em; z-index: 0; pointer-events: none;
    user-select: none; font-family: var(--font-stack-sans);
    font-weight: 700; font-size: clamp(88px, 16vw, 150px);
    letter-spacing: -0.05em; line-height: 1; color: var(--ghost); }
  [data-skin="boxscore"] .ghost-num ~ * { position: relative; }
  [data-skin="boxscore"] .slot-rail { display: flex; align-items: center;
    justify-content: center; align-self: stretch; background: var(--band);
    color: var(--ink); font-weight: 700; }
  [data-skin="boxscore"] .stamp { display: inline-block;
    transform: rotate(-7deg); border: 2px solid var(--alarm);
    color: var(--alarm); font-family: var(--font-stack-sans);
    font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
    text-transform: uppercase; padding: 4px 8px; opacity: 0.85; }
```

**Verify**: `bun run build` → exit 0.

### Step 2: components

Create `src/components/ghost-num.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** Giant faded numeral behind a page hero. Renders nothing outside the
 * boxscore skin (CSS-gated); parent needs the ghost-host class. */
export function GhostNum({ n, className }: { n: string | number | null | undefined; className?: string }) {
  if (n == null || n === "") return null;
  return <span aria-hidden className={cn("ghost-num", className)}>{n}</span>;
}

/** Rotated archival mark. Boxscore-only via CSS; reserve for earned moments. */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span aria-hidden className={cn("stamp", className)}>{children}</span>;
}
```

**Verify**: `bun run typecheck` → exit 0.

### Step 3: mounts (each = add `ghost-host` to the wrapper + one child)

1. `player-profile.tsx` `ProfileIdentity`: add `ghost-host` to the root
   flex div's className; render `<GhostNum n={player.number} />` as its
   FIRST child (jersey number; renders nothing when absent).
2. `scores.tsx`: add `ghost-host` to the header block containing the h1;
   `<GhostNum n={resolvedWeek} />` first child.
3. `recap.tsx` lead article header: `<Stamp>Official record · wk {week}</Stamp>`
   adjacent to the lead kicker `<p className="microlabel">` (before or
   above it, absolutely positioned is NOT needed — inline-block is fine);
   use the page's week value.
4. `lineup-board.tsx:206`: `className="w-9 shrink-0 microlabel-data"` →
   `className="w-9 shrink-0 microlabel-data slot-rail"` (starter rows only;
   line 280 bench label untouched).

**Verify**: `bun run typecheck` → exit 0; scoped biome → no NEW findings.

### Step 4: tests

Extend `src/skin/skin.test.mjs`:
- `styles.css` defines `.ghost-num`, `.slot-rail`, `.stamp`, `.ghost-host`.
- `skins/boxscore.css` defines `--ghost` at least 3 times (light + 2 dark).
- `ghost-num.tsx` exists and exports `GhostNum` and `Stamp`.
- `player-profile.tsx` contains `GhostNum`; `recap.tsx` contains `Stamp`;
  `lineup-board.tsx` contains `slot-rail`.

**Verify**: `bun test src/skin` all pass; `bun test src scripts` pass.

### Step 5: browser verification (agent-browser, sandbox disabled)

Seed sign-in; league `lg_65h3kyr5up` exists (WIFFL).
- **Ledger first** (default skin): player page, scores, roster, recap —
  screenshot; NO ghost numerals, NO rails, NO stamp, layout identical.
- **Box Score** (toggle at /account), light + dark: scores page shows the
  faded week numeral behind the header; a player profile shows the jersey
  ghost (pick a player with a number; if none has one, state it and rely on
  the scores mount); lineup slot labels render as gray plates; recap shows
  the rotated red stamp (if no recap exists for the seed week, state it and
  verify the Stamp renders via the component test only).

## Done criteria

- [ ] typecheck / `bun test src scripts` / build exit 0
- [ ] `git status`: only the 8 in-scope files modified
- [ ] Ledger screenshots show zero visual change
- [ ] Box Score light+dark show ghost numeral (scores at minimum), rails,
      and stamp (or honestly-reported seed-data gaps)

## STOP conditions

- Any flourish requires a skin conditional in a component (`useSkin()` in
  markup) → STOP; the gating must stay in CSS.
- `ghost-host` overflow clips something in LEDGER (it must not — the
  overflow rule is boxscore-scoped; if you see clipping in Ledger, the CSS
  landed unscoped) → STOP.
- The recap page's week value isn't reachable where the stamp mounts →
  mount the Stamp with static "Official record" text instead and note it;
  if even that requires restructuring, STOP.
- Any out-of-scope file needs edits → STOP.

## Maintenance notes

- More ghost mounts (wire FAAB, draft round, home week) are one-liners —
  add in later polish, not here.
- The stamp is reserved: recap lead only. Resist scattering it.
- Reviewer scrutiny: z-index/stacking at ghost mounts (the `~ *` sibling
  rule), and that line 280 bench label stayed rail-free.
