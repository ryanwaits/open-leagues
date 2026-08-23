import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Eighteen weeks is a menu, not a toolbar.
 *
 * The old strip spent a full row of the page on seventeen targets you almost
 * never press, and still scrolled sideways on a phone. One button that says
 * which week you are looking at costs a tap to change and nothing to ignore.
 */
export function WeekPicker({
  week,
  maxWeek,
  playoffStart,
  currentWeek,
  onPick,
  className,
}: {
  week: number;
  maxWeek: number;
  /** First playoff week; weeks from here up are labelled rather than numbered. */
  playoffStart: number;
  /** The league's live week, marked so "now" is findable in a long list. */
  currentWeek: number;
  onPick: (week: number) => void;
  className?: string;
}) {
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "group inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface pl-3.5 pr-2.5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-line-strong)] hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep",
          className,
        )}
      >
        {label(week, playoffStart)}
        <ChevronDown
          className="size-3.5 text-faint transition-transform duration-150 group-data-[state=open]:rotate-180"
          strokeWidth={2.2}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-[min(24rem,60vh)] w-52 overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-lift)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {weeks.map((w) => {
            const on = w === week;
            return (
              <DropdownMenu.Item
                key={w}
                onSelect={() => onPick(w)}
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-raised"
              >
                <span className="flex-1 font-medium">{label(w, playoffStart)}</span>
                {w === currentWeek ? <span className="microlabel-data">now</span> : null}
                {on ? (
                  <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} />
                ) : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function label(week: number, playoffStart: number): string {
  if (week < playoffStart) return `Week ${week}`;
  const round = week - playoffStart + 1;
  if (round === 1) return `Week ${week} · Round 1`;
  if (round === 2) return `Week ${week} · Semis`;
  if (round === 3) return `Week ${week} · Final`;
  return `Week ${week} · Playoffs`;
}
