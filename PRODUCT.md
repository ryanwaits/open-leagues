# Open Leagues — PRODUCT.md

register: product

## Product purpose
A self-hosted fantasy football desk: one commissioner runs a league on their own box, friends install it to their home screen and live in it on Sundays. Standings, matchups, live scoring, waivers/FAAB, trades, a draft room, and a wagering book — no third-party app, no ads.

## Users
- The commissioner (Ryan): runs the league, tunes settings, watches everything.
- League members: check their team, follow the live matchup on Sundays (phone-first, PWA), work the wire, talk trash.
- Agents/LLMs: a headless catalog (MCP) can run the league's verbs; the PWA stays client zero.

## The scene (theme)
A phone on a couch on Sunday at 1:07pm, sun on the screen, four games in progress and one eye on the TV. Light-first, high contrast, numbers that hold still.

## Tone & brand
"Ledger": a well-kept desk, not a dashboard. Sober, precise, a little dry. One identity colour (green) used sparingly; losing is the marked state, winning is default. Numbers are mono and tabular. Status is counts, not fake precision ("7 v 7 live", never a single quarter chip for a multi-game matchup).

## Anti-references
- ESPN/Yahoo app clutter: banner ads, badge storms, six nav levels.
- Sportsbook neon: no glow, no red/green casino flash.
- Generic SaaS dashboards: no hero-metric cards, no icon-card grids.
- "Bad web app" mobile: controls that scroll away, snap-scroll hijacks, spinner theatre.

## Strategic principles
1. The desk outlives the week: everything has a permalink and a past (livelines, ticks, recaps).
2. Compare vs follow: boards scan many things shallowly; detail pages follow one thing deeply. Every fact lives deep on exactly one page.
3. Movement only under the finger: drag follows touch 1:1; releases and state changes are instant. No easing on high-frequency UI.
4. Every gesture has a visible, tappable twin.
5. One live canvas per viewport; charts only when there is a line to draw.
