import { cn } from "@/lib/utils";

/** Giant faded numeral behind a page hero. Renders nothing outside the
 * boxscore skin (CSS-gated); parent needs the ghost-host class. */
export function GhostNum({
  n,
  className,
}: {
  n: string | number | null | undefined;
  className?: string;
}) {
  if (n == null || n === "") return null;
  return (
    <span aria-hidden className={cn("ghost-num", className)}>
      {n}
    </span>
  );
}

/** Rotated archival mark. Boxscore-only via CSS; reserve for earned moments. */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn("stamp", className)}>
      {children}
    </span>
  );
}
