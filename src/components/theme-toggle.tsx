import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { type ThemePref, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();
  // The stored preference is only knowable on the client; render the segmented
  // control unselected until mount so SSR and first paint agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = mounted && pref === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a native <input type="radio"> can't render the icon child or carry this custom styling; button+role is the standard ARIA pattern for a styled segmented control
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setPref(value)}
            className={cn(
              "grid size-8 place-items-center rounded-pill transition-colors duration-150",
              on ? "bg-fg text-bg" : "text-faint",
              !on && "hover:text-muted",
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
