# Open Leagues — DESIGN.md

The skin contract is law: literal values live ONLY in `src/skin/tokens.css`; `src/styles.css` maps them to Tailwind via `@theme inline`; components name utilities only. Default skin "Ledger" (x.ai/bot cut, 2026-08); alt skin "Box Score".

## Color (Ledger, light / dark)
- ground `--paper` #fafaf8 / #0d0d0d · card `--paper-raised` #ffffff / #161616 · sunken #f3f2ef / #202020 · band #f6f5f2 / #121212
- ink #0a0a0a / #ededed · ink-2 #5c6066 / #a3a6aa · ink-3 #7d8187 / #7b7f85
- hairline #e9e9e6 / #262626 · strong #d6d6d3 / #363636 · card edge = 1px `--card-ring` (no shadows; `--lift` is zero)
- brand #6fdc93 (mint: lines, meters, tints) · brand-strong #1f8a65 / #7fe3a2 (text-on-tint, links) · alarm #e0532f / #ef6b4f (losing/live — the only alarm) · caution #b26a00 / #e3a33b
- Badges: hue at 14% fill + hue text, 20px. Selected chips: brand 16% fill + 45% ring.

## Type
- Geist (sans + display), Geist Mono for every number (tabular-nums always).
- Headings 500 weight, tracking −0.02em. Never bolder than 600; nothing gets bolder on hover.
- Eyebrows: `.microlabel` = sans 11/500 uppercase .08em ink-3. Data labels: `.microlabel-data` = mono 10 uppercase .1em.

## Shape & depth
- Radii 10/12/16/20/24 (`--r-xs..xl`), pills everywhere clickable. Cards: white, 24px, 1px ring, flat.
- Primary button = ink pill (`bg-fg text-bg`), 32/36/44px, 500 weight. Secondary = 1px line-strong ring. Tertiary = sunken fill. `.push` is retired in Ledger.

## Motion (house rules)
- Zero animation on high-frequency UI: tab switches, pane changes, chip toggles are instant and start at top.
- Drag follows the finger 1:1 (axis-locked `useSwipe`: touch-action pan-y, 10px intent, quarter-width/flick commit); release resolves instantly.
- Reduced-motion collapses everything remaining to none. Chrome (thumb bar) never hides content-critical controls.

## Established patterns
- Pinned context rail: sticky under the 60px header, hairline when stuck (IntersectionObserver sentinel) — game page tabs, box-score mini-scorebar.
- Sheets: vaul, single full-height state (h-[94%]), drag-down dismiss; desktop keeps side panels.
- Status = counts ("9 v 9 to play", "● 7 v 7 live"); per-game clocks only where one game is in focus.
- Winner emphasis: bold, no glyphs. Yet-to-play: dimmed with kickoff time.
- Row anatomy: avatar · name / meta | slot rail | mono pts (+transient flash delta only).
- Contract tests in `src/skin/skin.test.mjs` enforce all of the above (20 tests).
