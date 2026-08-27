/**
 * Hosted MCP over Streamable HTTP (JSON response mode — no SSE).
 * Auth: Authorization Bearer off_… via lookupToken. Never cookie sessions.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createFileRoute } from "@tanstack/react-router";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import { dispatch } from "@/lib/agent/dispatch";
import { lookupToken } from "@/lib/auth/tokens.server";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS });
}

/** Resolve Bearer off_… → userId, or 401. Cookie sessions are not accepted. */
async function authorizeBearer(request: Request): Promise<string | Response> {
  const header = request.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!raw.startsWith("off_")) return unauthorized();
  const userId = await lookupToken(raw);
  if (!userId) return unauthorized();
  return userId;
}

const inputSchema = {
  type: "object" as const,
  properties: {},
  additionalProperties: true,
};

function buildServer(userId: string): Server {
  const coreTools = AGENT_TOOLS.filter((t) => AGENT_CORE.has(t.id));
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
        ? (request.params.arguments as Record<string, unknown>)
        : {};
    try {
      // userId from Bearer token only — never from tool arguments
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

  return server;
}

async function handleMcp(request: Request): Promise<Response> {
  const auth = await authorizeBearer(request);
  if (typeof auth !== "string") return auth;

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer(auth);
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => handleMcp(request),
      POST: async ({ request }) => handleMcp(request),
      DELETE: async ({ request }) => handleMcp(request),
    },
  },
});
