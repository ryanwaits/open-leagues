import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("receipt routes exist: a week board, a roster receipt, and its og image", () => {
  assert.ok(existsSync(join(root, "src/routes/r/$leagueId/index.tsx")));
  assert.ok(existsSync(join(root, "src/routes/r/$leagueId/$week.$rosterId.tsx")));
  assert.ok(existsSync(join(root, "src/routes/api/og/r/$leagueId.$week.$rosterId.ts")));
});

test("hosted leagues keep the seat rule on receipts; raw Sleeper ids do not need one", () => {
  const fns = read("src/lib/data/fns.ts");
  const receipt = fns.slice(fns.indexOf("export const getReceipt"));
  assert.match(receipt, /isHostedLeague\(data\.leagueId\)/);
  assert.match(receipt, /assertLeagueViewer/);
  const board = fns.slice(fns.indexOf("export const getWeekBoard"));
  assert.match(board, /assertLeagueViewer/);
});

test("the og image never renders a hosted league — unfurlers carry no session", () => {
  const og = read("src/routes/api/og/r/$leagueId.$week.$rosterId.ts");
  assert.match(og, /isHostedLeague\(p\.leagueId\)/);
  assert.match(og, /status: 404/);
  assert.doesNotMatch(og, /assertLeagueViewer/, "no seat check means no hosted render, ever");
});

test("public cards show team names, never a manager's display name", () => {
  const card = read("src/components/receipt-card.tsx");
  assert.doesNotMatch(card, /\.manager\b/);
  assert.doesNotMatch(card, /display_name/);
  const server = read("src/lib/receipts/receipt.server.ts");
  assert.match(server, /publicName\(/);
  assert.match(server, /Roster \$\{rosterId\}/);
});

test("the receipt page sets its own og:image, sized for unfurls", () => {
  const page = read("src/routes/r/$leagueId/$week.$rosterId.tsx");
  assert.match(page, /property: "og:image"/);
  assert.match(page, /\/api\/og\/r\//);
  assert.match(page, /"1200"/);
  assert.match(page, /"630"/);
});

test("the projection feed refreshes itself for any league, not only hosted ones", () => {
  const proj = read("src/lib/data/projections.server.ts");
  assert.match(proj, /refreshProjections\(input\.season, input\.week\)/);
});

test("metrics are five counters and nothing that identifies a person", () => {
  const m = read("src/lib/metrics.server.ts");
  assert.match(m, /"paste" \| "card" \| "unfurl" \| "import" \| "token"/);
  assert.doesNotMatch(m, /user_id|email|display_name|ip\b/);
});

test("the flip is reconstructed from play-by-play, never sampled live at launch", () => {
  const server = read("src/lib/receipts/receipt.server.ts");
  assert.match(server, /computeFlip\(/);
  assert.match(server, /ensureTimelines\(/);
  assert.match(server, /winProbability\(/);
  const pbp = read("src/lib/receipts/pbp.server.ts");
  assert.match(pbp, /nflverse-data\/releases\/download\/pbp/);
  assert.match(
    pbp,
    /REFRESH_AFTER_MS = 12 \* 60 \* 60 \* 1000/,
    "a season is re-read at most twice a day",
  );
  assert.match(pbp, /createGunzip\(\)/, "streamed, never held in memory");
});

test("the play-by-play parser has no I/O — it is testable on its own", () => {
  const parse = read("src/lib/receipts/pbp-parse.ts");
  assert.doesNotMatch(parse, /from "@\/lib\/db"/);
  assert.doesNotMatch(parse, /fetch\(/);
  assert.doesNotMatch(parse, /node:/);
});

test("flip times are stated in Eastern, the clock fantasy keeps", () => {
  const server = read("src/lib/receipts/receipt.server.ts");
  assert.match(server, /timeZone: "America\/New_York"/);
});

test("team loader reads the week's roster from the matchup, not today's /rosters", () => {
  const src = readFileSync(join(root, "src/lib/data/sleeper.server.ts"), "utf8");
  // A December starter who was dropped in March must still be on December's receipt.
  assert.match(src, /match\?\.players\?\.length \? match\.players/);
});

test("the season ledger is a verb on MCP and a section on the receipt", () => {
  assert.ok(existsSync(join(root, "src/lib/receipts/ledger.server.ts")));
  assert.match(read("src/lib/agent/catalog.ts"), /"getSourceLedger"/);
  assert.match(read("src/lib/agent/core.ts"), /"getSourceLedger"/);
  assert.match(read("src/lib/agent/dispatch.ts"), /case "getSourceLedger"/);
  assert.match(read("src/routes/r/$leagueId/$week.$rosterId.tsx"), /SourceLedgerCard/);
  // open sources only, and settled weeks are cached, never recomputed
  const ledger = read("src/lib/receipts/ledger.server.ts");
  assert.match(ledger, /ol_source_ledger/);
  assert.doesNotMatch(ledger, /fantasypros|espn_proj|paid/i);
});
