/**
 * JSON Schemas for tool arguments, as MCP clients see them.
 *
 * Without a typed schema a client has nothing to go on and will stringify an
 * array or an object; `sampleGames` then receives `"[2023, 2024]"` and refuses
 * it. Typed schemas fix that at the source, and double as the shortest
 * documentation an agent reads before its first call. Verbs not listed here
 * fall back to a permissive object.
 */
type Schema = Record<string, unknown>;

const num = (description: string): Schema => ({ type: "number", description });
const str = (description: string): Schema => ({ type: "string", description });
const bool = (description: string): Schema => ({ type: "boolean", description });
const arr = (items: Schema, description: string): Schema => ({ type: "array", items, description });
const range = (description: string): Schema => ({
  type: "array",
  items: { type: "number" },
  minItems: 2,
  maxItems: 2,
  description: `${description} as [min, max]`,
});
const obj = (
  properties: Record<string, Schema>,
  required: string[] = [],
  extra = false,
): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: extra,
});

const MARKET = { type: "string", enum: ["spread", "total", "moneyline"] };
const SIDE = { type: "string", enum: ["home", "away", "over", "under"] };

export const GAME_FILTER: Schema = obj({
  seasons: arr({ type: "number" }, "restrict to these seasons"),
  weeks: arr({ type: "number" }, "restrict to these weeks (1–18)"),
  homeDog: bool("home team is the underdog (closing spread < 0)"),
  homeFavorite: bool("home team is favored (closing spread > 0)"),
  spreadAbs: range("absolute closing spread"),
  total: range("closing total"),
  divGame: bool("divisional game"),
  roof: arr({ type: "string" }, "roof types, e.g. dome, outdoors, closed, open"),
  surface: arr({ type: "string" }, "surface, e.g. grass, fieldturf"),
  weekday: arr({ type: "string" }, "e.g. Thursday, Sunday, Monday"),
  restEdge: range("home rest days minus away rest days"),
  teams: arr({ type: "string" }, "nflverse abbreviations; matches home or away"),
  played: bool("true = only games with a result; false = only unplayed"),
  splits: arr(
    obj(
      {
        market: MARKET,
        side: SIDE,
        tickets: range("percent of tickets on this side"),
        money: range("percent of money on this side"),
        book: str(
          "read one source instead of the consensus: draftkings | wiseguyteam | actionnetwork",
        ),
      },
      ["market", "side"],
    ),
    "public-betting conditions; only games with stored splits can match. Consensus (Action Network) has history from 2023; draftkings and wiseguyteam cover the current slate only",
  ),
});

const BET: Schema = obj(
  {
    gameId: str("nflverse game id, e.g. 2025_14_DAL_DET"),
    market: MARKET,
    side: SIDE,
    line: { type: ["number", "null"], description: "the number taken; default: the close" },
    odds: {
      type: ["number", "null"],
      description: "American odds taken; default: the close, else -110",
    },
    stake: num("units risked; default 1"),
    note: str("the rule that produced this bet"),
  },
  ["gameId", "market", "side"],
);

const STAKING: Schema = {
  oneOf: [
    obj({ type: { type: "string", enum: ["flat"] }, unit: num("dollars per bet") }, [
      "type",
      "unit",
    ]),
    obj(
      {
        type: { type: "string", enum: ["percent"] },
        pct: num("percent of current bankroll per bet"),
        cap: num("hard cap, percent of bankroll"),
      },
      ["type", "pct"],
    ),
    obj(
      {
        type: { type: "string", enum: ["kelly"] },
        fraction: num("fraction of full Kelly, 0–1"),
        cap: num("hard cap, percent of bankroll"),
        winProb: num(
          "win probability to feed Kelly; omit to use the graded sample's hit rate (flagged)",
        ),
      },
      ["type", "fraction"],
    ),
  ],
};

const STRATEGY_SPEC: Schema = obj(
  {
    words: str("the strategy in the person's words, verbatim"),
    seasons: obj(
      { discovered: arr({ type: "number" }, ""), holdout: arr({ type: "number" }, "") },
      ["discovered", "holdout"],
    ),
    filter: GAME_FILTER,
    bet: obj({ market: MARKET, side: SIDE, stake: num("units") }, ["market", "side"]),
    staking: STAKING,
    bankroll: num("starting bankroll in dollars"),
  },
  ["words", "seasons", "filter", "bet", "staking", "bankroll"],
);

const GRADED = obj({}, [], true);

export const TOOL_SCHEMAS: Record<string, Schema> = {
  findSleeperUser: obj({ query: str("Sleeper username") }, ["query"]),
  getReceipt: obj(
    {
      leagueId: str("Sleeper league id, or an lg_ id on a league box"),
      week: num("week"),
      rosterId: num("roster id within the league"),
    },
    ["leagueId", "week", "rosterId"],
  ),
  getWeekBoard: obj(
    {
      leagueId: str("Sleeper league id"),
      week: { type: ["number", "null"], description: "default: current week" },
    },
    ["leagueId"],
  ),
  getSourceLedger: obj({ leagueId: str("Sleeper league id"), rosterId: num("roster id") }, [
    "leagueId",
    "rosterId",
  ]),
  getGameLines: obj(
    { season: num("e.g. 2025"), week: num("optional week"), postseason: bool("include playoffs") },
    ["season"],
  ),
  getGameContext: obj({ gameId: str("nflverse game id") }, ["gameId"]),
  getBettingSplits: obj({ season: num("2023 or later"), week: num("week") }, ["season", "week"]),
  sampleGames: obj(
    {
      seasons: arr({ type: "number" }, "seasons to search, e.g. [2023, 2024, 2025]"),
      filter: GAME_FILTER,
    },
    ["seasons"],
  ),
  evaluateBets: obj({ bets: arr(BET, "the bets to grade") }, ["bets"]),
  summarizeRun: obj({ bets: arr(GRADED, "graded bets, as returned by evaluateBets") }, ["bets"]),
  simulateBankroll: obj(
    {
      graded: arr(GRADED, "graded bets, as returned by evaluateBets"),
      bankroll: num("starting bankroll in dollars"),
      policy: STAKING,
      bootstrap: num("resamples; default 1000, 0 disables"),
      seed: num("PRNG seed; default 1"),
    },
    ["graded", "bankroll", "policy"],
  ),
  freezeStrategy: obj({ name: str("short name"), spec: STRATEGY_SPEC }, ["name", "spec"]),
  listStrategies: obj({}),
  getStrategy: obj({ id: str("strategy id") }, ["id"]),
  deleteStrategy: obj({ id: str("strategy id"), confirm: { type: "boolean", enum: [true] } }, [
    "id",
    "confirm",
  ]),
  recordLabRun: obj(
    {
      strategyId: str(""),
      kind: { type: "string", enum: ["discover", "weekly", "season"] },
      season: { type: ["number", "null"] },
      week: { type: ["number", "null"] },
      summary: obj({}, [], true),
      bankroll: { type: ["object", "null"], additionalProperties: true },
      bets: arr(BET, ""),
      digest: { type: ["string", "null"] },
    },
    ["strategyId", "kind", "summary", "bets"],
  ),
  getLabRuns: obj({ strategyId: str("") }, ["strategyId"]),
};

/** Anything not typed above: the permissive object the server always accepted. */
export const PERMISSIVE: Schema = { type: "object", properties: {}, additionalProperties: true };

export function schemaFor(id: string): Schema {
  return TOOL_SCHEMAS[id] ?? PERMISSIVE;
}

/**
 * Clients that lack a schema stringify arrays and objects. Undo that at the
 * door: a string argument that parses as JSON array/object becomes the value.
 * Strings that are meant to be strings are left alone.
 */
export function coerceArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") {
      const t = v.trim();
      if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
        try {
          out[k] = JSON.parse(t);
          continue;
        } catch {
          /* a string that only looks like JSON stays a string */
        }
      }
    }
    out[k] = v;
  }
  return out;
}
