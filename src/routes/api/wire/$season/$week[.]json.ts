import { createFileRoute } from "@tanstack/react-router";

/**
 * What each player actually cleared for on waivers this week, across every
 * Sleeper league that has asked for a receipt. Median, quartiles, count — the
 * number paid tools predict with a model, published as a fact. Anonymous:
 * no league id or manager appears.
 */
const CORS = { "access-control-allow-origin": "*" };

function parse(pathname: string): { season: string; week: number } | null {
  const m = pathname.match(/\/api\/wire\/(\d{4})\/(\d{1,2})\.json\/?$/);
  if (!m) return null;
  return { season: m[1] ?? "", week: Number(m[2]) };
}

export const Route = createFileRoute("/api/wire/$season/$week.json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const p = parse(new URL(request.url).pathname);
        if (!p || p.week < 1 || p.week > 18) {
          return Response.json({ error: "season/week" }, { status: 400, headers: CORS });
        }
        try {
          const { wirePrices } = await import("@/lib/receipts/open-data.server");
          const data = await wirePrices(p.season, p.week);
          return Response.json(data, {
            headers: { ...CORS, "cache-control": "public, max-age=600, s-maxage=3600" },
          });
        } catch {
          return Response.json({ error: "unavailable" }, { status: 503, headers: CORS });
        }
      },
    },
  },
});
