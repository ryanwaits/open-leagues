import { createFileRoute } from "@tanstack/react-router";

/**
 * Every game of a season with its closing lines, prices, result, and context —
 * nflverse's games table, served as JSON with CORS on. The backbone of any
 * backtest; free, no key, refreshed every six hours.
 */
const CORS = { "access-control-allow-origin": "*" };

export const Route = createFileRoute("/api/lines/$season.json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const m = new URL(request.url).pathname.match(/\/api\/lines\/(\d{4})\.json\/?$/);
        const season = m ? Number(m[1]) : Number.NaN;
        if (!Number.isFinite(season) || season < 1999) {
          return Response.json({ error: "season" }, { status: 400, headers: CORS });
        }
        try {
          const { gameLines } = await import("@/lib/lab/lines.server");
          const q = new URL(request.url).searchParams;
          const games = await gameLines({ season, postseason: q.get("postseason") === "true" });
          return Response.json(
            {
              source: "nflverse nfldata games.csv · closing lines",
              season,
              count: games.length,
              games,
            },
            { headers: { ...CORS, "cache-control": "public, max-age=3600, s-maxage=21600" } },
          );
        } catch {
          return Response.json({ error: "unavailable" }, { status: 503, headers: CORS });
        }
      },
    },
  },
});
