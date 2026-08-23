# Plan 058: Ledger primitives in the x.ai/bot voice — ink primary, sans badges, ink segmented thumb, 500-weight nav and headings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <057-landed SHA>..HEAD -- src/components/ui src/components/shell.tsx src/components/league-switcher.tsx src/components/theme-toggle.tsx src/routes/account.tsx src/components/lineup-board.tsx src/components/matchup-edge.tsx src/components/phase-hero.tsx src/components/install-drawer.tsx src/components/player-sheet.tsx src/components/header-menu.tsx src/components/claim-dialog.tsx src/components/trade-composer.tsx src/components/draft-trade-drawer.tsx src/components/wager-ticket.tsx src/routes/__root.tsx src/components/move-row.tsx`
> (Use the SHA recorded for plan 057 in `plans/README.md`.) If any in-scope
> file changed since then, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW–MED (class-recipe edits across ~15 files; no logic changes; 97 `<Button>` call sites inherit the new primary look automatically)
- **Depends on**: plans/057-ledger-bot-tokens-and-type.md (tokens, Geist, flat cards must already be landed)
- **Category**: direction (design polish)
- **Planned at**: commit `d370e29`, 2026-08-22 (written alongside 057; excerpts are from `d370e29` — 057 does not touch these lines except `shell.tsx:189` and `__root.tsx` fonts/metas)

## Why this matters

Plan 057 swapped the tokens (variant B: off-white ground, white cards with a 1px hairline ring), so cards, ground, ink and type already read like x.ai/bot. What still speaks the old Ledger voice is a handful of primitive *recipes* hardcoded in components: the green 3D primary button (now flat but still green), mono tracked badges, the segmented control's drop-shadow thumb (`rgb(0 0 0/.12)` in 3 files), `font-semibold`/`font-extrabold` nav, wordmark and headings, the `bg-accent` toast action, the 3D `.push` CTAs in `phase-hero.tsx`, and three different sheet scrims. x.ai/bot's rules, extracted from the live page: primary action = ink pill (`#0a0a0a` on white), secondary = 1px 15% ring, tertiary = grey fill, all 500 weight, 36–44px tall; badges 12px sans, hue at 14% fill + hue text; chips 32px with an inset ring; nothing is bolder than 600 and nothing gets bolder on hover. Reference mocks: https://claude.ai/code/artifact/4e0119fb-6b78-48ec-9a77-abaf4c55675e §4 "Primitives".

## Current state

All excerpts are from `d370e29`; verify with the drift check.

### `src/components/ui/button.tsx` (whole file is 45 lines)

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[opacity,background-color,box-shadow,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "push bg-accent text-accent-fg",
        ghost: "bg-transparent text-fg hover:bg-raised",
        outline:
          "bg-transparent text-accent-strong shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised",
        muted: "bg-raised text-fg hover:bg-line",
      },
      size: {
        sm: "h-9 rounded-pill px-4 text-sm",
        md: "h-11 rounded-pill px-5 text-sm",
        lg: "h-12 rounded-pill px-6 text-base",
        icon: "size-11 rounded-pill",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
```

Usage census: 97 `<Button` sites; `variant="outline"` 50, `ghost` 14, `muted` 3, `size="lg"` 1, `size="icon"` 0. Variant names are kept — only recipes change.

### `src/components/ui/badge.tsx` (lines 11–25)

```tsx
className={cn(
  "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs tracking-wide",
  tone === "default" && "bg-raised text-muted",
  tone === "win" && "bg-win/15 text-win",
  tone === "loss" && "bg-loss/15 text-loss",
  tone === "live" && "bg-live/15 text-live",
  tone === "warn" && "bg-warn/15 text-warn",
  tone === "muted" && "text-faint",
  className,
)}
```

22 `<Badge` sites. Note `--color-win` is mapped to ink on purpose (styles.css:50–51 "Wins inherit ink") — keep that.

### `src/components/ui/input.tsx` (12–17)

```tsx
"h-11 w-full rounded-md bg-raised px-3 text-sm text-fg ring-card placeholder:text-faint",
"transition-[box-shadow] duration-150 ease-out",
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
```

Native selects with hand-rolled recipes: `src/routes/join.tsx:120` (`mt-1.5 h-11 w-full rounded-md bg-raised px-3 text-sm text-fg ring-card`), `src/components/schedule-desk.tsx:171` (same + focus ring), `src/routes/league/$leagueId.tsx:278` (`mt-2 h-11 w-full max-w-xs rounded-pill border border-line bg-raised px-4 text-sm text-fg`), `src/components/trade-composer.tsx:1276` (`h-9 max-w-[9rem] rounded-sm bg-raised px-2 text-sm text-muted`).

### Segmented control — 5 instances, two recipes

Recipe 1 (`bg-surface` thumb + hardcoded shadow) — `src/components/theme-toggle.tsx:23,38–41`, `src/routes/account.tsx:73,84–88` (skin picker) and `:185,198–201` (AI provider):

```tsx
// track
"flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5"
// item (on / off)
on ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-faint"
```

Recipe 2 (ink thumb) — `src/components/lineup-board.tsx:224–245` and `src/components/matchup-edge.tsx:149–161`:

```tsx
<span className="flex rounded-pill bg-raised p-0.5">
  <button className={cn("h-7 rounded-pill px-2.5 text-[12px] font-semibold transition-colors duration-150", on ? "bg-fg text-bg" : "text-muted")}>
```

### Top nav — `src/components/shell.tsx`

```tsx
// 146 wordmark
<span className="font-display text-[24px] font-extrabold leading-none tracking-[-0.03em]">
// 164–167 desktop tab
"shrink-0 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
t.active ? "bg-fg text-bg" : "text-muted hover:bg-raised hover:text-fg",
// 180–182 scores link
"relative inline-flex h-9 items-center gap-1.5 rounded-pill px-2.5 text-sm font-semibold transition-colors duration-150 sm:px-3",
inScores ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
```

`src/components/league-switcher.tsx:45`:

```tsx
className="flex h-9 max-w-[11rem] items-center gap-2 rounded-pill bg-surface pr-2.5 pl-1.5 text-sm font-bold ring-card sm:max-w-[14rem]"
```

### `.push` direct uses — `src/components/phase-hero.tsx:52, 82, 120`

```tsx
className="push inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg"
```

### Toast action — `src/routes/__root.tsx:113–114`

```tsx
actionButton: "ml-auto shrink-0 rounded-pill bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg",
```

### Sheets / dialogs — three scrims, two top radii

- `src/components/install-drawer.tsx:79–80`: `Drawer.Overlay … bg-black/40`; `Drawer.Content … rounded-t-2xl bg-surface … ring-card`.
- `src/components/player-sheet.tsx:69`: scrim `bg-bg/50`; `:76` panel `rounded-t-xl bg-surface ring-card sm:rounded-none sm:border-l sm:border-line`.
- `src/components/header-menu.tsx:86`: scrim `bg-bg/50 sm:hidden`; `:102–104` panel `bg-surface p-1.5 shadow-[0_0_0_1px_var(--color-line-strong),var(--shadow-lift)] max-sm:rounded-t-xl … sm:rounded-lg`.
- Radix dialogs (identical in 4 files): `claim-dialog.tsx:162–163`, `trade-composer.tsx:1114–1115`, `draft-trade-drawer.tsx:169–170`, `wager-ticket.tsx:135–136`: `Dialog.Overlay … bg-bg/60 backdrop-blur-[2px]`; `Dialog.Content … rounded-xl bg-surface shadow-[var(--shadow-lift)]`.

After plan 057, `--shadow-lift` is a zero shadow, so a dialog content panel sitting on the scrim has **no edge at all**. It needs a 1px `line-strong` ring.

### Headings / weights (census)

`font-extrabold` 11 sites (listed below), `font-bold` 51, h2 recipe `font-display text-lg font-bold tracking-[-0.03em]` 17 sites. Global `h1,h2,h3` rule is now 500 after 057, but inline `font-bold`/`font-extrabold` utilities override it.

`font-extrabold` sites: `shell.tsx:146`, `player-profile.tsx:52`, `phase-hero.tsx:177`, `routes/index.tsx:51,73,107`, `league/$leagueId/settings.tsx:171`, `league/$leagueId/recap.tsx:76,131`, `league/$leagueId/roster.tsx:346`, `league/$leagueId.tsx:211`.

### `src/components/move-row.tsx:45`

`free_agent: "shadow-[inset_0_0_0_1px_var(--color-line-strong)] text-muted"` — the one inset-ring chip; fine as is (x.ai chips use exactly an inset ring). Leave.

### Conventions

- Components name tokens/utilities only (`bg-fg`, `text-bg`, `bg-raised`, `ring-card`, `rounded-pill`); no hex, no `rounded-[...]`. Radii via `rounded-xs|sm|md|lg|xl|pill`.
- `cn()` from `@/lib/utils`; cva for the button.
- Biome: `bunx biome check --write <touched files>` only — never `bun run lint:fix`.
- Commit style: `refactor(ui): ink primary, sans badges, one segmented recipe` (imperative; no AI attribution; no plan/sprint words).
- Skin contract test `src/skin/skin.test.mjs` greps `.tsx` for `shadow-[var(--shadow-border` (forbidden) and `font-mono text-[Npx] uppercase` (forbidden) — don't introduce either.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | error count ≤ baseline (10 contract-file errors) |
| Tests | `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` | ≥ 321 pass (319 + 057's 2), same 6 pre-existing fails |
| Skin tests | `bun test src/skin` | pass |
| Build | `bun run build:dev` | exit 0 |
| Dev | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 (start with `nohup bun run dev >/tmp/claude-501/dev.log 2>&1 &` if not) |

## Suggested executor toolkit

- `agent-browser` (sandbox disabled) for before/after screenshots of `/league/lg_65h3kyr5up`, `/league/lg_65h3kyr5up/roster`, `/account`, and one dialog (open "Add a player" → a claim dialog on `/league/lg_65h3kyr5up/wire`).

## Scope

**In scope**:
- `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/input.tsx`
- `src/components/theme-toggle.tsx`, `src/routes/account.tsx` (segmented recipes only), `src/components/lineup-board.tsx` (224–245 only), `src/components/matchup-edge.tsx` (149–161 only)
- `src/components/shell.tsx` (lines 146, 164–167, 180–182 only), `src/components/league-switcher.tsx` (line 45 only)
- `src/components/phase-hero.tsx` (lines 52, 82, 120, 177 only)
- `src/routes/__root.tsx` (toast `actionButton` + `title` classes only)
- Sheets: `install-drawer.tsx` (79–80), `player-sheet.tsx` (69, 76), `header-menu.tsx` (86, 102–104), and the 4 radix dialog files (overlay + content class strings only)
- Native selects: `src/routes/join.tsx:120`, `src/components/schedule-desk.tsx:171`, `src/routes/league/$leagueId.tsx:278`, `src/components/trade-composer.tsx:1276`
- Weight sweep: the 11 `font-extrabold` sites and the 17 h2-recipe sites listed above
- `src/skin/skin.test.mjs` (add assertions)

**Out of scope**:
- `src/lib/auth/gates.tsx` (avatar button — auth is do-not-edit per the skin contract)
- Any layout/spacing change — that is plan 059. Only class recipes for colour/weight/radius/height here.
- `src/skin/tokens.css`, `src/styles.css` (done in 057; if you think a token is missing, STOP and report)
- `src/skin/skins/boxscore.css`
- `src/components/move-row.tsx` (the inset chip is already the right idiom)
- Do-not-edit list: `public/__grok/**`, `scripts/install-page.html`, `scripts/grok-pwa-*.mjs`, `server/middleware/grok-pwa.ts`, `engine.server.ts`, `src/routeTree.gen.ts`

## Git workflow

- Current branch (`main`), 2–3 commits: (1) ui primitives, (2) nav/sheets/weights. Example: `refactor(ui): ink primary pill, sans badges, one segmented recipe`.
- Do NOT push.

## Steps

### Step 1: Button

Replace the cva in `src/components/ui/button.tsx`:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,background-color,box-shadow,color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:opacity-90",
        ghost: "bg-transparent text-muted hover:bg-raised hover:text-fg",
        outline: "bg-transparent text-fg shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised",
        muted: "bg-raised text-fg hover:bg-line",
      },
      size: {
        sm: "h-8 rounded-pill px-3 text-[13px]",
        md: "h-9 rounded-pill px-4 text-sm",
        lg: "h-11 rounded-pill px-5 text-[15px]",
        icon: "size-9 rounded-pill",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
```

Update the doc comment: "primary is a flat ink pill; secondary actions take `outline` (1px ring) or `muted` (grey fill); never bolder than 500."

Note `outline` drops `text-accent-strong` → `text-fg` (x.ai secondary is ink text). `size` heights drop one notch (36/44 → 32/36/44) to match the reference; `md` 36px is the new default.

**Verify**: `bun run typecheck` → 0. `grep -n "push\|font-semibold" src/components/ui/button.tsx` → none.

### Step 2: Badge

```tsx
"inline-flex h-5 items-center rounded-full px-2 text-xs font-medium leading-none",
tone === "default" && "bg-fg/6 text-muted",
tone === "win" && "bg-accent-strong/14 text-accent-strong",
tone === "loss" && "bg-loss/14 text-loss",
tone === "live" && "bg-live/14 text-live",
tone === "warn" && "bg-warn/14 text-warn",
tone === "muted" && "text-faint",
```

(Win gets the sober green tint — `--color-accent-strong` = `#1f8a65` after 057 — because a 14% ink tint is indistinguishable from `default`. The "wins inherit ink" rule in styles.css is about *text* on the board, not badge pills; leave `--color-win` itself untouched.)

**Verify**: `grep -n "font-mono" src/components/ui/badge.tsx` → none. Typecheck 0.

### Step 3: Input + native selects

`input.tsx`: `"h-10 w-full rounded-md bg-surface px-3 text-base text-fg shadow-[0_0_0_1px_var(--color-line-strong)] placeholder:text-faint sm:text-sm"` (white field with a 15% ring — cards are white too, so the ring is what separates it; 16px text under `sm` so iOS doesn't zoom). Keep the transition + focus lines.

Native selects — apply the same field recipe string to `join.tsx:120`, `schedule-desk.tsx:171`, `$leagueId.tsx:278` (drop `rounded-pill border border-line`, use `rounded-md` + the ring), and `trade-composer.tsx:1276` (`h-9 max-w-[9rem] rounded-md bg-surface px-2 text-sm text-fg shadow-[0_0_0_1px_var(--color-line-strong)]`).

**Verify**: `grep -rn "ring-card" src/components/ui/input.tsx src/routes/join.tsx src/components/schedule-desk.tsx` → none. Typecheck 0.

### Step 4: One segmented recipe

In `theme-toggle.tsx`, `account.tsx` (both radiogroups), `lineup-board.tsx`, `matchup-edge.tsx`:

- track: `flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5` (unchanged)
- item on: `bg-fg text-bg`; item off: `text-faint hover:text-muted`
- weights: `font-medium` (replace `font-semibold` in lineup-board / matchup-edge)
- remove every `shadow-[0_1px_2px_rgb(0_0_0/0.12)]`

**Verify**: `grep -rn "0_1px_2px_rgb(0_0_0/0.12)" src` → none. `grep -n "font-semibold" src/components/lineup-board.tsx src/components/matchup-edge.tsx` → none in the segmented buttons (other uses elsewhere in those files are fine).

### Step 5: Nav, switcher, wordmark

- `shell.tsx:146` wordmark → `font-display text-[22px] font-semibold leading-none tracking-[-0.02em]`
- `shell.tsx:164–167` tab → `shrink-0 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150`, off state `text-fg/55 hover:bg-raised hover:text-fg` (active unchanged `bg-fg text-bg`)
- `shell.tsx:180–182` scores → `font-medium`; off `text-fg/55 …`
- `league-switcher.tsx:45` → `flex h-9 max-w-[11rem] items-center gap-2 rounded-pill bg-surface pr-2.5 pl-1.5 text-sm font-medium shadow-[0_0_0_1px_var(--color-line-strong)] sm:max-w-[14rem]`

**Verify**: `grep -n "font-semibold\|font-bold\|font-extrabold" src/components/shell.tsx src/components/league-switcher.tsx` → none.

### Step 6: `.push` CTAs, toast action

- `phase-hero.tsx:52, 82, 120`: replace `push inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg` with `inline-flex h-10 shrink-0 items-center rounded-pill bg-fg px-4 text-sm font-medium text-bg hover:opacity-90` (keep any trailing classes after it on line 82).
- `phase-hero.tsx:177` h2 → `font-display text-xl font-medium tracking-[-0.02em]`
- `__root.tsx` toast `actionButton` → `ml-auto shrink-0 rounded-pill bg-fg px-3 py-1.5 text-xs font-medium text-bg`; `title` → `text-sm font-medium text-fg`.

**Verify**: `grep -rn '"push \|className="push' src` → none.

### Step 7: Sheets and dialogs

- All scrims → `bg-fg/40` (install-drawer was `bg-black/40`; player-sheet/header-menu `bg-bg/50`; radix `bg-bg/60 backdrop-blur-[2px]` → `bg-fg/40 backdrop-blur-[2px]`). In dark mode `--ink` is light, so `bg-fg/40` is a light scrim on dark — that is x.ai's convention too (their dark overlays are charcoal, not black); if it reads wrong in the dark screenshot, use `bg-black/50` everywhere instead and note it.
- Radius: bottom sheets `rounded-t-xl` (24px) — install-drawer `rounded-t-2xl` → `rounded-t-xl`; header-menu `max-sm:rounded-t-xl` stays; player-sheet stays.
- Edge: radix `Dialog.Content` `shadow-[var(--shadow-lift)]` → `shadow-[0_0_0_1px_var(--color-line-strong)]` in all 4 files; header-menu panel `shadow-[0_0_0_1px_var(--color-line-strong),var(--shadow-lift)]` → `shadow-[0_0_0_1px_var(--color-line-strong)]`.
- Handles: all `h-1 w-9`/`h-1.5 w-10` → `h-1.5 w-10 rounded-full bg-line-strong`.

**Verify**: `grep -rn "bg-black/40\|bg-bg/50\|bg-bg/60" src/components src/routes` → none.

### Step 8: Weight sweep

- The 11 `font-extrabold` sites → `font-medium` and tracking `-0.02em` (keep sizes). `routes/index.tsx:51` hero: `font-medium tracking-[-0.03em]` (big display can stay a touch tighter).
- The 17 `font-display text-lg font-bold tracking-[-0.03em]` h2 sites → `font-display text-lg font-medium tracking-[-0.02em]` (use `grep -rln` then sed per file; confirm each).
- `player-profile.tsx:52` → `font-medium`.

**Verify**: `grep -rn "font-extrabold" src` → none; `grep -rn "font-display text-lg font-bold" src` → none. Typecheck 0.

### Step 9: Gate + screenshots

Typecheck, lint (≤ baseline), tests (≥ 321), build:dev; screenshots desktop+mobile light/dark of `/league/lg_65h3kyr5up`, `/roster`, `/account`, and a dialog. Confirm: primary buttons are ink pills; segmented thumbs ink; no drop-shadow thumbs; dialogs have a 1px edge.

## Test plan

- Add to `src/skin/skin.test.mjs` (model on the existing "no src/**/*.tsx file has residual …" test):
  - `"no component carries the retired push / shadow-thumb / heavy-weight recipes"` — walk `src/**/*.tsx`; assert none matches `/className="push|"push /`, `/0_1px_2px_rgb\(0_0_0\/0\.12\)/`, `/font-extrabold/`; assert `src/components/ui/button.tsx` matches `/primary:\s*"bg-fg text-bg/` and `src/components/ui/badge.tsx` does not match `/font-mono/`.
- `bun test src/skin` → pass incl. new.

## Done criteria

- [ ] `bun run typecheck` 0; `bun run build:dev` 0
- [ ] `PGLITE_DATA_DIR=/tmp/claude-501/pglite-test bun test src scripts` ≥ 322 pass, no new fails
- [ ] `grep -rn "font-extrabold\|0_1px_2px_rgb(0_0_0/0.12)\|className=\"push" src` → none
- [ ] `grep -rn "bg-black/40\|bg-bg/50\|bg-bg/60" src` → none
- [ ] `grep -rn "shadow-\[var(--shadow-lift)\]" src/components/claim-dialog.tsx src/components/trade-composer.tsx src/components/draft-trade-drawer.tsx src/components/wager-ticket.tsx` → none
- [ ] `git status` clean outside scope; `src/lib/auth/**` untouched
- [ ] Screenshots captured; Box Score skin still renders (its own button/`.push` overrides intact)

## STOP conditions

- Drift on any excerpt.
- A `<Button>` call site depends on `text-accent-strong` in `outline` for meaning (e.g. a green "Claim" that must stay green) — list, don't improvise.
- A needed colour has no token (you want to write a hex) — STOP; tokens are plan 057's domain.
- The dark-mode scrim reads wrong and `bg-black/50` also reads wrong — report with screenshots.

## Maintenance notes

- New buttons: `variant="primary"` = ink pill; `outline` = ringed; `muted` = grey fill; never add `font-bold`.
- Segmented controls: three copies still exist (theme-toggle, account ×2, lineup-board, matchup-edge). Extracting a `<Segmented>` component was deliberately deferred — do it when a sixth appears.
- Reviewer: diff should contain only class strings, the cva, and doc comments — no logic.
