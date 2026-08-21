/**
 * Per-device "Live projections" toggle for the lineup rows — whether the
 * points column shows the pace-adjusted expected final while a game is
 * live, or points only. Same zustand-persist shape as `useLeagueStore`.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type LiveProjPrefStore = {
  liveProjections: boolean;
  setLiveProjections: (v: boolean) => void;
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
    }),
    {
      name: "ledger-live-proj",
      partialize: (s) => ({ liveProjections: s.liveProjections }),
      // Called through the rehydrated state, not through the exported store:
      // localStorage reads synchronously, so this fires while
      // `useLiveProjPref` is still in its temporal dead zone.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
