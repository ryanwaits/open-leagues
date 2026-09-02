import { createFileRoute } from "@tanstack/react-router";
import { isHostedLeague } from "@/lib/data/types";

/**
 * The receipt as a PNG, for unfurls. Unfurlers carry no session, so only raw
 * Sleeper ids render here; a hosted league's receipt stays behind its seat
 * until a commissioner opts the league into public receipts.
 */
function parse(pathname: string): { leagueId: string; week: number; rosterId: number } | null {
  const m = pathname.match(/\/api\/og\/r\/([^/]+)\/(\d+)\/(\d+)\/?$/);
  if (!m) return null;
  return { leagueId: m[1], week: Number(m[2]), rosterId: Number(m[3]) };
}

async function render(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const p = parse(url.pathname);
  if (!p) return new Response("not found", { status: 404 });
  if (isHostedLeague(p.leagueId)) return new Response("not public", { status: 404 });

  try {
    const { buildReceipt } = await import("@/lib/receipts/receipt.server");
    const { renderReceiptPng } = await import("@/lib/receipts/card.server");
    const { count } = await import("@/lib/metrics.server");
    const receipt = await buildReceipt(p.leagueId, p.week, p.rosterId, null);
    const png = await renderReceiptPng(receipt, url.origin);
    count("unfurl", p.leagueId);
    return new Response(png, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=300, s-maxage=900",
      },
    });
  } catch {
    return new Response("could not render", { status: 502 });
  }
}

export const Route = createFileRoute("/api/og/r/$leagueId/$week/$rosterId")({
  server: {
    handlers: {
      GET: async ({ request }) => render(request),
    },
  },
});
