# Manager lab — test it Monday

Waiver cousin of [the betting lab](lab.md). It grades the tape of a Sleeper
league’s adds, drops, and FAAB, then prints a Monday card: bid band or
no-move, with a receipt you can pull. It never files a claim.

Seeded against **SDIFFL**:

| | |
|---|---|
| 2026 league | `1312215005088739328` |
| 2025 league (one hop) | `1255972181892935680` |
| ryanwaits | roster **1**, FAAB budget **200** |

## 0. Fast checks (no league, no MCP)

```sh
bun test src/lib/manager
```

FAAB remaining never goes negative; last-3 / season avg only use prior weeks;
holdout is last 4 weeks (or the later season if it has ≥4 weeks); freeze
refuses a holdout that does not beat always-no-move; 1QB with Mahomes Q +
Dart is `no-move`; a hole at WR still adds.

`bun scripts/ledger.mjs` does **not** dispatch these verbs. Use MCP.

## 1. Point an agent at the public box

No account. No token. `getMoveLedger`, `getWireCard`, `getAdviceReceipt`,
`gradeManagerSpec` are on the public allowlist. `classifyMoves` and
`freezeManagerSpec` are not — those need a league box and a person.

```sh
claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp
codex  mcp add open-leagues --url https://leagues.waits.dev/api/mcp
```

Install the skill (or copy `skills/open-leagues-wire/` into your skills dir):

```sh
npx skills add ryanwaits/open-leagues --skill open-leagues-wire -g
```

Start a new session so the tool list refreshes. Confirm `getWireCard` is
listed.

Grok: `grok mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp`
and copy `skills/open-leagues-wire/` into `~/.grok/skills/` (or `npx skills add`
if that path is how you install). Public host needs **no token**. Do not start
with `getAgentContext` — that verb is league-box only and will  fail on
leagues.waits.dev. Monday asks go to `getWireCard`.

## 2. Monday card (the thing you feel)

Say, exactly:

```
/open-leagues-wire
SDIFFL, my team. Any adds this week?
```

Or without the skill:

```
getWireCard on Sleeper league 1312215005088739328, roster 1.
If it says add, tell me the bid band and remaining FAAB.
If I ask why, pull the receipt.
Do not file a claim.
```

What fires:

1. `getWireCard` `{ "leagueId": "1312215005088739328", "rosterId": 1 }`
2. On “why”: `getAdviceReceipt` `{ "id": "<receiptId from the card>" }`

What you should see:

- `remaining` / `budget` (SDIFFL is 200; you’ve already spent some)
- `call.kind` is `no-move` when that position is already filled (1QB +
  Mahomes Q and Dart → no-move, not Bryce Young)
- on add: a hole at that pos, `playerId`, `bidLo`, `bidHi`, `comps`
- ranking is this week's Sleeper proj / last-3 / season avg, not season PPR
- `call.source` is `quantile` until a spec is frozen, `spec` after
- a `receiptId` (`adv_…`); the receipt's `seat` names who you already roster
  at that pos, and `comps` is the bid-band set

The card does **not** call `addDrop`. If it names a player, you still bid in
Sleeper yourself.

First `getWireCard` in a cold cache also builds the move ledger (every week’s
transactions × projections × actuals, 2025 and 2026). Expect a long first
call; later ones read `ol_move_seasons` (6h TTL on the current season).

## 3. The tape

```
Show me the move ledger for SDIFFL. How much FAAB has each roster spent?
Who overpays?
```

Verb: `getMoveLedger`

```json
{
  "leagueId": "1312215005088739328",
  "includeHistory": true
}
```

`includeHistory` defaults true and walks **one** `previous_league_id` (2025).
Pass `"includeHistory": false` or `"season": "2026"` to stay on this year.

Each row is one add/drop/claim: `type` (`waiver_won` / `waiver_lost` / `fa` /
`drop`), `bid`, `remainingBefore`, `sleeperProj`, `last3`, `seasonAvg`,
`actual`. Lost claims do not spend. Winning bids do.

Ask next:

- “Which of my 2026 wins had the worst actual vs Sleeper proj?”
- “What did roster 9 pay for waiver wins, as a share of remaining?”
- “List every failed claim I made and the winning bid on that player that week.”
  (failed rows are yours; the winning row is another roster, same player/week)

## 4. Grade / freeze (optional)

```
gradeManagerSpec on that SDIFFL id. Did a frozen spec beat always-no-move?
```

On the public box this reports the holdout split even with no spec stored
(`specId` null). Freezing writes to the box; the public host will refuse
`freezeManagerSpec` (not in the public list).

On a **league box** you own, with a token:

```
classifyMoves on 1312215005088739328
freezeManagerSpec name "sdiffl-faab" leagueId 1312215005088739328
```

`classifyMoves` is a no-op without `TYPESAFE_API_KEY` on that box (returns
`reason: "no TYPESAFE_API_KEY"`). Labels are motive / bid aggression /
must-move via Jev; they are not the Monday headline.

`freezeManagerSpec` stores a league-scoped bid policy **only** if the holdout
beats always-no-move (won adds’ actuals > 0). Until 2026 has four scored
weeks, holdout is the last four weeks of 2025.

After a freeze, `getWireCard` source flips from `quantile` to `spec`.

## 5. Curl, no agent

Public box, JSON-RPC. Accept header required.

```sh
LEAGUE=1312215005088739328
MCP=https://leagues.waits.dev/api/mcp

curl -s $MCP \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getWireCard","arguments":{"leagueId":"'"$LEAGUE"'","rosterId":1}}}'
```

Swap `getWireCard` for `getMoveLedger` with
`"arguments":{"leagueId":"'"$LEAGUE"'"}`. Then `getAdviceReceipt` with the
`receiptId` from the card.

`classifyMoves` / `freezeManagerSpec` on this host return the self-host
pointer, not a classification.

## Queries worth saying out loud

One sentence each. Agent should hit the named verb, not invent numbers.

| You say | Verb |
|---|---|
| Any adds this week? How much FAAB do I have? | `getWireCard` |
| Why that bid on that guy? | `getAdviceReceipt` |
| Show every claim in SDIFFL this year and last | `getMoveLedger` |
| Who in this league overpays on WR? | `getMoveLedger` then filter `waiver_won` |
| Did we freeze a spec, and did it beat sitting still? | `gradeManagerSpec` |
| Label the tape with Jev | `classifyMoves` (league box + key) |

If the agent files a claim, stop it. The skill forbids `addDrop`.

## Limits

- Open sources only: Sleeper weekly proj, last 3 weeks, season average.
- Sleeper proj for a past week is the last row Sleeper still serves, frozen
  once that NFL week is behind us — not a Tuesday-night snapshot.
- No cron, no push, no autopilot.
- Lineup sit/start is still `open-leagues-lineup`, not this card.
- Hosted `lg_` ids: ledger is empty until we read imported txs. Use the
  Sleeper id.

Verbs: `getMoveLedger`, `getWireCard`, `getAdviceReceipt`, `gradeManagerSpec`,
and on a league box `classifyMoves`, `freezeManagerSpec`.
