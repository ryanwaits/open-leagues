import { AGENT_TOOLS } from "./catalog";
import { AGENT_CORE } from "./core";

export type DispatchArgs = Record<string, unknown>;

function str(v: unknown, name: string): string {
  if (typeof v !== "string" || !v) throw new Error(`${name} is required`);
  return v;
}

function num(v: unknown, name: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} is required`);
  return n;
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== "string") throw new Error("expected string");
  return v;
}

/** Hosted (lg_) leagues carry the seat rule; a raw Sleeper id is public data. */
function isHosted(leagueId: string): boolean {
  return leagueId.startsWith("lg_");
}

function asJson(result: unknown): unknown {
  return result === undefined ? { ok: true } : result;
}

function strArray(v: unknown, name: string): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new Error(`${name} is required`);
  }
  return v;
}

type SchedulePair = { home: number; away: number | null };

function schedulePairs(v: unknown, name: string): SchedulePair[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${name} is required`);
  return v.map((row, i) => {
    if (typeof row !== "object" || row === null) throw new Error(`${name}[${i}] must be an object`);
    const r = row as Record<string, unknown>;
    const away = r.away == null || r.away === "" ? null : num(r.away, `${name}[${i}].away`);
    return { home: num(r.home, `${name}[${i}].home`), away };
  });
}

type TradeAsset = {
  fromRoster: number;
  toRoster: number;
  kind: "player" | "pick" | "faab";
  playerId?: string | null;
  pickNo?: number | null;
  amount?: number | null;
};

function tradeAssets(v: unknown, name: string): TradeAsset[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${name} is required`);
  return v.map((row, i) => {
    if (typeof row !== "object" || row === null) throw new Error(`${name}[${i}] must be an object`);
    const r = row as Record<string, unknown>;
    const kind = r.kind;
    if (kind !== "player" && kind !== "pick" && kind !== "faab") {
      throw new Error(`${name}[${i}].kind must be player, pick, or faab`);
    }
    return {
      fromRoster: num(r.fromRoster, `${name}[${i}].fromRoster`),
      toRoster: num(r.toRoster, `${name}[${i}].toRoster`),
      kind,
      playerId: typeof r.playerId === "string" ? r.playerId : null,
      pickNo: optNum(r.pickNo) ?? null,
      amount: optNum(r.amount) ?? null,
    };
  });
}

/**
 * Settings an agent may touch, mirroring the saveSettings validator. An unknown
 * key is dropped rather than forwarded — a commissioner verb is not a place to
 * let a caller invent columns.
 */
function settingsPatch(args: DispatchArgs): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const numeric = [
    "playoffTeams",
    "currentWeek",
    "faabBudget",
    "tradeDeadlineWeek",
    "playoffStartWeek",
    "regularWeeks",
    "playoffByes",
    "poolSeed",
    "wagerCap",
    "exposureCap",
  ] as const;
  for (const key of numeric) {
    const n = optNum(args[key]);
    if (n !== undefined) patch[key] = n;
  }
  const name = optStr(args.name);
  if (name !== undefined) patch.name = name;
  const waiverType = optStr(args.waiverType);
  if (waiverType !== undefined) patch.waiverType = waiverType;
  if (typeof args.bettingOn === "boolean") patch.bettingOn = args.bettingOn;
  if (Array.isArray(args.slots)) patch.slots = strArray(args.slots, "slots");
  if (args.book != null) {
    if (typeof args.book !== "object") throw new Error("book must be an object");
    const book: Record<string, number> = {};
    for (const [k, v] of Object.entries(args.book as Record<string, unknown>)) {
      book[k] = num(v, `book.${k}`);
    }
    patch.book = book;
  }
  if (Object.keys(patch).length === 0) throw new Error("saveSettings needs at least one field");
  return patch;
}

/** A season operation that cannot be undone by calling its opposite. */
function requireConfirm(id: string, args: DispatchArgs): void {
  if (args.confirm !== true) throw new Error(`${id} requires confirm: true`);
}

type PlayerRow = {
  player_id: string;
  team?: string | null;
  injury_status?: string | null;
  status?: string | null;
};

function playerRows(v: unknown, name: string): PlayerRow[] {
  if (!Array.isArray(v)) throw new Error(`${name} is required`);
  return v.map((row, i) => {
    if (
      typeof row !== "object" ||
      row === null ||
      typeof (row as { player_id?: unknown }).player_id !== "string"
    ) {
      throw new Error(`${name}[${i}].player_id is required`);
    }
    const r = row as Record<string, unknown>;
    return {
      player_id: r.player_id as string,
      team: typeof r.team === "string" ? r.team : null,
      injury_status: typeof r.injury_status === "string" ? r.injury_status : null,
      status: typeof r.status === "string" ? r.status : null,
    };
  });
}

type RebuildTeamRow = {
  teamName: string;
  manager: string;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pf: number | null;
  pa: number | null;
  names: string[];
};

function rebuildTeamRows(v: unknown, name: string): RebuildTeamRow[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v)) throw new Error(`${name} must be an array`);
  return v.map((row, i) => {
    if (typeof row !== "object" || row === null) {
      throw new Error(`${name}[${i}] must be an object`);
    }
    const r = row as Record<string, unknown>;
    if (typeof r.teamName !== "string") throw new Error(`${name}[${i}].teamName is required`);
    if (typeof r.manager !== "string") throw new Error(`${name}[${i}].manager is required`);
    return {
      teamName: r.teamName,
      manager: r.manager,
      wins: typeof r.wins === "number" ? r.wins : null,
      losses: typeof r.losses === "number" ? r.losses : null,
      ties: typeof r.ties === "number" ? r.ties : null,
      pf: typeof r.pf === "number" ? r.pf : null,
      pa: typeof r.pa === "number" ? r.pa : null,
      names: strArray(r.names, `${name}[${i}].names`),
    };
  });
}

/**
 * Call a core catalog id against the hosted-league engine.
 * `userId` must come from the host (OPENLEAGUES_USER / token) — never from model args.
 */
export type DispatchOptions = {
  /** What the credential may do. `read` is refused at the door of every write. */
  scope?: "read" | "act";
  /** A name for the receipt: the token's label, "stdio", or "proxy". */
  actor?: string;
};

export async function dispatch(
  id: string,
  userId: string | null | undefined,
  args: DispatchArgs = {},
  opts: DispatchOptions = {},
): Promise<unknown> {
  if (id === "tick" || id === "tickAllLeagues") {
    throw new Error(`${id} is a cron clock, not a tool`);
  }
  if (!AGENT_CORE.has(id)) {
    throw new Error(`Unknown tool: ${id}`);
  }
  const mutating = AGENT_TOOLS.find((t) => t.id === id)?.mutating ?? false;
  if (mutating && opts.scope === "read") {
    throw new Error(`${id} is a write; this token is read-only`);
  }

  const result = await run(id, userId, args);

  // The receipt names the agent. A write that came through a credential is
  // logged against the roster it acted for; failure to log never fails the write.
  if (mutating && userId && opts.actor && typeof args.leagueId === "string") {
    void tagAgentAction(args.leagueId, userId, id, opts.actor);
  }
  return result;
}

async function tagAgentAction(leagueId: string, userId: string, tool: string, actor: string) {
  try {
    if (!leagueId.startsWith("lg_")) return;
    const eng = await import("@/lib/league/engine.server");
    const rosterId = await eng.rosterIdOwnedBy(leagueId, userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const row = (
      await sql<{
        current_week: number;
      }>`select current_week from ol_leagues where id = ${leagueId}`
    )[0];
    const { recordEvent } = await import("@/lib/league/events.server");
    await recordEvent({
      leagueId,
      week: row?.current_week ?? 1,
      kind: "agent_action",
      actorRoster: rosterId ?? null,
      payload: { tool, actor },
    });
  } catch {
    /* best-effort */
  }
}

async function run(
  id: string,
  userId: string | null | undefined,
  args: DispatchArgs,
): Promise<unknown> {
  const meta = AGENT_TOOLS.find((t) => t.id === id);
  if (meta?.mutating) {
    if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
  }

  const uid = userId ?? null;

  switch (id) {
    case "getAgentContext": {
      const { loadAgentContext } = await import("@/lib/league/agent-context.server");
      return asJson(await loadAgentContext(str(args.leagueId, "leagueId"), uid));
    }
    case "listMyLeagues": {
      if (!userId) throw new Error("listMyLeagues requires a signed-in user (OPENLEAGUES_USER)");
      const { listMyLeagues } = await import("@/lib/league/engine.server");
      return asJson(await listMyLeagues(userId));
    }
    case "getTeam": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(
        await eng.loadTeam(leagueId, num(args.rosterId, "rosterId"), num(args.week, "week")),
      );
    }
    case "getBook": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const book = await import("@/lib/league/book.server");
      return asJson(await book.loadBook(leagueId, uid, optNum(args.week)));
    }
    case "getReceipt": {
      const leagueId = str(args.leagueId, "leagueId");
      if (isHosted(leagueId)) {
        const eng = await import("@/lib/league/engine.server");
        await eng.assertLeagueViewer(leagueId, uid);
      }
      const { buildReceipt } = await import("@/lib/receipts/receipt.server");
      return asJson(
        await buildReceipt(leagueId, num(args.week, "week"), num(args.rosterId, "rosterId"), uid),
      );
    }
    case "getWeekBoard": {
      const leagueId = str(args.leagueId, "leagueId");
      if (isHosted(leagueId)) {
        const eng = await import("@/lib/league/engine.server");
        await eng.assertLeagueViewer(leagueId, uid);
      }
      const { buildWeekBoard } = await import("@/lib/receipts/receipt.server");
      return asJson(await buildWeekBoard(leagueId, optNum(args.week) ?? null, uid));
    }
    case "getGameLines": {
      const lines = await import("@/lib/lab/lines.server");
      return asJson(
        await lines.gameLines({
          season: num(args.season, "season"),
          week: optNum(args.week),
          postseason: args.postseason === true,
        }),
      );
    }
    case "getGameContext": {
      const lines = await import("@/lib/lab/lines.server");
      return asJson(await lines.gameLine(str(args.gameId, "gameId")));
    }
    case "getBettingSplits": {
      const sp = await import("@/lib/lab/splits.server");
      const season = num(args.season, "season");
      const week = num(args.week, "week");
      const status = await sp.ensureSplits(season, week).catch((e: Error) => ({
        skipped: true,
        rows: 0,
        source: sp.splitsSource(),
        error: e.message,
      }));
      const by = await sp.splitsFor([season], week);
      return asJson({ ...status, games: Object.fromEntries(by) });
    }
    case "sampleGames": {
      const seasons = args.seasons;
      if (!Array.isArray(seasons) || seasons.length === 0) throw new Error("seasons is required");
      const lines = await import("@/lib/lab/lines.server");
      const lab = await import("@/lib/lab/bets");
      const filterArg = (typeof args.filter === "object" && args.filter ? args.filter : {}) as {
        splits?: unknown[];
      };
      if (Array.isArray(filterArg.splits) && filterArg.splits.length > 0) {
        const sp = await import("@/lib/lab/splits.server");
        for (const season of seasons) await sp.ensureSeasonSplits(Number(season));
      }
      const games = await lines.gameLinesRange(seasons.map((x) => Number(x)));
      const filter = (
        typeof args.filter === "object" && args.filter ? args.filter : {}
      ) as import("@/lib/lab/bets").GameFilter;
      const out = lab.sampleGames(games, filter);
      return asJson({ count: out.length, games: out });
    }
    case "evaluateBets": {
      const bets = args.bets;
      if (!Array.isArray(bets) || bets.length === 0) throw new Error("bets is required");
      const lines = await import("@/lib/lab/lines.server");
      const lab = await import("@/lib/lab/bets");
      const typed = bets as import("@/lib/lab/bets").Bet[];
      const seasons = [
        ...new Set(typed.map((b) => Number(String(b.gameId).slice(0, 4))).filter(Number.isFinite)),
      ];
      const games = await lines.gameLinesRange(seasons);
      return asJson(lab.evaluateBets(games, typed));
    }
    case "summarizeRun": {
      const bets = args.bets;
      if (!Array.isArray(bets) || bets.length === 0) throw new Error("bets is required");
      const lab = await import("@/lib/lab/bets");
      return asJson(lab.summarize(bets as import("@/lib/lab/bets").GradedBet[]));
    }
    case "getSourceLedger": {
      const leagueId = str(args.leagueId, "leagueId");
      if (isHosted(leagueId)) {
        const eng = await import("@/lib/league/engine.server");
        await eng.assertLeagueViewer(leagueId, uid);
      }
      const { buildSourceLedger } = await import("@/lib/receipts/ledger.server");
      return asJson(await buildSourceLedger(leagueId, num(args.rosterId, "rosterId"), uid));
    }
    case "getMatchups": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadMatchups(leagueId, num(args.week, "week")));
    }
    case "getWire": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const scope =
        args.scope === "all" || args.scope === "available" || args.scope === "free_agent"
          ? args.scope
          : "available";
      return asJson(
        await eng.loadWire(
          leagueId,
          str(args.position ?? "ALL", "position"),
          typeof args.query === "string" ? args.query : "",
          scope,
        ),
      );
    }
    case "getDraft": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(
        await eng.loadDraft(
          leagueId,
          uid,
          str(args.position ?? "ALL", "position"),
          typeof args.query === "string" ? args.query : "",
        ),
      );
    }
    case "getSettings": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadSettings(leagueId, uid));
    }
    case "getEvents": {
      const { readEvents } = await import("@/lib/league/events.server");
      return asJson(
        await readEvents(str(args.leagueId, "leagueId"), {
          limit: optNum(args.limit),
          sinceWeek: optNum(args.sinceWeek),
        }),
      );
    }
    case "getLeagueFacts": {
      const { loadLeagueFacts } = await import("@/lib/league/league-facts.server");
      return asJson(await loadLeagueFacts(str(args.leagueId, "leagueId"), num(args.week, "week")));
    }
    case "sitPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { sitPlayer } = await import("@/lib/league/engine.server");
      await sitPlayer(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "startPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { startPlayer } = await import("@/lib/league/engine.server");
      await startPlayer(
        userId,
        str(args.leagueId, "leagueId"),
        str(args.playerId, "playerId"),
        args.replaceId == null ? undefined : (optStr(args.replaceId) ?? null),
        args.slot == null ? undefined : (optStr(args.slot) ?? null),
      );
      return { ok: true };
    }
    case "dropPlayer": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { dropPlayer } = await import("@/lib/league/engine.server");
      await dropPlayer(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "placeWager": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { placeWager } = await import("@/lib/league/wagers.server");
      const kind = args.kind;
      if (kind !== "spread" && kind !== "moneyline") {
        throw new Error("kind must be spread or moneyline");
      }
      return asJson(
        await placeWager({
          userId,
          leagueId: str(args.leagueId, "leagueId"),
          matchupId: num(args.matchupId, "matchupId"),
          kind,
          sideRoster: num(args.sideRoster, "sideRoster"),
          line: num(args.line, "line"),
          stake: num(args.stake, "stake"),
        }),
      );
    }
    case "pullWager": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { pullWager } = await import("@/lib/league/wagers.server");
      await pullWager(userId, str(args.leagueId, "leagueId"), str(args.wagerId, "wagerId"));
      return { ok: true };
    }
    case "makePick": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { makePick } = await import("@/lib/league/engine.server");
      await makePick(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "queueAdd": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { queueAdd } = await import("@/lib/league/engine.server");
      await queueAdd(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "createLeague": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const scoring: "ppr" | "half" | "std" =
        args.scoring === "ppr" || args.scoring === "half" || args.scoring === "std"
          ? args.scoring
          : (() => {
              throw new Error("scoring must be ppr, half, or std");
            })();
      const input = {
        userId,
        name: str(args.name, "name"),
        teamName: str(args.teamName, "teamName"),
        teamCount: num(args.teamCount, "teamCount"),
        scoring,
        fillHouse: args.fillHouse === true,
      };
      const eng = await import("@/lib/league/engine.server");
      return asJson(await eng.createLeague(input));
    }
    case "joinLeague": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const code = str(args.code, "code");
      const teamName = str(args.teamName, "teamName");
      const rosterId = optNum(args.rosterId) ?? null;
      const eng = await import("@/lib/league/engine.server");
      return asJson(await eng.joinLeague(userId, code, teamName, rosterId));
    }
    case "advanceWeek": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const ops = await import("@/lib/league/ops.server");
      await ops.commishAdvance(userId, str(args.leagueId, "leagueId"));
      return { ok: true };
    }
    case "processWaivers": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const ops = await import("@/lib/league/ops.server");
      return asJson(await ops.commishProcessWaivers(userId, str(args.leagueId, "leagueId")));
    }
    case "saveSettings": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const leagueId = str(args.leagueId, "leagueId");
      const patch = settingsPatch(args);
      const eng = await import("@/lib/league/engine.server");
      await eng.saveSettings(userId, leagueId, patch);
      return { ok: true, changed: Object.keys(patch) };
    }
    case "saveWeekSchedule": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const leagueId = str(args.leagueId, "leagueId");
      const week = num(args.week, "week");
      const pairs = schedulePairs(args.pairs, "pairs");
      const eng = await import("@/lib/league/engine.server");
      await eng.saveWeekSchedule(userId, leagueId, week, pairs);
      return { ok: true };
    }
    case "rebuildSchedule": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      requireConfirm(id, args);
      const eng = await import("@/lib/league/engine.server");
      await eng.rebuildSchedule(userId, str(args.leagueId, "leagueId"));
      return { ok: true };
    }
    case "proposeTrade": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const leagueId = str(args.leagueId, "leagueId");
      const assets = tradeAssets(args.assets, "assets");
      const ops = await import("@/lib/league/ops.server");
      return asJson(await ops.proposeTrade(userId, leagueId, assets));
    }
    case "voteTrade": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { voteTrade } = await import("@/lib/league/ops.server");
      if (typeof args.accept !== "boolean") throw new Error("accept must be boolean");
      await voteTrade(
        userId,
        str(args.leagueId, "leagueId"),
        str(args.tradeId, "tradeId"),
        args.accept,
      );
      return { ok: true };
    }
    case "previewImport": {
      const { previewSleeperImport } = await import("@/lib/league/engine.server");
      const includeHistory = args.includeHistory === true;
      return asJson(await previewSleeperImport(str(args.sleeperId, "sleeperId"), includeHistory));
    }
    case "importLeague": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      if (args.confirm !== true) {
        throw new Error("importLeague requires confirm: true");
      }
      const { importSleeperLeague } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importSleeperLeague({
          userId,
          sleeperId: str(args.sleeperId, "sleeperId"),
          claimRosterId: claim,
          includeHistory: args.includeHistory === true,
        }),
      );
    }
    case "getPulse": {
      const sleeper = await import("@/lib/data/sleeper.server");
      const espn = await import("@/lib/data/espn.server");
      // Map refresh is daily and large — don't block the pulse on it.
      void import("@/lib/data/player-refresh.server")
        .then((m) => m.refreshPlayerStatus())
        .catch(() => undefined);
      const [state, board, news, trending] = await Promise.all([
        sleeper.fetchNflState(),
        espn.fetchScoreboard(),
        espn.fetchNews(),
        sleeper.loadTrending(),
        import("@/lib/data/rotowire.server").then((m) => m.refreshRotowireFeed().catch(() => 0)),
      ]);
      return asJson({ state, games: board.games, news, trending });
    }
    case "getScores": {
      const espn = await import("@/lib/data/espn.server");
      return asJson(
        await espn.fetchScoreboard({
          week: optNum(args.week),
          season: optNum(args.season),
          seasonType: optNum(args.seasonType),
        }),
      );
    }
    case "getGameSummary": {
      const espn = await import("@/lib/data/espn.server");
      return asJson(await espn.fetchGameSummary(str(args.gameId, "gameId")));
    }
    case "getWeekStats": {
      const live = await import("@/lib/data/live.server");
      return asJson(
        await live.fetchWeekStats(
          str(args.season, "season"),
          num(args.week, "week"),
          optStr(args.kind) ?? "regular",
        ),
      );
    }
    case "getLiveWire": {
      const sleeper = await import("@/lib/data/sleeper.server");
      const live = await import("@/lib/data/live.server");
      const { playerTeam } = await import("@/lib/data/teams");
      const state = await sleeper.fetchNflState();
      const kind =
        optStr(args.kind) ??
        (state.season_type === "pre" || state.season_type === "post"
          ? state.season_type
          : "regular");
      const week = optNum(args.week) ?? state.display_week ?? state.week;
      const season = String(optNum(args.season) ?? state.season);
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
      return asJson({
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
      });
    }
    case "findSleeperUser": {
      const sleeper = await import("@/lib/data/sleeper.server");
      return asJson(await sleeper.lookupUser(str(args.query, "query")));
    }
    case "getByeWeeks": {
      const byes = await import("@/lib/data/byes.server");
      return asJson(await byes.byeWeeks(str(args.season, "season")));
    }
    case "getLeaders": {
      const sleeper = await import("@/lib/data/sleeper.server");
      return asJson(await sleeper.loadLeaders(str(args.position, "position")));
    }
    case "getPlayerSearch": {
      const sleeper = await import("@/lib/data/sleeper.server");
      return asJson(
        await sleeper.searchPlayers(str(args.query, "query"), str(args.position, "position")),
      );
    }
    case "getSources": {
      const sleeper = await import("@/lib/data/sleeper.server");
      return asJson(await sleeper.probeSources());
    }
    case "getProjections": {
      const proj = await import("@/lib/data/projections.server");
      return asJson(
        await proj.projectPlayers({
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          week: num(args.week, "week"),
          players: playerRows(args.players, "players"),
        }),
      );
    }
    case "getOutlooks": {
      const proj = await import("@/lib/data/projections.server");
      return asJson(
        await proj.outlooksFor({
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          playerIds: strArray(args.playerIds, "playerIds"),
        }),
      );
    }
    case "getPlayerProfile": {
      const profile = await import("@/lib/data/player-profile.server");
      return asJson(
        await profile.loadPlayerProfile({
          leagueId: str(args.leagueId, "leagueId"),
          playerId: str(args.playerId, "playerId"),
          season: optStr(args.season),
        }),
      );
    }
    case "getLeagueBundle": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadLeagueBundle(leagueId, uid));
    }
    case "getTicks": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const ticks = await import("@/lib/league/ticks.server");
      return asJson(
        await ticks.readTicks(leagueId, num(args.week, "week"), num(args.matchupId, "matchupId")),
      );
    }
    case "getActivity": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadActivity(leagueId, num(args.week, "week")));
    }
    case "getRecap": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadDispatch(leagueId, num(args.week, "week")));
    }
    case "getWeekProjections": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const season = str(args.season, "season");
      const week = num(args.week, "week");
      const sleeper = await import("@/lib/data/sleeper.server");
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
      const { getSql } = await import("@/lib/db");
      const [pairs, spots] = await Promise.all([
        eng.loadMatchups(leagueId, week),
        (await getSql())<{ player_id: string }>`
          select distinct player_id from ol_spots where league_id = ${leagueId}
        `,
      ]);
      for (const pair of pairs) {
        for (const side of [pair.home, pair.away]) {
          for (const line of side?.starters ?? []) take(line.player);
        }
      }
      for (const spot of spots) take(sleeper.getPlayer(spot.player_id));
      const proj = await import("@/lib/data/projections.server");
      return asJson(await proj.projectPlayers({ leagueId, season, week, players }));
    }
    case "previewInvite": {
      const eng = await import("@/lib/league/engine.server");
      return asJson(await eng.previewInvite(str(args.code, "code")));
    }
    case "getDesk": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadDesk(leagueId, num(args.week, "week")));
    }
    case "getMockPool": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { scoringBookFor, perGameUnder } = await import("@/lib/data/projections.server");
      const { getPlayer } = await import("@/lib/data/sleeper.server");
      const book = await scoringBookFor(leagueId);
      const seed = JSON.parse(
        readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
      ) as {
        player_id: string;
      }[];
      const out: {
        playerId: string;
        name: string;
        position: string | null;
        team: string | null;
        pts: number;
      }[] = [];
      for (const row of seed) {
        const p = getPlayer(row.player_id);
        if (!p?.position) continue;
        const pts = perGameUnder(book, row.player_id);
        if (pts == null) continue;
        out.push({
          playerId: row.player_id,
          name: p.full_name,
          position: p.position,
          team: p.team ?? null,
          pts,
        });
      }
      out.sort((a, b) => b.pts - a.pts);
      return asJson(out.slice(0, 250));
    }
    case "getClaims": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const mine = await eng.rosterIdOwnedBy(leagueId, uid);
      const ops = await import("@/lib/league/ops.server");
      return asJson(await ops.listClaims(leagueId, mine));
    }
    case "getTrades": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const ops = await import("@/lib/league/ops.server");
      return asJson(await ops.listTrades(leagueId));
    }
    case "getTradablePicks": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      const ops = await import("@/lib/league/ops.server");
      return asJson(await ops.listTradablePicks(leagueId));
    }
    case "getSchedule": {
      const eng = await import("@/lib/league/engine.server");
      const leagueId = str(args.leagueId, "leagueId");
      await eng.assertLeagueViewer(leagueId, uid);
      return asJson(await eng.loadSchedule(leagueId, uid));
    }
    case "exportLeague": {
      if (!userId) throw new Error("exportLeague requires a signed-in user (OPENLEAGUES_USER)");
      const eng = await import("@/lib/league/engine.server");
      return asJson(await eng.exportLeague(userId, str(args.leagueId, "leagueId")));
    }
    case "queueRemove": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { queueRemove } = await import("@/lib/league/engine.server");
      await queueRemove(userId, str(args.leagueId, "leagueId"), str(args.playerId, "playerId"));
      return { ok: true };
    }
    case "queueReorder": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      if (!Array.isArray(args.playerIds)) throw new Error("playerIds is required");
      const playerIds = args.playerIds.map((v) => String(v));
      const { queueReorder } = await import("@/lib/league/engine.server");
      await queueReorder(userId, str(args.leagueId, "leagueId"), playerIds);
      return { ok: true };
    }
    case "setAutodraft": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      if (typeof args.on !== "boolean") throw new Error("on must be boolean");
      const { setAutodraft } = await import("@/lib/league/engine.server");
      await setAutodraft(userId, str(args.leagueId, "leagueId"), args.on);
      return { ok: true };
    }
    case "addDrop": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { addDrop } = await import("@/lib/league/engine.server");
      const dropId = args.dropId == null ? null : str(args.dropId, "dropId");
      return asJson(
        await addDrop(
          userId,
          str(args.leagueId, "leagueId"),
          str(args.addId, "addId"),
          dropId,
          optNum(args.bid) ?? 0,
        ),
      );
    }
    case "cancelClaim": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { cancelClaim } = await import("@/lib/league/ops.server");
      await cancelClaim(userId, str(args.leagueId, "leagueId"), str(args.claimId, "claimId"));
      return { ok: true };
    }
    case "cancelTradeFn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { cancelTrade } = await import("@/lib/league/ops.server");
      await cancelTrade(userId, str(args.leagueId, "leagueId"), str(args.tradeId, "tradeId"));
      return { ok: true };
    }
    case "claimRoster": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { claimRoster } = await import("@/lib/league/engine.server");
      const code = args.code == null ? null : str(args.code, "code");
      await claimRoster(
        userId,
        str(args.leagueId, "leagueId"),
        num(args.rosterId, "rosterId"),
        code,
      );
      return { ok: true };
    }
    case "previewEspn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const { previewEspnImport } = await import("@/lib/league/engine.server");
      return asJson(
        await previewEspnImport({
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          swid: optStr(args.swid),
          espnS2: optStr(args.espnS2),
        }),
      );
    }
    case "importEspn": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      if (args.confirm !== true) throw new Error("importEspn requires confirm: true");
      const { importEspnLeague } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importEspnLeague({
          userId,
          leagueId: str(args.leagueId, "leagueId"),
          season: str(args.season, "season"),
          claimRosterId: claim,
          swid: optStr(args.swid),
          espnS2: optStr(args.espnS2),
        }),
      );
    }
    case "previewRebuild": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      const scoring: "ppr" | "half" | "std" =
        args.scoring === "ppr" || args.scoring === "half" || args.scoring === "std"
          ? args.scoring
          : (() => {
              throw new Error("scoring must be ppr, half, or std");
            })();
      const { previewRebuild } = await import("@/lib/league/engine.server");
      return asJson(
        await previewRebuild({
          paste: optStr(args.paste),
          known: optStr(args.known),
          pdfBase64: optStr(args.pdfBase64),
          teams: rebuildTeamRows(args.teams, "teams"),
          name: str(args.name, "name"),
          season: str(args.season, "season"),
          scoring,
        }),
      );
    }
    case "importRebuild": {
      if (!userId) throw new Error(`${id} requires a signed-in user (OPENLEAGUES_USER)`);
      if (args.confirm !== true) throw new Error("importRebuild requires confirm: true");
      const scoring: "ppr" | "half" | "std" =
        args.scoring === "ppr" || args.scoring === "half" || args.scoring === "std"
          ? args.scoring
          : (() => {
              throw new Error("scoring must be ppr, half, or std");
            })();
      const { importRebuild } = await import("@/lib/league/engine.server");
      const claim =
        args.claimRosterId == null || args.claimRosterId === ""
          ? null
          : num(args.claimRosterId, "claimRosterId");
      return asJson(
        await importRebuild({
          userId,
          paste: optStr(args.paste),
          known: optStr(args.known),
          teams: rebuildTeamRows(args.teams, "teams"),
          name: str(args.name, "name"),
          season: str(args.season, "season"),
          scoring,
          claimRosterId: claim,
        }),
      );
    }
    default:
      throw new Error(`Unknown tool: ${id}`);
  }
}
