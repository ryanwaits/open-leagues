import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
  lede: "Receipts for your fantasy week, on a headless league. Postgres holds the league and enforces the rules; an MCP server exposes every verb; the browser app is client zero — not the product.",
  sections: [
    {
      id: "what",
      heading: "What this is",
      body: () => (
        <>
          <P>
            Two things, one box. <DocLink slug="receipts">Receipts</DocLink> read any Sleeper league
            by id — no account — and say when a matchup flipped, what sat on the bench, and what the
            wire cost. Underneath is a fantasy football league that keeps its state in a database
            you control and its rules in one engine, exposed three ways. The surfaces differ in
            reach, not in rules — they all land on the same server modules.
          </P>
          <DocTable
            head={["Surface", "Reach", "Entry point"]}
            rows={[
              [
                <strong key="a" className="font-medium text-fg">
                  Receipts
                </strong>,
                "Any Sleeper league, anonymous",
                <Mono key="c">/r/:leagueId · /api/*.json</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The public box
                </strong>,
                "The default shape: receipts, open data, the lab, public MCP · no accounts, no leagues",
                <Mono key="c">OPENLEAGUES_MODE unset · league for the whole product</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The lab
                </strong>,
                "Real NFL lines, cohorts, grading, staking · 13 verbs",
                <Mono key="c">/api/lines/:season.json · two skills</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Browser app
                </strong>,
                "Everything",
                <Mono key="c">createServerFn</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  MCP server
                </strong>,
                `${MCP_WIRED} of ${MCP_CATALOG} verbs`,
                <Mono key="c">/api/mcp · scripts/mcp.mjs</Mono>,
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  Ledger CLI
                </strong>,
                "3 reads + one gated write",
                <Mono key="c">scripts/ledger.mjs</Mono>,
              ],
            ]}
          />
          <Callout>
            The CLI is a deliberate slice, not a second full client. If you want the whole surface
            from a terminal, point an agent at MCP — that is the headless path. See{" "}
            <DocLink slug="cli">CLI</DocLink> for exactly what it dispatches.
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
            Docker is the shortest path to a durable box: PGLite lives on a volume, the league clock
            ticks in-process, and nothing needs a managed Postgres.
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
            One league row, ten rosters, a schedule, a wire, and a book. Three invariants the engine
            holds regardless of which surface asked:
          </P>
          <Bullets>
            <li>
              <strong className="font-medium text-fg">FAAB is one purse.</strong> Waiver bids and
              wager stakes draw from the same <Inline>faab_remaining</Inline>, so a spend is checked
              against <Inline>spendable</Inline> — remaining minus what is staked and unsettled —
              never against <Inline>remaining</Inline>.
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
            After a migrate commits, this box is the source of truth. Extract is one-way —{" "}
            <Inline>exportLeague</Inline> hands back a JSON snapshot; there is no import-from-backup
            and nothing syncs to Sleeper or ESPN.
          </Callout>
        </>
      ),
    },
  ],
};

/* ── receipts ──────────────────────────────────────────────────────── */

const receipts: DocsPage = {
  title: "Receipts",
  lede: "Paste a Sleeper league id. For any team, any settled week: the minute the matchup flipped, what was left on the bench, what the wire cost — and which open source called it before kickoff.",
  sections: [
    {
      id: "urls",
      heading: "Two URLs",
      body: () => (
        <>
          <DocTable
            head={["URL", "Shows", "Needs"]}
            rows={[
              [
                <Mono key="a">/r/:leagueId</Mono>,
                "Every matchup of the current week, one line each; a week picker",
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
            <Inline>:leagueId</Inline> is a raw Sleeper id. Private leagues work — Sleeper’s API
            serves them by id — and a username in the home input lists that person’s leagues to pick
            from. Team names only: when a team name is just the manager’s username, it renders as{" "}
            <Inline>Roster N</Inline>.
          </P>
          <Callout>
            A league on your own box (an <Inline>lg_</Inline> id) has receipts too, behind the same
            seat check as everything else there — and no public card. The anonymous path is for
            public Sleeper data only; the public box hosts no leagues at all.
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
                "The minute the matchup last changed hands, the play, and how likely you were to win a half-hour earlier",
                "nflverse play-by-play, scored under the league’s own book, to the second",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The bench
                </strong>,
                "Points left sitting, and exactly who over whom",
                "Best lineup on the box score versus the lineup actually set",
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
                "Bids as a share of your budget, results, and what the player cleared for elsewhere",
                "The league’s transactions plus the wire clearing prices in percent of budget, once a second league has one",
              ],
              [
                <strong key="a" className="font-medium text-fg">
                  The season ledger
                </strong>,
                "Which open source would have set a better lineup than you did, week by week, over the season",
                "Each source’s pre-kickoff lineup scored on the box score; counts labeled with weeks",
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
          <Pre label="a real one · SDIFFL 2025 · week 14 · NateBot 129.0 — Roster 14 85.3">{`Took the lead for good at 3:41pm ET on a Trevor Lawrence completion, 78.8–78.6 · 78% to win at 3:11pm.
6.5 left on the bench — Omarion Hampton (13.7) started over Saquon Barkley (20.2).
  Sleeper projection, Last 3 weeks, and Season average all said start Barkley.
Wire: bid $26 on Stefon Diggs — 13% of a $200 budget — lost.`}</Pre>
          <Note>
            Hindsight, on purpose. A projection is an opinion and a box score is a fact; the receipt
            is about facts, and it names which opinions were right. Paid sources never appear, even
            as a comparison.
          </Note>
        </>
      ),
    },
    {
      id: "card",
      heading: "The card",
      body: () => (
        <>
          <P>
            Every receipt page sets <Inline>og:image</Inline> to a rendered PNG at{" "}
            <Inline>/api/og/r/:leagueId/:week/:rosterId</Inline>, so pasting the link into iMessage,
            Discord, or a group chat unfurls the receipt itself. The card is rendered server-side
            with the same lines as the page; nothing is drawn that is not on the receipt.
          </P>
          <Callout tone="warn">
            Receipts read a league’s public Sleeper data and show team names, not people. To have a
            league’s receipts taken down, open an issue on the repo with the league id.
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
              scoring deltas — who gained what, on which play, at which wall-clock second.
            </li>
            <li>
              Both lineups are replayed under the league’s scoring book, so a half-PPR league’s flip
              and a full-PPR league’s flip can land on different plays for the same game slate.
            </li>
            <li>
              The flip is the last moment the lead changed. “How likely you were” is a
              win-probability snapshot from thirty minutes earlier, from the two scores and the game
              states then.
            </li>
            <li>
              Kick times are printed in Eastern. If the season’s play-by-play is not published yet
              (the current week, most Sundays), the receipt says so rather than guessing.
            </li>
            <li>
              The play log is settled to the box score. Where nflverse and Sleeper’s official weekly
              stats disagree — a re-spotted catch, a Thursday stat correction — the difference is
              booked as one event at the final whistle, so every final matches Sleeper to the cent
              (84 of 84 team-weeks checked on a real league) and the play log still supplies the
              minute. If a correction is what decided the week, the receipt says “on the final box
              score” instead of naming a play.
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
  lede: "The files every hobby tool rebuilds by hand, published once: the player-ID crosswalk, FAAB clearing prices, and every NFL game’s closing line since 1999. Anonymous, CORS on, no key.",
  sections: [
    {
      id: "players",
      heading: "/api/players.json",
      body: () => (
        <>
          <P>
            The player-ID crosswalk: Sleeper, GSIS (nflverse), ESPN, Yahoo, RotoWire, and Sportradar
            ids side by side, with name, team, and position. Built from Sleeper’s player file and
            refreshed as it is; cached a day.
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
            What each player actually cleared for on waivers that week, across every Sleeper league
            that has asked for a receipt — as a{" "}
            <strong className="font-medium text-fg">share of budget</strong>, because a dollar is
            not a unit: $50 is half of a $100 league and a twentieth of a $1,000 one. Median,
            quartiles, max, the share of what the winner had left, and the count behind each number.
            Raw dollars appear only when every bid came from the same budget. The figure paid tools
            predict with a model, published as a fact.
          </P>
          <P>
            Filter to a cohort so formats are not averaged together:{" "}
            <Inline>?rosters=12&amp;format=half&amp;superflex=false</Inline>. The payload’s{" "}
            <Inline>budgets</Inline> map shows how many contributing leagues run each purse.
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
              Only leagues that have pasted contribute. Each receipt read registers its league;
              nothing is crawled.
            </li>
            <li>
              No league id, manager, or roster appears in the payload. <Inline>n</Inline> is the
              number of winning bids behind a price; <Inline>median_pct_remaining</Inline> is the
              bid as a share of what the winner still had, reconstructed from their earlier wins.
            </li>
            <li>
              Cached an hour once at least one league has a cleared claim; empty results are not
              cached, so the file fills in as leagues arrive.
            </li>
            <li>
              A team’s own receipt shows every bid as a percent of its budget, and the median share
              beside a won claim once a second league has one, with the count — so a single league’s
              bid never reads as “the market”.
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
            Every game of a season with its closing spread, total, moneylines, the prices on each
            side, the result, and the context a strategy keys on: rest days, roof, surface, division
            game, weekday, starting quarterbacks, referee. nflverse’s games table, 1999 to now,
            refreshed every six hours. Closing lines only — free opening lines exist for 2007–2021
            in the Sportsbook Review archive and are not wired in. Public betting splits are a
            separate, opt-in feed (<Inline>OPENLEAGUES_SPLITS_SOURCE=actionnetwork</Inline>, 2023
            onward) read over MCP as <Inline>getBettingSplits</Inline>; they are not republished
            here because they are not ours to publish.
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
            The same rows drive the lab’s verbs over MCP — <Inline>getGameLines</Inline>,{" "}
            <Inline>getGameContext</Inline>, <Inline>getBettingSplits</Inline>,{" "}
            <Inline>sampleGames</Inline>, <Inline>evaluateBets</Inline>,{" "}
            <Inline>summarizeRun</Inline> (with <Inline>pBreakEven</Inline>), and{" "}
            <Inline>simulateBankroll</Inline> — plus a person’s frozen strategies and their run
            ledger (<Inline>freezeStrategy</Inline>, <Inline>recordLabRun</Inline>,{" "}
            <Inline>getLabRuns</Inline>). Two skills compose them: <Inline>lab-discover</Inline>{" "}
            holds out a season before it freezes anything; <Inline>lab-run</Inline> grades a frozen
            rule each week and writes the digest. Neither can place a bet. The{" "}
            <DocLink slug="guide">guide</DocLink> runs a real one.
          </P>
        </>
      ),
    },
  ],
};

/* ── quickstart ────────────────────────────────────────────────────── */

const quickstart: DocsPage = {
  title: "Quickstart",
  lede: "From an empty box to an agent answering a question about your league. Six steps, no integration code on either side.",
  sections: [
    {
      id: "steps",
      heading: "Six steps",
      body: () => (
        <Steps>
          <Step n={1} title="Run a box">
            <P>
              Docker gives you a durable box with the clock already running. Locally,{" "}
              <Inline>bun run dev</Inline> binds <Inline>0.0.0.0:8080</Inline> and migrates its own
              PGLite on first access — no Postgres, no migrate step.
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
              A fresh box has no users and no leagues in it. Open{" "}
              <Inline>http://localhost:8080/login</Inline>, choose{" "}
              <strong className="font-medium text-fg">Need an account?</strong>, and sign up. There
              is no admin tier — the first account is an account like any other.
            </P>
            <Note>
              Nothing is seeded. If you want the maintainer&apos;s own fixture league for
              development, start the box with <Inline>OPENLEAGUES_DEV_SEED=1</Inline> instead.
            </Note>
          </Step>
          <Step n={3} title="Start or migrate a league">
            <P>
              Go to <Inline>/new</Inline>. Start one from scratch, or import from Sleeper, ESPN, or
              a pasted recap. Migration is always preview-then-commit, and whoever commits becomes
              the commissioner of the resulting league.
            </P>
            <Note>
              An agent can do this too — <Inline>previewImport</Inline> then{" "}
              <Inline>importLeague</Inline> with <Inline>confirm: true</Inline>. See{" "}
              <DocLink slug="migrate">Migrate a league</DocLink>.
            </Note>
          </Step>
          <Step n={4} title="Mint an agent token">
            <P>
              On your league box, open <Inline>/account</Inline> — any member, no commissioner gate.
              Under <strong className="font-medium text-fg">Agent tokens</strong>, name one and
              create it. The raw <Inline>ol_…</Inline> value is shown once.
            </P>
            <Note>
              Never opening the browser? The CLI issues the same credential against the same box:{" "}
              <Inline>bun scripts/ledger.mjs mintToken --write --user …</Inline>
            </Note>
            <Callout tone="warn">
              If you lose it, revoke and mint a new one. There is no second look at the value.
            </Callout>
          </Step>
          <Step n={5} title="Point a client at it">
            <P>Every client below speaks the same endpoint. None of them is a plugin we wrote.</P>
            <TabbedCode snippets={connectSnippets(hostOrigin())} />
          </Step>
          <Step n={6} title="Ask it something">
            <P>Plain language. The agent introspects the catalog and picks its own verbs.</P>
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
            Before blaming a prompt, confirm the transport. The row should read{" "}
            <Inline>enabled</Inline> with <Inline>Bearer token</Inline>.
          </P>
          <Pre label="codex mcp list">{`Name          Url                                 Bearer Token Env Var  Status   Auth
open-leagues  ${hostOrigin()}/api/mcp   OPENLEAGUES_TOKEN     enabled  Bearer token`}</Pre>
          <Callout tone="warn">
            Your token must belong to someone with a seat in the league you are asking about. Every
            call on a league-box league (an <Inline>lg_</Inline> id) runs{" "}
            <Inline>assertLeagueViewer</Inline> — commissioner or seat holder, or the call returns{" "}
            <Inline>Unauthorized</Inline>. A raw Sleeper league id is different: it is
            Sleeper&apos;s own public data, passed through read-only, and needs no seat.
          </Callout>
        </>
      ),
    },
  ],
};

/* ── migrate ───────────────────────────────────────────────────────── */

const migrate: DocsPage = {
  title: "Migrate a league",
  lede: "Every source becomes one import pack — teams, managers, slots, scoring, rosters, weeks. You preview the pack, then commit it.",
  sections: [
    {
      id: "sources",
      heading: "Pick a source",
      body: () => (
        <>
          <P>
            Three paths, two verbs each. Paste or file is always the fallback when a connect fails
            or the platform is unsupported.
          </P>
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
            Sleeper import takes a <strong className="font-medium text-fg">league id</strong>. If
            all you have is a username, <Inline>findSleeperUser</Inline> is the discovery step that
            finds their leagues for a season — it is not itself an input to the import.
          </P>
          <Pre label="MCP · arguments">{`findSleeperUser  { "query": "ryan" }

previewImport    { "sleeperId": "<league id>", "includeHistory": false }

importLeague     { "sleeperId": "<league id>",
                   "claimRosterId": 4,
                   "includeHistory": false,
                   "confirm": true }`}</Pre>
          <Note>
            <Inline>confirm: true</Inline> is an MCP-layer gate only — it is not part of the server
            function signature. Dispatch refuses the call without it, so an agent cannot commit an
            import by accident.
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
            The preview reads and shapes; it writes nothing. Every write in a migration happens
            inside one committer, so a failed import does not leave half a league behind.
          </P>
          <Callout>
            <strong className="font-medium text-fg">Never invent manager emails.</strong> No source
            API gives you a trustworthy one, and the committer has no email column to write to. The
            allowlist is a post-import step the commissioner types in settings, and managers attach
            themselves to a seat with <Inline>claimRoster</Inline>.
          </Callout>
          <Note>
            <Inline>addAllowlistEmail</Inline> is app-only — it is in the catalog but not on the MCP
            allowlist, so an agent cannot seed the allowlist for you.
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
            Committing makes you the commissioner of the new league — the importing user id is
            written as <Inline>commish_id</Inline>. From there the season runs here: waivers,
            trades, the book, the clock.
          </P>
          <P>
            <Inline>exportLeague</Inline> gives a commissioner a JSON snapshot at any point. There
            is no counterpart that reads one back in, and nothing writes to the platform you left.
          </P>
          <Note>
            Migration also runs as a playbook — say “bring over my Sleeper league” to an agent with{" "}
            <Inline>open-leagues-migrate</Inline> installed and it walks the tree, stopping for your
            yes before the commit. See <DocLink slug="playbooks">Playbooks</DocLink>.
          </Note>
        </>
      ),
    },
  ],
};

/* ── cli ───────────────────────────────────────────────────────────── */

const cli: DocsPage = {
  title: "CLI",
  lede: "A ledger slice, not a second client. Three reads and one gated write, so a terminal can inspect a league and settle a bet without standing up the whole surface.",
  sections: [
    {
      id: "shape",
      heading: "What it dispatches",
      body: () => (
        <>
          <P>
            There is no <Inline>open-leagues</Inline> binary. The CLI is a script, and it refuses by
            design anything outside its slice — the full surface is{" "}
            <DocLink slug="agents">MCP</DocLink>.
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
            <Inline>mintToken</Inline> is not a catalog verb — issuing a credential is not a league
            primitive. It exists here so a self-hoster can go headless without opening the browser
            app at all.
          </Note>
          <Note>
            Anything else in the catalog is refused by name: “…is a catalogued read but this CLI
            slice only dispatches getEvents, getLeagueFacts, and getAgentContext”, or “…is mutating
            and is not dispatched from this CLI.”
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
            Flags are <Inline>--key value</Inline>. A <Inline>--json</Inline> blob can supply the
            same fields if you would rather pass one argument.
          </P>
          <TabbedCode snippets={CLI_SNIPPETS} />
          <Callout tone="warn">
            Live reads and the write need <Inline>DATABASE_URL</Inline> pointing at the same
            Postgres the app uses. <Inline>bun</Inline> has no Vite{" "}
            <Inline>import.meta.glob</Inline>, so it cannot migrate the PGLite fallback the dev
            server runs on. <Inline>--help</Inline> and <Inline>--list</Inline> work with no
            database at all.
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
            <Inline>getAgentContext</Inline> is the one read worth memorising. It returns the three
            numbers any spend must respect, in one round trip.
          </P>
          <PurseCard />
          <P>
            <Inline>spendable</Inline> is <Inline>max(0, remaining − atRisk)</Inline>.{" "}
            <Inline>placeWager</Inline> validates against <Inline>spendable</Inline>, so a ticket
            that has not settled is not money you have.
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
          cron or the in-process ticker. Dispatch rejects them by name — “tick is a cron clock, not
          a tool” — on both the CLI and MCP paths.
        </P>
      ),
    },
  ],
};

/* ── agents ────────────────────────────────────────────────────────── */

const agents: DocsPage = {
  title: "Agents & MCP",
  lede: "One URL and whatever agent you already use. The public box needs no token at all for its read verbs; your own box takes a bearer token or a proxied user id. We publish no client-specific surface and ship no first-party plugin.",
  sections: [
    {
      id: "connect",
      heading: "Connect a client",
      body: () => (
        <>
          <P>
            Two doors. The public box at <Inline>leagues.waits.dev</Inline> runs in substrate mode:
            add the URL and every read verb that needs no person — receipts, boards, the season
            ledger, lines, cohorts, grading, staking — answers with no account and no token,
            rate-limited per IP. Your own box is the full product: mint a token at{" "}
            <Inline>/account</Inline> (or from a shell), or let your edge pass a user id. stdio is
            for a commissioner who would rather not expose an endpoint at all.
          </P>
          <TabbedCode snippets={connectSnippets(hostOrigin())} />
          <Callout>
            Cookie sessions are rejected on <Inline>/api/mcp</Inline> — never accepted, in any mode.
            No browser? Mint the same token from a shell:{" "}
            <Inline>bun scripts/ledger.mjs mintToken --write --user …</Inline>. stdio needs a real
            Postgres <Inline>DATABASE_URL</Inline> plus <Inline>OPENLEAGUES_USER</Inline>; it exits
            immediately without both.
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
            Captured preseason 2026 against the live host, kept unedited. The first two calls are
            tools Codex assumed existed. It introspected the catalog, recovered on its own, and
            answered from the league.
          </P>
          <TranscriptReplay />
          <Note>
            The <Inline>mcp:</Inline> lines are the proof — every value came back over the wire,
            none from model memory.
          </Note>
        </>
      ),
    },
    {
      id: "auth",
      heading: "What actually gates a call",
      body: () => (
        <>
          <P>
            Two checks, and neither of them reads the catalog’s <Inline>scope</Inline> column. That
            column is documentation — it tells you which seat a verb is meant for; it is not an
            authorization tier.
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
            holder. It refuses before any write runs, so an over-reaching call fails whole — never
            halfway.
          </P>
          <Callout tone="warn">
            A league box has no looser path. Every read of an <Inline>lg_</Inline> league — browser,
            CLI, or agent — goes through the same seat check, so a box you self-host exposes nothing
            it holds to a stranger who happens to know the id. Raw Sleeper ids are the one
            exception, by design: that data is already public on Sleeper, and passing it through is
            how you look at a league before you move it.
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
            Those two checks are league rules — who holds a seat, who runs the league. How a caller
            proved they are that person is a different question, and it is yours to answer. The
            engine only ever takes a user id.
          </P>
          <TabbedCode snippets={IDENTITY_SNIPPETS} />
          <P>
            In <Inline>proxy</Inline> mode nothing else is trusted: no bearer, no cookie, no user id
            in tool arguments. Your edge authenticates however you like — SSO, mTLS, an internal
            gateway — and passes the id it settled on.
          </P>
          <Callout tone="warn">
            A header is only worth trusting if nothing but your proxy can set it. Set{" "}
            <Inline>OPENLEAGUES_MCP_PROXY_SECRET</Inline> so the box can tell. Leave it unset and
            the box logs a warning and trusts the header anyway — fine on an origin nothing else can
            reach, dangerous on a public one.
          </Callout>
          <Note>
            Every mode fails closed. An unset mode is <Inline>token</Inline>; an unrecognised one
            refuses to serve rather than guessing. stdio is separate again — it has no HTTP identity
            at all, and <Inline>OPENLEAGUES_USER</Inline> is the trust boundary.
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
            Every token is minted <Inline>read</Inline> or <Inline>act</Inline>. A read token can
            call any read verb and nothing that writes; an act token can do what the seat behind it
            can do. This is the one scope the engine enforces — the catalog’s <Inline>scope</Inline>{" "}
            column below is a different thing.
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
            Every write an act token makes is logged as an <Inline>agent_action</Inline> event
            carrying the token’s name, so a receipt on a league box can show the agent’s line —
            “codex started X over Y at 11:52am” — next to the human’s. In proxy mode the edge
            narrows a caller with <Inline>x-openleagues-scope: read</Inline>; it cannot widen
            anything, because act is already the ceiling.
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
            Descriptive, but useful — it is how the catalog says who a verb is for, and{" "}
            <Inline>getAgentContext</Inline> filters the tool list it hands an agent by the caller’s
            own standing.
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
  lede: "Four reads cover almost every question anyone asks about a league. Start with context, then narrow.",
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
                "Who am I here, what week, what can I spend, what may I call",
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
            Start every session with <Inline>getAgentContext</Inline>. One round trip for seat,
            purse, league facts, recent events, and the in-scope tool list — the things an agent
            otherwise discovers by guessing.
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
            comes back zeroed rather than null. For a settled week’s story — the flip, the bench,
            the wire — read the <DocLink slug="receipts">receipt</DocLink> instead; it is the same
            data folded into facts.
          </Note>
        </>
      ),
    },
    {
      id: "shape",
      heading: "One payload, two views",
      body: () => (
        <>
          <P>
            The board below is drawn from the array behind the toggle. Same object, no private
            rendering path.
          </P>
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
            A filled starter slot in an unplayed week carries <Inline>points: 0</Inline>, not null —{" "}
            <Inline>null</Inline> means the slot has no player in it.{" "}
            <Inline>MatchupSide.points</Inline> is the sum, so it is <Inline>0</Inline> before
            kickoff.
          </P>
          <Callout tone="warn">
            The raw <Inline>getMatchups</Inline> response has no projections in it.{" "}
            <Inline>expected</Inline> and <Inline>forecast</Inline> exist on the type but are added
            by the app’s own enrichment pass — an agent that wants a projection calls{" "}
            <Inline>getWeekProjections</Inline> or <Inline>getProjections</Inline>, both on the
            allowlist.
          </Callout>
          <P>
            That is why <Inline>open-leagues-lineup</Inline> spends a call on{" "}
            <Inline>getWeekProjections</Inline> before it proposes a sit/start: there is nothing to
            reason from in the matchup payload alone.
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
            <Inline>getBook</Inline> returns the week’s lines, your positions, the settled ones, the
            house pool, your purse, and the caps. Two markets only — there is no over/under.
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
            A wager is <Inline>spread</Inline> or <Inline>moneyline</Inline>. Spread pricing is the
            single <Inline>spread</Inline> field, negative when the home side is favoured; moneyline
            pricing is <Inline>homeMult</Inline> / <Inline>awayMult</Inline>, profit per dollar.
          </Note>
        </>
      ),
    },
  ],
};

/* ── playbooks ─────────────────────────────────────────────────────── */

const playbooks: DocsPage = {
  title: "Playbooks",
  lede: "Six skills ship in the repo. A skill turns one sentence into the right chain of verbs, in the right order, stopping where a human should confirm.",
  sections: [
    {
      id: "install",
      heading: "Install them",
      body: () => (
        <>
          <P>
            One command with the <Inline>skills</Inline> CLI, or copy the folder. Nothing registers,
            nothing phones home — a skill is a folder with a <Inline>SKILL.md</Inline>, and the six
            live at <Inline>skills/</Inline> in the repo, where skills.sh finds them.
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
      heading: "What you say, what fires",
      body: () => (
        <>
          <P>
            Writes are marked. Everything unmarked is a read. The lineup, migrate, and book skills
            stop and wait for a human before anything mutates; the two lab skills never move money
            at all — discover freezes a rule only after a holdout clears, and run only appends a
            ledger.
          </P>
          <PlaybookList playbooks={PLAYBOOKS} />
          <Note>
            Every verb these six skills call is on the MCP allowlist, with one exception the migrate
            skill flags itself: <Inline>addAllowlistEmail</Inline> is app-only.
          </Note>
        </>
      ),
    },
    {
      id: "why",
      heading: "Why a skill and not a prompt",
      body: () => (
        <P>
          The session on the <DocLink slug="agents">Agents</DocLink> page shows what happens without
          one: two failed guesses before the agent found the catalog. A skill front-loads the order
          and the invariants, so the first call is the right call.
        </P>
      ),
    },
  ],
};

/* ── catalog ───────────────────────────────────────────────────────── */

const catalog: DocsPage = {
  title: "Verb catalog",
  lede: `The catalog is the ceiling. MCP exposes a deliberate subset of it — ${MCP_WIRED} of ${MCP_CATALOG} today.`,
  sections: [
    { id: "table", heading: "Every verb", body: () => <CatalogTable /> },
    {
      id: "confirm",
      heading: "Season operations need confirm",
      body: () => (
        <>
          <P>
            A handful of verbs move the whole league, not one roster, and none of them can be undone
            by calling an opposite verb. Dispatch refuses them outright unless the call carries{" "}
            <Inline>confirm: true</Inline>, so an agent cannot advance your season by being
            agreeable.
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
            <Inline>saveSettings</Inline> takes only the fields it knows; an unrecognised key is
            dropped rather than forwarded. It reports back which fields it changed.
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
              <strong className="font-medium text-fg">scope</strong> — who the verb is for.
              Documentation, not a gate; see{" "}
              <DocLink slug="agents">what actually gates a call</DocLink>.
            </li>
            <li>
              <strong className="font-medium text-fg">read</strong> — never mutates.
            </li>
            <li>
              <strong className="font-medium text-fg">atomic</strong> — one mutation, reversible by
              its opposite verb.
            </li>
            <li>
              <strong className="font-medium text-fg">workflow</strong> — several mutations behind
              one call. <Inline>addDrop</Inline> and <Inline>importLeague</Inline> are the shape.
            </li>
            <li>
              <strong className="font-medium text-fg">MCP</strong> — whether the id is on the
              allowlist. Unwired means exactly that: no allowlist entry and no dispatch branch, so
              the verb runs in the browser app and nowhere else.
            </li>
          </Bullets>
          <Note>
            Adding a verb to MCP is an id in <Inline>core.ts</Inline> plus a branch in{" "}
            <Inline>dispatch.ts</Inline> — never a new integration.
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
            The compose file publishes 8080 and keeps durable PGLite on a named volume. Do not set{" "}
            <Inline>DATABASE_URL</Inline> here — the volume is the database.
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
            Leave <Inline>BETTER_AUTH_SECRET</Inline> blank and the entrypoint generates one and
            saves it to the volume at <Inline>/data/better-auth-secret</Inline>, so sessions survive
            a restart. Set it explicitly when you run more than one replica, or when the volume may
            be recreated.
          </P>
          <Note>
            Set <Inline>BETTER_AUTH_URL</Inline> to your real public origin, without a trailing
            slash, as soon as the box sits behind a proxy or a domain.
          </Note>
        </>
      ),
    },
    {
      id: "local",
      heading: "Local",
      body: () => (
        <>
          <P>No Postgres, no migrate step — PGLite migrates itself on first database access.</P>
          <Pre label="shell">{`bun install
cp .env.example .env      # optional
bun run dev               # 0.0.0.0:8080`}</Pre>
          <Callout>
            <Inline>bun run db:migrate</Inline> is a no-op without <Inline>DATABASE_URL</Inline> —
            it prints “skipping” and exits. It only matters when you point dev at a real Postgres.
          </Callout>
        </>
      ),
    },
    {
      id: "clock",
      heading: "The clock",
      body: () => (
        <>
          <P>Scoring advances on a tick. Exactly one thing should drive it.</P>
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
                  <Mono>vercel.json</Mono> cron — <Mono>15 * * * *</Mono>
                </span>,
                <Mono key="c">leave it unset</Mono>,
              ],
            ]}
          />
          <Callout tone="warn">
            Setting <Inline>OPENLEAGUES_SELF_TICK</Inline> on Vercel gives you two clocks. Set{" "}
            <Inline>CRON_SECRET</Inline> too: without it, <Inline>/api/league/tick</Inline> accepts
            unauthenticated requests — the box logs a warning at boot and carries on.
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
            The full list is in <Inline>.env.example</Inline>. What actually decides whether a box
            boots:
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
                "Postgres. Its absence is what selects PGLite.",
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
                "token (default) or proxy — who /api/mcp trusts.",
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
                "off (default) or actionnetwork — opts the lab into public betting splits, 2023 on. Every pulled week is kept.",
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
            Out of the box, <Inline>/api/mcp</Inline> issues and checks its own bearer tokens
            against its own database. Nothing is issued centrally: a token minted here works here
            and nowhere else.
          </P>
          <Pre label="headless mint — no browser">{`bun scripts/ledger.mjs mintToken --write --user usr_… --name codex`}</Pre>
          <P>
            If you already authenticate people at the edge, put{" "}
            <Inline>OPENLEAGUES_MCP_AUTH=proxy</Inline> in the environment and pass the user id on a
            header instead. See <DocLink slug="agents">bring your own identity</DocLink> for the
            whole seam.
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
            <Inline>bun run build</Inline> is <Inline>vite build</Inline> followed by{" "}
            <Inline>db:migrate</Inline> — that ordering is for Vercel, where migrations run against{" "}
            <Inline>DATABASE_URL</Inline> on every deploy.
          </P>
          <P>
            The Docker image does not use that script. It runs <Inline>vite build</Inline> at image
            build time, and the entrypoint runs migrations at container start instead — where, with
            no <Inline>DATABASE_URL</Inline> set, they skip and PGLite migrates itself.
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
