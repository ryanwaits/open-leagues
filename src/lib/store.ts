import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SavedLeague = {
  leagueId: string;
  name: string;
  season: string;
};

type LeagueStore = {
  recent: SavedLeague[];
  remember: (league: SavedLeague) => void;
  hasHydrated: boolean;
  markHydrated: () => void;
};

export const useLeagueStore = create<LeagueStore>()(
  persist(
    (set, get) => ({
      recent: [],
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      remember: (league) => {
        const next = [league, ...get().recent.filter((r) => r.leagueId !== league.leagueId)].slice(
          0,
          8,
        );
        set({ recent: next });
      },
    }),
    {
      name: "ledger-leagues",
      partialize: (s) => ({ recent: s.recent }),
      // Called through the rehydrated state, not through the exported store:
      // localStorage reads synchronously, so this fires while `useLeagueStore`
      // is still in its temporal dead zone. Naming the export here threw, the
      // flag never flipped, and the recent-league chip stayed hidden for
      // everyone who had one.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
