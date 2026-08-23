import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

/**
 * Commit a horizontal swipe: -1 = previous, 1 = next, 0 = spring back.
 * Far enough (a quarter of the width) or a fast flick (with real travel)
 * commits; anything else snaps back.
 */
export function swipeCommit(dragPx: number, width: number, vxPxMs: number): -1 | 0 | 1 {
  if (width <= 0) return 0;
  const far = Math.abs(dragPx) > width * 0.25;
  const fast = Math.abs(vxPxMs) > 0.45 && Math.abs(dragPx) > 24;
  if (!far && !fast) return 0;
  return dragPx < 0 ? 1 : -1;
}

type SwipeStart = { x: number; y: number; t: number; axis: "h" | "v" | null; id: number };

/**
 * Axis-locked horizontal swipe for transform-driven panes.
 *
 * Attach `handlers` to the track and give it `touch-pan-y`: vertical panning
 * stays native (the browser cancels our pointer stream for it), and only a
 * deliberate, mostly-horizontal drag (>10px, clearly wider than tall) engages.
 * A vertical scroll can therefore never move the panes — the failure mode of
 * free `overflow-x` + `scroll-snap`, where any diagonal wobble flips them.
 * Mouse pointers are ignored on purpose; desktop drives the visible controls.
 */
export function useSwipe(onCommit: (dir: -1 | 1) => void) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const st = useRef<SwipeStart | null>(null);

  const end = useCallback(
    (e: ReactPointerEvent<HTMLElement>, cancel: boolean) => {
      const s = st.current;
      if (!s) return;
      st.current = null;
      if (s.axis === "h" && !cancel) {
        const dx = e.clientX - s.x;
        const vx = dx / Math.max(1, e.timeStamp - s.t);
        const dir = swipeCommit(dx, e.currentTarget.clientWidth || 1, vx);
        if (dir !== 0) onCommit(dir);
      }
      setDrag(0);
      setDragging(false);
    },
    [onCommit],
  );

  return {
    drag,
    dragging,
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" || !e.isPrimary) return;
        st.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null, id: e.pointerId };
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const s = st.current;
        if (!s || e.pointerId !== s.id) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (s.axis == null) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            s.axis = "h";
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Capture is best-effort (synthetic pointers, older engines).
            }
            setDragging(true);
          } else if (Math.abs(dy) > 10) {
            // The browser owns this one as a native vertical scroll.
            s.axis = "v";
          }
        }
        if (s.axis === "h") setDrag(dx);
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
    },
  };
}
