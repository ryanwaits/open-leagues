import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/routes/api/mcp.ts"), "utf8");
const identity = readFileSync(join(root, "src/lib/auth/mcp-identity.server.ts"), "utf8");

test("mcp HTTP route resolves identity through the seam, and 401s without one", () => {
  assert.match(src, /resolveMcpUser/, "must resolve identity through resolveMcpUser");
  assert.match(src, /status:\s*401/, "401 path missing");
  // The route must not read a credential itself — the seam owns that.
  assert.doesNotMatch(src, /lookupToken/);
});

test("the identity seam still checks a real token in the default mode", () => {
  assert.match(identity, /lookupToken/, "token mode must verify against ol_agent_tokens");
  assert.match(identity, /startsWith\("ol_"\)/);
});

test("the identity seam fails closed", () => {
  // An unset mode is token, and an unknown mode refuses rather than guessing.
  assert.match(identity, /raw === "" \|\| raw === "token"/);
  assert.match(identity, /Refusing to serve MCP/);
  // A proxy header is only honoured in proxy mode, never as a fallback.
  assert.doesNotMatch(identity, /\|\|\s*request\.headers\.get\(proxyUserHeader\(\)\)/);
});

test("mcp HTTP route does not use OPENLEAGUES_USER", () => {
  assert.doesNotMatch(src, /\bOPENLEAGUES_USER\b/);
});

test("mcp HTTP route does not import tickAllLeagues", () => {
  assert.doesNotMatch(src, /tickAllLeagues/);
});

test("mcp HTTP route dispatches via agent/dispatch", () => {
  assert.match(src, /from ["']@\/lib\/agent\/dispatch["']/);
  assert.match(src, /\bdispatch\b/);
});
