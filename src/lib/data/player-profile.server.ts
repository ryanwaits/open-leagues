import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBook, presetOf, type ScoringBook } from "@/lib/league/scoring";
import { byeWeekFor } from "./byes.server";
import { isDefense, playerTeam } from "./teams";
import type { PlayerNote, PlayerScheduleGame, SlimPlayer } from "./types";
import { isHostedLeague } from "./types";

export type PlayerProfile = {
  player: SlimPlayer;
  season: string;
  /** Points under THIS league's book, not a canned PPR total. */
  points: number;
  gamesPlayed: number;
  perGame: number;
  /** Rank among players at the same position, recomputed under this book. */
  posRank: number | null;
  posRankOf: number | null;
  /** Raw component totals, for the splits list. */
  splits: Record<string, number>;
  /** One entry per week; null is a bye or a week with nothing to draw. */
  weekly: WeeklyBar[];
  byeWeek: number | null;
  scoringNote: string;
  /** RotoWire notes when we can resolve an ESPN athlete id. */
  news: PlayerNote[];
  /** Regular-season slate for his NFL team. */
  schedule: PlayerScheduleGame[];
  /** Season the news + schedule describe (live NFL year, not the stats seed). */
  slateSeason: string;
  slateWeek: number;
  /**
   * Who holds him in this league, or null if nobody does.
   *
   * The only fact on this page the client cannot work out for itself — the
   * league bundle carries standings and your own roster, but never says which
   * of the other rosters a given player sits on.
   */
  ownedBy: { rosterId: number; teamName: string } | null;
  /** Unowned and sitting for a bid — not the weekly leftover free-agent pool. */
  onWaivers: boolean;
};

export type WeeklyBar = {
  pts: number;
  kind: "actual" | "proj";
} | null;

type StatSeed = Record<string, number> & { player_id: string };

let seasonSeed: StatSeed[] | null = null;
function loadSeasonSeed(): StatSeed[] {
  if (seasonSeed) return seasonSeed;
  seasonSeed = JSON.parse(
    readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
  ) as StatSeed[];
  return seasonSeed;
}

/** The season the bundled files describe. */
const SEED_SEASON = "2025";
const WEEKS = 18;

let weeklyPpr: Record<string, Record<string, number>> | null = null;
function loadWeeklyPpr(): Record<string, Record<string, number>> {
  if (weeklyPpr) return weeklyPpr;
  weeklyPpr = JSON.parse(
    readFileSync(join(process.cwd(), "data/weekly-ppr-2025.json"), "utf8"),
  ) as Record<string, Record<string, number>>;
  return weeklyPpr;
}

/** Both league kinds already surface the resolved book on the bundle. */
async function bookFor(leagueId: string): Promise<ScoringBook> {
  if (isHostedLeague(leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    const bundle = await eng.loadLeagueBundle(leagueId, null, { tick: false });
    return (bundle.league.scoring_settings ?? {}) as ScoringBook;
  }
  const sleeper = await import("./sleeper.server");
  const bundle = await sleeper.loadLeagueBundle(leagueId);
  return (bundle.league.scoring_settings ?? {}) as ScoringBook;
}

export async function loadPlayerProfile(input: {
  leagueId: string;
  playerId: string;
  season?: string;
}): Promise<PlayerProfile | null> {
  const sleeper = await import("./sleeper.server");
  const base = sleeper.getPlayer(input.playerId);
  if (!base) return null;
  const { statusOverlay } = await import("./player-refresh.server");
  const overlay = (await statusOverlay([input.playerId]))[input.playerId];
  const player = overlay
    ? {
        ...base,
        injury_status: overlay.injuryStatus ?? base.injury_status,
        team: overlay.team ?? base.team,
        depth_chart_order: overlay.depthChartOrder ?? base.depth_chart_order,
      }
    : base;

  const season = input.season ?? SEED_SEASON;
  const book = await bookFor(input.leagueId);
  const seed = loadSeasonSeed();
  const mine = seed.find((r) => r.player_id === input.playerId);
  const team = playerTeam(player);

  const live = await import("./live.server");
  const liveSeason: Record<string, Record<string, number>> = await live
    .fetchSeasonStats(season)
    .catch(() => ({}));
  const liveRow = liveSeason[input.playerId] ?? {};
  // Seed is offense-only. D/ST and K components come from the live season map.
  const splits = { ...(mine ? stripMeta(mine) : {}), ...stripMeta(liveRow) };
  const points = seasonPoints(book, player.position, mine, splits, liveRow);
  const gamesPlayed = Number(liveRow.gp ?? mine?.gp ?? 0);

  // Rank has to be recomputed too: a different book reorders the position.
  let posRank: number | null = null;
  let posRankOf: number | null = null;
  if (player.position) {
    const peers = seed
      .map((r) => {
        const p = sleeper.getPlayer(r.player_id);
        const extra = liveSeason[r.player_id] ?? {};
        return {
          id: r.player_id,
          p,
          pts: seasonPoints(
            book,
            p?.position ?? null,
            r,
            { ...stripMeta(r), ...stripMeta(extra) },
            extra,
          ),
        };
      })
      .filter((r) => r.p?.position === player.position);
    peers.sort((a, b) => b.pts - a.pts);
    const idx = peers.findIndex((r) => r.id === input.playerId);
    if (idx >= 0) {
      posRank = idx + 1;
      posRankOf = peers.length;
    }
  }

  const [byeWeek, slate, actuals] = await Promise.all([
    byeWeekFor(season, team),
    loadSlate(player),
    weeklyLine(season, input.playerId, book),
  ]);
  const weekly: WeeklyBar[] = actuals.map((pts, i) => {
    if (byeWeek === i + 1) return null;
    if (pts == null) return null;
    return { pts, kind: "actual" };
  });

  return {
    player,
    season,
    points: Math.round(points * 10) / 10,
    gamesPlayed,
    perGame: gamesPlayed > 0 ? Math.round((points / gamesPlayed) * 10) / 10 : 0,
    posRank,
    posRankOf,
    splits,
    weekly,
    byeWeek,
    scoringNote: `Scored with this league's book`,
    ownedBy: await ownerOf(input.leagueId, input.playerId),
    onWaivers: await onWaivers(input.leagueId, input.playerId),
    news: slate.news,
    schedule: withBye(slate.schedule, slate.byeWeek ?? byeWeek),
    slateSeason: slate.season,
    slateWeek: slate.week,
  };
}

async function loadSlate(player: SlimPlayer): Promise<{
  news: PlayerNote[];
  schedule: PlayerScheduleGame[];
  season: string;
  week: number;
  byeWeek: number | null;
}> {
  const sleeper = await import("./sleeper.server");
  const espn = await import("./espn.server");
  let season = "2026";
  let week = 1;
  try {
    const state = await sleeper.fetchNflState();
    season = state.season;
    // Preseason display_week is not a regular-season week — don't hide week 1.
    week =
      state.season_type === "regular" || state.season_type === "post"
        ? (state.display_week ?? state.week ?? 1)
        : 1;
  } catch {
    /* keep defaults */
  }
  const espnId =
    player.espn_id != null && String(player.espn_id).trim() !== ""
      ? String(player.espn_id)
      : player.position === "DEF"
        ? null
        : await espn.resolveEspnAthleteId(player.full_name);
  const year = Number(season) || new Date().getFullYear();
  const team = playerTeam(player);
  const rw = await import("./rotowire.server");
  const [stored, espnNotes, schedule, byeWeek] = await Promise.all([
    rw
      .refreshRotowireFeed()
      .then(() => rw.notesForPlayer(player.player_id))
      .catch(() => []),
    espnId ? espn.fetchPlayerNotes(espnId, year).catch(() => []) : Promise.resolve([]),
    team ? espn.fetchTeamSchedule(team, year).catch(() => []) : Promise.resolve([]),
    byeWeekFor(season, team),
  ]);
  return { news: mergeNotes(stored, espnNotes), schedule, season, week, byeWeek };
}

function mergeNotes(primary: PlayerNote[], backup: PlayerNote[]): PlayerNote[] {
  const seen = new Set(primary.map((n) => n.headline.slice(0, 48).toLowerCase()));
  const extra = backup.filter((n) => !seen.has(n.headline.slice(0, 48).toLowerCase()));
  return [...primary, ...extra].slice(0, 8);
}

function withBye(games: PlayerScheduleGame[], byeWeek: number | null): PlayerScheduleGame[] {
  if (!byeWeek || games.some((g) => g.week === byeWeek)) return games;
  const bye: PlayerScheduleGame = {
    week: byeWeek,
    date: "",
    opp: "BYE",
    detail: "Bye week",
    state: "pre",
    bye: true,
  };
  return [...games, bye].sort((a, b) => a.week - b.week);
}

async function onWaivers(leagueId: string, playerId: string): Promise<boolean> {
  if (!isHostedLeague(leagueId)) return false;
  try {
    const ops = await import("@/lib/league/ops.server");
    const { playerAvailability } = await import("@/lib/league/waivers");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const row = (
      await sql<{
        waiver_type: string | null;
        last_waiver_week: number | null;
        current_week: number;
      }>`
        select waiver_type, last_waiver_week, current_week from ol_leagues where id = ${leagueId}
      `
    )[0];
    if (!row) return false;
    const owned = await ownerOf(leagueId, playerId);
    const held = (await ops.heldPlayerIds(leagueId)).has(playerId);
    return (
      playerAvailability({
        owned: Boolean(owned),
        waiverType: row.waiver_type,
        lastWaiverWeek: row.last_waiver_week ?? 0,
        currentWeek: row.current_week,
        held,
      }) === "waiver"
    );
  } catch {
    return false;
  }
}

/** Only hosted leagues have rosters we can read; an import is always read-only. */
async function ownerOf(
  leagueId: string,
  playerId: string,
): Promise<{ rosterId: number; teamName: string } | null> {
  if (!isHostedLeague(leagueId)) return null;
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const row = (
      await sql<{ roster_id: number; team_name: string | null }>`
        select s.roster_id, r.team_name
        from ol_spots s
        left join ol_rosters r
          on r.league_id = s.league_id and r.roster_id = s.roster_id
        where s.league_id = ${leagueId} and s.player_id = ${playerId}
        limit 1
      `
    )[0];
    if (!row) return null;
    return { rosterId: row.roster_id, teamName: row.team_name ?? `Roster ${row.roster_id}` };
  } catch {
    // A league whose tables have not been created yet simply has no owners.
    return null;
  }
}

const META_KEYS = new Set([
  "player_id",
  "gp",
  "pts_ppr",
  "pts_half_ppr",
  "pts_std",
  "pos_rank_ppr",
]);
function stripMeta(row: Record<string, unknown> | StatSeed): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!META_KEYS.has(k) && typeof v === "number") out[k] = v;
  }
  return out;
}

/** D/ST and K season maps cannot be re-scored from bucket totals. Use the canned line. */
function seasonPoints(
  book: ScoringBook,
  pos: string | null | undefined,
  seed: StatSeed | undefined,
  splits: Record<string, number>,
  live: Record<string, number>,
): number {
  const preset = presetOf(book);
  const canned =
    Number(
      seed
        ? preset === "half"
          ? seed.pts_half_ppr
          : preset === "std"
            ? seed.pts_std
            : seed.pts_ppr
        : (live.pts_ppr ?? live.pts_std ?? 0),
    ) || 0;
  if (isDefense(pos) || pos === "K") return canned || applyBook(book, splits);
  return applyBook(book, splits) || canned;
}

/**
 * Weekly points under the league's book. Sleeper's per-week stat maps are raw
 * components, so each week is scored the same way the season is. The bundled
 * PPR file is deliberately unused: it would be wrong in any league that is not
 * full PPR.
 */
async function weeklyLine(
  season: string,
  playerId: string,
  book: ScoringBook,
): Promise<(number | null)[]> {
  // 2025 PPR is already on disk. Hitting Sleeper for all 18 weeks is what made
  // a cold profile click wait a second or two before the stats row painted.
  if (season === SEED_SEASON && presetOf(book) === "ppr") {
    const weekly = loadWeeklyPpr();
    return Array.from({ length: WEEKS }, (_, i) => {
      const v = weekly[String(i + 1)]?.[playerId];
      return typeof v === "number" ? Math.round(v * 10) / 10 : null;
    });
  }
  const live = await import("./live.server");
  const weeks = await Promise.all(
    Array.from({ length: WEEKS }, async (_, i) => {
      try {
        const raw = await live.fetchWeekStats(season, i + 1, "regular");
        const line = raw[playerId];
        if (!line) return null;
        return Math.round(applyBook(book, line) * 10) / 10;
      } catch {
        return null;
      }
    }),
  );
  return weeks;
}
