import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The context deck: a page's lens + one action, docked above the thumb bar.
 * Renders into Shell's #deck-slot (phones only — the slot lives inside the
 * md:hidden bottom nav). One deck per page, mounted by the route. */
export function Deck({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    setHost(document.getElementById("deck-slot"));
  }, []);
  if (!host) return null;
  return createPortal(<div className="flex items-center gap-2 px-3 py-2">{children}</div>, host);
}
