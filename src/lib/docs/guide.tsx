import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import { connectSnippets, INSTALL_SNIPPETS, PLAYBOOKS, type Snippet } from "./fixtures";
import { AUDIENCES, setAudience, useAudience } from "./guide-store";
import type { DocsPage, DocsSection } from "./pages";
import { Inline, P, PlaybookList, TabbedCode, TranscriptReplay } from "./widgets";

const MCP_WIRED = AGENT_CORE.size;
const MCP_CATALOG = AGENT_TOOLS.length;

/**
 * The guide: every use case as pain → fix → what you run → what comes back.
 * Every output block on this page was captured from the live app against a
 * real Sleeper league (SDIFFL, 2025, week 14). Nothing is illustrative.
 */

function hostOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "https://leagues.waits.dev";
}

/* ── widgets ─────────────────────────────────────────────────────────── */

export function AudienceChips() {
  const active = useAudience();
  const hint = AUDIENCES.find((a) => a.key === active)?.hint ?? "";
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5">
        {AUDIENCES.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAudience(a.key)}
            aria-pressed={a.key === active}
            className={
              a.key === active
                ? "rounded-full bg-fg px-3 py-1 text-[13px] font-medium text-bg"
                : "rounded-full border border-line px-3 py-1 text-[13px] text-muted hover:border-line-strong hover:text-fg"
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11.5px] text-faint">{hint}</p>
    </div>
  );
}

function Micro({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">
      {children}
    </div>
  );
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="rounded-[6px] border border-line px-1.5 py-px font-mono text-[10.5px] text-faint hover:border-line-strong hover:text-fg"
    >
      {done ? "copied" : "copy"}
    </button>
  );
}

/** A real output, collapsed past a few lines. */
export function Output({
  label,
  children,
  lines = 8,
}: {
  label: string;
  children: string;
  lines?: number;
}) {
  const all = children.split("\n");
  const long = all.length > lines + 2;
  const [open, setOpen] = useState(!long);
  const shown = open ? children : all.slice(0, lines).join("\n");
  return (
    <div className="mt-3 overflow-hidden rounded-sm border border-line bg-band">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-1.5 font-mono text-[11.5px] text-faint">
        <span className="min-w-0 truncate">{label}</span>
        <span className="flex items-center gap-2">
          {long ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-[6px] border border-line px-1.5 py-px font-mono text-[10.5px] text-faint hover:border-line-strong hover:text-fg"
            >
              {open ? "collapse" : `show all ${all.length} lines`}
            </button>
          ) : null}
          <Copy text={children} />
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-fg">
        {shown}
        {!open ? <span className="text-faint">{"\n…"}</span> : null}
      </pre>
    </div>
  );
}

export function UseCase({
  pain,
  fix,
  run,
  runLabel,
  output,
  outputLabel,
  outputLines,
  after,
  trust,
}: {
  /** In the reader's words. */
  pain: string;
  /** One or two sentences: what the product does about it. */
  fix: ReactNode;
  /** What you type, tabbed by surface. A single string renders one block. */
  run?: Snippet[] | string;
  runLabel?: string;
  /** What came back, verbatim. */
  output?: string;
  outputLabel?: string;
  outputLines?: number;
  after?: ReactNode;
  /** Why the output can be trusted: sources, checks, limits. */
  trust?: string[];
}) {
  return (
    <div className="mt-4">
      <Micro>the pain</Micro>
      <blockquote className="mt-1.5 max-w-[620px] font-display text-[19px] font-medium leading-snug tracking-[-0.005em] text-fg">
        “{pain}”
      </blockquote>
      <Micro>
        <span className="mt-5 block">the fix</span>
      </Micro>
      <div className="mt-1 max-w-[640px] text-[15px] leading-relaxed text-muted [&_code]:text-fg">
        {fix}
      </div>
      {run ? (
        <>
          <Micro>
            <span className="mt-5 block">what you run</span>
          </Micro>
          {typeof run === "string" ? (
            <div className="mt-2 overflow-hidden rounded-sm border border-line-strong bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-band px-3.5 py-1.5 font-mono text-[11.5px] text-faint">
                <span className="min-w-0 truncate">{runLabel}</span>
                <Copy text={run} />
              </div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.75px] leading-[1.7]">
                {run}
              </pre>
            </div>
          ) : (
            <TabbedCode snippets={run} />
          )}
        </>
      ) : null}
      {output ? (
        <>
          <Micro>
            <span className="mt-5 block">what comes back</span>
          </Micro>
          <Output label={outputLabel ?? "output"} lines={outputLines}>
            {output}
          </Output>
        </>
      ) : null}
      {after}
      {trust?.length ? (
        <>
          <Micro>
            <span className="mt-5 block">why you can trust it</span>
          </Micro>
          <ul className="mt-1.5 max-w-[640px] space-y-1 text-[13.5px] leading-relaxed text-muted">
            {trust.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ── the league every output below came from ─────────────────────────── */

const L = "1255972181892935680";
const RECEIPT_URL = `/r/${L}/14/9`;

const FLIP_OUT = `GET ${RECEIPT_URL}

NateBot 129.0 — Roster 14 85.3 · final
Took the lead for good at 3:41pm ET on Trevor Lawrence.
You were 78% to win at 3:11pm ET · 1 lead change this week · 78.78–78.56 at the flip

"flip": {
  "at": "2025-12-07T20:41:50.800Z",
  "atLabel": "3:41pm ET",
  "to": 9,
  "toName": "NateBot",
  "by": "Trevor Lawrence",
  "scores": [78.78, 78.56],
  "changes": 1,
  "probBefore": 0.7768,
  "beforeLabel": "3:11pm ET"
}`;

const FIND_OUT = `type: ryanwaits

[
  { "name": "SDIFFL", "league_id": "${L}", "total_rosters": 14, "season": "2025" }
]

→ pick one → /r/${L}`;

const BENCH_OUT = `Left 6.5 on the bench. Saquon Barkley 20.2 sat behind Omarion Hampton 13.7.

  Sleeper projection   start   15.0 / 9.7
  Last 3 weeks         start    8.0 / 0.0
  Season average       start   12.8 / 5.9

"bench": {
  "actual": 129.0,
  "optimal": 135.5,
  "left": 6.5,
  "misses": [{
    "slot": "RB",
    "started": { "playerId": "12507", "name": "Omarion Hampton", "points": 13.7 },
    "best":    { "playerId": "4866",  "name": "Saquon Barkley",  "points": 20.2 },
    "cost": 6.5,
    "sourceLine": "Sleeper projection, Last 3 weeks, and Season average said start Saquon Barkley."
  }]
}`;

const WIRE_OUT = `"wire": {
  "moves": [
    { "kind": "waiver", "add": "Stefon Diggs", "bid": 26, "won": false,
      "budget": 200, "bidPct": 13, "medianPct": null, "leagues": null }
  ],
  "spent": 0
}

GET /api/wire/2025/14.json
{
  "season": "2025", "week": 14, "leagues": 1,
  "budgets": { "200": 1 },
  "cohort": {},
  "prices": [
    { "player_id": "2449", "name": "Stefon Diggs",       "position": "WR",  "n": 1, "median_pct": 39.5, "p25_pct": 39.5, "p75_pct": 39.5, "max_pct": 39.5, "median_pct_remaining": 76.7, "dollars": { "budget": 200, "median": 79 } },
    { "player_id": "CIN",  "name": "Cincinnati Bengals", "position": "DEF", "n": 1, "median_pct": 1,    "p25_pct": 1,    "p75_pct": 1,    "max_pct": 1,    "median_pct_remaining": 8.3,  "dollars": { "budget": 200, "median": 2 } },
    { "player_id": "3678", "name": "Wil Lutz",           "position": "K",   "n": 1, "median_pct": 0,    "p25_pct": 0,    "p75_pct": 0,    "max_pct": 0,    "median_pct_remaining": 0,    "dollars": { "budget": 200, "median": 0 } }
  ]
}`;

const LEDGER_OUT = `GET ${RECEIPT_URL}  →  season ledger, below the receipt
mcp: getSourceLedger { "leagueId": "${L}", "rosterId": 9 }

NateBot · 2025 · 16 weeks
You set lineups worth 1874.3 and left 151.0 on the bench.
Following Sleeper projection every week would have added +2.1.

  source               beat · tied · lost     vs you
  Sleeper projection      5  ·  5  ·  6         +2.1
  Last 3 weeks            1  ·  1  · 13       -236.4
  Season average          4  ·  0  · 11       -261.9

"weeks": [
  { "week": 14, "you": 129.0, "optimal": 135.5, "sources": { "sleeper_proj": 127.6, "last3": 112.1, "season_avg": 131.0 } },
  { "week": 15, "you": 123.1, "optimal": 159.3, "sources": { "sleeper_proj": 112.6, "last3": 118.6, "season_avg": 142.8 } },
  …
]`;

const LAB_OUT = `── discover ──────────────────────────────────────────────────────────────
mcp: sampleGames  { "seasons": [2023, 2024], "filter": { "homeDog": true, "played": true,
                    "splits": [{ "market": "spread", "side": "home", "tickets": [50, 100] }] } }
mcp: evaluateBets · summarizeRun
     discovery 2023–24   27-18   roi +0.14   pBreakEven 0.19   n 45

mcp: sampleGames  { "seasons": [2025], … same filter, untouched }        ← the holdout, opened once
mcp: evaluateBets · summarizeRun
     holdout 2025        15-18   roi −0.13   pBreakEven 0.83   n 33

→ does not clear the holdout. The skill reports it and does NOT call freezeStrategy.

── what a bankroll would have done anyway ─────────────────────────────────
mcp: simulateBankroll { "graded": [ …78 bets ], "bankroll": 1000, "policy": { "type": "percent", "pct": 1, "cap": 2 } }
{ "final": 1019.40, "profit": 19.40, "roi": 0.02, "bets": 78,
  "maxDrawdown": { "dollars": 66.62, "pct": 6.18 }, "longestLosingRun": { "bets": 3, "dollars": 31.99 },
  "bootstrap": { "runs": 1000, "final": { "p5": 891.86, "p50": 1018.20, "p95": 1170.36 },
                 "maxDrawdownPct": { "p5": 3.95, "p50": 7.81, "p95": 15.30 }, "probLoss": 0.43, "probBust": 0 } }

mcp: simulateBankroll { …, "policy": { "type": "kelly", "fraction": 0.25, "cap": 3 } }
{ "final": 1029.96, "winProbUsed": 0.54, "winProbSource": "history",   ← flagged: Kelly fed its own sample
  "maxDrawdown": { "dollars": 132.42, "pct": 11.41 },
  "bootstrap": { "final": { "p5": 892.82, "p50": 1037.11, "p95": 1190.57 }, "probLoss": 0.34 } }

── all three seasons together, for the record ────────────────────────────
home dogs the public is ON        42-36-4   +2.27u   roi +0.03   pBreakEven 0.44
home dogs the public is FADING    87-99-3  −19.03u   roi −0.10
all home dogs                    156-167-8 −24.13u   roi −0.07`;

const BOARD_OUT = `GET /r/${L}?week=14

{ "league": { "id": "${L}", "name": "SDIFFL", "season": "2025", "hosted": false },
  "week": 14, "currentWeek": 17,
  "rows": [
    { "matchupId": 1, "home": { "rosterId": 3, "name": "My Toe Hurts", "points": 9 },   "away": { "rosterId": 6,  "name": "BBQ BRISSKET", "points": 4 },    "outcome": "home" },
    { "matchupId": 2, "home": { "rosterId": 4, "name": "PPA 2.5",      "points": 99 },  "away": { "rosterId": 10, "name": "Sweet Lou",    "points": 75 },   "outcome": "home" },
    { "matchupId": 3, "home": { "rosterId": 9, "name": "NateBot",      "points": 129 }, "away": { "rosterId": 14, "name": "Roster 14",    "points": 85.3 }, "outcome": "home" },
    … 4 more
  ] }`;

const SHARE_OUT = `curl -I ${hostOrigin()}/api/og/r/${L}/14/9

HTTP/1.1 200
content-type: image/png
cache-control: public, max-age=300, s-maxage=900

→ a 1200×630 card: both scores, the flip line, the bench line, the wire line, the URL.`;

const CROSSWALK_OUT = `curl -s ${hostOrigin()}/api/players.json | jq '.players[] | select(.sleeper_id=="4866")'

{
  "sleeper_id": "4866",
  "gsis_id": "00-0034844",
  "espn_id": "3929630",
  "yahoo_id": "30972",
  "rotowire_id": "12507",
  "sportradar_id": "9811b753-347c-467a-b3cb-85937e71e2b9",
  "name": "Saquon Barkley",
  "team": "PHI",
  "position": "RB"
}

"count": 11826 · access-control-allow-origin: * · cache-control: public, max-age=3600, s-maxage=86400`;

const MINT_OUT = `{
  "id": "…",
  "token": "ol_…",          ← shown once; only its hash is stored
  "prefix": "ol_…",
  "scope": "read",
  "note": "Copy the token now — only its hash is stored. Revoke from /account or by id."
}`;

const CODEX_LIST_OUT = `Name          Url                                     Bearer Token Env Var  Status   Auth
open-leagues  https://leagues.waits.dev/api/mcp       OPENLEAGUES_TOKEN      enabled  Bearer token`;

const REFUSALS_OUT = `startPlayer with a read token
  → Error: startPlayer is a write; this token is read-only

importLeague without confirm
  → Error: importLeague requires confirm: true

asking the clock to run
  → Error: tick is a cron clock, not a tool

reading a league-box league without a seat
  → Unauthorized · 401`;

const CLOCK_OUT = `advanceWeek without confirm
  → Error: advanceWeek requires confirm: true

tick over MCP
  → Error: tick is a cron clock, not a tool

# what the clock does on its own, every hour
#   scoring refresh · week advances with the NFL schedule · waivers clear Wednesday`;

const CLI_HELP_OUT = `bun scripts/ledger.mjs --help

Ledger CLI. Reads by default; writes need --write (placeWager, mintToken).

Usage:
  bun scripts/ledger.mjs --list
  bun scripts/ledger.mjs getEvents --league <id> [--limit n] [--sinceWeek n]
  bun scripts/ledger.mjs getLeagueFacts --league <id> --week <n>
  bun scripts/ledger.mjs getAgentContext --league <id> --user <id>
  bun scripts/ledger.mjs placeWager --write --user <id> --league <id> \\
    --matchup <n> --kind spread|moneyline --side <rosterId> --line <n> --stake <n>
  bun scripts/ledger.mjs mintToken --write --user <id> [--name codex] [--scope read|act]

Live reads/writes need DATABASE_URL (same Postgres as the app) or the running app.`;

/* ── sections ────────────────────────────────────────────────────────── */

const sections: DocsSection[] = [
  {
    id: "start",
    heading: "Pick your seat",
    body: () => (
      <>
        <P>
          Outputs come from a real Sleeper league (SDIFFL, 2025, week 14) or a real lab run,
          verbatim. Filter to your seat, or read straight down.
        </P>
        <AudienceChips />
      </>
    ),
  },
  {
    id: "connect",
    heading: "Connect Codex or Claude",
    audience: ["agent", "manager", "bettor", "builder"],
    body: () => (
      <UseCase
        pain="My agent can talk about fantasy football but cannot touch my league."
        fix={
          <>
            The public box serves the read verbs with no token, rate-limited per IP. Your own box
            takes one bearer token for {MCP_WIRED} of {MCP_CATALOG} verbs.
          </>
        }
        run={connectSnippets(hostOrigin())}
        output={CODEX_LIST_OUT}
        outputLabel="codex mcp list · captured while leagues.waits.dev was a league box"
        after={
          <>
            <p className="mt-4 max-w-[640px] text-[13.5px] leading-relaxed text-muted">
              Then ask it a question. Captured preseason 2026 against the live host, unedited. The
              first two calls are tools Codex assumed existed.
            </p>
            <TranscriptReplay />
          </>
        }
        trust={[
          "/api/mcp rejects cookie sessions in every mode. It accepts a bearer token or a proxied user id.",
          "stdio needs a Postgres DATABASE_URL and OPENLEAGUES_USER, and exits without both.",
        ]}
      />
    ),
  },
  {
    id: "lab",
    heading: "Test a betting hunch",
    audience: ["bettor", "agent"],
    body: () => (
      <UseCase
        pain="Checking whether home dogs with over half the tickets are a signal takes a spreadsheet and a weekend."
        fix={
          <>
            <Inline>open-leagues-lab-discover</Inline> grades the cohort on 2023–24, then once on a
            2025 holdout, and freezes the rule only if the holdout clears.{" "}
            <Inline>open-leagues-lab-run</Inline> grades a frozen rule each Tuesday on paper and
            places no bets.
          </>
        }
        run={[
          {
            key: "agent",
            tab: "Agent",
            label: "over MCP · three calls",
            body: `# discover: tune on 2023–24, verify on 2025, freeze only if it clears
sampleGames      { "seasons": [2023, 2024], "filter": { "homeDog": true, "played": true, "splits": [{ "market": "spread", "side": "home", "tickets": [50, 100] }] } }
evaluateBets · summarizeRun                       # read pBreakEven and n
sampleGames      { "seasons": [2025], …same filter }   # the holdout, opened once
evaluateBets · summarizeRun
simulateBankroll { "graded": […], "bankroll": 1000, "policy": { "type": "percent", "pct": 1, "cap": 2 } }
freezeStrategy   { "name": "…", "spec": { words, seasons, filter, bet, staking, bankroll } }   # only if it cleared

# run, every Tuesday, on the frozen rule
getStrategy → getLabRuns → sampleGames (last week) → evaluateBets → summarizeRun
→ simulateBankroll (season) → recordLabRun → the digest`,
          },
          {
            key: "curl",
            tab: "curl",
            label: "the lines feed · every game since 1999",
            body: `curl -s ${hostOrigin()}/api/lines/2025.json | jq '.games[] | select(.spread < 0 and .spread > -3.5)'`,
          },
        ]}
        output={LAB_OUT}
        outputLabel="discover skill · every number from summarizeRun or simulateBankroll"
        outputLines={12}
        trust={[
          "Lines and results are nflverse closing numbers. Missing prices default to −110 and the payload says which odds were used.",
          "Grading is tested against DAL–DET, week 14 2025 (DET −3.5, 44–30), and reports closing-line value when your number differed from the close.",
          "Ticket and money percentages are opt-in (OPENLEAGUES_SPLITS_SOURCE). Action Network consensus has history from 2023 and is the source backtests use. DraftKings Network handle and bet share and the WiseGuyTeam multi-book read cover the current slate, each kept under its own book. All are undocumented and stored on your box once pulled.",
          "Tuned on 2023–24 this cohort went 27-18, roi +0.14. On the 2025 holdout it went 15-18, roi −0.13. pBreakEven 0.19 means a 27-18 record comes up by luck one time in five. The skill does not freeze it and says why.",
          "The staking policy is the caller’s. simulateBankroll compounds it, reports drawdown in dollars, flags when Kelly was fed its own sample, and resamples the bets 1000 times. Here a +$19 result shows as a band from −$108 to +$170 with a 43% chance of a loss.",
          "Opening lines and line movement are not wired in (free only for 2007–2021). A frozen strategy is stored on your box and never touched by the run skill.",
          "docs/lab.md in the repo has the full walkthrough, from box to the sentence to say.",
        ]}
      />
    ),
  },

  /* ── managers ── */
  {
    id: "flip",
    heading: "The minute it flipped",
    audience: ["manager"],
    body: () => (
      <UseCase
        pain="I was winning until the 4pm games."
        fix={
          <>
            Open your team’s receipt for any settled week this season or last. The first line gives
            the minute of the last lead change, the player behind it, and your win probability a
            half-hour earlier.
          </>
        }
        run={`${hostOrigin()}${RECEIPT_URL}`}
        runLabel="browser · no account"
        output={FLIP_OUT}
        outputLabel="the receipt and its JSON"
        outputLines={6}
        trust={[
          "Rebuilt from nflverse play-by-play under your league’s scoring settings, to the second.",
          "Where the play log and Sleeper’s official stats disagree, the difference is booked at the final whistle. Finals match Sleeper to the cent, 84 of 84 team-weeks checked on this league. A correction that decides a week is named as one.",
          "The current week appears once the play log publishes; until then the receipt says so.",
        ]}
      />
    ),
  },
  {
    id: "find",
    heading: "Find the league",
    audience: ["manager"],
    body: () => (
      <UseCase
        pain="I have the Sleeper app and no league id."
        fix={
          <>
            Type your Sleeper username in the home input; it lists every league that account is in
            this season, private ones included.
          </>
        }
        run="ryanwaits"
        runLabel="home page input"
        output={FIND_OUT}
        outputLabel="findSleeperUser"
        trust={[
          "Read from Sleeper’s public user and league endpoints. Nothing about you is stored.",
          "Team names only: a team named after its manager’s username renders as Roster N.",
        ]}
      />
    ),
  },
  {
    id: "bench",
    heading: "What the bench cost",
    audience: ["manager"],
    body: () => (
      <UseCase
        pain="I should have started him."
        fix={
          <>
            The receipt scores your best possible lineup against the one you set, on the box score.
            Under each miss, three open sources show their pre-kickoff call.
          </>
        }
        run={`${hostOrigin()}${RECEIPT_URL}#bench`}
        runLabel="same receipt, second section"
        output={BENCH_OUT}
        outputLabel="the bench line"
        outputLines={5}
        trust={[
          "Sleeper projection, last three weeks, and season average, each valued under your league’s book. No paid source appears, even as a comparison.",
          "The receipt grades in hindsight and names which source was right.",
        ]}
      />
    ),
  },
  {
    id: "wire",
    heading: "What the wire cost",
    audience: ["manager", "builder"],
    body: () => (
      <UseCase
        pain="I think I overpaid on waivers."
        fix={
          <>
            The wire line lists your week’s bids as a share of your league’s budget and whether each
            won. From the second pasted league on, it adds the median share each player cleared for
            elsewhere.
          </>
        }
        run={[
          {
            key: "page",
            tab: "Receipt",
            label: "the wire line on your receipt",
            body: `${hostOrigin()}${RECEIPT_URL}#wire`,
          },
          {
            key: "curl",
            tab: "curl",
            label: "clearing prices for a week · anonymous · CORS on",
            body: `curl -s ${hostOrigin()}/api/wire/2025/14.json
curl -s "${hostOrigin()}/api/wire/2025/14.json?rosters=14&format=half"   # one cohort`,
          },
        ]}
        output={WIRE_OUT}
        outputLabel="wire · one league pasted so far"
        outputLines={7}
        trust={[
          "Only leagues that asked for a receipt contribute; nothing is crawled. No league id, manager, or roster appears in the file.",
          "Each price is a share of the bidder’s league budget, with the share of their remaining budget beside it. Raw dollars appear only inside a single-budget cohort. Filters by roster count, scoring format, and superflex keep formats apart.",
          "n is the number of winning bids behind a price. With one league it is one bid; the receipt shows a median only once a second league has cleared a claim.",
        ]}
      />
    ),
  },
  {
    id: "trust",
    heading: "Which source to trust",
    audience: ["manager", "agent"],
    body: () => (
      <UseCase
        pain="Every site tells me who to start and none tells me if it was right."
        fix={
          <>
            Below each receipt, the season ledger scores each open source’s lineup, week by week,
            beside yours, as weeks beat, tied, or lost.
          </>
        }
        run={`${hostOrigin()}${RECEIPT_URL}#ledger`}
        runLabel="below any receipt · getSourceLedger over MCP"
        output={LEDGER_OUT}
        outputLabel="the season ledger · NateBot, 2025"
        outputLines={10}
        trust={[
          "Each source’s lineup is filled the same way yours is, from its pre-kickoff numbers under your league’s book, then scored on the box score.",
          "Settled weeks are computed once and kept. The first ask for a team takes about half a minute; later asks are cached.",
          "Two of the three sources lose to this manager by over 230 points, and the ledger reports it.",
        ]}
      />
    ),
  },
  {
    id: "board",
    heading: "The whole week",
    audience: ["manager"],
    body: () => (
      <UseCase
        pain="I want to see every matchup in the league this week."
        fix={
          <>
            The league page shows one line per matchup with a week picker; each line opens a receipt
            and needs no login.
          </>
        }
        run={`${hostOrigin()}/r/${L}?week=14`}
        runLabel="browser"
        output={BOARD_OUT}
        outputLabel="getWeekBoard"
        outputLines={6}
      />
    ),
  },
  {
    id: "share",
    heading: "Send it to the chat",
    audience: ["manager"],
    body: () => (
      <UseCase
        pain="Screenshots get argued with."
        fix={
          <>
            Paste the receipt URL into iMessage, Discord, Sleeper chat, or X; it unfurls as a card
            drawn from the same lines as the page.
          </>
        }
        run={`${hostOrigin()}${RECEIPT_URL}`}
        runLabel="paste where links unfurl"
        output={SHARE_OUT}
        outputLabel="the og:image behind the link · headers"
        trust={[
          "Rendered server-side from the receipt; nothing appears that is not on the page.",
          "To have a league’s receipts taken down, open an issue on the repo with the league id.",
        ]}
      />
    ),
  },

  /* ── builders ── */
  {
    id: "crosswalk",
    heading: "One player-id map",
    audience: ["builder"],
    body: () => (
      <UseCase
        pain="Every side project starts by hand-building the same Sleeper-to-ESPN-to-nflverse id table."
        fix={
          <>
            One file, one row per player: Sleeper, GSIS (nflverse), ESPN, Yahoo, RotoWire, and
            Sportradar ids with name, team, and position. It needs no key, is CORS open, and is
            cached one day.
          </>
        }
        run={`curl -s ${hostOrigin()}/api/players.json`}
        runLabel="curl · 11,826 rows"
        output={CROSSWALK_OUT}
        outputLabel="one row"
        outputLines={13}
        trust={[
          "Sleeper’s player file plus the dynastyprocess id table. Sleeper alone has a GSIS id for a fifth of active players; the join gives every active player one.",
          "Sleeper stays the authority on its own ids; the id table only fills what Sleeper leaves blank.",
        ]}
      />
    ),
  },
  {
    id: "prices",
    heading: "Clearing prices as data",
    audience: ["builder"],
    body: () => (
      <UseCase
        pain="Paid tools predict FAAB prices, and nobody publishes what cleared."
        fix={
          <>
            <Inline>/api/wire/:season/:week.json</Inline> lists winning bids per player across
            pasted leagues, as a share of each league’s budget: median, quartiles, max,
            remaining-budget share, and count. Cohort filters keep formats apart.
          </>
        }
        run={`curl -s ${hostOrigin()}/api/wire/2025/14.json | jq '.prices[:3]'`}
        runLabel="curl · cached one hour once a claim has cleared"
        output={WIRE_OUT.split("\n\nGET")[1] ? `GET${WIRE_OUT.split("\n\nGET")[1]}` : WIRE_OUT}
        outputLabel="week 14 · one league so far"
        outputLines={12}
        after={
          <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-muted">
            Full field shapes for both files are on{" "}
            <Link
              to="/docs/$slug"
              params={{ slug: "open-data" }}
              className="text-fg underline decoration-line-strong underline-offset-4"
            >
              Open data
            </Link>
            .
          </p>
        }
      />
    ),
  },

  /* ── commissioners ── */
  {
    id: "box",
    heading: "Run your own box",
    audience: ["commissioner"],
    body: () => (
      <UseCase
        pain="Our league’s history belongs to an app that sells ads against it."
        fix={
          <>
            Run one container with a volume, or a Vercel deploy with Postgres. Receipts work for any
            Sleeper id on first boot, and nothing is seeded.
          </>
        }
        run={INSTALL_SNIPPETS}
        trust={[
          "With no DATABASE_URL the box uses the embedded PGLite database and still keeps a league.",
          "Players, stats, and projections come from Sleeper and nflverse over outbound requests. No member needs an account anywhere else.",
        ]}
      />
    ),
  },
  {
    id: "migrate",
    heading: "Move a league in",
    audience: ["commissioner", "agent"],
    body: () => (
      <UseCase
        pain="We would switch, but not if it means re-typing ten rosters and a scoring table."
        fix={
          <>
            Import from Sleeper by league id, ESPN by id or URL, or a pasted recap. Preview, then
            commit; whoever commits is the commissioner, and nothing syncs back.
          </>
        }
        run={[
          {
            key: "app",
            tab: "Browser",
            label: "the import flow",
            body: `/new → Import → Sleeper → paste ${L}
review teams, scoring, rosters → Commit`,
          },
          {
            key: "agent",
            tab: "Agent",
            label: "the same two verbs over MCP",
            body: `previewImport  { "leagueId": "${L}" }
importLeague   { "leagueId": "${L}", "confirm": true }`,
          },
        ]}
        output={REFUSALS_OUT.split("\n\n")[1] ?? ""}
        outputLabel="without confirm · engine text"
        trust={[
          "No manager emails are pulled from any source. The commissioner types the invite allowlist, which is not on MCP.",
          "exportLeague returns a JSON snapshot at any time.",
        ]}
      />
    ),
  },
  {
    id: "clock",
    heading: "Let it run itself",
    audience: ["commissioner"],
    body: () => (
      <UseCase
        pain="I don’t want to be the one who forgets to process waivers."
        fix={
          <>
            An hourly tick refreshes scoring, advances weeks with the NFL schedule, and clears
            waivers on Wednesday. Season-wide moves still need the commissioner’s confirm.
          </>
        }
        run="OPENLEAGUES_SELF_TICK=1      # a long-lived box ticks itself; on Vercel, vercel.json's cron is the clock"
        runLabel=".env · one clock source"
        output={CLOCK_OUT}
        outputLabel="engine text"
      />
    ),
  },

  /* ── agents ── */
  {
    id: "token",
    heading: "Give an agent a key",
    audience: ["agent", "commissioner"],
    body: () => (
      <UseCase
        pain="I want my agent to set lineups without the power to wreck the league."
        fix={
          <>
            Tokens are minted <Inline>read</Inline> or <Inline>act</Inline> on your own box, from
            the account page or a shell. A read token cannot move a player; an act token has your
            seat’s powers, one purse, and confirm on season-wide moves.
          </>
        }
        run={[
          {
            key: "shell",
            tab: "Shell",
            label: "mint from a shell · this box's database",
            body: `bun scripts/ledger.mjs mintToken --write --user usr_… --name codex --scope read`,
          },
          {
            key: "app",
            tab: "Browser",
            label: "the account page",
            body: `https://YOUR_BOX/account → Agent tokens → New token → read | act`,
          },
        ]}
        output={MINT_OUT}
        outputLabel="mintToken · shape"
        after={<Output label="bun scripts/ledger.mjs --help">{CLI_HELP_OUT}</Output>}
        trust={[
          "Your box issues and checks tokens against its own table; nothing is central. They are hashed at rest and shown once. An act token cannot fade its own team.",
          "OPENLEAGUES_MCP_AUTH=proxy trusts a user-id header from your edge instead, and x-openleagues-scope: read narrows a caller.",
        ]}
      />
    ),
  },
  {
    id: "honest",
    heading: "Prove what the agent did",
    audience: ["agent", "manager"],
    body: () => (
      <UseCase
        pain="The agent says it set a good lineup, and I have only its word."
        fix={
          <>
            Every act-token write is logged as an event carrying the token’s name, and the receipt
            shows the agent’s line beside yours. Disallowed calls fail whole, with the reason in
            plain text.
          </>
        }
        run={`getAgentContext { "leagueId": "lg_…" }     # start every session here: seat, purse, week, the tools you may call
startPlayer     { "leagueId": "lg_…", "playerId": "4866", "slot": "RB" }`}
        runLabel="two verbs over MCP"
        output={REFUSALS_OUT}
        outputLabel="refusals · engine text"
        outputLines={12}
        trust={[
          "Two checks gate every call: a user id on every write and a seat check on every hosted read. Browser, CLI, and agent get the same rule.",
          "Raw Sleeper ids need no seat. That data is already public.",
        ]}
      />
    ),
  },
  {
    id: "playbooks",
    heading: "Say a sentence",
    audience: ["agent"],
    body: () => (
      <UseCase
        pain={`I don’t want to learn ${MCP_CATALOG} verbs to set a lineup.`}
        fix={
          <>
            Six skills ship in the repo. One sentence runs the chain and stops where a human must
            confirm.
          </>
        }
        run={`npx skills add ryanwaits/open-leagues -g                 # all six, Claude Code
npx skills add ryanwaits/open-leagues --skill open-leagues-lab-discover -g
npx skills add ryanwaits/open-leagues --agent codex -g   # Codex`}
        runLabel="install · once"
        after={<PlaybookList playbooks={PLAYBOOKS} />}
      />
    ),
  },
];

export const guide: DocsPage = {
  title: "Guide",
  lede: "One pain, one fix, the command, and what came back.",
  sections,
};
