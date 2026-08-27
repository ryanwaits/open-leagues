#!/usr/bin/env bun
/**
 * MCP stdio server for AGENT_CORE tools.
 *
 *   export DATABASE_URL=postgres://…
 *   export OPENLEAGUES_USER=<Better Auth user.id>
 *   bun scripts/mcp.mjs
 *
 * Hosts: codex/claude/grok `mcp add open-leagues --command bun --args scripts/mcp.mjs`
 *
 * Calls the same engine modules as the PWA (not createServerFn). Hosted-league
 * Postgres only — bun cannot boot the PGLite fallback (no import.meta.glob).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AGENT_TOOLS } from "../src/lib/agent/catalog.ts";
import { AGENT_CORE } from "../src/lib/agent/core.ts";
import { dispatch } from "../src/lib/agent/dispatch.ts";

const userId = process.env.OPENLEAGUES_USER;
const databaseUrl = process.env.DATABASE_URL;

if (!userId || !databaseUrl) {
  const missing = [
    !userId ? "OPENLEAGUES_USER" : null,
    !databaseUrl ? "DATABASE_URL" : null,
  ].filter(Boolean);
  console.error(
    `open-leagues mcp: missing ${missing.join(" and ")}. Set both env vars (Postgres + Better Auth user.id).`,
  );
  process.exit(1);
}

const coreTools = AGENT_TOOLS.filter((t) => AGENT_CORE.has(t.id));

/** Loose object schema — args validated inside dispatch. */
const inputSchema = {
  type: "object",
  properties: {},
  additionalProperties: true,
};

const server = new Server(
  { name: "open-leagues", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: coreTools.map((t) => ({
    name: t.id,
    description: t.description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args =
    request.params.arguments && typeof request.params.arguments === "object"
      ? /** @type {Record<string, unknown>} */ (request.params.arguments)
      : {};
  try {
    // userId from OPENLEAGUES_USER only — never from tool arguments
    const result = await dispatch(name, userId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: msg }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
