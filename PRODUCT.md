# Open Leagues PRODUCT.md

register: product

## Product purpose
A set of headless tools and open sources, exposed over MCP, that tell an agent facts: about a fantasy league (rosters, matchups, FAAB, the wire), about the NFL itself (scores, stats, projections, byes), and about betting (every closing line since 1999, cohorts graded with n and pBreakEven). Every answer is a record with a clock and a named source. No rankings, no picks, no paid feeds. The agent brings its own model and makes the decision. Receipts are the worked example. A league box you own is where your own league lives.

## Two boxes
The public host is a substrate: public MCP verbs for any Sleeper league, the game, and the lab, plus the open-data files, with no accounts, tokens, or leagues. Agents bring their own model; the box pays for Postgres and nothing else. Everything that needs a person runs on a box you own, from one command. Same code; substrate is the default, and `OPENLEAGUES_MODE=league` is the deliberate step into accounts and leagues.

## Users
- The agent operator: adds one URL to Codex or Claude, asks in words, gets facts with clocks, decides on their own model. Never makes an account on the public box.
- The Sleeper manager: any league by id, team names only; wants the receipt for the chat and the season ledger on which open source was right. Never makes an account.
- The bettor with a hunch: describes a cohort, grades it against results, reads a record with n and pBreakEven and a holdout. The lab never says what to bet; it says what happened.
- The builder: fetches the player crosswalk, the wire clearing prices, and every closing line since 1999 instead of rebuilding them.
- The commissioner: runs a league box, migrates a league in, lets the tick advance weeks and clear waivers, confirms season ops, and mints tokens for the seats' agents.

## The scene (theme)
Monday morning, phone in one hand, the group chat already going. A card unfurls: the flip, the bench, the wire. Nobody argues with it because every line has a clock on it.

## Tone & brand
"Ledger": a well-kept desk, not a dashboard. Sober, precise, a little dry. One identity colour (green) used sparingly; losing is the marked state, winning is default. Numbers are mono and tabular. Facts over adjectives: a receipt says what happened and who said so beforehand never what you should have done.

## Anti-references
- Advice sites: no rankings, no "start/sit" verdicts, no expert byline. We print who was right, not who to trust.
- ESPN/Yahoo app clutter: banner ads, badge storms, six nav levels.
- Sportsbook neon: no glow, no red/green casino flash.
- Generic SaaS dashboards: no hero-metric cards, no icon-card grids.

## Strategic principles
1. Every verb returns a fact, not an opinion. Every line traces to a box score, a play-by-play row, a transaction log, or a closing line, with a timestamp. Projections appear only as what a named source said before kickoff.
2. Open sources only. Sleeper's projection, last three weeks, season average. A paid source never renders, even as a comparison.
3. Team names, never people. Public Sleeper data passes through by id; a manager's name is replaced with the roster number when it would identify them. Leagues on a league box (`lg_` ids) are seat-gated on every surface; the public box hosts none.
4. Every league read makes the commons richer. Leagues read through the box, by an agent or a browser, contribute anonymously to the wire clearing prices. No league id, manager, or roster appears in an aggregate.
5. The verbs are the product; the browser is client zero. One FAAB purse, one scoring book, confirm-gated season ops, read/act agent scopes.
6. Leagues run themselves. The tick advances weeks and clears waivers; the commissioner is idle by design.
7. Tools are atomic; strategies are prompts. The lab exposes lines, cohorts, grading, and summaries as separate verbs and leaves the judgment which games, which side to the agent or the person. A feature that would bundle that judgment into code is a feature we do not build.
8. Agents bring the model. The box never calls a model to answer a verb and never recommends; it pays for Postgres only. Receipts and the lab digest are what an agent made from the verbs, not what the box decided.
