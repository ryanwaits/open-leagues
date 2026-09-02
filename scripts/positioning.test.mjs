import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("the product is headless tools for agents; receipts are a worked example", () => {
  const landing = read("src/components/landing.tsx");
  assert.match(landing, /Fantasy and NFL facts\. Your agent decides\./);
  assert.match(landing, /claude mcp add --transport http open-leagues/);
  assert.match(landing, /a worked example: the receipt/);
  assert.match(landing, /a worked example: the lab/);
  // the door comes before the receipt example, and the finder sits under the example
  assert.ok(landing.indexOf("add it to your agent") < landing.indexOf("a worked example: the receipt"));
  assert.ok(landing.indexOf("a worked example: the receipt") < landing.indexOf("<ReceiptFinder />"));
  // no hardcoded verb counts on the landing
  assert.doesNotMatch(landing, /MCP_WIRED|MCP_CATALOG/);
});

test("retired taglines are gone from every reader-facing surface", () => {
  for (const p of ["src/components/landing.tsx", "README.md", "PRODUCT.md", "src/lib/docs/pages.tsx", "src/lib/docs/guide.tsx", "docs/codex-demo.md"]) {
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
  assert.match(readme.slice(firstCode, firstCode + 200), /claude mcp add --transport http open-leagues https:\/\/leagues\.waits\.dev\/api\/mcp/);
  assert.match(readme, /## What an agent can ask/);
  assert.ok(readme.indexOf("## What an agent can ask") < readme.indexOf("## A worked example: the receipt"));
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
