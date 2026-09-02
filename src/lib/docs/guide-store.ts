import { useSyncExternalStore } from "react";

/**
 * Who is reading the guide. A tiny external store so the chip row, the
 * article, and the table of contents agree without a provider wrapping them.
 */
export type Audience = "all" | "agent" | "manager" | "bettor" | "builder" | "commissioner";

export const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: "all", label: "Everyone", hint: "every use case, agents first, then the season in order" },
  { key: "agent", label: "I run an agent", hint: "Codex, Claude, anything that speaks MCP" },
  { key: "manager", label: "I play on Sleeper", hint: "any league by id, no account" },
  { key: "bettor", label: "I test betting ideas", hint: "lines since 1999, graded, never a pick" },
  { key: "builder", label: "I build on the data", hint: "three JSON files, CORS on, no key" },
  { key: "commissioner", label: "I run a league", hint: "your own box, your own rules" },
];

let current: Audience = "all";
const listeners = new Set<() => void>();

export function setAudience(next: Audience): void {
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAudience(): Audience {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "all",
  );
}

/** Does a section tagged for `who` show under the current filter? */
export function showsFor(who: Audience[] | undefined, filter: Audience): boolean {
  if (!who || filter === "all") return true;
  return who.includes(filter);
}
