import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A header dropdown that is a popover under its trigger on wide screens and a
 * bottom sheet on phones. Rendered into <body>: the header is sticky with a
 * backdrop blur, which makes it the containing block for any `position:
 * fixed` child — so a sheet drawn inside it lands inside the 60px header
 * instead of over the page. Portalling out is what keeps it on screen.
 */
export function HeaderMenu({
  open,
  onClose,
  anchorRef,
  align = "left",
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Which edge of the trigger the popover hangs from on wide screens. */
  align?: "left" | "right";
  label: string;
  /** Popover width etc. — applied on sm+ only. */
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);

  useEffect(() => setHost(document.body), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 8, left: r.left, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        anchorRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !host) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-fg/40 sm:hidden"
      />
      <div
        ref={panelRef}
        role="menu"
        aria-label={label}
        style={
          pos
            ? ({
                "--menu-top": `${pos.top}px`,
                "--menu-left": `${pos.left}px`,
                "--menu-right": `${pos.right}px`,
              } as React.CSSProperties)
            : undefined
        }
        className={cn(
          "fixed z-50 bg-surface p-1.5 shadow-[0_0_0_1px_var(--color-line-strong)]",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-xl max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "sm:top-[var(--menu-top)] sm:rounded-lg",
          align === "left" ? "sm:left-[var(--menu-left)]" : "sm:right-[var(--menu-right)]",
          className,
        )}
      >
        <div className="mx-auto mt-1 mb-3 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
        {children}
      </div>
    </>,
    host,
  );
}
