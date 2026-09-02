import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("the two open-data endpoints exist at their public paths", () => {
  assert.ok(existsSync(join(root, "src/routes/api/players[.]json.ts")));
  assert.ok(existsSync(join(root, "src/routes/api/wire/$season/$week[.]json.ts")));
  assert.match(
    read("src/routes/api/players[.]json.ts"),
    /createFileRoute\("\/api\/players\.json"\)/,
  );
  assert.match(
    read("src/routes/api/wire/$season/$week[.]json.ts"),
    /createFileRoute\("\/api\/wire\/\$season\/\$week\.json"\)/,
  );
});

test("open data is anonymous and CORS-open", () => {
  for (const p of [
    "src/routes/api/players[.]json.ts",
    "src/routes/api/wire/$season/$week[.]json.ts",
  ]) {
    const src = read(p);
    assert.match(src, /access-control-allow-origin/);
    assert.match(src, /cache-control/);
  }
  const mod = read("src/lib/receipts/open-data.server.ts");
  // The price row carries counts and quantiles — never the league that bid.
  assert.match(mod, /player_id,\s*name:/);
  assert.doesNotMatch(mod, /league_id[^\n]*prices\.push|prices[^\n]*league_id/);
  // Hosted leagues never register as pasted.
  assert.match(mod, /if \(leagueId\.startsWith\("lg_"\)\) return;/);
});

test("receipt shows a market median only once two leagues have cleared a claim, raw Sleeper only", () => {
  const src = read("src/lib/receipts/receipt.server.ts");
  assert.match(src, /p\.n >= 2/);
  assert.match(src, /!isHostedLeague\(leagueId\) && moves\.some/);
});

test("empty wire results are not cached", () => {
  const mod = read("src/lib/receipts/open-data.server.ts");
  assert.match(mod, /if \(fresh\.leagues === 0\) return fresh;/);
  assert.match(mod, /hit\.leagues > 0/);
});

test("docs and landing describe receipts and open data", () => {
  const nav = read("src/lib/docs/nav.ts");
  assert.match(nav, /"receipts"/);
  assert.match(nav, /"open-data"/);
  const pages = read("src/lib/docs/pages.tsx");
  assert.match(pages, /\/api\/players\.json/);
  assert.match(pages, /\/api\/wire\/:season\/:week\.json/);
  const landing = read("src/components/landing.tsx");
  assert.match(landing, /The minute your matchup flipped\./);
  assert.match(landing, /ReceiptFinder/);
  assert.doesNotMatch(landing, /A headless fantasy league\./);
  const readme = read("README.md");
  assert.match(readme, /\/api\/players\.json/);
  assert.match(readme, /--scope read/);
});
