import { lookupToken } from "@/lib/auth/tokens.server";

/**
 * Who is calling /api/mcp.
 *
 * The engine never asks how a caller proved who they are — every verb takes a
 * `userId` and the league rules (seat, commish, purse) do the rest. So identity
 * is one seam a host can replace, not a policy baked into the product.
 *
 *   token  (default) — Authorization: Bearer ol_… against this box's own
 *                      ol_agent_tokens table. Minted at /account or with
 *                      `bun scripts/ledger.mjs mintToken --write`.
 *   proxy            — the host authenticated the caller at the edge and passes
 *                      the user id on a header. We trust that header and nothing
 *                      else.
 *
 * Every mode fails closed. An unset or unknown mode is `token`, never "open".
 */
export type McpAuthMode = "token" | "proxy";

export const DEFAULT_PROXY_USER_HEADER = "x-openleagues-user";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function mcpAuthMode(): McpAuthMode {
  const raw = env("OPENLEAGUES_MCP_AUTH").toLowerCase();
  if (raw === "proxy") return "proxy";
  if (raw === "" || raw === "token") return "token";
  throw new Error(
    `OPENLEAGUES_MCP_AUTH must be "token" or "proxy" (got "${raw}"). Refusing to serve MCP.`,
  );
}

export function proxyUserHeader(): string {
  return (env("OPENLEAGUES_MCP_USER_HEADER") || DEFAULT_PROXY_USER_HEADER).toLowerCase();
}

let warnedNoProxySecret = false;

/**
 * A header is only worth trusting if nothing but the proxy can set it. When the
 * box is reachable directly, anyone can. `OPENLEAGUES_MCP_PROXY_SECRET` is the
 * shared value that proves the request came through the edge; without it we
 * serve anyway (some deployments really are private) but say so once, loudly.
 */
function proxySecretOk(request: Request): boolean {
  const expected = env("OPENLEAGUES_MCP_PROXY_SECRET");
  if (!expected) {
    if (!warnedNoProxySecret) {
      warnedNoProxySecret = true;
      console.warn(
        "[mcp] OPENLEAGUES_MCP_AUTH=proxy without OPENLEAGUES_MCP_PROXY_SECRET — " +
          `anyone who can reach this box can claim any user id via ${proxyUserHeader()}. ` +
          "Set the secret, or keep the origin unreachable except through your proxy.",
      );
    }
    return true;
  }
  const sent = request.headers.get("x-openleagues-proxy-secret")?.trim() ?? "";
  return sent.length > 0 && sent === expected;
}

/** Resolve a request to a user id, or null. Never throws on a bad credential. */
export async function resolveMcpUser(request: Request): Promise<string | null> {
  if (mcpAuthMode() === "proxy") {
    if (!proxySecretOk(request)) return null;
    const claimed = request.headers.get(proxyUserHeader())?.trim() ?? "";
    return claimed.length > 0 ? claimed : null;
  }

  const header = request.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!raw.startsWith("ol_")) return null;
  return await lookupToken(raw);
}
