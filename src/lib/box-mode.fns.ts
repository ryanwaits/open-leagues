import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { BoxMode } from "./box-mode";

/** The one thing a client needs to know before it draws a door: is there a door. */
export const getBoxMode = createServerFn({ method: "GET" }).handler(async () => {
  const { boxMode } = await import("./box-mode");
  return { mode: boxMode() };
});

export function useBoxMode(): { mode: BoxMode | null; substrate: boolean; pending: boolean } {
  const q = useQuery({
    queryKey: ["box-mode"],
    queryFn: () => getBoxMode(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const mode = q.data?.mode ?? null;
  return { mode, substrate: mode === "substrate", pending: q.isPending };
}
