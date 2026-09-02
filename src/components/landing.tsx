import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClaudeMark, OpenAIMark, OpenCodeMark } from "@/components/icons/brand-marks";
import { ReceiptFinder } from "@/components/receipt-finder";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import type { AppUser } from "@/lib/auth/use-current-user";

const LANDING_PLAYS = [
  {
    say: "set my lineup for the bye weeks",
    verbs: ["getAgentContext", "getTeam", "getWeekProjections", "startPlayer"],
  },
  { say: "what's going on this week", verbs: ["getAgentContext", "getMatchups", "getWire"] },
  { say: "put $12 on us", verbs: ["getBook", "placeWager"] },
];

const MCP_WIRED = AGENT_CORE.size;
const MCP_CATALOG = AGENT_TOOLS.length;

export type LandingSeat = {
  leagueId: string;
  name: string;
  season: string;
  role: string;
};

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
        A headless fantasy league.
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Postgres holds the league and enforces the rules. An MCP server exposes every verb. The
        browser app is client zero — not the product.
      </p>
      <p className="mt-2.5 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Migrate a league in once, then run it from a browser, a terminal, or an agent that&apos;s
        never seen this repo before.
      </p>

      <div className="mt-7 mb-3">
        <ReceiptFinder />
      </div>
      <p className="mb-8 max-w-[520px] text-[12.5px] text-faint">
        Sleeper leagues, no account. Team names only. Or{" "}
        <Link to="/docs" className="underline underline-offset-4 hover:text-fg">
          read the docs
        </Link>{" "}
        to run a league of your own.
      </p>

      <div className="mb-3 text-[13px] text-faint">works with</div>
      <div className="mb-8 flex gap-2.5">
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-muted"
          title="Claude"
        >
          <ClaudeMark className="h-[15px] w-[15px]" />
        </div>
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-muted"
          title="OpenAI / Codex"
        >
          <OpenAIMark className="h-[15px] w-[15px]" />
        </div>
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-muted"
          title="opencode"
        >
          <OpenCodeMark className="h-[13px] w-[13px]" />
        </div>
        <div
          className="flex h-[30px] items-center justify-center rounded-md border border-line bg-surface px-2.5 font-mono text-[10.5px] font-semibold tracking-wide text-muted"
          title="Grok (xAI) — no official mark available, shown as text"
        >
          GROK
        </div>
      </div>

      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center gap-1.5 border-b border-line bg-band px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="h-2 w-2 rounded-full bg-line-strong" />
          <span className="ml-1 font-mono text-xs text-faint">codex · open-leagues</span>
        </div>
        <div className="bg-band px-4 py-3 text-[14.5px]">
          <span className="text-faint">› </span>
          get my league context — team name, record, this week&apos;s opponent
        </div>
        <div className="border-t border-line px-4 py-3 text-[13px] italic text-faint">
          Called open-leagues → listMyLeagues, getAgentContext, getLeagueBundle
        </div>
        <div className="flex items-baseline gap-2 border-t border-line px-4 py-3 text-[14.5px]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>
            <b className="font-semibold">hands</b> — 0-0-0 — vs{" "}
            <b className="font-semibold">Butterbean</b>
          </span>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Real Codex session against this host, captured preseason 2026. Full transcript:{" "}
          <Link
            to="/docs/$slug"
            params={{ slug: "agents" }}
            className="underline underline-offset-2"
          >
            docs / agents
          </Link>
          .
        </p>
      </div>

      <div
        id="features"
        className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint"
      >
        features
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          <span>the verbs</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
          <span className="font-semibold">{"importLeague "}</span>
          <span className="text-muted">{"  migrate from Sleeper, ESPN, or a pasted recap"}</span>
          {"\n"}
          <span className="font-semibold">{"startPlayer  "}</span>
          <span className="text-muted">{"  sit/start against real projections"}</span>
          {"\n"}
          <span className="font-semibold">{"addDrop      "}</span>
          <span className="text-muted">{"  work the wire, FAAB conserved"}</span>
          {"\n"}
          <span className="font-semibold">{"voteTrade    "}</span>
          <span className="text-muted">
            {"  propose, counter, accept — priced by replacement value"}
          </span>
          {"\n"}
          <span className="font-semibold">{"placeWager   "}</span>
          <span className="text-muted">
            {"  a real house book against your league's own purse"}
          </span>
          {"\n\n"}
          <span className="italic text-faint">
            {MCP_WIRED} of {MCP_CATALOG} verbs wired to MCP — same primitives the app runs on.
          </span>
        </pre>
      </div>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        playbooks
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          what you say · which verbs fire
        </div>
        {LANDING_PLAYS.map((play) => (
          <div key={play.say} className="border-b border-line px-4 py-3 last:border-b-0">
            <div className="text-[14px]">
              <span className="font-mono text-faint">&rsaquo; </span>
              &ldquo;{play.say}&rdquo;
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {play.verbs.map((verb, i) => (
                <span key={verb} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-[10.5px] text-faint">&rarr;</span> : null}
                  <span className="rounded border border-line bg-band px-1.5 py-px font-mono text-[10.5px] text-muted">
                    {verb}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Four skills ship in the repo. Copy them into your host&apos;s skills dir and a sentence
          runs the whole chain, stopping where a human should confirm.
        </p>
      </div>

      <div className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint">
        the ledger
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          one purse · getAgentContext
        </div>
        <div className="flex h-2.5 bg-raised" aria-hidden="true">
          <span className="block w-[74%] bg-accent" />
          <span className="block w-[12%] bg-warn" />
        </div>
        <div className="grid grid-cols-3">
          {[
            ["remaining", "$86"],
            ["at risk", "$12"],
            ["spendable", "$74"],
          ].map(([label, value]) => (
            <div key={label} className="border-l border-line px-4 py-3 first:border-l-0">
              <div className="microlabel-data">{label}</div>
              <div className="mt-0.5 font-mono text-[18px] tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint">
          Waiver bids and wager stakes draw from the same purse. A spend is checked against
          spendable — what is left minus what is staked and unsettled — so money cannot be committed
          twice.
        </p>
      </div>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues — headless fantasy football operator, MIT
      </footer>
    </div>
  );
}
