import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "win" | "loss" | "live" | "muted" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs tracking-wide",
        tone === "default" && "bg-raised text-muted",
        tone === "win" && "bg-win/15 text-win",
        tone === "loss" && "bg-loss/15 text-loss",
        tone === "live" && "bg-live/15 text-live",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "muted" && "text-faint",
        className,
      )}
      {...props}
    />
  );
}
