import { Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/receipt-card";
import { useConsoleSkin } from "@/lib/use-console-skin";

/**
 * What a substrate box says where a door would be. Plain, one screen, and
 * pointing at the two things this box does do and the one place the rest lives.
 */
export function SubstrateNotice({ what }: { what: string }) {
  useConsoleSkin();
  return (
    <PublicShell>
      <div className="mt-12 max-w-[560px]">
        <p className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
          not on this box
        </p>
        <h1 className="mt-2 text-balance text-[26px] font-medium leading-[1.25]">
          {what} lives on your own box.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This host is a public substrate: receipts for any Sleeper league, the open data files, and
          the read verbs over MCP. It keeps no accounts and hosts no leagues, so there is nothing to
          sign into here. Everything else — a league of your own, tokens, frozen strategies — runs
          on a box you own, with one command.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          <Link to="/" className="underline underline-offset-4 hover:text-fg">
            Get a receipt
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "self-host" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Run your own box
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "agents" }}
            className="underline underline-offset-4 hover:text-fg"
          >
            Add /api/mcp to your agent
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
