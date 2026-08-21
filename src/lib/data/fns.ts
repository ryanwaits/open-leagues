import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { isHostedLeague } from "./types";

export const getPulse = createServerFn({ method: "GET" }).handler(async () => {
  const sleeper = await import("./sleeper.server");
  const espn = await import("./espn.server");
  // Map refresh is daily and large — don't block the pulse on it.
  void import("./player-refresh.server")
    .then((m) => m.refreshPlayerStatus())
    .catch(() => undefined);
  const [state, board, news, trending] = await Promise.all([
    sleeper.fetchNflState(),
    espn.fetchScoreboard(),
    espn.fetchNews(),
    sleeper.loadTrending(),
    import("./rotowire.server").then((m) => m.refreshRotowireFeed().catch(() => 0)),
  ]);
  return { state, games: board.games, news, trending };
});

export const getScores = createServerFn({ method: "GET" })
  .validator(
    z.object({
      week: z.number().optional(),
      season: z.number().optional(),
      seasonType: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const espn = await import("./espn.server");
    return espn.fetchScoreboard(data);
  });

export const getGameSummary = createServerFn({ method: "GET" })
  .validator(z.object({ gameId: z.string() }))
  .handler(async ({ data }) => {
    const espn = await import("./espn.server");
    return espn.fetchGameSummary(data.gameId);
  });

export const getWeekStats = createServerFn({ method: "GET" })
  .validator(
    z.object({
      season: z.string(),
      week: z.number(),
      kind: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const live = await import("./live.server");
    return live.fetchWeekStats(data.season, data.week, data.kind ?? "regular");
  });

export const getLiveWire = createServerFn({ method: "GET" })
  .validator(
    z.object({
      week: z.number().optional(),
      season: z.number().optional(),
      kind: z.enum(["pre", "regular", "post"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sleeper = await import("./sleeper.server");
    const live = await import("./live.server");
    const { playerTeam } = await import("./teams");
    const state = await sleeper.fetchNflState();
    const kind =
      data.kind ??
      (state.season_type === "pre" || state.season_type === "post" ? state.season_type : "regular");
    const week = data.week ?? state.display_week ?? state.week;
    const season = String(data.season ?? state.season);
    const [board, pts] = await Promise.all([
      live.weekBoard(season, week, kind),
      live.fetchWeekPoints(season, week, "ppr", kind),
    ]);
    const leaders = Object.entries(pts)
      .map(([id, points]) => {
        const p = sleeper.getPlayer(id);
        return {
          id,
          points,
          name: p?.full_name ?? (p?.team ? `${p.team} D/ST` : id),
          pos: p?.position ?? null,
          team: p?.team ?? null,
          game: live.gameForTeam(board.index, playerTeam(p)),
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 16);
    return {
      asOf: Date.now(),
      week,
      season,
      kind,
      live: board.live,
      gamesIn: board.games.filter((g) => g.state === "in").length,
      gamesTotal: board.games.length,
      scoredPlayers: Object.keys(pts).length,
      leaders,
      pollMs: board.live ? 12_000 : 30_000,
    };
  });

export const findSleeperUser = createServerFn({ method: "GET" })
  .validator(z.object({ query: z.string() }))
  .handler(async ({ data }) => {
    const sleeper = await import("./sleeper.server");
    return sleeper.lookupUser(data.query);
  });

export const getLeagueBundle = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ data, context }) => {
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      return eng.loadLeagueBundle(data.leagueId, context.userId);
    }
    const sleeper = await import("./sleeper.server");
    return sleeper.loadLeagueBundle(data.leagueId);
  });

export const getMatchups = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number() }))
  .handler(async ({ data, context }) => {
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      const pairs = await eng.loadMatchups(data.leagueId, data.week);
      // Fire-and-forget, throttled inside: any client polling matchups
      // while scoring is live keeps ff_ticks warm without this request
      // waiting on the write.
      void import("@/lib/league/ticks.server")
        .then((t) => t.recordTicks(data.leagueId, data.week))
        .catch(() => {});
      return pairs;
    }
    const sleeper = await import("./sleeper.server");
    return sleeper.loadMatchups(data.leagueId, data.week);
  });

/** Read-only history for the matchup finals chart — the past `useMatchupSeries` needs on a reload. */
export const getTicks = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number(), matchupId: z.number() }))
  .handler(async ({ data, context }) => {
    if (!isHostedLeague(data.leagueId)) return [];
    const eng = await import("@/lib/league/engine.server");
    await eng.assertLeagueViewer(data.leagueId, context.userId);
    const ticks = await import("@/lib/league/ticks.server");
    return ticks.readTicks(data.leagueId, data.week, data.matchupId);
  });

export const getTeam = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      rosterId: z.number(),
      week: z.number(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
    }
    const team = isHostedLeague(data.leagueId)
      ? await (await import("@/lib/league/engine.server")).loadTeam(
          data.leagueId,
          data.rosterId,
          data.week,
        )
      : await (await import("./sleeper.server")).loadTeam(data.leagueId, data.rosterId, data.week);
    const { decorateRoster } = await import("./player-refresh.server");
    await decorateRoster(team.players);
    return team;
  });

export const getWire = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      position: z.string(),
      query: z.string(),
      scope: z.enum(["all", "available", "free_agent"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const scope = data.scope ?? "available";
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      return eng.loadWire(data.leagueId, data.position, data.query, scope);
    }
    const sleeper = await import("./sleeper.server");
    return sleeper.loadWire(data.leagueId, data.position, data.query, scope);
  });

export const getActivity = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number() }))
  .handler(async ({ data, context }) => {
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      return eng.loadActivity(data.leagueId, data.week);
    }
    const sleeper = await import("./sleeper.server");
    return sleeper.loadActivity(data.leagueId, data.week);
  });

export const getByeWeeks = createServerFn({ method: "GET" })
  .validator(z.object({ season: z.string() }))
  .handler(async ({ data }) => {
    const byes = await import("./byes.server");
    return byes.byeWeeks(data.season);
  });

export const getProjections = createServerFn({ method: "GET" })
  .validator(
    z.object({
      leagueId: z.string(),
      season: z.string(),
      week: z.number(),
      players: z.array(
        z.object({
          player_id: z.string(),
          team: z.string().nullable().optional(),
          injury_status: z.string().nullable().optional(),
          status: z.string().nullable().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const proj = await import("./projections.server");
    return proj.projectPlayers(data);
  });

/** Whole-week starter (+ rostered) projections. Avoids a fat GET of every player. */
export const getWeekProjections = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(
    z.object({
      leagueId: z.string(),
      season: z.string(),
      week: z.number(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { isHostedLeague } = await import("./types");
    const sleeper = await import("./sleeper.server");
    const seen = new Set<string>();
    const players: {
      player_id: string;
      team?: string | null;
      injury_status?: string | null;
      status?: string | null;
    }[] = [];

    function take(
      p: {
        player_id: string;
        team?: string | null;
        injury_status?: string | null;
        status?: string | null;
      } | null,
    ) {
      if (!p || seen.has(p.player_id)) return;
      seen.add(p.player_id);
      players.push({
        player_id: p.player_id,
        team: p.team,
        injury_status: p.injury_status,
        status: p.status,
      });
    }

    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      const { getSql } = await import("@/lib/db");
      const [pairs, spots] = await Promise.all([
        eng.loadMatchups(data.leagueId, data.week),
        (await getSql())<{ player_id: string }>`
          select distinct player_id from ff_spots where league_id = ${data.leagueId}
        `,
      ]);
      for (const pair of pairs) {
        for (const side of [pair.home, pair.away]) {
          for (const line of side?.starters ?? []) take(line.player);
        }
      }
      for (const spot of spots) take(sleeper.getPlayer(spot.player_id));
    } else {
      const pairs = await sleeper.loadMatchups(data.leagueId, data.week);
      for (const pair of pairs) {
        for (const side of [pair.home, pair.away]) {
          for (const line of side?.starters ?? []) take(line.player);
        }
      }
    }

    const proj = await import("./projections.server");
    return proj.projectPlayers({ ...data, players });
  });

export const getOutlooks = createServerFn({ method: "GET" })
  .validator(
    z.object({
      leagueId: z.string(),
      season: z.string(),
      playerIds: z.array(z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const proj = await import("./projections.server");
    return proj.outlooksFor(data);
  });

export const getPlayerProfile = createServerFn({ method: "GET" })
  .validator(
    z.object({
      leagueId: z.string(),
      playerId: z.string(),
      season: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const profile = await import("./player-profile.server");
    return profile.loadPlayerProfile(data);
  });

export const getLeaders = createServerFn({ method: "GET" })
  .validator(z.object({ position: z.string() }))
  .handler(async ({ data }) => {
    const sleeper = await import("./sleeper.server");
    return sleeper.loadLeaders(data.position);
  });

export const getPlayerSearch = createServerFn({ method: "GET" })
  .validator(z.object({ query: z.string(), position: z.string() }))
  .handler(async ({ data }) => {
    const sleeper = await import("./sleeper.server");
    return sleeper.searchPlayers(data.query, data.position);
  });

export const getRecap = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number() }))
  .handler(async ({ data, context }) => {
    if (isHostedLeague(data.leagueId)) {
      const eng = await import("@/lib/league/engine.server");
      await eng.assertLeagueViewer(data.leagueId, context.userId);
      return eng.loadDispatch(data.leagueId, data.week);
    }
    const sleeper = await import("./sleeper.server");
    const [bundle, pairs, activity] = await Promise.all([
      sleeper.loadLeagueBundle(data.leagueId),
      sleeper.loadMatchups(data.leagueId, data.week),
      sleeper.loadActivity(data.leagueId, data.week),
    ]);
    return sleeper.writeRecap(bundle.league.name, data.week, pairs, activity);
  });

export const getSources = createServerFn({ method: "GET" }).handler(async () => {
  const sleeper = await import("./sleeper.server");
  return sleeper.probeSources();
});
