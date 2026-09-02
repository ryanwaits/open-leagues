import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("the landing is a quickstart: what it is, how to add it, what to ask", () => {
  const landing = read("src/components/landing.tsx");
  assert.match(landing, /NFL and fantasy football data for your agent\./);
  assert.match(landing, /claude mcp add --transport http open-leagues/);
  assert.match(landing, /codex mcp add open-leagues/);
  // the door comes before the examples; examples before the files; no widgets, no essays
  assert.ok(landing.indexOf("add it to your agent") < landing.indexOf("then ask"));
  assert.ok(landing.indexOf("then ask") < landing.indexOf("without an agent"));
  assert.doesNotMatch(landing, /ReceiptFinder|FAMILIES|RECEIPT_LINES|LAB_SAMPLE/);
  assert.doesNotMatch(landing, /MCP_WIRED|MCP_CATALOG/);
  const prose = landing.match(/<p[^>]*>([\s\S]*?)<\/p>/g) ?? [];
  assert.ok(prose.length <= 3, `landing has ${prose.length} paragraphs; keep it under four`);
  assert.ok(landing.split("\n").length < 240, "landing grew past a screen of code");
});

test("retired taglines are gone from every reader-facing surface", () => {
  for (const p of [
    "src/components/landing.tsx",
    "README.md",
    "PRODUCT.md",
    "src/lib/docs/pages.tsx",
    "src/lib/docs/guide.tsx",
  ]) {
    const s = read(p);
    assert.doesNotMatch(s, /Receipts for your fantasy week/, p);
    assert.doesNotMatch(s, /The minute your matchup flipped\./, p);
    assert.doesNotMatch(s, /Two files every hobby tool/, p);
    assert.doesNotMatch(s, /7,548/, p);
  }
  // no em dashes in the rewritten prose surfaces
  for (const p of ["src/components/landing.tsx", "README.md", "PRODUCT.md"]) {
    assert.doesNotMatch(read(p), /—/, `${p} has an em dash`);
  }
});

test("README opens with the substrate and the install line, not a receipt", () => {
  const readme = read("README.md");
  const firstCode = readme.indexOf("```sh");
  assert.ok(firstCode > 0);
  assert.match(
    readme.slice(firstCode, firstCode + 200),
    /claude mcp add --transport http open-leagues https:\/\/leagues\.waits\.dev\/api\/mcp/,
  );
  assert.match(readme, /## Then ask/);
  assert.ok(readme.indexOf("## Then ask") < readme.indexOf("## Run your own"));
  assert.ok(readme.split("\n").length < 90, "README grew past a screen");
});

test("the guide leads with agents and knows bettors", () => {
  const store = read("src/lib/docs/guide-store.ts");
  assert.match(store, /"bettor"/);
  const keys = [...store.matchAll(/key: "([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ["all", "agent", "manager", "bettor", "builder", "commissioner"]);
  const guide = read("src/lib/docs/guide.tsx");
  assert.ok(guide.indexOf('id: "connect"') < guide.indexOf('id: "lab"'));
  assert.ok(guide.indexOf('id: "lab"') < guide.indexOf('id: "flip"'));
  const nav = read("src/lib/docs/nav.ts");
  assert.ok(nav.indexOf('slug: "open-data"') < nav.indexOf('slug: "receipts"'));
  assert.match(nav, /kicker: "A worked example"/);
});
