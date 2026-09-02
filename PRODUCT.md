# Open Leagues — PRODUCT.md

register: product

## Product purpose
Receipts for your fantasy week, on a headless league. Paste a Sleeper league id and get, for any team, the minute the matchup flipped, what was left on the bench, what the wire cost, and which open source called it before kickoff. Every line is a fact with a timestamp; nothing on a receipt comes from a model. Beneath the receipts, a league engine anyone can self-host and any agent can operate.

## Users
- The manager who lost by 2.4: wants to know exactly when and why, and wants to send it to the chat. Never makes an account.
- The commissioner: migrates a league in, then lets it run — the tick advances weeks and clears waivers; they confirm season ops and otherwise stay idle.
- Agents: read or act tokens over MCP. They read receipts like anyone else, set lineups, work the wire, and sign every write so the receipt can show their line next to the human's.
- Builders: fetch the player crosswalk, the wire clearing prices, and every closing line since 1999 instead of rebuilding them.
- Bettors with a hunch: describe a cohort, grade it against results, read a record with n. The lab never says what to bet; it says what happened.

## The scene (theme)
Monday morning, phone in one hand, the group chat already going. A card unfurls: the flip, the bench, the wire. Nobody argues with it because every line has a clock on it.

## Tone & brand
"Ledger": a well-kept desk, not a dashboard. Sober, precise, a little dry. One identity colour (green) used sparingly; losing is the marked state, winning is default. Numbers are mono and tabular. Facts over adjectives: a receipt says what happened and who said so beforehand — never what you should have done.

## Anti-references
- Advice sites: no rankings, no "start/sit" verdicts, no expert byline. We print who was right, not who to trust.
- ESPN/Yahoo app clutter: banner ads, badge storms, six nav levels.
- Sportsbook neon: no glow, no red/green casino flash.
- Generic SaaS dashboards: no hero-metric cards, no icon-card grids.

## Strategic principles
1. A receipt is a fact, not an opinion. Every line traces to a box score, a play-by-play row, or a transaction log — with a timestamp. Projections appear only as what a source said before kickoff.
2. Open sources only. Sleeper's projection, last three weeks, season average. A paid source never renders, even as a comparison.
3. Team names, never people. Public Sleeper data passes through by id; a manager's name is replaced with the roster number when it would identify them. Hosted (`lg_`) leagues are seat-gated on every surface.
4. Every paste makes the commons richer. Leagues that ask for a receipt contribute anonymously to the wire clearing prices. No league id, manager, or roster appears in an aggregate.
5. The engine is the product's floor, not its headline. One FAAB purse, one scoring book, confirm-gated season ops, read/act agent scopes. The browser app is client zero.
6. Leagues run themselves. The tick advances weeks and clears waivers; the commissioner is idle by design.
7. Tools are atomic; strategies are prompts. The lab exposes lines, cohorts, grading, and summaries as separate verbs and leaves the judgment — which games, which side — to the agent or the person. A feature that would bundle that judgment into code is a feature we do not build.
