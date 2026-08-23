import { useEffect, useState } from "react";

/** Pure: next hidden state from a scroll sample. Down past the fold hides; any
 * meaningful up-move, or being near the top, shows. Small jitter (<8px) is ignored. */
export function nextHidden(prevY: number, y: number, hidden: boolean): boolean {
  if (y <= 120) return false;
  const d = y - prevY;
  if (d > 8) return true;
  if (d < -8) return false;
  return hidden;
}

/** True while the user is not in reduced-motion. */
export function motionOk(): boolean {
  return typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Window-scroll direction → hide chrome. Always false under reduced motion. */
export function useScrollHide(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!motionOk()) return;
    let prevY = window.scrollY;
    // Tracked outside React state so the scroll handler never needs a
    // functional setState updater — those are double-invoked under
    // StrictMode (on by default via TanStack Start's client entry), and an
    // updater that closes over the mutable `prevY` above is not pure: the
    // second invocation would see `prevY` already advanced by this same
    // callback, producing the wrong result on roughly half of transitions.
    let hiddenNow = false;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const next = nextHidden(prevY, y, hiddenNow);
        if (next !== hiddenNow) {
          hiddenNow = next;
          setHidden(next);
        }
        prevY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return hidden;
}
