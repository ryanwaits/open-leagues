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
