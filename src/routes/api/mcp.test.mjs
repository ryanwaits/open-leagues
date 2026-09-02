import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { AGENT_CORE } from "@/lib/agent/core";
import { handleMcp } from "./mcp.ts";

const KEYS = [
  "OPENLEAGUES_MCP_AUTH",
  "OPENLEAGUES_MCP_USER_HEADER",
  "OPENLEAGUES_MCP_PROXY_SECRET",
];
afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

function rpc(body, headers = {}) {
  return new Request("https://box.test/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const LIST = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

test("an unauthenticated call is 401, with CORS still attached", async () => {
  const res = await handleMcp(rpc(LIST));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await res.json(), { error: "unauthorized" });
});

test("a cookie session is not a credential", async () => {
  const res = await handleMcp(rpc(LIST, { cookie: "better-auth.session_token=abc" }));
  assert.equal(res.status, 401);
});

test("a bearer that is not an ol_ token never reaches the engine", async () => {
  const res = await handleMcp(rpc(LIST, { authorization: "Bearer sk-live-nope" }));
  assert.equal(res.status, 401);
});

test("proxy mode serves the real tool list over JSON-RPC", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  const res = await handleMcp(rpc(LIST, { "x-openleagues-user": "usr_1" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.jsonrpc, "2.0");
  const names = body.result.tools.map((t) => t.name);
  assert.equal(names.length, AGENT_CORE.size, "every allowlisted verb is advertised");
  for (const name of names) assert.ok(AGENT_CORE.has(name), `${name} is not on the allowlist`);
  // The season spine an agent needs to actually run a league.
  for (const verb of ["advanceWeek", "processWaivers", "saveSettings", "proposeTrade"]) {
    assert.ok(names.includes(verb), `${verb} must be advertised`);
  }
  // The clock is not a tool.
  assert.ok(!names.includes("tick"));
});

test("proxy mode still refuses when the shared secret does not match", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  process.env.OPENLEAGUES_MCP_PROXY_SECRET = "s3cret";
  const bad = await handleMcp(rpc(LIST, { "x-openleagues-user": "usr_1" }));
  assert.equal(bad.status, 401);
  const good = await handleMcp(
    rpc(LIST, { "x-openleagues-user": "usr_1", "x-openleagues-proxy-secret": "s3cret" }),
  );
  assert.equal(good.status, 200);
});

test("a misconfigured auth mode is a closed door", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "everyone";
  const res = await handleMcp(rpc(LIST, { "x-openleagues-user": "usr_1" }));
  assert.equal(res.status, 401);
});
