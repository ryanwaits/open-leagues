import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { Check, FlaskConical, Pause, Play, Radio, X } from "lucide-react";
import { useEffect } from "react";
import { LAST_PHASE, useDemoOn, useDemoStore, usePreLive } from "@/lib/demo/store";
import { PROTOTYPE_LABELS, PROTOTYPE_STATES, type PrototypeState } from "@/lib/league/prototype";
import { REPLAY_PHASES, REPLAY_TICK_MS } from "@/lib/replay";
import { cn } from "@/lib/utils";

/**
 * Every not-the-real-week control, in one place you can ignore.
 *
 * These used to be banners: a "Simulate this week" card at the top of Matchups,
 * a Simulate button inside the player drawer, each owning its own copy of the
 * phase. Three controls for one idea, competing with the content for the top of
 * the page. Now there is one transport, one clock, and one piece of state, and
 * they sit in the corner where a debug affordance belongs.
 *
 * The tick lives here because the toolbar is the only thing guaranteed to be
 * mounted exactly once. Pages read the phase; they never advance it.
 */
export function DemoToolbar({ state }: { state: PrototypeState | undefined }) {
  const on = useDemoOn();
  const preLive = usePreLive();
  const phase = useDemoStore((s) => s.phase);
  const running = useDemoStore((s) => s.running);
  const toggle = useDemoStore((s) => s.toggle);
  const stop = useDemoStore((s) => s.stop);
  const step = useDemoStore((s) => s.step);
  const setPreLive = useDemoStore((s) => s.setPreLive);
  const navigate = useNavigate();

  useEffect(() => {
    if (!on || !running || phase == null) return;
    const t = window.setTimeout(step, REPLAY_TICK_MS);
    return () => window.clearTimeout(t);
  }, [on, running, phase, step]);

  // Leaving demo mode has to leave the simulation behind with it.
  useEffect(() => {
    if (!on && phase != null) stop();
  }, [on, phase, stop]);

  if (!on) return null;

  const label = phase != null ? (REPLAY_PHASES[phase]?.label ?? "Sim") : null;
  const setState = (next: PrototypeState | undefined) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, state: next }),
      replace: true,
    });

  return (
    // High enough to clear both the mobile tab bar and any page that parks a
    // fixed action rail above it. A dev toy must never sit on a real control.
    <div className="pointer-events-none fixed right-3 bottom-36 z-40 flex items-center gap-1.5 md:bottom-20">
      <Chip
        onClick={() => setPreLive(!preLive)}
        label="Pre live"
        title="Paint tonight's preseason games onto your matchups. Display only."
        on={preLive}
      >
        <Radio className="size-3" strokeWidth={2.4} />
      </Chip>
      {phase == null ? (
        <Chip onClick={toggle} label="Simulate" title="Unfold this week play by play">
          <Play className="size-3" strokeWidth={2.4} />
        </Chip>
      ) : (
        <span className="pointer-events-auto inline-flex h-8 items-center overflow-hidden rounded-pill border border-accent-strong bg-accent text-accent-fg shadow-[var(--shadow-lift)]">
          <button
            type="button"
            onClick={toggle}
            title={running ? "Pause" : phase >= LAST_PHASE ? "Run it again" : "Resume"}
            className="grid h-8 w-8 place-items-center hover:bg-accent-deep/20"
          >
            {running ? (
              <Pause className="size-3" strokeWidth={2.4} />
            ) : (
              <Play className="size-3" strokeWidth={2.4} />
            )}
          </button>
          <span className="px-1.5 microlabel-data tabular-nums">
            {label} · {phase + 1}/{REPLAY_PHASES.length}
          </span>
          <button
            type="button"
            onClick={stop}
            title="Show the real week"
            className="grid h-8 w-8 place-items-center hover:bg-accent-deep/20"
          >
            <X className="size-3" strokeWidth={2.4} />
          </button>
        </span>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            "pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 microlabel-data shadow-[var(--shadow-lift)] transition-colors duration-150",
            state
              ? "border-accent-strong bg-accent text-accent-fg"
              : "border-line bg-surface text-faint hover:text-muted",
          )}
        >
          <FlaskConical className="size-3" strokeWidth={2.4} />
          {state ?? "state"}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            side="top"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-60 rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-lift)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <p className="px-3 pt-2 pb-1.5 microlabel-data">Week phase · demo mode</p>
            <Row on={!state} label="Off" hint="real data" onSelect={() => setState(undefined)} />
            {PROTOTYPE_STATES.map((s) => (
              <Row
                key={s}
                on={state === s}
                label={s}
                hint={PROTOTYPE_LABELS[s]}
                onSelect={() => setState(s)}
              />
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function Chip({
  onClick,
  label,
  title,
  on,
  children,
}: {
  onClick: () => void;
  label: string;
  title: string;
  on?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 microlabel-data shadow-[var(--shadow-lift)] transition-colors duration-150",
        on
          ? "border-accent-strong bg-accent text-accent-fg"
          : "border-line bg-surface hover:text-muted",
      )}
    >
      {children}
      {label}
    </button>
  );
}

function Row({
  on,
  label,
  hint,
  onSelect,
}: {
  on: boolean;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-raised"
    >
      <span className="flex-1 font-medium capitalize">{label}</span>
      <span className="font-mono text-[10px] text-faint">{hint}</span>
      {on ? <Check className="size-3.5 shrink-0 text-accent-strong" strokeWidth={3} /> : null}
    </DropdownMenu.Item>
  );
}
