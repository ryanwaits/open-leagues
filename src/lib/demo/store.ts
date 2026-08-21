import { create } from "zustand";
import { persist } from "zustand/middleware";
import { REPLAY_PHASES } from "@/lib/replay";

/**
 * One switch for everything that isn't the real week.
 *
 * Forcing the hero into a phase, unfolding a Sunday from a stat bag, watching a
 * player's drives tick over on a Tuesday — each of those used to be its own
 * control living in its own banner on its own page, on by default, which meant
 * the product shipped with three separate invitations to look at made-up
 * numbers. They are now one preference and one toolbar.
 *
 * Off by default, and only reachable from a dev build. The preference is
 * per-browser rather than per-league: it changes what *you* are looking at, not
 * what the league is, so it has no business in league state where it would
 * follow every other manager around.
 *
 * `enabled` and `preLive` persist. The transport — which phase, whether it is
 * ticking — deliberately does not: a reload should never come back mid-fake-Sunday.
 */

export const LAST_PHASE = REPLAY_PHASES.length - 1;

/** Demo mode is a dev affordance. A production build has no switch to find. */
export const demoAvailable = import.meta.env.DEV;

type DemoStore = {
  enabled: boolean;
  /** Paint tonight's preseason slate onto matchups. Display only. */
  preLive: boolean;
  /** Null means "no simulation" — every surface shows the real week. */
  phase: number | null;
  running: boolean;
  hasHydrated: boolean;
  markHydrated: () => void;
  setEnabled: (on: boolean) => void;
  setPreLive: (on: boolean) => void;
  start: () => void;
  toggle: () => void;
  stop: () => void;
  step: () => void;
};

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      enabled: false,
      preLive: false,
      phase: null,
      running: false,
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      setEnabled: (on) =>
        // Turning it off has to take the simulation with it, or the pages keep
        // rendering fake scores with no visible control to stop them.
        set(
          on ? { enabled: true } : { enabled: false, preLive: false, phase: null, running: false },
        ),
      setPreLive: (on) =>
        set(on ? { preLive: true, phase: null, running: false } : { preLive: false }),
      start: () => set({ preLive: false, phase: 0, running: true }),
      toggle: () => {
        const { phase, running } = get();
        if (phase == null || phase >= LAST_PHASE) {
          set({ preLive: false, phase: 0, running: true });
          return;
        }
        set({ running: !running });
      },
      stop: () => set({ phase: null, running: false }),
      step: () => {
        const { phase } = get();
        if (phase == null) return;
        if (phase >= LAST_PHASE) {
          set({ running: false });
          return;
        }
        set({ phase: phase + 1 });
      },
    }),
    {
      name: "ledger-demo",
      partialize: (s) => ({ enabled: s.enabled, preLive: s.preLive }),
      // Through the rehydrated state, never through the exported store —
      // localStorage reads synchronously, so this runs while `useDemoStore` is
      // still in its temporal dead zone.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

/**
 * True when demo mode is on and safe to act on.
 *
 * Guards the hydration gap as well as the dev gate: the server always renders
 * with the preference off, so anything keyed on this has to wait for the store
 * to come back from localStorage or it renders one tree and hydrates another.
 */
export function useDemoOn(): boolean {
  return useDemoStore((s) => demoAvailable && s.hasHydrated && s.enabled);
}

/** The simulation phase, or null when nothing is being faked. */
export function useSimPhase(): number | null {
  return useDemoStore((s) =>
    demoAvailable && s.hasHydrated && s.enabled && !s.preLive ? s.phase : null,
  );
}

/** Real preseason chips + stats on this browser's matchups. Dev only. */
export function usePreLive(): boolean {
  return useDemoStore((s) => demoAvailable && s.hasHydrated && s.enabled && s.preLive);
}
