/**
 * MCP stdio allowlist (042). Subset of AGENT_TOOLS — not the full catalog.
 * Add an id here + a dispatch branch to expose a new verb over MCP.
 */
export const AGENT_CORE: ReadonlySet<string> = new Set([
  // reads
  "getAgentContext",
  "listMyLeagues",
  "getTeam",
  "getBook",
  "getMatchups",
  "getWire",
  "getDraft",
  "getSettings",
  "getEvents",
  "getLeagueFacts",
  // atoms
  "sitPlayer",
  "startPlayer",
  "dropPlayer",
  "placeWager",
  "pullWager",
  "makePick",
  "queueAdd",
  "voteTrade",
  // migrate
  "previewImport",
  "importLeague",
  // reads (081)
  "getPulse",
  "getScores",
  "getGameSummary",
  "getWeekStats",
  "getLiveWire",
  "findSleeperUser",
  "getByeWeeks",
  "getLeaders",
  "getPlayerSearch",
  "getSources",
  "getProjections",
  "getOutlooks",
  "getPlayerProfile",
  "getLeagueBundle",
  "getTicks",
  "getActivity",
  "getRecap",
  "getWeekProjections",
  "previewInvite",
  "getDesk",
  "getMockPool",
  "getClaims",
  "getTrades",
  "getTradablePicks",
  "getSchedule",
  "exportLeague",
  // verb completion (082)
  "queueRemove",
  "queueReorder",
  "setAutodraft",
  "addDrop",
  "cancelClaim",
  "cancelTradeFn",
  "claimRoster",
  // receipts (095) — public facts about a week, seat-gated for hosted leagues
  "getReceipt",
  "getWeekBoard",
  "getSourceLedger",
  // zero to a league without a browser (094)
  "createLeague",
  "joinLeague",
  // the season spine (094) — commissioner operations, all confirm-gated
  "advanceWeek",
  "processWaivers",
  "saveSettings",
  "saveWeekSchedule",
  "rebuildSchedule",
  // the other half of voteTrade
  "proposeTrade",
  // migrate completion (083)
  "previewEspn",
  "importEspn",
  "previewRebuild",
  "importRebuild",
]);
