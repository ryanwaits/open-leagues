import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AGENT_CORE } from "@/lib/agent/core";
import { handleMcp } from "./mcp.ts";

const KEYS = [
  "OPENLEAGUES_MCP_AUTH",
  "OPENLEAGUES_MODE",
  "OPENLEAGUES_MCP_USER_HEADER",
  "OPENLEAGUES_MCP_PROXY_SECRET",
];
// Unset is substrate; these tests exercise the league box's credential door
// unless a test says otherwise.
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  process.env.OPENLEAGUES_MODE = "league";
});
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

test("proxy mode can narrow a caller to read-only, and a write is then refused", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  const res = await handleMcp(
    rpc(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "sitPlayer", arguments: { leagueId: "lg_x", playerId: "p1" } },
      },
      { "x-openleagues-user": "usr_1", "x-openleagues-scope": "read" },
    ),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /read-only/);
});

test("a substrate box answers the public with no credential, and only the public verbs", async () => {
  process.env.OPENLEAGUES_MODE = "substrate";
  const res = await handleMcp(rpc(LIST));
  assert.equal(res.status, 200);
  const body = await res.json();
  const names = body.result.tools.map((t) => t.name);
  assert.ok(names.includes("getReceipt"));
  assert.ok(names.includes("sampleGames"));
  assert.ok(names.includes("simulateBankroll"));
  assert.ok(!names.includes("startPlayer"), "writes are not offered");
  assert.ok(!names.includes("freezeStrategy"), "nothing that needs a person is offered");
  assert.ok(!names.includes("getAgentContext"), "no seat, no context");
});

test("a substrate box refuses a non-public verb with the pointer to self-hosting", async () => {
  process.env.OPENLEAGUES_MODE = "substrate";
  const call = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "freezeStrategy", arguments: { name: "x", spec: {} } },
  };
  const res = await handleMcp(rpc(call));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /public substrate/);
  assert.match(body.result.content[0].text, /self-host/);
});

test("a substrate box ignores a bearer token: there are no accounts to check it against", async () => {
  process.env.OPENLEAGUES_MODE = "substrate";
  const res = await handleMcp(rpc(LIST, { authorization: "Bearer ol_anything" }));
  assert.equal(res.status, 200);
});
