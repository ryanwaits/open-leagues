import { Check } from "lucide-react";
import { Drawer } from "vaul";
import { weekLabel } from "@/components/week-picker";
import { cn } from "@/lib/utils";

/**
 * The week picker's thumb-reach twin.
 *
 * WeekPicker is a desktop dropdown anchored to a header far from the thumb.
 * On a phone the deck pill opens this sheet instead — same eighteen rows,
 * reachable with one hand.
 */
export function WeekSheet({
  open,
  onOpenChange,
  week,
  maxWeek,
  playoffStart,
  currentWeek,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: number;
  maxWeek: number;
  /** First playoff week; weeks from here up are labelled rather than numbered. */
  playoffStart: number;
  /** The league's live week, marked so "now" is findable in a long list. */
  currentWeek: number;
  onPick: (week: number) => void;
}) {
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-fg/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 outline-none ring-card">
          <Drawer.Handle className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />
          <Drawer.Title className="sr-only">Change week</Drawer.Title>
          <Drawer.Description className="sr-only">
            Pick a week to view for this league.
          </Drawer.Description>

          <p className="microlabel mt-4">Week</p>
          <div className="mt-2 max-h-[50dvh] overflow-y-auto overscroll-contain">
            {weeks.map((w) => {
              const on = w === week;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    onPick(w);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
                    on ? "font-medium" : "text-muted",
                  )}
                >
                  <span className="flex-1">{weekLabel(w, playoffStart)}</span>
                  {w === currentWeek ? <span className="microlabel-data">now</span> : null}
                  {on ? (
                    <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
