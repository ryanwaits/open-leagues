import { ArrowUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PlayerCell } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import type { Projection, RosterPlayer, TeamBundle } from "@/lib/data/types";
import { onBye } from "@/lib/league/phase";
import { labeledStartSlots, slotAccepts } from "@/lib/league/roster";
import { cn, formatPts } from "@/lib/utils";

/**
 * Owns lineup editing for the whole app. `team/$rosterId` is a read-only view
 * of anybody's roster; this is where a manager actually sets theirs, so the
 * interaction lives in exactly one place.
 *
 * One gesture everywhere: every row — starter slot or bench — carries a move
 * button beside its position. Tap it and the rows that can legally trade
 * places with it light up while the rest recede; tap a lit row and the move
 * commits. The rule is shown, not remembered, and the bench needs no
 * separate add/remove logic.
 */
export function LineupBoard({
  team,
  rosterPositions,
  editable,
  byes,
  week,
  projections,
  busy,
  onOpenPlayer,
  onIntentPlayer,
  onStart,
  onSit,
  onSwap,
}: {
  team: TeamBundle;
  rosterPositions: string[];
  editable: boolean;
  byes?: Record<string, number>;
  week?: number;
  projections?: Record<string, Projection>;
  busy: boolean;
  onOpenPlayer?: (p: RosterPlayer) => void;
  onIntentPlayer?: (p: RosterPlayer) => void;
  onStart: (
    playerId: string,
    replaceId: string | null,
    slot: string | null,
    name?: string,
    into?: string,
  ) => void;
  onSit: (playerId: string, name?: string) => void;
  /** Two starters trading slots: `a` takes `bSlot`, `b` takes `aSlot`. */
  onSwap: (swap: {
    aId: string;
    bId: string;
    aSlot: string;
    bSlot: string;
    aName: string;
    bName: string;
  }) => void;
}) {
  const slots = labeledStartSlots(rosterPositions);
  const starters = team.players.filter((p) => p.slot === "starter");
  const bench = team.players.filter((p) => p.slot === "bench");
  const bySlot = new Map(starters.map((p) => [p.starterSlot ?? "", p]));

  /**
   * The row whose move button was pressed. Stored as a reference, not a
   * snapshot, and re-resolved against the roster every render — the moment
   * the move lands, or the week turns, the source stops resolving and the
   * board drops out of the mode without an effect having to notice.
   */
  const [picked, setPicked] = useState<
    { kind: "slot"; label: string } | { kind: "bench"; playerId: string } | null
  >(null);

  const src = !editable
    ? null
    : picked?.kind === "bench"
      ? (() => {
          const p = bench.find((b) => b.player_id === picked.playerId);
          return p ? ({ kind: "bench", player: p } as const) : null;
        })()
      : picked?.kind === "slot" && slots.some((s) => s.label === picked.label)
        ? ({ kind: "slot", label: picked.label, player: bySlot.get(picked.label) ?? null } as const)
        : null;

  const cancel = () => setPicked(null);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src]);

  /**
   * Bring the rows that just lit up into view. Arming a bench player often
   * happens with the lineup scrolled off the top, so nudge to the first slot
   * he can take. `block: "nearest"` moves the least amount that works.
   */
  const slotRows = useRef(new Map<string, HTMLLIElement>());
  const firstEligible =
    src?.kind === "bench"
      ? (slots.find(({ label }) => slotAccepts(src.player.position, label))?.label ?? null)
      : null;

  useEffect(() => {
    if (!firstEligible) return;
    const row = slotRows.current.get(firstEligible);
    if (!row) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
  }, [firstEligible]);

  /** Can the row at `label` trade with the armed source? */
  const slotEligible = (label: string, occupant: RosterPlayer | undefined): boolean => {
    if (!src) return false;
    if (src.kind === "bench") return slotAccepts(src.player.position, label);
    if (src.label === label) return false;
    if (src.player && occupant)
      return slotAccepts(src.player.position, label) && slotAccepts(occupant.position, src.label);
    if (src.player) return slotAccepts(src.player.position, label);
    if (occupant) return slotAccepts(occupant.position, src.label);
    return false;
  };

  const benchEligible = (b: RosterPlayer): boolean =>
    src?.kind === "slot" ? slotAccepts(b.position, src.label) : false;

  const chooseSlot = (label: string, occupant: RosterPlayer | undefined) => {
    if (!src) return;
    if (src.kind === "bench") {
      onStart(
        src.player.player_id,
        occupant?.player_id ?? null,
        occupant ? null : label,
        src.player.full_name,
        label,
      );
    } else if (src.player && occupant) {
      onSwap({
        aId: src.player.player_id,
        bId: occupant.player_id,
        aSlot: src.label,
        bSlot: label,
        aName: src.player.full_name,
        bName: occupant.full_name,
      });
    } else if (src.player) {
      onStart(src.player.player_id, null, label, src.player.full_name, label);
    } else if (occupant) {
      onStart(occupant.player_id, null, src.label, occupant.full_name, src.label);
    }
    setPicked(null);
  };

  const chooseBench = (b: RosterPlayer) => {
    if (src?.kind !== "slot") return;
    onStart(
      b.player_id,
      src.player?.player_id ?? null,
      src.player ? null : src.label,
      b.full_name,
      src.label,
    );
    setPicked(null);
  };

  return (
    <section className="rounded-xl bg-surface ring-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Starting lineup</h2>
        <span className="microlabel-data">
          {editable ? `Week ${team.week} · tap ⇅ to move` : `Week ${team.week}`}
        </span>
      </header>

      <ul>
        {slots.map(({ label }) => {
          const p = bySlot.get(label);
          const bye = p ? onBye(p, byes, week) : false;
          const broken = !p || isOut(p) || bye;
          const isSrc = src?.kind === "slot" && src.label === label;
          const takes = src ? slotEligible(label, p) : false;
          return (
            <li
              key={label}
              ref={(node) => {
                if (node) slotRows.current.set(label, node);
                else slotRows.current.delete(label);
              }}
              className={cn(
                "scroll-mt-20 scroll-mb-40 md:scroll-mb-24",
                "flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0",
                broken && !src && "bg-[color-mix(in_oklab,var(--alarm)_9%,transparent)]",
                // While a row is armed the board answers one question only, so
                // rows it cannot trade with recede rather than compete.
                src && !isSrc && !takes && "opacity-40",
                isSrc && "bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]",
                takes && "bg-[color-mix(in_oklab,var(--brand)_7%,transparent)]",
              )}
            >
              <span className="w-9 shrink-0 microlabel-data">{label}</span>
              {editable ? (
                <MoveButton
                  state={isSrc ? "source" : src ? (takes ? "target" : "off") : "idle"}
                  busy={busy}
                  label={
                    isSrc
                      ? "Cancel move"
                      : src
                        ? `Move here — ${p ? `swap with ${p.full_name}` : `fill ${label}`}`
                        : `Move ${p ? p.full_name : `the empty ${label} slot`}`
                  }
                  onPress={() =>
                    isSrc
                      ? cancel()
                      : src
                        ? chooseSlot(label, p)
                        : setPicked({ kind: "slot", label })
                  }
                />
              ) : null}
              {p ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
                  onPointerEnter={() => onIntentPlayer?.(p)}
                  onPointerDown={() => onIntentPlayer?.(p)}
                  onFocus={() => onIntentPlayer?.(p)}
                  // A lit row commits the move wherever you tap it; everywhere
                  // else the press keeps meaning "look at this player".
                  onClick={() => (takes && !busy ? chooseSlot(label, p) : onOpenPlayer?.(p))}
                >
                  <PlayerCell player={p} compact game={p.game} />
                </button>
              ) : takes ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => chooseSlot(label, undefined)}
                  className="min-w-0 flex-1 rounded-md text-left text-sm font-semibold text-accent-strong"
                >
                  Put here
                </button>
              ) : (
                <span className="min-w-0 flex-1 text-sm font-semibold text-loss">Empty</span>
              )}
              {bye ? <Badge tone="loss">Bye</Badge> : null}
              <Points player={p} projection={projections?.[p?.player_id ?? ""]} />
            </li>
          );
        })}
      </ul>

      <header className="border-t border-line px-5 pt-4 pb-2">
        <h3 className="microlabel">Bench</h3>
      </header>
      <ul className="pb-2">
        {bench.length === 0 ? (
          <li className="px-5 py-3 text-sm text-muted">Nobody on the bench.</li>
        ) : null}
        {bench.map((p) => {
          const isSrc = src?.kind === "bench" && src.player.player_id === p.player_id;
          const takes = src ? benchEligible(p) : false;
          const canStart = slots.some(({ label }) => slotAccepts(p.position, label));
          return (
            <li
              key={p.player_id}
              className={cn(
                "flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0",
                src && !isSrc && !takes && "opacity-40",
                isSrc && "bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]",
                takes && "bg-[color-mix(in_oklab,var(--brand)_7%,transparent)]",
              )}
            >
              <span className="w-9 shrink-0 microlabel-data">{p.position ?? ""}</span>
              {editable ? (
                canStart || takes ? (
                  <MoveButton
                    state={isSrc ? "source" : src ? (takes ? "target" : "off") : "idle"}
                    busy={busy}
                    label={
                      isSrc ? "Cancel move" : src ? `Send ${p.full_name} in` : `Move ${p.full_name}`
                    }
                    onPress={() =>
                      isSrc
                        ? cancel()
                        : src
                          ? chooseBench(p)
                          : setPicked({ kind: "bench", playerId: p.player_id })
                    }
                  />
                ) : (
                  <span className="size-8 shrink-0" />
                )
              ) : null}
              <button
                type="button"
                className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
                onPointerEnter={() => onIntentPlayer?.(p)}
                onPointerDown={() => onIntentPlayer?.(p)}
                onFocus={() => onIntentPlayer?.(p)}
                onClick={() => (takes && !busy ? chooseBench(p) : onOpenPlayer?.(p))}
              >
                <PlayerCell player={p} compact game={p.game} />
              </button>
              {onBye(p, byes, week) ? <Badge tone="loss">Bye</Badge> : null}
              <Points player={p} projection={projections?.[p.player_id]} />
            </li>
          );
        })}
      </ul>

      {/* Pinned rather than placed: the lit row can be a screen away from
          where you armed, so the way out follows you. Moves commit on the
          target press itself — this bar only narrates and cancels. */}
      {src ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex w-full max-w-md items-center gap-3 rounded-pill bg-surface px-4 py-2.5 shadow-[0_0_0_1px_var(--color-line-strong),var(--shadow-lift)]">
            <span className="min-w-0 flex-1 truncate text-sm leading-tight">
              <span className="font-semibold">
                {src.kind === "bench"
                  ? src.player.full_name
                  : (src.player?.full_name ?? `${src.label} slot`)}
              </span>
              <span className="block microlabel-data">Tap a lit row</span>
            </span>
            {src.kind === "slot" && src.player ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (src.player) onSit(src.player.player_id, src.player.full_name);
                  cancel();
                }}
                className="shrink-0 rounded-pill px-3 py-2 microlabel-data text-accent-strong shadow-[0_0_0_1px_var(--color-accent-deep)] hover:bg-raised"
              >
                To bench
              </button>
            ) : null}
            <button
              type="button"
              onClick={cancel}
              className="shrink-0 rounded-pill px-2 py-1 microlabel-data text-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The edit column. One glyph, four postures: quiet when nothing is armed,
 * filled on the row you armed, ringed on rows that can take the move, and
 * faded on rows that cannot.
 */
function MoveButton({
  state,
  busy,
  label,
  onPress,
}: {
  state: "idle" | "source" | "target" | "off";
  busy: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      disabled={state === "off" || busy}
      aria-pressed={state === "source"}
      aria-label={label}
      onClick={onPress}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-pill transition-colors duration-150",
        state === "idle" && "text-faint hover:bg-raised hover:text-fg",
        state === "source" && "bg-accent text-accent-fg",
        state === "target" &&
          "text-accent-strong shadow-[0_0_0_1px_var(--color-accent-deep)] hover:bg-raised",
        state === "off" && "text-faint opacity-50",
      )}
    >
      <ArrowUpDown className="size-4" strokeWidth={2.4} />
    </button>
  );
}

/**
 * Before kickoff there is no score to show, so an em dash reads as missing data
 * when the real answer is "hasn't happened yet". Show the projection instead,
 * dimmed and marked, and switch to the live figure the moment the ball is in
 * the air.
 */
function Points({
  player,
  projection,
}: {
  player: RosterPlayer | undefined;
  projection: Projection | undefined;
}) {
  if (!player) {
    return <span className="w-14 shrink-0 text-right font-mono text-sm text-faint">—</span>;
  }
  const started = player.game?.state === "in" || player.game?.state === "post";
  if (started && player.weekPts != null) {
    return (
      <span className="w-14 shrink-0 text-right font-mono text-sm font-semibold tabular-nums">
        {formatPts(player.weekPts, 1)}
      </span>
    );
  }
  if (!projection || projection.reason === "no-data") {
    return <span className="w-14 shrink-0 text-right font-mono text-sm text-faint">—</span>;
  }
  return (
    <span className="w-14 shrink-0 text-right">
      <span className="block font-mono text-sm tabular-nums text-muted">
        {formatPts(projection.points, 1)}
      </span>
      <span className="block microlabel-data">
        {projection.reason === "bye" ? "bye" : projection.reason === "out" ? "out" : "proj"}
      </span>
    </span>
  );
}

const OUT = new Set(["out", "ir", "doubtful", "suspended", "pup", "na"]);
function isOut(p: RosterPlayer): boolean {
  const s = (p.injury_status ?? p.status ?? "").toLowerCase().trim();
  return s.length > 0 && OUT.has(s);
}
