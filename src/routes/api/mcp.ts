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
import { AGENT_CORE, PUBLIC_CORE } from "@/lib/agent/core";
import { dispatch } from "@/lib/agent/dispatch";
import { coerceArgs, schemaFor } from "@/lib/agent/schemas";
import { type McpIdentity, resolveMcpIdentity } from "@/lib/auth/mcp-identity.server";
import { isSubstrate, SUBSTRATE_REFUSAL } from "@/lib/box-mode";

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

/** The public caller on a substrate box: no person, read scope, the public allowlist. */
const PUBLIC: McpIdentity = { userId: "", scope: "read", label: "public" };

/* ── a small per-IP limiter for the public door ─────────────────────── */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const buckets = new Map<string, { at: number; n: number }>();
function rateLimited(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.at > RATE_WINDOW_MS) {
    buckets.set(ip, { at: now, n: 1 });
    if (buckets.size > 10_000) buckets.clear();
    return false;
  }
  b.n += 1;
  return b.n > RATE_MAX;
}

/**
 * Resolve the caller → identity, or 401. Cookie sessions are not accepted.
 * A substrate box has no credentials to check: every caller is the public,
 * rate-limited, and confined to PUBLIC_CORE.
 */
async function authorize(request: Request): Promise<McpIdentity | Response> {
  if (isSubstrate()) {
    if (rateLimited(request)) {
      return Response.json({ error: "rate limited" }, { status: 429, headers: CORS });
    }
    return PUBLIC;
  }
  try {
    const who = await resolveMcpIdentity(request);
    return who ?? unauthorized();
  } catch (err) {
    // A misconfigured identity mode is a closed door, not an open one.
    console.error("[mcp] identity resolution failed:", err);
    return unauthorized();
  }
}

function buildServer(who: McpIdentity): Server {
  const isPublic = who.label === "public";
  const allowed = isPublic ? PUBLIC_CORE : AGENT_CORE;
  const coreTools = AGENT_TOOLS.filter((t) => allowed.has(t.id));
  const server = new Server(
    { name: "open-leagues", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: coreTools.map((t) => ({
      name: t.id,
      description: t.description,
      inputSchema: schemaFor(t.id) as { type: "object"; [k: string]: unknown },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    // A client without a schema stringifies arrays and objects; take them anyway.
    const args = coerceArgs(
      request.params.arguments && typeof request.params.arguments === "object"
        ? (request.params.arguments as Record<string, unknown>)
        : {},
    );
    try {
      if (isPublic && !PUBLIC_CORE.has(name)) throw new Error(`${name}: ${SUBSTRATE_REFUSAL}`);
      // Identity from the resolved credential only — never from tool arguments.
      // A read-scoped token is refused at the door of every write.
      const result = await dispatch(name, isPublic ? null : who.userId, args, {
        scope: who.scope,
        actor: who.label,
      });
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
  if (auth instanceof Response) return auth;

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
