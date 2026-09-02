import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClaudeMark, OpenAIMark, OpenCodeMark } from "@/components/icons/brand-marks";
import { ReceiptFinder } from "@/components/receipt-finder";
import type { AppUser } from "@/lib/auth/use-current-user";

export type LandingSeat = {
  leagueId: string;
  name: string;
  season: string;
  role: string;
};

const MCP_URL = "https://leagues.waits.dev/api/mcp";
const DOOR = {
  claude: `claude mcp add --transport http open-leagues ${MCP_URL}`,
  codex: `codex mcp add open-leagues --url ${MCP_URL}`,
};
const FIRST_PROMPT =
  "Which week is it, what is on the board right now, and who is trending on Sleeper?";

/** Three families of verbs, in the reader's words. One real ask each. */
const FAMILIES: { title: string; points: string[]; ask: string }[] = [
  {
    title: "Your league",
    points: [
      "Any Sleeper league by id, no account: rosters, matchups, the whole week's board.",
      "The minute a matchup flipped, what the bench left, what the wire cost as a share of budget.",
      "Over a season, which open source would have set the better lineup: Sleeper projection, last 3 weeks, season average.",
      "On a box you own, the same verbs read and move a league you host, by seat scope, with a confirm gate on anything that spends.",
    ],
    ask: "Find my Sleeper username, list the leagues, and give me the receipt for roster 4 in week 6.",
  },
  {
    title: "The game",
    points: [
      "The NFL with no league attached: state of the season, scoreboard, box scores and play lists.",
      "Raw weekly stats, live scoring leaders, byes, position leaders, player pages.",
      "Projections and outlooks from open sources; nothing behind a paywall.",
      "getSources probes every upstream first, so an agent knows what it is standing on before it answers.",
    ],
    ask: "Who leads the season at TE, and which teams sit on bye in week 9 of 2026?",
  },
  {
    title: "The lab",
    points: [
      "Every NFL game since 1999 as a backtest bench: closing spread, total, moneylines, result, roof, surface, rest.",
      "Public ticket and money splits, 2023 on, where a box opts in.",
      "Describe a cohort in words; grade the hypothetical bets; read a record with n, pBreakEven and drawdown; simulate a bankroll under flat or fractional Kelly staking.",
      "Arithmetic only. It never picks a side and never places a bet.",
    ],
    ask: "Home dogs of 3 to 7 in division games, 2015 to 2024: record against the spread, n, break-even rate, max drawdown.",
  },
];

/**
 * A real receipt, unedited: SDIFFL 2025, week 14, NateBot vs Roster 14.
 * Team names only, the same thing a stranger sees at /r/.
 */
const SAMPLE = {
  header: "SDIFFL · week 14 · NateBot 129.0, Roster 14 85.3",
  flip: "Took the lead for good at 3:41pm ET on a Trevor Lawrence completion, 78.8 to 78.6. 78% to win at 3:11pm.",
  bench: "6.5 left on the bench. Omarion Hampton (13.7) started over Saquon Barkley (20.2).",
  sources: "Sleeper projection, last 3 weeks, and season average all said start Barkley.",
  wire: "Wire: bid $26 on Stefon Diggs, 13% of a $200 budget, lost.",
};

const RECEIPT_LINES: { k: string; what: string; how: string }[] = [
  {
    k: "the flip",
    what: "The minute the matchup changed hands, and the play that did it.",
    how: "nflverse play-by-play scored under your league's own book, to the second.",
  },
  {
    k: "the bench",
    what: "Points left sitting, and exactly who over whom.",
    how: "Best lineup on the box score versus the lineup set. Hindsight, on purpose.",
  },
  {
    k: "the sources",
    what: "Which open source would have called it before kickoff, and which would not.",
    how: "Sleeper projection, last three weeks, season average. Never a paid source.",
  },
  {
    k: "the wire",
    what: "What was bid, whether it won, and what the same player cleared for elsewhere.",
    how: "As a share of each league's budget: a $50 bid is half of a $100 league and a twentieth of a $1,000 one.",
  },
];

const LAB_SAMPLE = `home dogs the public was on
discovery 2023-24   27-18   roi +0.14   pBreakEven 0.19   n 45
holdout   2025      15-18   roi -0.13   pBreakEven 0.83   n 33
not frozen. $1,000 at 1%: $1,019; bootstrap band $892 to $1,170; 43% chance of a loss.`;

function Kicker({ children }: { children: string }) {
  return (
    <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
      {children}
    </div>
  );
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <code className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[13px]">
        {text}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          });
        }}
        className="shrink-0 rounded-[6px] border border-line px-1.5 py-px font-mono text-[10.5px] text-faint hover:border-line-strong hover:text-fg"
      >
        {done ? "copied" : "copy"}
      </button>
    </div>
  );
}

export function Landing({
  user,
  seats,
  sessionPending,
}: {
  user: AppUser | null;
  seats: LandingSeat[];
  sessionPending: boolean;
}) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-skin");
    el.setAttribute("data-skin", "console");
    return () => {
      if (prev) el.setAttribute("data-skin", prev);
      else el.removeAttribute("data-skin");
    };
  }, []);

  return (
    <div className="mx-auto max-w-[720px] px-6 pb-12 font-sans text-fg">
      <nav className="flex items-center justify-between gap-3 border-b border-line py-7">
        <Link to="/" className="shrink-0 whitespace-nowrap text-[15px] font-semibold">
          open-leagues
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm sm:gap-5">
          <Link to="/docs" className="text-muted hover:text-fg">
            Docs
          </Link>
          <a href="https://github.com/ryanwaits/open-leagues" className="text-muted hover:text-fg">
            GitHub
          </a>
        </div>
      </nav>

      {!sessionPending && user && seats.length > 0 ? (
        <ul className="border-b border-line py-4">
          {seats.map((s) => (
            <li key={s.leagueId}>
              <Link
                to="/league/$leagueId"
                params={{ leagueId: s.leagueId }}
                preload="intent"
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm hover:text-accent-strong"
              >
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-[11px] text-faint">
                  {s.season} · {s.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <h1 className="mt-12 text-balance text-[34px] font-medium leading-[1.25] tracking-[-0.01em]">
        Fantasy and NFL facts. Your agent decides.
      </h1>
      <p className="mt-3 max-w-[600px] text-[15px] leading-relaxed text-muted">
        A headless set of tools and sources over MCP: your league&apos;s rosters, matchups and FAAB,
        open projections and stats, every closing line since 1999. Each answer is a record with a
        timestamp and a source. No rankings, no picks, no paid feeds. The agent brings the model.
      </p>

      <div className="mt-7 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 font-mono text-xs text-muted">
          <span>add it to your agent</span>
          <span className="flex items-center gap-1.5 text-faint" title="works with">
            <ClaudeMark className="h-[13px] w-[13px]" />
            <OpenAIMark className="h-[13px] w-[13px]" />
            <OpenCodeMark className="h-[11px] w-[11px]" />
            <span className="font-mono text-[10px] font-semibold tracking-wide">GROK</span>
          </span>
        </div>
        <CopyLine text={DOOR.claude} />
        <div className="border-t border-line">
          <CopyLine text={DOOR.codex} />
        </div>
      </div>
      <p className="mt-2.5 text-[13px] text-muted">
        No account, no token, team names only. Your agent brings the model; the box pays for
        Postgres only.
      </p>
      <p className="mt-1.5 text-[12.5px] text-faint">
        First prompt to try: &ldquo;{FIRST_PROMPT}&rdquo;
      </p>
      <p className="mb-12 mt-1.5 text-[12.5px] text-faint">
        Every answer is a record with a clock and a named source. No rankings, no picks, no paid
        feeds.
      </p>

      <Kicker>what an agent can ask</Kicker>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        {FAMILIES.map((f) => (
          <div key={f.title} className="border-b border-line px-4 py-4 last:border-b-0">
            <div className="text-[15px] font-medium">{f.title}</div>
            <ul className="mt-2 space-y-1 text-[13.5px] leading-relaxed text-muted">
              {f.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 font-mono text-[12px] text-faint">
              <span className="text-muted">ask </span>&ldquo;{f.ask}&rdquo;
            </div>
          </div>
        ))}
      </div>

      <Kicker>open data</Kicker>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          three files every hobby tool rebuilds by hand · free · CORS on · no key
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
          <span className="text-faint">$ </span>
          <span className="font-semibold">curl /api/players.json</span>
          {"\n"}
          <span className="text-muted">
            {"  sleeper, gsis, espn, yahoo, sportradar ids, one row per player"}
          </span>
          {"\n\n"}
          <span className="text-faint">$ </span>
          <span className="font-semibold">curl /api/wire/2025/14.json</span>
          {"\n"}
          <span className="text-muted">
            {
              "  what each player cleared for on waivers, as a share of budget: median, quartiles, n, by cohort"
            }
          </span>
          {"\n\n"}
          <span className="text-faint">$ </span>
          <span className="font-semibold">curl /api/lines/2025.json</span>
          {"\n"}
          <span className="text-muted">
            {
              "  every game that season: closing spread, total, moneylines, result, roof, surface, rest"
            }
          </span>
        </pre>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Anonymous aggregates. No league id, manager, or roster appears in any payload. Every
          league read through the box makes the wire file a little more honest.
        </p>
      </div>

      <Kicker>a worked example: the receipt</Kicker>
      <p className="mb-3 text-[14px] text-muted">
        An agent asked one question; this came back from four verbs. Nothing on it came from a
        model.
      </p>
      <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="border-b border-line bg-band px-3.5 py-1.5 font-mono text-xs text-muted">
          {SAMPLE.header}
        </div>
        <ul className="divide-y divide-line text-[14px] leading-relaxed">
          <li className="px-4 py-3">{SAMPLE.flip}</li>
          <li className="px-4 py-3">
            {SAMPLE.bench}
            <div className="mt-1 text-[12.5px] text-muted">{SAMPLE.sources}</div>
          </li>
          <li className="px-4 py-3">{SAMPLE.wire}</li>
        </ul>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Four numbers, two clocks, zero adjectives. Every receipt has a permalink and a card that
          unfurls in the group chat.
        </p>
      </div>
      <div className="mt-3 mb-4 overflow-hidden rounded-lg border border-line bg-surface">
        {RECEIPT_LINES.map((row) => (
          <div
            key={row.k}
            className="grid gap-1 border-b border-line px-4 py-2.5 last:border-b-0 sm:grid-cols-[100px_1fr]"
          >
            <div className="font-mono text-[11.5px] text-faint">{row.k}</div>
            <div>
              <div className="text-[13.5px]">{row.what}</div>
              <div className="mt-0.5 text-[12px] text-muted">{row.how}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mb-1.5 font-mono text-[11px] text-faint">try one without an agent</div>
      <ReceiptFinder />
      <p className="mb-14 mt-2 max-w-[520px] text-[12.5px] text-faint">
        Any Sleeper league, public or private. No account. Team names only, never a person&apos;s
        name.
      </p>

      <Kicker>a worked example: the lab</Kicker>
      <p className="mb-3 text-[14px] text-muted">
        The lab grades your idea, then argues with it. An agent tuned a hunch on two seasons and
        opened the third once.
      </p>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.7]">
          {LAB_SAMPLE}
        </pre>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          pBreakEven 0.19 says a 27-18 discovery happens by luck one time in five. The skill refused
          to freeze it, and the run ledger says why. Nothing in the lab places a bet.
        </p>
      </div>

      <Kicker>run your own box</Kicker>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="px-4 py-3.5 text-[14px] leading-relaxed">
          The public box hosts no leagues and keeps no accounts. Run the same code as a league box
          and it holds yours: Postgres enforces one FAAB purse, one scoring book, and confirm-gated
          season ops; members mint read or act tokens for their agents; every agent write is signed
          with the token&apos;s name. The verbs are the product; the browser is client zero.
        </div>
        <div className="border-t border-line">
          <CopyLine text="git clone https://github.com/ryanwaits/open-leagues.git && cd open-leagues && docker compose up -d" />
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Compose runs <span className="font-mono">OPENLEAGUES_MODE=league</span>. Drop the mode
          line and the same box is a public substrate like ours.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-[13px]">
          <Link
            to="/docs/$slug"
            params={{ slug: "agents" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Connect an agent
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "guide" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Guide
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "open-data" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Open data
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "quickstart" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Self-host
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "migrate" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Migrate a league
          </Link>
        </div>
      </div>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues. Headless fantasy and betting tools for agents, over MCP. MIT.
      </footer>
    </div>
  );
}
