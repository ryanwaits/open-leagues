# Open Leagues PRODUCT.md

register: product

## Product purpose
An open-source MCP server. It reads any Sleeper league by id, NFL stats, open projections, and the closing line for every game since 1999. League reads cover rosters, matchups, FAAB, and the wire; NFL reads cover scores, stats, projections, and byes. The lab grades betting cohorts with n and pBreakEven. Each answer carries a timestamp and a source. No account is needed.

It does not rank players, pick sides, place bets, or read paid feeds. The agent brings its own model and decides. Receipts are the worked example. A league box you own holds your own league.

## Two boxes
The public box is a substrate: MCP verbs for any Sleeper league, the game, and the lab, plus the open-data files. It has no accounts, tokens, or leagues. Agents bring the model; the box pays for Postgres only. Anything that needs a person runs on a league box you own, from one command. Same code: substrate is the default, and `OPENLEAGUES_MODE=league` opts into accounts and leagues.

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
1. Every verb returns a fact. Every line traces to a box score, a play-by-play row, a transaction log, or a closing line, with a timestamp. Projections appear only as what a named source said before kickoff.
2. Open sources only: Sleeper's projection, the last three weeks, the season average. A paid source never renders, even as a comparison.
3. Team names, never a person's name. Public Sleeper data passes through by id; a manager's name becomes the roster number when it would identify them. Leagues on a league box (`lg_` ids) are seat-gated on every surface; the public box hosts none.
4. Every league read adds to the shared data. Leagues read through the box, by agent or browser, feed the wire clearing prices anonymously. No league id, manager, or roster appears in an aggregate.
5. The verbs are the product; the browser is the first client. One FAAB purse, one scoring book, confirm-gated season ops, read/act agent scopes.
6. Leagues run on their own. The tick advances weeks and clears waivers; the commissioner is idle by design.
7. Tools are atomic; strategies are prompts. The lab exposes lines, cohorts, grading, and summaries as separate verbs and leaves the judgment (which games, which side) to the agent or the person. We do not build a feature that bundles that judgment into code.
8. Agents bring the model. The box never calls a model to answer a verb, never recommends, and pays for Postgres only. Receipts and the lab digest are what an agent made from the verbs; the box decided nothing.
