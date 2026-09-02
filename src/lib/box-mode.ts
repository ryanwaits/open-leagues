/**
 * What kind of box this is.
 *
 *   substrate  (default) — receipts, open data, the lab, and /api/mcp with no
 *              accounts at all. No signup, no tokens, no leagues. Anyone can
 *              call the public read verbs; anything that needs a person is
 *              refused with a pointer to running a league box. This is what
 *              an unconfigured deploy is, so a public host can never expose a
 *              signup form by accident.
 *   league     — the whole product: accounts, hosted leagues, the desk, tokens,
 *              plus everything the substrate does. Opted into with
 *              OPENLEAGUES_MODE=league; docker-compose and `bun run dev` set it.
 *
 * Server-side truth is the environment. Clients ask through `getBoxMode`.
 */
export type BoxMode = "league" | "substrate";

export function boxMode(): BoxMode {
  const raw = (process.env.OPENLEAGUES_MODE ?? "").trim().toLowerCase();
  return raw === "league" || raw === "box" ? "league" : "substrate";
}

export const isSubstrate = (): boolean => boxMode() === "substrate";

/** The sentence every refusal on a substrate box ends with. */
export const SUBSTRATE_REFUSAL =
  "This box is a public substrate: receipts, open data, the lab, and read verbs over MCP. It keeps no accounts and hosts no leagues. Run your own box to do this — see /docs/self-host.";
