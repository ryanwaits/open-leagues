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
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium leading-none",
        tone === "default" && "bg-fg/6 text-muted",
        tone === "win" && "bg-accent-strong/14 text-accent-strong",
        tone === "loss" && "bg-loss/14 text-loss",
        tone === "live" && "bg-live/14 text-live",
        tone === "warn" && "bg-warn/14 text-warn",
        tone === "muted" && "text-faint",
        className,
      )}
      {...props}
    />
  );
}
