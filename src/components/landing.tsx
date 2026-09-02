import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClaudeMark, OpenAIMark, OpenCodeMark } from "@/components/icons/brand-marks";
import { ReceiptFinder } from "@/components/receipt-finder";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import type { AppUser } from "@/lib/auth/use-current-user";

const MCP_WIRED = AGENT_CORE.size;
const MCP_CATALOG = AGENT_TOOLS.length;

export type LandingSeat = {
  leagueId: string;
  name: string;
  season: string;
  role: string;
};

/**
 * A real receipt, unedited: SDIFFL 2025, week 14, NateBot vs Roster 14.
 * Team names only — the same thing a stranger sees at /r/….
 */
const SAMPLE = {
  header: "SDIFFL · week 14 · NateBot 129.0 — Roster 14 85.3",
  flip: "Took the lead for good at 3:41pm ET on a Trevor Lawrence completion, 78.8–78.6 · 78% to win at 3:11pm.",
  bench: "6.5 left on the bench — Omarion Hampton (13.7) started over Saquon Barkley (20.2).",
  sources: "Sleeper projection, Last 3 weeks, and Season average all said start Barkley.",
  wire: "Wire: bid $26 on Stefon Diggs — 13% of a $200 budget — lost.",
};

const RECEIPT_LINES: { k: string; what: string; how: string }[] = [
  {
    k: "the flip",
    what: "The minute the matchup changed hands, and the play that did it.",
    how: "nflverse play-by-play scored under your league's own book, to the second.",
  },
  {
    k: "the bench",
    what: "Points you left sitting, and exactly who over whom.",
    how: "Best lineup on the box score versus the lineup you set. Hindsight, on purpose.",
  },
  {
    k: "the sources",
    what: "Which open source would have called it before kickoff — and which wouldn't.",
    how: "Sleeper projection, last three weeks, season average. Never a paid source.",
  },
  {
    k: "the wire",
    what: "What you bid, whether you won, and what the same player cleared for elsewhere.",
    how: "As a share of each league’s budget — a $50 bid is half of a $100 league and a twentieth of a $1,000 one — across every league that has pasted.",
  },
];

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
        The minute your matchup flipped.
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Paste a Sleeper league id or username. Get a receipt for your week: when the game turned,
        what you left on the bench, what the wire cost — and which open source called it before
        kickoff.
      </p>

      <div className="mt-7 mb-3">
        <ReceiptFinder />
      </div>
      <p className="mb-12 max-w-[520px] text-[12.5px] text-faint">
        Any Sleeper league, public or private. No account. Team names only — never a person&apos;s
        name.
      </p>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        a real one
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
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
          Every receipt has a permalink and a card that unfurls in the group chat. Nothing on it
          came from a model — every line is a fact with a timestamp.
        </p>
      </div>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        what&apos;s on it
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        {RECEIPT_LINES.map((row) => (
          <div
            key={row.k}
            className="grid gap-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[110px_1fr]"
          >
            <div className="font-mono text-[12px] text-faint">{row.k}</div>
            <div>
              <div className="text-[14px]">{row.what}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">{row.how}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        open data
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          the two files every hobby tool rebuilds by hand · free · CORS on
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
          <span className="text-faint">$ </span>
          <span className="font-semibold">curl /api/players.json</span>
          {"\n"}
          <span className="text-muted">
            {"  sleeper ↔ gsis ↔ espn ↔ yahoo ↔ sportradar ids, one row per player"}
          </span>
          {"\n\n"}
          <span className="text-faint">$ </span>
          <span className="font-semibold">curl /api/wire/2025/14.json</span>
          {"\n"}
          <span className="text-muted">
            {
              "  what each player cleared for on waivers, as a share of budget — median, quartiles, n — by cohort"
            }
          </span>
        </pre>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Anonymous aggregates. No league id, manager, or roster appears in either payload. Every
          league that asks for a receipt makes the wire file a little more honest.
        </p>
      </div>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        underneath
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="px-4 py-3.5 text-[14px] leading-relaxed">
          Receipts sit on a headless league engine. Add{" "}
          <span className="font-mono text-[13px]">leagues.waits.dev/api/mcp</span> to your agent and
          it reads receipts, lines, cohorts, and grades bets with no account and no token — your
          agent brings its own model. Run the same code on your own box and it becomes a league:
          Postgres holds the rules — one FAAB purse, one scoring book, confirm-gated season ops —
          and {MCP_WIRED} of {MCP_CATALOG} verbs open to read or act tokens.
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-[13px]">
          <Link
            to="/docs/$slug"
            params={{ slug: "guide" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Guide
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
            params={{ slug: "agents" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Connect an agent
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "migrate" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Migrate a league
          </Link>
          <span className="ml-auto flex items-center gap-1.5 text-faint" title="works with">
            <ClaudeMark className="h-[13px] w-[13px]" />
            <OpenAIMark className="h-[13px] w-[13px]" />
            <OpenCodeMark className="h-[11px] w-[11px]" />
            <span className="font-mono text-[10px] font-semibold tracking-wide">GROK</span>
          </span>
        </div>
      </div>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues — receipts for your fantasy week, on a headless league. MIT.
      </footer>
    </div>
  );
}
