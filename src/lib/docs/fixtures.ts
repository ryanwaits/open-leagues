import type { MatchupPair, StarterLine } from "@/lib/data/types";

/**
 * Docs fixtures. Real-shaped payloads cut to the fields the engine actually
 * returns, so the raw/rendered toggle shows one object two ways. Nothing here
 * calls the engine; a docs paint must not cost a query.
 */

function line(
  slot: string,
  playerId: string,
  fullName: string,
  position: string,
  team: string,
  detail: string,
  opp: string,
): StarterLine {
  return {
    slot,
    playerId,
    player: { player_id: playerId, full_name: fullName, position, team },
    // A filled slot in an unplayed week scores 0. `null` means an empty slot.
    points: 0,
    game: { state: "pre", detail, opp, gameId: null },
  };
}

/** `getMatchups`: one pair, week 1, nothing played. No projections: the raw
 *  response carries none; `expected` / `forecast` are a UI enrichment pass. */
export const MATCHUPS_FIXTURE: MatchupPair[] = [
  {
    matchupId: 3,
    kind: "regular",
    playoffRound: null,
    label: null,
    home: {
      rosterId: 4,
      teamName: "hands",
      manager: "ryan",
      avatar: null,
      points: 0,
      starters: [
        line("QB", "4046", "Patrick Mahomes", "QB", "KC", "Thu 8:20p", "BAL"),
        line("RB1", "8155", "Bijan Robinson", "RB", "ATL", "Sun 1:00p", "TB"),
        line("RB2", "9509", "De'Von Achane", "RB", "MIA", "Sun 1:00p", "NE"),
        line("WR1", "6794", "Ja'Marr Chase", "WR", "CIN", "Sun 4:25p", "CLE"),
        line("WR2", "8112", "Drake London", "WR", "ATL", "Sun 1:00p", "TB"),
        line("TE", "4033", "Trey McBride", "TE", "ARI", "Sun 4:05p", "SEA"),
        line("FLEX", "5849", "Jaylen Waddle", "WR", "MIA", "Sun 1:00p", "NE"),
        line("K", "3678", "Jake Bates", "K", "DET", "Sun 1:00p", "GB"),
        line("DEF", "PHI", "Philadelphia", "DEF", "PHI", "Sun 1:00p", "DAL"),
      ],
    },
    away: {
      rosterId: 9,
      teamName: "Butterbean",
      manager: "dmw",
      avatar: null,
      points: 0,
      starters: [
        line("QB", "4881", "Josh Allen", "QB", "BUF", "Sun 1:00p", "NYJ"),
        line("RB1", "7564", "Jahmyr Gibbs", "RB", "DET", "Sun 1:00p", "GB"),
        line("RB2", "4034", "Christian McCaffrey", "RB", "SF", "Sun 4:25p", "LAR"),
        line("WR1", "9493", "Malik Nabers", "WR", "NYG", "Sun 1:00p", "WAS"),
        line("WR2", "6801", "Brandon Aiyuk", "WR", "SF", "Sun 4:25p", "LAR"),
        line("TE", "5844", "Sam LaPorta", "TE", "DET", "Sun 1:00p", "GB"),
        line("FLEX", "8138", "Chris Olave", "WR", "NO", "Sun 1:00p", "CAR"),
        line("K", "3451", "Brandon Aubrey", "K", "DAL", "Sun 1:00p", "PHI"),
        line("DEF", "BAL", "Baltimore", "DEF", "BAL", "Thu 8:20p", "KC"),
      ],
    },
  },
];

/** A real Codex session against a league box (2026-08-26); the first two guesses failed. */
export type TranscriptCall = { id: string; name: string; ok: boolean };

export const CODEX_TRANSCRIPT: TranscriptCall[] = [
  { id: "1-getDesk", name: "getDesk", ok: false },
  { id: "2-getSchedule", name: "getSchedule", ok: false },
  { id: "3-listMyLeagues", name: "listMyLeagues", ok: true },
  { id: "4-getAgentContext", name: "getAgentContext", ok: true },
  { id: "5-getLeagueBundle", name: "getLeagueBundle", ok: true },
  { id: "6-getMatchups", name: "getMatchups", ok: true },
  { id: "7-getSchedule", name: "getSchedule", ok: true },
];

export const CODEX_PROMPT = "get my league context — team name, record, this week's opponent";
export const CODEX_ANSWER = { team: "hands", record: "0-0-0", opponent: "Butterbean" };

export type Snippet = { key: string; tab: string; label: string; body: string };

export function connectSnippets(_origin: string): Snippet[] {
  return [
    {
      key: "public",
      tab: "Public box",
      label: "leagues.waits.dev · no account, no token · public read verbs",
      body: `claude mcp add --transport http open-leagues https://leagues.waits.dev/api/mcp
codex  mcp add open-leagues --url https://leagues.waits.dev/api/mcp

# receipts, week boards, the season ledger, lines, cohorts, grading, staking
# rate-limited per IP · nothing here needs a person`,
    },
    {
      key: "codex",
      tab: "Codex",
      label: "codex · your league box over HTTP",
      body: `export OPENLEAGUES_TOKEN=ol_…    # minted at https://YOUR_BOX/account
codex mcp add open-leagues \\
  --url https://YOUR_BOX/api/mcp \\
  --bearer-token-env-var OPENLEAGUES_TOKEN
codex mcp list`,
    },
    {
      key: "claude-code",
      tab: "Claude Code",
      label: "claude · your league box over HTTP",
      body: `export OPENLEAGUES_TOKEN=ol_…    # minted at https://YOUR_BOX/account
claude mcp add --transport http open-leagues \\
  https://YOUR_BOX/api/mcp \\
  --header "Authorization: Bearer $OPENLEAGUES_TOKEN"`,
    },
    {
      key: "stdio",
      tab: "stdio",
      label: "stdio · your own box, no public endpoint",
      body: `export DATABASE_URL=postgres://…
export OPENLEAGUES_USER=<your Better Auth user id>
codex mcp add open-leagues -- bun scripts/mcp.mjs`,
    },
    {
      key: "connector",
      tab: "Connector",
      label: "connector · Claude Cowork, ChatGPT, Grok",
      body: `# Settings → Connectors → Add custom connector
# the public box: no auth
url:   https://leagues.waits.dev/api/mcp

# your league box: bearer
url:   https://YOUR_BOX/api/mcp
auth:  Bearer  ol_…

# tools appear under: open-leagues`,
    },
  ];
}

export const INSTALL_SNIPPETS: Snippet[] = [
  {
    key: "docker",
    tab: "Docker",
    label: "docker · durable box, in-process clock",
    body: `git clone https://github.com/ryanwaits/open-leagues.git
cd open-leagues
docker compose up -d

# http://localhost:8080`,
  },
  {
    key: "local",
    tab: "Local",
    label: "local · bun dev server, PGLite fallback",
    body: `bun install
cp .env.example .env      # optional
bun run dev

# 0.0.0.0:8080 · no Postgres, no migrate step`,
  },
  {
    key: "vercel",
    tab: "Vercel",
    label: "vercel · managed Postgres, cron clock",
    body: `# project env
DATABASE_URL=postgres://…
BETTER_AUTH_URL=https://your-host
BETTER_AUTH_SECRET=…
CRON_SECRET=…

# leave OPENLEAGUES_SELF_TICK unset; vercel.json cron is the clock`,
  },
];

/** scripts/ledger.mjs dispatches three reads and one gated write. Nothing else. */
export const CLI_SNIPPETS: Snippet[] = [
  {
    key: "read",
    tab: "Reads",
    label: "reads · JSON to stdout",
    body: `bun scripts/ledger.mjs getEvents       --league lg_wiffl --limit 20
bun scripts/ledger.mjs getLeagueFacts  --league lg_wiffl --week 1
bun scripts/ledger.mjs getAgentContext --league lg_wiffl --user usr_…

# same fields as one argument
bun scripts/ledger.mjs getEvents --json '{"leagueId":"lg_wiffl","limit":20}'`,
  },
  {
    key: "write",
    tab: "The one write",
    label: "placeWager · needs --write",
    body: `bun scripts/ledger.mjs placeWager --write \\
  --user usr_… --league lg_wiffl \\
  --matchup 3 --kind spread \\
  --side 4 --line -3.5 --stake 12

# --side is a rosterId, not a team name
# --kind is spread | moneyline; no total
# --stake is floored to whole dollars, minimum 1`,
  },
  {
    key: "mint",
    tab: "Mint a token",
    label: "mintToken · issues this box's bearer",
    body: `bun scripts/ledger.mjs mintToken --write --user usr_… --name codex

{
  "id": "at_…",
  "token": "ol_…",          # printed once; only the hash is stored
  "prefix": "ol_a1b2c3d4",
  "note": "Copy the token now — only its hash is stored."
}

# no browser; writes to the same DATABASE_URL the app uses`,
  },
  {
    key: "refused",
    tab: "Refusals",
    label: "refusals",
    body: `$ bun scripts/ledger.mjs placeWager --league lg_wiffl
placeWager is mutating and is not dispatched without --write.
See src/lib/agent/CATALOG.md.

$ bun scripts/ledger.mjs getMatchups --league lg_wiffl --week 1
getMatchups is a catalogued read but this CLI slice only dispatches
getEvents, getLeagueFacts, and getAgentContext.

$ bun scripts/ledger.mjs tick --league lg_wiffl
tick is a cron clock, not a tool

$ bun scripts/ledger.mjs mintToken --user usr_…
mintToken issues a live credential and is not dispatched without --write.`,
  },
];

export type PlaybookStep = { verb: string; write?: boolean; pause?: boolean };
export type Playbook = { say: string; chain: PlaybookStep[]; skill: string };

/** Chains transcribed from the SKILL.md files under skills/. */
export const PLAYBOOKS: Playbook[] = [
  {
    say: "set my lineup for the bye weeks",
    chain: [
      { verb: "getAgentContext" },
      { verb: "getTeam" },
      { verb: "getWeekProjections" },
      { verb: "confirm", pause: true },
      { verb: "sitPlayer", write: true },
      { verb: "startPlayer", write: true },
    ],
    skill: "open-leagues-lineup · never invents a projection · pauses for confirm before writes",
  },
  {
    say: "bring over my Sleeper league",
    chain: [
      { verb: "previewImport" },
      { verb: "confirm", pause: true },
      { verb: "importLeague · confirm:true", write: true },
    ],
    skill: "open-leagues-migrate · same pair for ESPN and rebuild · file/paste is option 2",
  },
  {
    say: "what's going on this week",
    chain: [
      { verb: "getAgentContext" },
      { verb: "getMatchups" },
      { verb: "getTeam" },
      { verb: "getWire" },
    ],
    skill: "open-leagues-week · read-only digest · no writes",
  },
  {
    say: "put $12 on us and pull my other ticket",
    chain: [
      { verb: "getAgentContext" },
      { verb: "getBook" },
      { verb: "confirm stake", pause: true },
      { verb: "placeWager", write: true },
      { verb: "pullWager", write: true },
    ],
    skill: "open-leagues-book · whole dollars · cannot fade your own roster",
  },
  {
    say: "is there anything to home dogs the public is on?",
    chain: [
      { verb: "getBettingSplits" },
      { verb: "sampleGames · discovery seasons" },
      { verb: "evaluateBets" },
      { verb: "summarizeRun" },
      { verb: "sampleGames · holdout" },
      { verb: "summarizeRun · pBreakEven" },
      { verb: "simulateBankroll" },
      { verb: "freezeStrategy", write: true },
    ],
    skill:
      "open-leagues-lab-discover · tunes on some seasons, verifies on others · freezes only what clears the holdout · places no bet",
  },
  {
    say: "run my lab for last week",
    chain: [
      { verb: "getStrategy" },
      { verb: "getLabRuns" },
      { verb: "sampleGames · last week" },
      { verb: "evaluateBets" },
      { verb: "summarizeRun" },
      { verb: "simulateBankroll · season" },
      { verb: "recordLabRun", write: true },
    ],
    skill: "open-leagues-lab-run · frozen rule, paper stakes, digest · no placeWager",
  },
];

export const IDENTITY_SNIPPETS: Snippet[] = [
  {
    key: "token",
    tab: "token (default)",
    label: "OPENLEAGUES_MCP_AUTH=token · this box issues the credential",
    body: `# nothing to set; token is the default
# on your league box: mint from /account, or headless:
bun scripts/ledger.mjs mintToken --write --user usr_…

# the client sends it
Authorization: Bearer ol_…`,
  },
  {
    key: "proxy",
    tab: "proxy",
    label: "OPENLEAGUES_MCP_AUTH=proxy · your edge authenticates the caller",
    body: `OPENLEAGUES_MCP_AUTH=proxy
OPENLEAGUES_MCP_USER_HEADER=x-openleagues-user   # optional, this is the default
OPENLEAGUES_MCP_PROXY_SECRET=…                   # your proxy proves it is the proxy

# what your edge sends after it authenticates the caller
x-openleagues-user: usr_…
x-openleagues-proxy-secret: …`,
  },
];

/** Illustrative purse, matching the AgentContext.purse shape. */
export const PURSE_FIXTURE = { budget: 100, remaining: 86, atRisk: 12, spendable: 74 };
export const KNOBS_FIXTURE = { wagerCap: 25, exposureCap: 40, bookLocked: false };
