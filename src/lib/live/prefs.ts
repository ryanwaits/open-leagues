/**
 * Per-device "Live projections" toggle for the lineup rows — whether the
 * points column shows the pace-adjusted expected final while a game is
 * live, or points only. Same zustand-persist shape as `useLeagueStore`.
 *
 * Also carries the matchup finals chart's own per-device prefs: which view
 * the segmented control shows (`edgeView`) and which window is selected
 * (`edgeWindow`). Same store, same persist key — one more field to
 * `partialize`, not a second store to hydrate.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EdgeView = "finals" | "pct" | "margin";

type LiveProjPrefStore = {
  liveProjections: boolean;
  setLiveProjections: (v: boolean) => void;
  edgeView: EdgeView;
  setEdgeView: (v: EdgeView) => void;
  edgeWindow: number;
  setEdgeWindow: (v: number) => void;
  hasHydrated: boolean;
  markHydrated: () => void;
};

export const useLiveProjPref = create<LiveProjPrefStore>()(
  persist(
    (set) => ({
      liveProjections: true,
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      setLiveProjections: (v) => set({ liveProjections: v }),
      edgeView: "finals",
      setEdgeView: (v) => set({ edgeView: v }),
      edgeWindow: 10800,
      setEdgeWindow: (v) => set({ edgeWindow: v }),
    }),
    {
      name: "ledger-live-proj",
      partialize: (s) => ({
        liveProjections: s.liveProjections,
        edgeView: s.edgeView,
        edgeWindow: s.edgeWindow,
      }),
      // Called through the rehydrated state, not through the exported store:
      // localStorage reads synchronously, so this fires while
      // `useLiveProjPref` is still in its temporal dead zone.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
