/**
 * Hosted MCP over Streamable HTTP (JSON response mode — no SSE).
 *
 * Identity comes from `resolveMcpUser` — a bearer token by default, or a header
 * your own edge sets when OPENLEAGUES_MCP_AUTH=proxy. Never cookie sessions,
 * and never from tool arguments.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createFileRoute } from "@tanstack/react-router";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import { dispatch } from "@/lib/agent/dispatch";
import { resolveMcpUser } from "@/lib/auth/mcp-identity.server";

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

/** Resolve the caller → userId, or 401. Cookie sessions are not accepted. */
async function authorize(request: Request): Promise<string | Response> {
  try {
    const userId = await resolveMcpUser(request);
    return userId ?? unauthorized();
  } catch (err) {
    // A misconfigured identity mode is a closed door, not an open one.
    console.error("[mcp] identity resolution failed:", err);
    return unauthorized();
  }
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
      // userId from the resolved identity only — never from tool arguments
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

/**
 * Exported for tests: the whole request path, minus the router. `tools/list`
 * never reaches the engine, so the protocol surface is testable without a
 * database.
 */
export async function handleMcp(request: Request): Promise<Response> {
  const auth = await authorize(request);
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
