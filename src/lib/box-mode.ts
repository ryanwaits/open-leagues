/**
 * What kind of box this is.
 *
 *   box        (default) — the whole product: accounts, hosted leagues, the
 *              desk, tokens, plus receipts, open data, the lab, and MCP.
 *   substrate  — the public host's shape: receipts, open data, the lab, and
 *              /api/mcp with no accounts at all. No signup, no tokens, no
 *              leagues live here. Anyone can call the public verbs; anything
 *              that needs a person is refused with a pointer to self-hosting.
 *
 * Server-side truth is the environment. Clients ask through `getBoxMode`.
 */
export type BoxMode = "box" | "substrate";

export function boxMode(): BoxMode {
  const raw = (process.env.OPENLEAGUES_MODE ?? "").trim().toLowerCase();
  return raw === "substrate" ? "substrate" : "box";
}

export const isSubstrate = (): boolean => boxMode() === "substrate";

/** The sentence every refusal on a substrate box ends with. */
export const SUBSTRATE_REFUSAL =
  "This box is a public substrate: receipts, open data, the lab, and read verbs over MCP. It keeps no accounts and hosts no leagues. Run your own box to do this — see /docs/self-host.";
