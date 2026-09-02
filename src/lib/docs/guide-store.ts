import { useSyncExternalStore } from "react";

/**
 * Who is reading the guide. A tiny external store so the chip row, the
 * article, and the table of contents agree without a provider wrapping them.
 */
export type Audience = "all" | "manager" | "builder" | "commissioner" | "agent";

export const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: "all", label: "Everyone", hint: "every use case, in the order the pain shows up" },
  { key: "manager", label: "I play on Sleeper", hint: "receipts, no account" },
  { key: "builder", label: "I build things", hint: "the JSON behind the cards" },
  { key: "commissioner", label: "I run a league", hint: "your own box, your own rules" },
  { key: "agent", label: "I run an agent", hint: "Codex, Claude, anything that speaks MCP" },
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
