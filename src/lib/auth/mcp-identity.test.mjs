import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  DEFAULT_PROXY_USER_HEADER,
  mcpAuthMode,
  proxyUserHeader,
  resolveMcpUser,
} from "./mcp-identity.server.ts";

const KEYS = [
  "OPENLEAGUES_MCP_AUTH",
  "OPENLEAGUES_MCP_USER_HEADER",
  "OPENLEAGUES_MCP_PROXY_SECRET",
];

function reset() {
  for (const k of KEYS) delete process.env[k];
}

afterEach(reset);

function req(headers = {}) {
  return new Request("https://box.test/api/mcp", { headers });
}

test("unset mode is token, not open", () => {
  reset();
  assert.equal(mcpAuthMode(), "token");
  process.env.OPENLEAGUES_MCP_AUTH = "token";
  assert.equal(mcpAuthMode(), "token");
});

test("an unknown mode refuses to serve rather than guessing", () => {
  process.env.OPENLEAGUES_MCP_AUTH = "none";
  assert.throws(() => mcpAuthMode(), /must be "token" or "proxy"/);
});

test("token mode rejects anything that is not an ol_ bearer without touching the db", async () => {
  reset();
  assert.equal(await resolveMcpUser(req()), null);
  assert.equal(await resolveMcpUser(req({ authorization: "Bearer nope" })), null);
  assert.equal(await resolveMcpUser(req({ cookie: "session=abc" })), null);
  // A proxy header means nothing in token mode.
  assert.equal(await resolveMcpUser(req({ [DEFAULT_PROXY_USER_HEADER]: "usr_1" })), null);
});

test("proxy mode trusts the header it is told to trust", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  assert.equal(proxyUserHeader(), DEFAULT_PROXY_USER_HEADER);
  assert.equal(await resolveMcpUser(req({ [DEFAULT_PROXY_USER_HEADER]: "usr_1" })), "usr_1");
  // Missing or blank is a closed door, not an anonymous one.
  assert.equal(await resolveMcpUser(req()), null);
  assert.equal(await resolveMcpUser(req({ [DEFAULT_PROXY_USER_HEADER]: "   " })), null);
});

test("proxy mode honours a custom header name", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  process.env.OPENLEAGUES_MCP_USER_HEADER = "X-Team-User";
  assert.equal(proxyUserHeader(), "x-team-user");
  assert.equal(await resolveMcpUser(req({ "x-team-user": "usr_2" })), "usr_2");
  assert.equal(await resolveMcpUser(req({ [DEFAULT_PROXY_USER_HEADER]: "usr_2" })), null);
});

test("the proxy secret, when set, is required", async () => {
  process.env.OPENLEAGUES_MCP_AUTH = "proxy";
  process.env.OPENLEAGUES_MCP_PROXY_SECRET = "s3cret";
  const user = { [DEFAULT_PROXY_USER_HEADER]: "usr_3" };
  assert.equal(await resolveMcpUser(req(user)), null, "no secret, no trust");
  assert.equal(await resolveMcpUser(req({ ...user, "x-openleagues-proxy-secret": "wrong" })), null);
  assert.equal(
    await resolveMcpUser(req({ ...user, "x-openleagues-proxy-secret": "s3cret" })),
    "usr_3",
  );
});
