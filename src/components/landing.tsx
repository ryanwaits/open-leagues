import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClaudeMark, OpenAIMark, OpenCodeMark } from "@/components/icons/brand-marks";
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

/** Things to type at an agent once the server is added. Each one is real and runs on the public box. */
const EXAMPLES: { ask: string; back: string }[] = [
  {
    ask: "Which week is it, and who is trending on Sleeper?",
    back: "the season state and the most added and dropped players, with counts",
  },
  {
    ask: "Find my Sleeper username, list my leagues, and show roster 4 in week 6.",
    back: "leagues by id, then the roster, its matchup, and the box score",
  },
  {
    ask: "Give me the receipt for that matchup.",
    back: "when it flipped, points left on the bench, what the wire cost as a share of budget",
  },
  {
    ask: "Who leads the season at TE, and which teams are on bye in week 9?",
    back: "position leaders from raw weekly stats, and the bye table",
  },
  {
    ask: "Home dogs of 3 to 7 in division games, 2015 to 2024: record against the spread and n.",
    back: "the cohort, graded at the closing line, with pBreakEven; it never picks a side",
  },
];

const FILES: { path: string; what: string }[] = [
  { path: "/api/players.json", what: "one row per player: sleeper, gsis, espn, yahoo ids" },
  { path: "/api/wire/2025/14.json", what: "waiver prices as a share of budget, by cohort" },
  { path: "/api/lines/2025.json", what: "every game: closing spread, total, moneylines, result" },
];

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

function Kicker({ children }: { children: string }) {
  return (
    <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
      {children}
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
    <div className="mx-auto max-w-[680px] px-6 pb-12 font-sans text-fg">
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

      <h1 className="mt-12 text-balance text-[30px] font-medium leading-[1.25] tracking-[-0.01em]">
        NFL and fantasy football data for your agent.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        An open-source MCP server. It reads any Sleeper league by id, NFL stats, open projections,
        and the closing line for every game since 1999. Each answer carries a timestamp and a
        source. No account is needed.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-line-strong bg-surface">
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

      <div className="mt-12">
        <Kicker>then ask</Kicker>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line-strong bg-surface">
          {EXAMPLES.map((e) => (
            <li key={e.ask} className="px-4 py-3">
              <div className="text-[14px]">&ldquo;{e.ask}&rdquo;</div>
              <div className="mt-0.5 text-[12.5px] text-muted">{e.back}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <Kicker>without an agent</Kicker>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface font-mono text-[12.5px]">
          {FILES.map((f) => (
            <li key={f.path} className="flex flex-wrap gap-x-4 gap-y-0.5 px-4 py-2.5">
              <a href={f.path} className="shrink-0 hover:underline">
                {f.path}
              </a>
              <span className="text-muted">{f.what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <Kicker>run your own</Kicker>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <CopyLine text="git clone https://github.com/ryanwaits/open-leagues.git && cd open-leagues && docker compose up -d" />
          <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
            The same box, holding your league: rosters, FAAB, scoring, and tokens for your agents.{" "}
            <Link
              to="/docs/$slug"
              params={{ slug: "quickstart" }}
              className="underline underline-offset-4 hover:text-fg"
            >
              Quickstart
            </Link>
            {" · "}
            <Link
              to="/docs/$slug"
              params={{ slug: "guide" }}
              className="underline underline-offset-4 hover:text-fg"
            >
              Guide
            </Link>
          </p>
        </div>
      </div>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues · MIT
      </footer>
    </div>
  );
}
