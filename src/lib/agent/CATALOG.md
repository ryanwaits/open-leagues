# Agent primitive catalog

Named tools a spectator, manager, or commish agent may call. Source of truth:
`catalog.ts`. Ids match `createServerFn` exports in `src/lib/league/fns.ts` and
`src/lib/data/fns.ts`. Tick / `tickAllLeagues` are not tools.

Harness context: [context-prompt.md](./context-prompt.md).

If it's not in this table, it is not a tool. Stop. Do not invent a table.

| id | scope | kind | one-liner |
|----|-------|------|-----------|
| listMyLeagues | spectator | read | List leagues the signed-in user belongs to. |
| createLeague | commish | workflow | Create a hosted league and take the first seat. |
| deleteLeague | commish | atomic | Permanently delete a hosted league the signed-in user commissioners. |
| exportLeague | commish | read | Download a JSON backup of a hosted league the signed-in user commissioners. |
| joinLeague | manager | atomic | Join a league by invite code and claim a seat, plus allowlist if the commish seeded one. |
| previewInvite | spectator | read | Preview a league from an invite code. |
| getDesk | spectator | read | Load the league desk for a week. |
| getEvents | spectator | read | Read the league event diary. |
| getLeagueFacts | spectator | read | Load standing facts rolled up through a week. |
| getAgentContext | spectator | read | Seat, spendable FAAB, facts, recent events, and the tools in your scope. |
| getDraft | spectator | read | Load the live draft board, queue, and clock. |
| getMockPool | spectator | read | Load the scored mock-draft player pool. |
| startDraft | commish | atomic | Open the draft room and start the clock. |
| makePick | manager | atomic | Draft the player on the clock for your seat. |
| queueAdd | manager | atomic | Add a player to your draft queue. |
| queueRemove | manager | atomic | Remove a player from your draft queue. |
| queueReorder | manager | atomic | Replace your draft queue order. |
| setAutodraft | manager | atomic | Toggle autodraft for your seat. |
| autoFillDraft | commish | workflow | Autopick remaining draft seats to completion. |
| startPlayer | manager | atomic | Move a player into a starting slot. |
| sitPlayer | manager | atomic | Bench a starter. |
| addDrop | manager | workflow | Add a player, optionally dropping another, as a free agent or FAAB claim. |
| dropPlayer | manager | atomic | Drop a player from your roster. |
| previewImport | manager | read | Preview a Sleeper league import. |
| importLeague | commish | workflow | Import a Sleeper league into the ledger. |
| previewEspn | commish | read | Preview an ESPN league import. Never log swid/espnS2; not for traces. |
| importEspn | commish | workflow | Import an ESPN league into the ledger. Never log swid/espnS2; not for traces. |
| previewRebuild | commish | read | Preview a paste/PDF rebuild of a historical league. |
| importRebuild | commish | workflow | Commit a paste/PDF rebuild into the ledger. |
| getSettings | spectator | read | Load league settings and whether you are commish. |
| saveSettings | commish | workflow | Save scoring, slots, FAAB, playoffs, and betting knobs. |
| claimRoster | manager | atomic | Claim an open roster seat as your own (invite code required unless you are commish). |
| listAllowlist | commish | read | List emails allowed to join this league. |
| addAllowlistEmail | commish | atomic | Add an email to the league invite allowlist. |
| removeAllowlistEmail | commish | atomic | Remove an email from the league invite allowlist. |
| getClaims | spectator | read | List waiver claims visible to you. |
| cancelClaim | manager | atomic | Withdraw one of your pending waiver claims. |
| processWaivers | commish | workflow | Run the waiver wire and award winning claims. |
| advanceWeek | commish | workflow | Lock the week, settle, and roll the league forward. |
| getTrades | spectator | read | List trades in the league. |
| getTradablePicks | spectator | read | List picks that can still be traded. |
| proposeTrade | manager | workflow | Propose a multi-asset trade between rosters. |
| voteTrade | manager | atomic | Accept or reject a trade you are party to. |
| cancelTradeFn | manager | atomic | Cancel a trade you proposed. |
| getSchedule | spectator | read | Load the matchup schedule. |
| saveWeekSchedule | commish | workflow | Set home/away pairs for one week. |
| rebuildSchedule | commish | workflow | Rebuild the remaining regular-season schedule. |
| getBook | spectator | read | Load the matchup book, lines, and your tickets. |
| placeWager | manager | atomic | Stake FAAB on a spread or moneyline. CLI requires --write and --user. |
| pullWager | manager | atomic | Withdraw a wager before the book closes. |
| getPulse | spectator | read | NFL state, scoreboard, news, and trending. |
| getScores | spectator | read | Scoreboard for a week. |
| getGameSummary | spectator | read | Box score and plays for one NFL game. |
| getWeekStats | spectator | read | Raw weekly stats for a season/week. |
| getLiveWire | spectator | read | Live scoring leaders for the current week. |
| findSleeperUser | spectator | read | Lookup a Sleeper user by query. |
| getLeagueBundle | spectator | read | League header, rosters, and users. |
| getReceipt | spectator | read | One roster's week as facts: score, bench left, wire cost. Team names only. |
| getWeekBoard | spectator | read | Every matchup in a week, each side linked to its receipt. |
| getGameLines | spectator | read | Closing lines, prices, results, and context for every NFL game of a season or week, 1999 to now. |
| getGameContext | spectator | read | One NFL game by nflverse id: lines, result, rest, roof, surface, division, QBs, referee. |
| sampleGames | spectator | read | Games across seasons matching a cohort filter: home dog, spread band, total band, rest edge, roof, weekday. |
| evaluateBets | spectator | read | Grade hypothetical bets against results: win/loss/push, units at the odds taken, closing-line value. |
| summarizeRun | spectator | read | Record, ROI, break-even, drawdown, streaks, per-season splits for a graded run. |
| getSourceLedger | spectator | read | Over a season, which open source would have set a better lineup than the roster did. |
| getMatchups | spectator | read | Matchup cards for a week. |
| getTicks | spectator | read | Per-minute projected finals / win % / spread samples for one matchup on a game day. |
| getTeam | spectator | read | One roster's lineup and bench for a week. |
| getWire | spectator | read | Free-agent and available player wire. |
| getActivity | spectator | read | Transaction activity for a week. |
| getByeWeeks | spectator | read | NFL bye weeks for a season. |
| getProjections | spectator | read | Project a given player list for a week. |
| getWeekProjections | spectator | read | Starter and rostered projections for a week. |
| getOutlooks | spectator | read | Rest-of-season outlooks for player ids. |
| getPlayerProfile | spectator | read | Player page payload: news, stats, outlook. |
| getLeaders | spectator | read | Season leaders at a position. |
| getPlayerSearch | spectator | read | Search players by name and position. |
| getRecap | spectator | read | Week recap / dispatch copy. |
| getSources | spectator | read | Probe upstream data sources. |
| getAiSettings | spectator | read | Load your saved AI provider/model config, masked — never returns the key. |
| saveAiSettings | spectator | workflow | Save your AI provider, model, and API key (BYOK), encrypted at rest. |
| deleteAiSettings | spectator | atomic | Remove your saved AI key and provider config. |
| testAiSettings | spectator | read | Test your saved AI key with a tiny round-trip call. |
| analyzeImport | commish | read | Extract league settings from pasted text via the commissioner's AI key. |
