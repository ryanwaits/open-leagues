import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ClaudeMark, OpenAIMark } from "@/components/icons/brand-marks";
import { LogoMark } from "@/components/logo";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  // Marketing identity is fixed to Console, independent of whatever skin
  // the visitor has picked for their own desk (data-skin lives on <html>,
  // shared globally — see src/lib/theme.ts). Restore whatever was there
  // before on unmount so navigating away doesn't leave it stuck.
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
      <nav className="flex items-center justify-between border-b border-line py-7">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <LogoMark className="h-4 w-4 text-accent" />
          open-leagues
        </div>
        <div className="flex gap-5 text-sm">
          <a href="#features" className="text-muted hover:text-fg">
            Features
          </a>
          <a href="#docs" className="text-muted hover:text-fg">
            Docs
          </a>
          <a href="https://github.com/ryanwaits/open-leagues" className="text-muted hover:text-fg">
            GitHub
          </a>
        </div>
      </nav>

      <h1 className="mt-12 text-balance text-[34px] font-medium leading-[1.25] tracking-[-0.01em]">
        A headless fantasy league.
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Postgres holds the league and enforces the rules. An MCP server exposes every verb. The
        reference app you're picturing right now is client zero — not the product.
      </p>
      <p className="mt-2.5 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Migrate a league in once, then run it from a browser, a terminal, or an agent that's never
        seen this repo before.
      </p>

      <div className="mt-7 mb-8">
        <div className="mb-3 text-[13px] text-faint">works with</div>
        <div className="flex gap-2.5">
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
            className="flex h-[30px] items-center justify-center rounded-md border border-line bg-surface px-2.5 font-mono text-[10.5px] font-semibold tracking-wide text-muted"
            title="Grok (xAI) — no official mark available, shown as text"
          >
            GROK
          </div>
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
      </div>

      <div
        id="features"
        className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-faint"
      >
        features
      </div>
      <div className="mb-14 overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
          <span>open-leagues --help</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
          <span className="text-faint">$ open-leagues --help</span>
          {"\n\n"}
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
            57 of 76 verbs wired to MCP — same primitives the app runs on.
          </span>
        </pre>
      </div>

      <div
        id="docs"
        className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-faint"
      >
        docs
      </div>
      <p className="mb-5 text-[13.5px] text-muted">
        Any signed-in member mints their own token from{" "}
        <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px]">/account</code> — no
        commish gate.
      </p>

      <TermCard label="Codex CLI">
        codex mcp add open-leagues --url https://YOUR_HOST/api/mcp --bearer-token-env-var
        OPENLEAGUES_TOKEN
      </TermCard>
      <TermCard label="Codex CLI (self-hosted box)">
        codex mcp add open-leagues -- bun scripts/mcp.mjs
      </TermCard>
      <TermCard label="Claude / ChatGPT connector">
        {"# url\nhttps://YOUR_HOST/api/mcp\n# auth — bearer token, minted from /account"}
      </TermCard>
      <TermCard label="Self-host">
        {`git clone https://github.com/ryanwaits/open-leagues.git\ncd open-leagues\ndocker compose up -d`}
      </TermCard>

      <footer className="mt-16 border-t border-line pt-6 pb-6 text-center text-xs text-faint">
        open-leagues — headless fantasy football operator, MIT
      </footer>
    </div>
  );
}

function TermCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-md border border-line-strong bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-band px-3.5 py-1.5 text-xs text-muted">
        <span>{label}</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-[1.7]">
        {children}
      </pre>
    </div>
  );
}
