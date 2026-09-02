import { createFileRoute } from "@tanstack/react-router";

/**
 * The player-ID crosswalk: Sleeper, GSIS (nflverse), ESPN, Yahoo, RotoWire,
 * Sportradar ids side by side. Free, anonymous, cached for a day. The map
 * every hobby tool hand-builds, published once so nobody has to.
 */
const CORS = { "access-control-allow-origin": "*" };

export const Route = createFileRoute("/api/players.json")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          const { playersCrosswalk } = await import("@/lib/receipts/open-data.server");
          const rows = await playersCrosswalk();
          return Response.json(
            { source: "sleeper players + nflverse gsis", count: rows.length, players: rows },
            { headers: { ...CORS, "cache-control": "public, max-age=3600, s-maxage=86400" } },
          );
        } catch {
          return Response.json({ error: "unavailable" }, { status: 503, headers: CORS });
        }
      },
    },
  },
});
