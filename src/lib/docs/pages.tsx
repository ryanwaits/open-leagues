import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ReceiptFinder } from "@/components/receipt-finder";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import {
  CLI_SNIPPETS,
  connectSnippets,
  IDENTITY_SNIPPETS,
  INSTALL_SNIPPETS,
  PLAYBOOKS,
} from "./fixtures";
import { guide } from "./guide";
import { type Audience, showsFor, useAudience } from "./guide-store";
import { type DocsSlug, docsNeighbours } from "./nav";
import {
  Bullets,
  Callout,
  CatalogTable,
  DocTable,
  Inline,
  MatchupPreview,
  Mono,
  Note,
  P,
  Pill,
  PlaybookList,
  Pre,
  PurseCard,
  Step,
  Steps,
  TabbedCode,
  TranscriptReplay,
} from "./widgets";

export type DocsSection = {
  id: string;
  heading: string;
  body: () => ReactNode;
  /** Who this section is for; unset means everyone. Filtered by the guide's chips. */
  audience?: Audience[];
};
export type DocsPage = { title: string; lede: ReactNode; sections: DocsSection[] };

const MCP_WIRED = AGENT_CORE.size;
const MCP_CATALOG = AGENT_TOOLS.length;

function scopeCount(scope: "spectator" | "manager" | "commish") {
  return AGENT_TOOLS.filter((t) => t.scope === scope).length;
}

function hostOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "https://leagues.waits.dev";
}

function DocLink({ slug, children }: { slug: DocsSlug; children: ReactNode }) {
  if (slug === "overview") {
    return (
      <Link to="/docs" className="text-fg underline decoration-line-strong underline-offset-4">
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/docs/$slug"
      params={{ slug }}
      className="text-fg underline decoration-line-strong underline-offset-4"
    >
      {children}
    </Link>
  );
}

/* ── overview ──────────────────────────────────────────────────────── */

const overview: DocsPage = {
  title: "Overview",
  lede: "An open-source MCP server. It reads any Sleeper league by id, NFL stats, open projections, and the closing line for every game since 1999.",
  sections: [
    {
      id: "what",
      heading: "What this is",
      body: () => (
        <>
          <P>
            Three families of verbs. Your league reads any Sleeper league by id with no account; on
            a box you own it also moves the league you host. The game is the NFL with no league
            attached. The lab is every closing line since 1999.
          </P>
          <DocTable
            head={["Surface", "Reach", "Entry point"]}
            rows={[
              [
                <strong key="a" className="font-medium text-fg">
                  MCP server
                </strong>,
                `${MCP_WIRED} of ${MCP_CATALOG} verbs; 23 with no account`,
                <Mono key="c">/api/mcp · scripts/mcp.mjs</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The public box
                </strong>,
                "Default mode: public MCP plus the open-data files; no accounts, no leagues",
                <Mono key="c">OPENLEAGUES_MODE unset · league for the whole product</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The lab
                </strong>,
                "Real NFL lines since 1999, cohorts, grading, staking",
                <Mono key="c">/api/lines/:season.json · two skills</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Open data
                </strong>,
                "Three JSON files, anonymous, CORS on",
                <Mono key="c">/api/players.json · /api/wire · /api/lines</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Receipts
                </strong>,
                "A worked example: any Sleeper league, anonymous",
                <Mono key="c">/r/:leagueId</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Browser app
                </strong>,
                "Every verb, in the browser",
                <Mono key="c">createServerFn</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Ledger CLI
                </strong>,
                "Three reads, one gated write",
                <Mono key="c">scripts/ledger.mjs</Mono>,
              ],
            ]}
          />
          <Callout>
            The CLI dispatches a slice of the catalog; see <DocLink slug="cli">CLI</DocLink>.
          </Callout>
        </>
      ),
    },
    {
      id: "install",
      heading: "Install",
      body: () => (
        <>
          <P>
            Docker gives a durable box: PGLite on a volume, the league clock in-process, no managed
            Postgres.
          </P>
          <TabbedCode snippets={INSTALL_SNIPPETS} />
        </>
      ),
    },
    {
      id: "shape",
      heading: "The shape of a league",
      body: () => (
        <>
          <P>
            One league row, ten rosters by default, a schedule, a wire, and a book. Three invariants
            hold on every surface:
          </P>
          <Bullets>
            <li>
              <strong className="font-medium text-fg">FAAB is one purse.</strong> Waiver bids and
              wager stakes draw from the same <Inline>faab_remaining</Inline>. A spend is checked
              against <Inline>spendable</Inline> (remaining minus unsettled stakes), never against{" "}
              <Inline>remaining</Inline>.
            </li>
            <li>
              <strong className="font-medium text-fg">You cannot fade your own roster.</strong> You
              may back it. The engine throws: “You can back yourself, but you cannot bet against
              yourself.”
            </li>
            <li>
              <strong className="font-medium text-fg">Stakes are whole dollars.</strong> A stake is
              floored to an integer with a $1 minimum before any other check runs.
            </li>
          </Bullets>
          <Callout>
            <Inline>exportLeague</Inline> returns a JSON snapshot. Nothing reads one back in, and
            nothing syncs to Sleeper or ESPN.
          </Callout>
        </>
      ),
    },
  ],
};

/* ── receipts ──────────────────────────────────────────────────────── */

const receipts: DocsPage = {
  title: "Receipts",
  lede: "Paste a Sleeper league id. For any settled week: the minute the matchup flipped, bench points left, wire cost, and which open source called it.",
  sections: [
    {
      id: "urls",
      heading: "Two URLs",
      body: () => (
        <>
          <ReceiptFinder />
          <DocTable
            head={["URL", "Shows", "Needs"]}
            rows={[
              [
                <Mono key="a">/r/:leagueId</Mono>,
                "Each matchup of the current week on one line, with a week picker",
                "Nothing",
              ],
              [
                <Mono key="a">/r/:leagueId/:week/:rosterId</Mono>,
                "One team’s receipt, with an image card for the chat",
                "Nothing",
              ],
            ]}
          />
          <P>
            <Inline>:leagueId</Inline> is a raw Sleeper id. Private leagues work, since Sleeper’s
            API serves them by id. A username in the finder lists that person’s leagues. When a team
            name is the manager’s username, it renders as <Inline>Roster N</Inline>.
          </P>
          <Callout>
            A league on your own league box (an <Inline>lg_</Inline> id) has receipts too, behind
            the same seat check and with no public card. The public box hosts no leagues.
          </Callout>
        </>
      ),
    },
    {
      id: "lines",
      heading: "What is on one",
      body: () => (
        <>
          <DocTable
            head={["Line", "Says", "Computed from"]}
            rows={[
              [
                <strong key="a" className="font-medium text-fg">
                  The flip
                </strong>,
                "The minute the lead last changed, the play, and the win probability a half-hour earlier",
                "nflverse play-by-play under the league’s book",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The bench
                </strong>,
                "Points left on the bench, and who sat behind whom",
                "Best lineup on the box score against the lineup set",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The sources
                </strong>,
                "What each open source would have called before kickoff",
                "Sleeper projection · last three weeks · season average, under the same book",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The wire
                </strong>,
                "Bids as a share of budget, results, and what the player cleared for elsewhere",
                "League transactions plus wire clearing prices in percent of budget, once a second league has one",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The season ledger
                </strong>,
                "Which open source would have set a better lineup than you, week by week",
                "Each source’s pre-kickoff lineup scored on the box score",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The agent’s line
                </strong>,
                "Which lineup moves a token made, by name and time",
                <Mono key="c">agent_action</Mono>,
              ],
            ]}
          />
          <Pre label="a real one · SDIFFL 2025 · week 14 · NateBot 129.0 · Roster 14 85.3">{`Took the lead for good at 3:41pm ET on a Trevor Lawrence completion, 78.8–78.6 · 78% to win at 3:11pm.
6.5 left on the bench — Omarion Hampton (13.7) started over Saquon Barkley (20.2).
  Sleeper projection, Last 3 weeks, and Season average all said start Barkley.
Wire: bid $26 on Stefon Diggs — 13% of a $200 budget — lost.`}</Pre>
          <Note>Paid sources do not appear on a receipt.</Note>
        </>
      ),
    },
    {
      id: "card",
      heading: "The card",
      body: () => (
        <>
          <P>
            Each receipt page sets <Inline>og:image</Inline> to a PNG at{" "}
            <Inline>/api/og/r/:leagueId/:week/:rosterId</Inline>, so a pasted link unfurls the
            receipt in iMessage or Discord. The card draws only what is on the receipt.
          </P>
          <Callout tone="warn">
            Receipts show team names, not people. To have a league’s receipts taken down, open an
            issue on the repo with the league id.
          </Callout>
        </>
      ),
    },
    {
      id: "flip-method",
      heading: "How the flip is found",
      body: () => (
        <>
          <Bullets>
            <li>
              Each season’s nflverse play-by-play is streamed once into a per-game timeline of
              scoring deltas: who gained what, on which play, at which second.
            </li>
            <li>
              Both lineups are replayed under the league’s scoring book, so a half-PPR flip and a
              full-PPR flip can land on different plays.
            </li>
            <li>
              The flip is the last moment the lead changed. “How likely you were” is a
              win-probability snapshot from thirty minutes earlier.
            </li>
            <li>
              Kick times are Eastern. If the season’s play-by-play is not published yet (the current
              week, most Sundays), the receipt says so.
            </li>
            <li>
              Where nflverse and Sleeper’s weekly stats disagree, the difference is booked as one
              event at the final whistle. Each final matches Sleeper to the cent (84 of 84
              team-weeks checked). If a correction decided the week, the receipt says “on the final
              box score”.
            </li>
          </Bullets>
        </>
      ),
    },
  ],
};

/* ── open data ─────────────────────────────────────────────────────── */

const openData: DocsPage = {
  title: "Open data",
  lede: "Three JSON files: the player-ID crosswalk, FAAB clearing prices, and the closing line for every NFL game since 1999. Anonymous, CORS on, no key.",
  sections: [
    {
      id: "players",
      heading: "/api/players.json",
      body: () => (
        <>
          <P>
            Sleeper, GSIS (nflverse), ESPN, Yahoo, RotoWire, and Sportradar ids side by side, with
            name, team, and position. Built from Sleeper’s player file; cached a day.
          </P>
          <Pre label="shape">{`{
  "source": "sleeper players + nflverse gsis",
  "count": 11826,
  "players": [
    { "sleeper_id": "4866", "gsis_id": "00-0034844", "espn_id": "3929630",
      "yahoo_id": "30972", "rotowire_id": "12507", "sportradar_id": "9811b753-…",
      "name": "Saquon Barkley", "team": "PHI", "position": "RB" }
  ]
}`}</Pre>
        </>
      ),
    },
    {
      id: "wire",
      heading: "/api/wire/:season/:week.json",
      body: () => (
        <>
          <P>
            What each player cleared for on waivers that week, across every Sleeper league that has
            asked for a receipt, as a{" "}
            <strong className="font-medium text-fg">share of budget</strong>. Median, quartiles,
            max, share of what the winner had left, and the count. Raw dollars appear only when
            every bid came from the same budget.
          </P>
          <P>
            Filter to a cohort: <Inline>?rosters=12&amp;format=half&amp;superflex=false</Inline>.
            The <Inline>budgets</Inline> map shows how many contributing leagues run each purse.
          </P>
          <Pre label="shape · real">{`{
  "season": "2025", "week": 14, "leagues": 1,
  "budgets": { "200": 1 },            // contributing leagues per FAAB purse
  "cohort": {},                       // or { rosters: 14, format: "half", superflex: false }
  "prices": [
    { "player_id": "2449", "name": "Stefon Diggs", "position": "WR", "n": 1,
      "median_pct": 39.5, "p25_pct": 39.5, "p75_pct": 39.5, "max_pct": 39.5,
      "median_pct_remaining": 76.7,   // share of what the winner still had
      "dollars": { "budget": 200, "median": 79 } }   // only within one budget
  ]
}`}</Pre>
          <Bullets>
            <li>
              Only leagues that have been pasted contribute. Each receipt read registers its league;
              nothing is crawled.
            </li>
            <li>
              No league id, manager, or roster appears in the payload. <Inline>n</Inline> is the
              number of winning bids behind a price. <Inline>median_pct_remaining</Inline> is the
              bid as a share of what the winner still had.
            </li>
            <li>Cached an hour once a league has a cleared claim. Empty results are not cached.</li>
            <li>
              A team’s receipt shows the median share and count beside a won claim once a second
              league has one.
            </li>
          </Bullets>
        </>
      ),
    },
    {
      id: "lines",
      heading: "/api/lines/:season.json",
      body: () => (
        <>
          <P>
            Every game of a season with its closing spread, total, moneylines, prices, result, and
            context: rest days, roof, surface, division game, weekday, starting quarterbacks,
            referee. Source: nflverse’s games table, 1999 to now, refreshed every six hours. Closing
            lines only; opening lines for 2007–2021 exist in the Sportsbook Review archive and are
            not wired in.
          </P>
          <P>
            Public betting splits are a separate opt-in feed, read over MCP as{" "}
            <Inline>getBettingSplits</Inline>.{" "}
            <Inline>OPENLEAGUES_SPLITS_SOURCE=actionnetwork,dknetwork,wiseguyteam</Inline> adds the
            consensus with history from 2023, DraftKings’ own numbers, and a multi-book read for the
            current slate, each under its own book. They are not republished here.
          </P>
          <Pre label="shape · real">{`{
  "source": "nflverse nfldata games.csv · closing lines", "season": 2025, "count": 272,
  "games": [
    { "gameId": "2025_14_DAL_DET", "season": 2025, "week": 14, "home": "DET", "away": "DAL",
      "spread": 3.5,            // home-signed: DET favored by 3.5
      "total": 55.5, "homeMoneyline": -192, "awayMoneyline": 160,
      "homeSpreadOdds": -110, "awaySpreadOdds": -110, "overOdds": -110, "underOdds": -110,
      "result": 14,             // home − away
      "points": 74, "homeScore": 44, "awayScore": 30,
      "divGame": false, "roof": "dome", "surface": "fieldturf", "homeRest": 7, "awayRest": 7,
      "weekday": "Thursday", "gameday": "2025-12-04", "gametime": "20:15",
      "homeQb": "Jared Goff", "awayQb": "Dak Prescott", "referee": "Shawn Hochuli" }
  ]
}`}</Pre>
          <P>
            The same rows drive the lab verbs over MCP: <Inline>getGameLines</Inline>,{" "}
            <Inline>getGameContext</Inline>, <Inline>getBettingSplits</Inline>,{" "}
            <Inline>sampleGames</Inline>, <Inline>evaluateBets</Inline>,{" "}
            <Inline>summarizeRun</Inline> (with <Inline>pBreakEven</Inline>),{" "}
            <Inline>simulateBankroll</Inline>. <Inline>freezeStrategy</Inline>,{" "}
            <Inline>recordLabRun</Inline>, and <Inline>getLabRuns</Inline> hold frozen strategies
            and the run ledger. <Inline>lab-discover</Inline> holds out a season before it freezes
            anything; <Inline>lab-run</Inline> grades a frozen rule weekly. Neither places a bet.
            The <DocLink slug="guide">guide</DocLink> runs one.
          </P>
        </>
      ),
    },
  ],
};

/* ── quickstart ────────────────────────────────────────────────────── */

const quickstart: DocsPage = {
  title: "Quickstart",
  lede: "Six steps from an empty box to an agent answering a question about your league. Neither side needs integration code.",
  sections: [
    {
      id: "steps",
      heading: "Six steps",
      body: () => (
        <Steps>
          <Step n={1} title="Run a box">
            <P>
              Docker gives a durable box with the clock running. Locally,{" "}
              <Inline>bun run dev</Inline> binds <Inline>0.0.0.0:8080</Inline> and migrates its own
              PGLite on first access.
            </P>
            <Pre label="shell">{`git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d

# or, locally
bun install
bun run dev`}</Pre>
          </Step>
          <Step n={2} title="Make your account">
            <P>
              A fresh box has no users or leagues. Open <Inline>http://localhost:8080/login</Inline>
              , choose <strong className="font-medium text-fg">Need an account?</strong>, and sign
              up. There is no admin tier.
            </P>
            <Note>
              Nothing is seeded. For the maintainer&apos;s fixture league, start the box with{" "}
              <Inline>OPENLEAGUES_DEV_SEED=1</Inline>.
            </Note>
          </Step>
          <Step n={3} title="Start or migrate a league">
            <P>
              Go to <Inline>/new</Inline>. Start from scratch, or import from Sleeper, ESPN, or a
              pasted recap. Whoever commits an import becomes its commissioner.
            </P>
            <Note>
              An agent can do this too: <Inline>previewImport</Inline>, then{" "}
              <Inline>importLeague</Inline> with <Inline>confirm: true</Inline>. See{" "}
              <DocLink slug="migrate">Migrate a league</DocLink>.
            </Note>
          </Step>
          <Step n={4} title="Mint an agent token">
            <P>
              On your league box, open <Inline>/account</Inline> (any member). Under{" "}
              <strong className="font-medium text-fg">Agent tokens</strong>, name one and create it.
              The raw <Inline>ol_…</Inline> value is shown once.
            </P>
            <Note>
              The CLI mints the same credential with no browser:{" "}
              <Inline>bun scripts/ledger.mjs mintToken --write --user …</Inline>
            </Note>
            <Callout tone="warn">If you lose it, revoke and mint a new one.</Callout>
          </Step>
          <Step n={5} title="Point a client at it">
            <P>Every client below speaks the same endpoint. None is a plugin we wrote.</P>
            <TabbedCode snippets={connectSnippets(hostOrigin())} />
          </Step>
          <Step n={6} title="Ask it something">
            <P>The agent introspects the catalog and picks its own verbs.</P>
            <Pre label="shell">{`codex exec "Use the open-leagues MCP tools to get my league context —
  team name, record, and this week's matchup opponent if one exists."`}</Pre>
          </Step>
        </Steps>
      ),
    },
    {
      id: "verify",
      heading: "Verify the connection",
      body: () => (
        <>
          <P>
            Confirm the transport first. The row should read <Inline>enabled</Inline> with{" "}
            <Inline>Bearer token</Inline>.
          </P>
          <Pre label="codex mcp list">{`Name          Url                                 Bearer Token Env Var  Status   Auth
open-leagues  ${hostOrigin()}/api/mcp   OPENLEAGUES_TOKEN     enabled  Bearer token`}</Pre>
          <Callout tone="warn">
            Your token must belong to someone with a seat in the league. Every call on an{" "}
            <Inline>lg_</Inline> league runs <Inline>assertLeagueViewer</Inline>: commissioner or
            seat holder, or the call returns <Inline>Unauthorized</Inline>. A raw Sleeper league id
            is public data and needs no seat.
          </Callout>
        </>
      ),
    },
  ],
};

/* ── migrate ───────────────────────────────────────────────────────── */

const migrate: DocsPage = {
  title: "Migrate a league",
  lede: "Each source becomes one import pack: teams, managers, slots, scoring, rosters, weeks. Preview the pack, then commit it.",
  sections: [
    {
      id: "sources",
      heading: "Pick a source",
      body: () => (
        <>
          <P>Paste or file is the fallback when a connect fails or the platform is unsupported.</P>
          <DocTable
            head={["Source", "Preview", "Commit"]}
            rows={[
              ["Sleeper", <Mono key="b">previewImport</Mono>, <Mono key="c">importLeague</Mono>],
              ["ESPN", <Mono key="b">previewEspn</Mono>, <Mono key="c">importEspn</Mono>],
              [
                "Paste, PDF, screenshot recap",
                <Mono key="b">previewRebuild</Mono>,
                <Mono key="c">importRebuild</Mono>,
              ],
            ]}
          />
          <P>
            Sleeper import takes a <strong className="font-medium text-fg">league id</strong>.{" "}
            <Inline>findSleeperUser</Inline> turns a username into that person’s leagues for a
            season; it is not an input to the import.
          </P>
          <Pre label="MCP · arguments">{`findSleeperUser  { "query": "ryan" }

previewImport    { "sleeperId": "<league id>", "includeHistory": false }

importLeague     { "sleeperId": "<league id>",
                   "claimRosterId": 4,
                   "includeHistory": false,
                   "confirm": true }`}</Pre>
          <Note>
            <Inline>confirm: true</Inline> is an MCP-layer gate, not part of the server function
            signature. Dispatch refuses the call without it.
          </Note>
        </>
      ),
    },
    {
      id: "commit",
      heading: "Preview, then commit",
      body: () => (
        <>
          <P>
            The preview writes nothing. Every write happens inside one committer, so a failed import
            leaves no half league.
          </P>
          <Callout>
            <strong className="font-medium text-fg">Never invent manager emails.</strong> No source
            API gives a verified one, and the committer has no email column. The commissioner types
            the allowlist in settings after import; managers attach to a seat with{" "}
            <Inline>claimRoster</Inline>.
          </Callout>
          <Note>
            <Inline>addAllowlistEmail</Inline> is app-only: in the catalog, not on the MCP
            allowlist.
          </Note>
        </>
      ),
    },
    {
      id: "after",
      heading: "After the commit",
      body: () => (
        <>
          <P>
            Committing writes your user id as <Inline>commish_id</Inline>. From then on the season
            runs here: waivers, trades, the book, the clock.
          </P>
          <P>
            <Inline>exportLeague</Inline> gives a commissioner a JSON snapshot. Nothing reads one
            back in, and nothing writes to the platform you left.
          </P>
          <Note>
            Migration also runs as a playbook: say “bring over my Sleeper league” to an agent with{" "}
            <Inline>open-leagues-migrate</Inline> installed. It stops for your yes before the
            commit. See <DocLink slug="playbooks">Playbooks</DocLink>.
          </Note>
        </>
      ),
    },
  ],
};

/* ── cli ───────────────────────────────────────────────────────────── */

const cli: DocsPage = {
  title: "CLI",
  lede: "A script with three reads and one gated write. A terminal can inspect a league and place a wager without the browser app.",
  sections: [
    {
      id: "shape",
      heading: "What it dispatches",
      body: () => (
        <>
          <P>
            There is no <Inline>open-leagues</Inline> binary. The CLI is a script and refuses
            anything outside its slice; the full surface is <DocLink slug="agents">MCP</DocLink>.
          </P>
          <Pre label="shell">{`bun scripts/ledger.mjs --help
bun scripts/ledger.mjs --list`}</Pre>
          <DocTable
            head={["Verb", "Kind", "Required flags"]}
            rows={[
              [
                <Mono key="a">getEvents</Mono>,
                <Pill key="b">read</Pill>,
                <Mono key="c">--league [--limit --sinceWeek]</Mono>,
              ],
              [
                <Mono key="a">getLeagueFacts</Mono>,
                <Pill key="b">read</Pill>,
                <Mono key="c">--league --week</Mono>,
              ],
              [
                <Mono key="a">getAgentContext</Mono>,
                <Pill key="b">read</Pill>,
                <Mono key="c">--league --user</Mono>,
              ],
              [
                <Mono key="a">placeWager</Mono>,
                <Pill key="b" tone="ink">
                  write
                </Pill>,
                <Mono key="c">--write --user --league --matchup --kind --side --line --stake</Mono>,
              ],
            ]}
          />
          <Note>
            <Inline>mintToken</Inline> is not a catalog verb. It lets a self-hoster mint a token
            without the browser app.
          </Note>
          <Note>
            Anything else is refused by name: “…is a catalogued read but this CLI slice only
            dispatches getEvents, getLeagueFacts, and getAgentContext”, or “…is mutating and is not
            dispatched from this CLI.”
          </Note>
        </>
      ),
    },
    {
      id: "examples",
      heading: "Real invocations",
      body: () => (
        <>
          <P>
            Flags are <Inline>--key value</Inline>, or one <Inline>--json</Inline> blob with the
            same fields.
          </P>
          <TabbedCode snippets={CLI_SNIPPETS} />
          <Callout tone="warn">
            Live reads and the write need <Inline>DATABASE_URL</Inline> pointing at the app’s
            Postgres. <Inline>bun</Inline> has no Vite <Inline>import.meta.glob</Inline>, so it
            cannot migrate the PGLite fallback. <Inline>--help</Inline> and <Inline>--list</Inline>{" "}
            need no database.
          </Callout>
        </>
      ),
    },
    {
      id: "purse",
      heading: "Reading the purse",
      body: () => (
        <>
          <P>
            <Inline>getAgentContext</Inline> returns the three numbers any spend must respect, in
            one round trip.
          </P>
          <PurseCard />
          <P>
            <Inline>spendable</Inline> is <Inline>max(0, remaining − atRisk)</Inline>.{" "}
            <Inline>placeWager</Inline> validates against <Inline>spendable</Inline>, so an
            unsettled ticket is not spendable money.
          </P>
        </>
      ),
    },
    {
      id: "clock",
      heading: "Not verbs",
      body: () => (
        <P>
          <Inline>tick</Inline> and <Inline>tickAllLeagues</Inline> are the league clock, driven by
          cron or the in-process ticker. Dispatch rejects them by name on both paths: “tick is a
          cron clock, not a tool”.
        </P>
      ),
    },
  ],
};

/* ── agents ────────────────────────────────────────────────────────── */

const agents: DocsPage = {
  title: "Agents & MCP",
  lede: "One URL for any MCP client. The public box needs no token for reads; a league box takes a bearer token or a proxied user id.",
  sections: [
    {
      id: "connect",
      heading: "Connect a client",
      body: () => (
        <>
          <P>
            The public box at <Inline>leagues.waits.dev</Inline> runs in substrate mode: every read
            verb that needs no person answers with no account and no token, rate-limited per IP.
            Your league box is the full product: mint a token at <Inline>/account</Inline> or from a
            shell, or let your edge pass a user id. stdio is for a commissioner who exposes no
            endpoint.
          </P>
          <TabbedCode snippets={connectSnippets(hostOrigin())} />
          <Callout>
            <Inline>/api/mcp</Inline> rejects cookie sessions in every mode. Shell mint:{" "}
            <Inline>bun scripts/ledger.mjs mintToken --write --user …</Inline>. stdio needs a
            Postgres <Inline>DATABASE_URL</Inline> plus <Inline>OPENLEAGUES_USER</Inline> and exits
            without both.
          </Callout>
        </>
      ),
    },
    {
      id: "session",
      heading: "A real session",
      body: () => (
        <>
          <P>
            Captured preseason 2026 against the live host, unedited. The first two calls are tools
            Codex assumed existed; it then introspected the catalog and answered from the league.
          </P>
          <TranscriptReplay />
          <Note>
            Every <Inline>mcp:</Inline> value came back over the wire, none from model memory.
          </Note>
        </>
      ),
    },
    {
      id: "auth",
      heading: "What gates a call",
      body: () => (
        <>
          <P>
            Two checks, and neither reads the catalog’s <Inline>scope</Inline> column. That column
            says which seat a verb is meant for; it is not an authorization tier.
          </P>
          <DocTable
            head={["Check", "Applies to", "Failure"]}
            rows={[
              [
                <Mono key="a">userId present</Mono>,
                "Every mutating verb",
                "“…requires a signed-in user”",
              ],
              [
                <Mono key="a">assertLeagueViewer</Mono>,
                "Every league-scoped call",
                <Mono key="c">Unauthorized · 401</Mono>,
              ],
            ]}
          />
          <P>
            <Inline>assertLeagueViewer</Inline> passes only the league’s commissioner or a seat
            holder, and refuses before any write runs.
          </P>
          <Callout tone="warn">
            Every read of an <Inline>lg_</Inline> league (browser, CLI, or agent) goes through the
            same seat check. Raw Sleeper ids are the exception: that data is already public on
            Sleeper.
          </Callout>
        </>
      ),
    },
    {
      id: "identity",
      heading: "Bring your own identity",
      body: () => (
        <>
          <P>
            Those checks are league rules. How a caller proved identity is yours to decide; the
            engine takes a user id.
          </P>
          <TabbedCode snippets={IDENTITY_SNIPPETS} />
          <P>
            In <Inline>proxy</Inline> mode nothing else is trusted: no bearer, no cookie, no user id
            in tool arguments. Your edge authenticates (SSO, mTLS, a gateway) and passes the id.
          </P>
          <Callout tone="warn">
            Set <Inline>OPENLEAGUES_MCP_PROXY_SECRET</Inline> so only your proxy can set the header.
            Unset, the box logs a warning and trusts the header anyway.
          </Callout>
          <Note>
            Every mode fails closed. Unset means <Inline>token</Inline>; an unrecognised mode
            refuses to serve. stdio has no HTTP identity; <Inline>OPENLEAGUES_USER</Inline> is its
            trust boundary.
          </Note>
        </>
      ),
    },
    {
      id: "token-scope",
      heading: "Token scope: read or act",
      body: () => (
        <>
          <P>
            Every token is minted <Inline>read</Inline> or <Inline>act</Inline>. A read token calls
            read verbs only; an act token does what its seat can do. This is the one scope the
            engine enforces.
          </P>
          <Pre label="mint a read-only token from a shell">{`bun scripts/ledger.mjs mintToken --write --user usr_… --name codex --scope read`}</Pre>
          <DocTable
            head={["Scope", "May call", "On refusal"]}
            rows={[
              [<Mono key="a">read</Mono>, "Every verb with kind: read", "“…requires an act token”"],
              [<Mono key="a">act</Mono>, "Everything the seat may do", "Seat rules, as usual"],
            ]}
          />
          <P>
            Every write by an act token is logged as an <Inline>agent_action</Inline> event with the
            token’s name, so a receipt can show “codex started X over Y at 11:52am” next to the
            human’s line. In proxy mode <Inline>x-openleagues-scope: read</Inline> narrows a caller.
          </P>
        </>
      ),
    },
    {
      id: "scopes",
      heading: "Reading the scope column",
      body: () => (
        <>
          <P>
            The scope column says who a verb is for. <Inline>getAgentContext</Inline> filters the
            tool list it hands an agent by the caller’s standing.
          </P>
          <DocTable
            head={["Scope", "Meant for", "Verbs"]}
            rows={[
              [
                <strong key="a" className="font-medium text-fg">
                  spectator
                </strong>,
                "Anyone who can see the league",
                <Mono key="c">{scopeCount("spectator")}</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  manager
                </strong>,
                "A seat: lineup, wire, trades, book",
                <Mono key="c">{scopeCount("manager")}</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  commish
                </strong>,
                "The league: settings, waivers, the clock",
                <Mono key="c">{scopeCount("commish")}</Mono>,
              ],
            ]}
          />
        </>
      ),
    },
  ],
};

/* ── reading league state ──────────────────────────────────────────── */

const state: DocsPage = {
  title: "Reading league state",
  lede: "Four reads cover the common questions about a league. Start with getAgentContext, then narrow.",
  sections: [
    {
      id: "four",
      heading: "The four reads",
      body: () => (
        <>
          <DocTable
            head={["Verb", "Arguments", "Answers"]}
            rows={[
              [
                <Mono key="a">getAgentContext</Mono>,
                <Mono key="b">leagueId</Mono>,
                "Your seat, the week, your purse, the verbs you may call",
              ],
              [
                <Mono key="a">getLeagueBundle</Mono>,
                <Mono key="b">leagueId</Mono>,
                "Standings, scoring, lineup slots, ops settings",
              ],
              [
                <Mono key="a">getMatchups</Mono>,
                <Mono key="b">leagueId, week</Mono>,
                "The week’s pairs with both starting lineups",
              ],
              [
                <Mono key="a">getTeam</Mono>,
                <Mono key="b">leagueId, rosterId, week</Mono>,
                "One roster: record and players with slot, bye, injury",
              ],
            ]}
          />
          <P>
            Start each session with <Inline>getAgentContext</Inline>: one round trip for seat,
            purse, league facts, recent events, and the in-scope tool list.
          </P>
          <Pre label="getAgentContext · response">{`{
  "leagueId": "lg_wiffl",
  "name": "WIFFL",
  "week": 1,
  "status": "in_season",              // pre_draft | drafting | in_season
  "you": { "userId": "usr_…", "rosterId": 4, "teamName": "hands", "isCommish": false },
  "purse": { "remaining": 86, "atRisk": 12, "spendable": 74 },
  "knobs": { "bettingOn": true, "wagerCap": 25, "exposureCap": 40, "bookLocked": false },
  "facts": [ { "kind": "streak", "teams": ["hands"], "text": "…" } ],
  "recent": [ { "id": "ev_…", "week": 1, "kind": "waiver", "amount": 14, "at": "…" } ],
  "tools": [ { "id": "getMatchups", "scope": "spectator", "kind": "read" } ]
}`}</Pre>
          <Note>
            Without a seat, <Inline>you</Inline> is <Inline>null</Inline> and <Inline>purse</Inline>{" "}
            is zeroed. For a settled week (flip, bench, wire) read the{" "}
            <DocLink slug="receipts">receipt</DocLink> instead.
          </Note>
        </>
      ),
    },
    {
      id: "shape",
      heading: "The board and its payload",
      body: () => (
        <>
          <P>The board below is drawn from the array behind the toggle.</P>
          <MatchupPreview caption="getMatchups · lg_wiffl · week 1" />
        </>
      ),
    },
    {
      id: "points",
      heading: "Points, and what is missing from them",
      body: () => (
        <>
          <P>
            A filled starter slot in an unplayed week carries <Inline>points: 0</Inline>;{" "}
            <Inline>null</Inline> means an empty slot. <Inline>MatchupSide.points</Inline> is the
            sum, so it is <Inline>0</Inline> before kickoff.
          </P>
          <Callout tone="warn">
            <Inline>getMatchups</Inline> carries no projections. <Inline>expected</Inline> and{" "}
            <Inline>forecast</Inline> are added by the app’s enrichment pass. An agent calls{" "}
            <Inline>getWeekProjections</Inline> or <Inline>getProjections</Inline>, both on the
            allowlist.
          </Callout>
          <P>
            That is why <Inline>open-leagues-lineup</Inline> calls{" "}
            <Inline>getWeekProjections</Inline> before proposing a sit/start.
          </P>
        </>
      ),
    },
    {
      id: "book",
      heading: "The book",
      body: () => (
        <>
          <P>
            <Inline>getBook</Inline> returns the week’s lines, your positions, settled ones, the
            house pool, your purse, and the caps. Two markets, spread and moneyline; no over/under.
          </P>
          <DocTable
            head={["Field", "Holds"]}
            rows={[
              [
                <Mono key="a">lines[]</Mono>,
                <Mono key="b">
                  matchupId · spread · homePct/awayPct · homeMult/awayMult · locked
                </Mono>,
              ],
              [
                <Mono key="a">positions[]</Mono>,
                <Mono key="b">
                  id · kind · sideRoster · line · mult · stake · status · payout · mine
                </Mono>,
              ],
              [<Mono key="a">purse</Mono>, <Mono key="b">budget · free · atRisk · rosterId</Mono>],
              [<Mono key="a">caps</Mono>, <Mono key="b">wager · exposure</Mono>],
            ]}
          />
          <Note>
            <Inline>spread</Inline> is the single spread field, negative when the home side is
            favoured. <Inline>homeMult</Inline> / <Inline>awayMult</Inline> are moneyline profit per
            dollar.
          </Note>
        </>
      ),
    },
  ],
};

/* ── playbooks ─────────────────────────────────────────────────────── */

const playbooks: DocsPage = {
  title: "Playbooks",
  lede: "Six skills ship in the repo. Each turns one sentence into a chain of verbs and stops where a human should confirm.",
  sections: [
    {
      id: "install",
      heading: "Install them",
      body: () => (
        <>
          <P>
            One command with the <Inline>skills</Inline> CLI, or copy the folder. A skill is a
            folder with a <Inline>SKILL.md</Inline>; the six live at <Inline>skills/</Inline> in the
            repo.
          </P>
          <Pre label="shell">{`npx skills add ryanwaits/open-leagues -g                          # every skill, Claude Code
npx skills add ryanwaits/open-leagues --skill open-leagues-week -g  # one
npx skills add ryanwaits/open-leagues --agent codex -g            # Codex

# or from a checkout
cp -R skills/open-leagues-* ~/.claude/skills/
# or
ln -s "$PWD/skills/open-leagues-week" ~/.codex/skills/`}</Pre>
        </>
      ),
    },
    {
      id: "chains",
      heading: "What each sentence fires",
      body: () => (
        <>
          <P>
            Writes are marked; everything else is a read. The lineup, migrate, and book skills stop
            for a human before anything mutates. The two lab skills move no money.
          </P>
          <PlaybookList playbooks={PLAYBOOKS} />
          <Note>
            Every verb these skills call is on the MCP allowlist, except{" "}
            <Inline>addAllowlistEmail</Inline>, which is app-only.
          </Note>
        </>
      ),
    },
    {
      id: "why",
      heading: "Why a skill",
      body: () => (
        <P>
          The session on the <DocLink slug="agents">Agents</DocLink> page shows two failed guesses
          before the agent found the catalog. A skill front-loads the order.
        </P>
      ),
    },
  ],
};

/* ── catalog ───────────────────────────────────────────────────────── */

const catalog: DocsPage = {
  title: "Verb catalog",
  lede: `The catalog lists every verb the engine has. MCP exposes ${MCP_WIRED} of ${MCP_CATALOG} today.`,
  sections: [
    { id: "table", heading: "Every verb", body: () => <CatalogTable /> },
    {
      id: "confirm",
      heading: "Season operations need confirm",
      body: () => (
        <>
          <P>
            Six verbs move the whole league, and none has an opposite verb to undo it. Dispatch
            refuses them without <Inline>confirm: true</Inline>.
          </P>
          <DocTable
            head={["Verb", "What it moves"]}
            rows={[
              [<Mono key="a">advanceWeek</Mono>, "The clock. Locks the week and opens the next."],
              [
                <Mono key="a">processWaivers</Mono>,
                "Every pending claim, in bid order. Spends FAAB.",
              ],
              [<Mono key="a">saveSettings</Mono>, "Scoring, budgets, playoff shape, book knobs."],
              [<Mono key="a">saveWeekSchedule</Mono>, "One week's pairings."],
              [<Mono key="a">rebuildSchedule</Mono>, "The whole remaining schedule."],
              [
                <Mono key="a">importLeague</Mono>,
                "Commits a migration and makes you commissioner.",
              ],
            ]}
          />
          <Note>
            <Inline>saveSettings</Inline> drops unrecognised keys and reports which fields it
            changed.
          </Note>
        </>
      ),
    },
    {
      id: "reading",
      heading: "Reading a row",
      body: () => (
        <>
          <Bullets>
            <li>
              <strong className="font-medium text-fg">scope</strong>: who the verb is for.
              Documentation; see <DocLink slug="agents">what gates a call</DocLink>.
            </li>
            <li>
              <strong className="font-medium text-fg">read</strong>: never mutates.
            </li>
            <li>
              <strong className="font-medium text-fg">atomic</strong>: one mutation, reversible by
              its opposite verb.
            </li>
            <li>
              <strong className="font-medium text-fg">workflow</strong>: several mutations behind
              one call, such as <Inline>addDrop</Inline> and <Inline>importLeague</Inline>.
            </li>
            <li>
              <strong className="font-medium text-fg">MCP</strong>: whether the id is on the
              allowlist. Unwired verbs run in the browser app only.
            </li>
          </Bullets>
          <Note>
            Adding a verb to MCP is an id in <Inline>core.ts</Inline> plus a branch in{" "}
            <Inline>dispatch.ts</Inline>.
          </Note>
        </>
      ),
    },
  ],
};

/* ── self-host ─────────────────────────────────────────────────────── */

const selfHost: DocsPage = {
  title: "Self-host",
  lede: "One container with a volume, or a Vercel deploy with managed Postgres. The difference is who drives the league clock.",
  sections: [
    {
      id: "docker",
      heading: "Docker",
      body: () => (
        <>
          <P>
            The compose file publishes 8080 and keeps PGLite on a named volume. Do not set{" "}
            <Inline>DATABASE_URL</Inline> here; the volume is the database.
          </P>
          <Pre label="docker-compose.yml (abridged)">{`services:
  app:
    build: .
    ports: ["8080:8080"]
    volumes: [open-leagues-data:/data]
    environment:
      PGLITE_DATA_DIR: /data/pglite
      OPENLEAGUES_SELF_TICK: "1"
      BETTER_AUTH_URL: \${BETTER_AUTH_URL:-http://localhost:8080}
      BETTER_AUTH_SECRET: \${BETTER_AUTH_SECRET:-}
      CRON_SECRET: \${CRON_SECRET:-}`}</Pre>
          <P>
            Left blank, <Inline>BETTER_AUTH_SECRET</Inline> is generated at{" "}
            <Inline>/data/better-auth-secret</Inline> on the volume. Set it for more than one
            replica.
          </P>
          <Note>
            Set <Inline>BETTER_AUTH_URL</Inline> to your public origin, no trailing slash, once the
            box sits behind a proxy or domain.
          </Note>
        </>
      ),
    },
    {
      id: "local",
      heading: "Local",
      body: () => (
        <>
          <P>PGLite migrates itself on first database access.</P>
          <Pre label="shell">{`bun install
cp .env.example .env      # optional
bun run dev               # 0.0.0.0:8080`}</Pre>
          <Callout>
            <Inline>bun run db:migrate</Inline> is a no-op without <Inline>DATABASE_URL</Inline>: it
            prints “skipping” and exits.
          </Callout>
        </>
      ),
    },
    {
      id: "clock",
      heading: "The clock",
      body: () => (
        <>
          <P>Scoring advances on a tick. One process should drive it.</P>
          <DocTable
            head={["Host", "Clock", "Setting"]}
            rows={[
              [
                "Docker / any long-lived box",
                "In-process ticker",
                <Mono key="c">OPENLEAGUES_SELF_TICK=1</Mono>,
              ],
              [
                "Vercel",
                <span key="b">
                  <Mono>vercel.json</Mono> cron, <Mono>15 * * * *</Mono>
                </span>,
                <Mono key="c">leave it unset</Mono>,
              ],
            ]}
          />
          <Callout tone="warn">
            <Inline>OPENLEAGUES_SELF_TICK</Inline> on Vercel gives you two clocks. Without{" "}
            <Inline>CRON_SECRET</Inline>, <Inline>/api/league/tick</Inline> accepts unauthenticated
            requests and the box logs a warning at boot.
          </Callout>
        </>
      ),
    },
    {
      id: "env",
      heading: "Environment",
      body: () => (
        <>
          <P>
            The full list is in <Inline>.env.example</Inline>. These decide whether a box boots:
          </P>
          <DocTable
            head={["Variable", "Docker", "Vercel", "Purpose"]}
            rows={[
              [
                <Mono key="a">DATABASE_URL</Mono>,
                <Pill key="b" tone="off">
                  omit
                </Pill>,
                <Pill key="c" tone="ink">
                  required
                </Pill>,
                "Postgres. Absent selects PGLite.",
              ],
              [
                <Mono key="a">PGLITE_DATA_DIR</Mono>,
                <Pill key="b">preset</Pill>,
                <Pill key="c" tone="off">
                  n/a
                </Pill>,
                "Where durable PGLite lives.",
              ],
              [
                <Mono key="a">BETTER_AUTH_URL</Mono>,
                <Pill key="b">set it</Pill>,
                <Pill key="c" tone="ink">
                  required
                </Pill>,
                "Public origin, no trailing slash.",
              ],
              [
                <Mono key="a">BETTER_AUTH_SECRET</Mono>,
                <Pill key="b">optional</Pill>,
                <Pill key="c" tone="ink">
                  required
                </Pill>,
                "Session signing. Self-generates on the volume.",
              ],
              [
                <Mono key="a">CRON_SECRET</Mono>,
                <Pill key="b">advised</Pill>,
                <Pill key="c">advised</Pill>,
                "Guards the tick endpoint.",
              ],
              [
                <Mono key="a">OPENLEAGUES_MCP_AUTH</Mono>,
                <Pill key="b">optional</Pill>,
                <Pill key="c">optional</Pill>,
                "token (default) or proxy: who /api/mcp trusts.",
              ],
              [
                <Mono key="a">OPENLEAGUES_MODE</Mono>,
                <Pill key="b">optional</Pill>,
                <Pill key="c">optional</Pill>,
                "unset = substrate (receipts, open data, the lab, public MCP; no accounts or leagues). league = the whole product. Compose and bun run dev set league.",
              ],
              [
                <Mono key="a">OPENLEAGUES_SPLITS_SOURCE</Mono>,
                <Pill key="b">optional</Pill>,
                <Pill key="c">optional</Pill>,
                "off (default), or a list: actionnetwork (consensus, history from 2023), dknetwork (DraftKings' own, current slate), wiseguyteam (multi-book, current slate). Every pulled week is kept.",
              ],
            ]}
          />
          <Callout>
            Agent tokens (<Inline>ol_…</Inline>) are minted in-app and never belong in an env file.
          </Callout>
        </>
      ),
    },
    {
      id: "identity",
      heading: "Who your box trusts",
      body: () => (
        <>
          <P>
            By default <Inline>/api/mcp</Inline> issues and checks its own bearer tokens against its
            own database. A token minted here works here only.
          </P>
          <Pre label="headless mint, no browser">{`bun scripts/ledger.mjs mintToken --write --user usr_… --name codex`}</Pre>
          <P>
            If you authenticate people at the edge, set <Inline>OPENLEAGUES_MCP_AUTH=proxy</Inline>{" "}
            and pass the user id on a header. See{" "}
            <DocLink slug="agents">bring your own identity</DocLink>.
          </P>
        </>
      ),
    },
    {
      id: "build",
      heading: "Build and migrations",
      body: () => (
        <>
          <P>
            <Inline>bun run build</Inline> is <Inline>vite build</Inline> then{" "}
            <Inline>db:migrate</Inline>. The ordering is for Vercel, where migrations run against{" "}
            <Inline>DATABASE_URL</Inline> on every deploy.
          </P>
          <P>
            The Docker image runs <Inline>vite build</Inline> at image build time and migrations at
            container start. With no <Inline>DATABASE_URL</Inline>, they skip and PGLite migrates
            itself.
          </P>
        </>
      ),
    },
  ],
};

export const DOCS_PAGES: Record<DocsSlug, DocsPage> = {
  overview,
  guide,
  receipts,
  "open-data": openData,
  quickstart,
  migrate,
  cli,
  agents,
  state,
  playbooks,
  catalog,
  "self-host": selfHost,
};

export function DocsArticle({ slug }: { slug: DocsSlug }) {
  const page = DOCS_PAGES[slug];
  const { prev, next } = docsNeighbours(slug);
  const audience = useAudience();
  const visible = page.sections.filter((s) => showsFor(s.audience, audience));

  return (
    <article>
      <h1 className="text-balance font-display text-[31px] font-medium leading-[1.2] tracking-[-0.012em]">
        {page.title}
      </h1>
      <p className="mt-3.5 max-w-[640px] text-[15px] leading-relaxed text-muted">{page.lede}</p>

      {visible.map((section) => {
        const Body = section.body;
        return (
          <section key={section.id} className="mt-8 border-t border-line pt-7">
            <h2
              id={section.id}
              className="scroll-mt-20 font-display text-[19px] font-medium tracking-[-0.005em] text-fg"
            >
              {section.heading}
            </h2>
            <Body />
          </section>
        );
      })}

      <nav className="mt-10 grid gap-2.5 border-t border-line pt-5 sm:grid-cols-2">
        {prev ? <PagerLink item={prev} dir="Previous" /> : <span />}
        {next ? <PagerLink item={next} dir="Next" /> : <span />}
      </nav>
    </article>
  );
}

function PagerLink({
  item,
  dir,
}: {
  item: { slug: DocsSlug; label: string };
  dir: "Previous" | "Next";
}) {
  const className = `block rounded-sm border border-line bg-surface px-3.5 py-2.5 text-[14px] hover:border-line-strong ${
    dir === "Next" ? "text-right sm:col-start-2" : ""
  }`;
  const inner = (
    <>
      <span className="mb-0.5 block font-mono text-[10px] tracking-[0.07em] text-faint uppercase">
        {dir}
      </span>
      {item.label}
    </>
  );
  if (item.slug === "overview") {
    return (
      <Link to="/docs" className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/docs/$slug" params={{ slug: item.slug }} className={className}>
      {inner}
    </Link>
  );
}
