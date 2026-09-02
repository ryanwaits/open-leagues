/** Query key[0] values written to localStorage. Live feeds stay memory-only. */
export const PERSIST_ROOTS = new Set<string>([
  "league",
  "matchups",
  "team",
  "my-leagues",
  "byes",
  "activity",
  "desk",
  "trades",
  "claims",
  "picks",
  "settings",
  "schedule",
  "player-profile",
  "wire",
]);

export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PERSIST_BUSTER = "ledger-workbook-1";
export const PERSIST_STORAGE_KEY = "ledger-rq";

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_ROOTS.has(root);
}

/**
 * Workbook keys that can change between sessions (lineups, trades). Hydrate
 * paints last-known, then these must refetch — persist + 30s staleTime would
 * otherwise treat a just-written snapshot as fresh and skip the network.
 */
export const PERSIST_STALE_ON_RESTORE = new Set<string>([
  "league",
  "matchups",
  "team",
  "trades",
  "claims",
  "wire",
  "activity",
  "desk",
]);

export function shouldStaleOnRestore(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_STALE_ON_RESTORE.has(root);
}
