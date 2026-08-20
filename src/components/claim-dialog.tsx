import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import type { RosterPlayer, SlimPlayer } from "@/lib/data/types";
import { addDrop, dropPlayer } from "@/lib/league/fns";
import { invalidateAfterRosterMove } from "@/lib/league/lineup-cache";
import { cn } from "@/lib/utils";

/**
 * Adding a player, in one place.
 *
 * The wire used to keep a single bid and a single drop at the top of the page
 * and apply them to whichever row you pressed next, which meant the amount you
 * were about to spend was never next to the player you were spending it on.
 * Here the price, the drop and the arithmetic all belong to one claim, and
 * nothing leaves until you sign it.
 *
 * Nothing pre-fills the bid. The app has no basis for guessing what a player is
 * worth to you, and a number it puts in the box is a number it is recommending.
 */

export type ClaimMode =
  /** Waivers are open: this queues a claim that settles on the process day. */
  | "claim"
  /** Waivers are closed or the league has none: the add happens immediately. */
  | "add";

export type ClaimTarget = {
  player: SlimPlayer;
  name: string;
  headshot: string | null;
  /** Drop is a player you already hold — no add, no bid. */
  action?: "add" | "drop";
  /** This player sits on waivers even if the weekly leftover pool is FA. */
  onWaivers?: boolean;
};

export function ClaimDialog({
  open,
  onOpenChange,
  leagueId,
  target,
  mode,
  /** "faab" spends money, "rolling" spends your place in line, "none" spends nothing. */
  waiverType,
  faabRemaining,
  waiverPos,
  /** Bench and starters you could send away; empty when nobody has to go. */
  droppable,
  /** True when the roster is at its cap, so the server will demand a drop. */
  mustDrop,
  rosterCount,
  rosterCap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  target: ClaimTarget | null;
  mode: ClaimMode;
  waiverType: string;
  faabRemaining: number;
  waiverPos: number | null;
  droppable: RosterPlayer[];
  mustDrop: boolean;
  /** Shown so the count is visible rather than merely asserted. */
  rosterCount?: number;
  rosterCap?: number;
}) {
  const qc = useQueryClient();
  // null is "you have not named a price yet", which is different from $0.
  const [bid, setBid] = useState<number | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  const money = mode === "claim" && waiverType === "faab";

  // A fresh dialog every time it opens — a bid left over from the last player
  // is exactly the kind of carried-over state this component exists to kill.
  useEffect(() => {
    if (open) {
      setBid(null);
      setDropId(null);
      setFailure(null);
      setPlaced(false);
    }
  }, [open]);

  const dropping = target?.action === "drop";

  const submit = useMutation({
    mutationFn: async (): Promise<{ mode: "drop" | "claim" | "free_agent" }> => {
      if (dropping) {
        await dropPlayer({
          data: { leagueId, playerId: target?.player.player_id ?? "" },
        });
        return { mode: "drop" };
      }
      return addDrop({
        data: { leagueId, addId: target?.player.player_id ?? "", dropId, bid: bid ?? 0 },
      });
    },
    onSuccess: (res) => {
      setPlaced(true);
      void invalidateAfterRosterMove(qc, leagueId);
      void qc.invalidateQueries({ queryKey: ["player", leagueId] });
      void qc.invalidateQueries({ queryKey: ["player-profile", leagueId] });
      toast(
        res.mode === "drop"
          ? `Dropped ${target?.name ?? "him"}.`
          : res.mode === "claim"
            ? money
              ? `Bid $${bid ?? 0} on ${target?.name ?? "him"}.`
              : `Claim in for ${target?.name ?? "him"}.`
            : `Added ${target?.name ?? "him"}.`,
      );
      // Hold the confirmation long enough to read the number you committed to.
      window.setTimeout(() => onOpenChange(false), 700);
    },
    onError: (e) => setFailure(e instanceof Error ? e.message : "That did not go through."),
  });

  if (!target) return null;

  const overBudget = !dropping && money && bid != null && bid > faabRemaining;
  const noBid = !dropping && money && bid == null;
  const needDrop = !dropping && mustDrop && !dropId;
  const blocked = overBudget || noBid || needDrop;

  const verb = dropping
    ? "Drop"
    : mode === "add"
      ? "Add"
      : money
        ? "Place bid"
        : "Put in the claim";
  const label = placed
    ? dropping
      ? "Dropped"
      : mode === "add"
        ? "Added"
        : "Bid placed"
    : submit.isPending
      ? dropping
        ? "Dropping…"
        : "Placing…"
      : noBid
        ? "Enter a bid"
        : overBudget
          ? "Over your budget"
          : needDrop
            ? "Pick someone to drop"
            : verb;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lift)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={target.headshot} name={target.name} className="size-10" />
              <div className="min-w-0">
                <Dialog.Title asChild>
                  <span className="block truncate font-display text-base font-bold tracking-[-0.02em]">
                    {target.name}
                  </span>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <span className="block truncate microlabel-data">
                    {[target.player.position, target.player.team].filter(Boolean).join(" · ")}
                  </span>
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                Esc
              </Button>
            </Dialog.Close>
          </header>

          {failure ? (
            <p className="flex gap-2 border-b border-line bg-loss/10 px-5 py-3 text-sm text-loss">
              <span aria-hidden>⚠</span>
              <span>{failure}</span>
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {dropping ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">Drop</span>
                <p className="mt-1.5 text-sm text-muted">
                  {waiverType === "none"
                    ? "He becomes a free agent. Anyone can add him."
                    : "He hits waivers. The next run is when someone can claim him."}
                </p>
              </section>
            ) : money ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">Your bid</span>
                <div className="mt-2.5 flex items-center gap-3">
                  <StepButton
                    label="Lower bid"
                    disabled={!bid}
                    onClick={() => setBid(Math.max(0, (bid ?? 0) - 1))}
                  >
                    −
                  </StepButton>
                  <div
                    className={cn(
                      "flex items-baseline rounded-md bg-raised px-3.5 py-1.5 ring-card focus-within:shadow-[0_0_0_1px_var(--color-accent-deep)]",
                      overBudget && "shadow-[0_0_0_1px_var(--color-loss)]",
                    )}
                  >
                    <span className="font-mono text-xl font-bold text-faint">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      aria-label="Bid amount in FAAB dollars"
                      value={bid == null ? "" : String(bid)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                        setBid(digits === "" ? null : Number(digits));
                      }}
                      className={cn(
                        "w-[3.4ch] bg-transparent font-mono text-2xl font-bold tabular-nums tracking-[-0.03em] outline-none placeholder:text-faint/60",
                        overBudget && "text-loss",
                      )}
                    />
                  </div>
                  <StepButton label="Raise bid" onClick={() => setBid((bid ?? 0) + 1)}>
                    +
                  </StepButton>
                </div>
                <p className={cn("mt-2 text-xs", overBudget ? "text-loss" : "text-faint")}>
                  {overBudget
                    ? `You only have $${faabRemaining}.`
                    : "Highest bid wins. Ties go to reverse standings."}
                </p>
              </section>
            ) : mode === "claim" ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">Waiver priority</span>
                <p className="mt-1.5 font-mono text-2xl font-bold tracking-[-0.03em]">
                  {waiverPos ? `#${waiverPos}` : "—"}
                </p>
                <p className="mt-1 text-xs text-faint">
                  No money in this league. Winning sends you to the back of the order.
                </p>
              </section>
            ) : null}

            {!dropping && droppable.length > 0 ? (
              <section className="border-b border-line px-5 py-4">
                <span className="microlabel-data">
                  {mustDrop ? "Drop someone" : "Drop someone (optional)"}
                </span>
                {rosterCap ? (
                  <span className="mt-0.5 block font-mono text-[10px] text-faint">
                    {rosterCount} of {rosterCap} spots used
                  </span>
                ) : null}
                <div className="mt-2 flex flex-col gap-0.5">
                  {!mustDrop ? (
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-2.5 py-2 transition-colors duration-150",
                        dropId == null
                          ? "border-accent-deep bg-raised"
                          : "border-transparent hover:bg-raised",
                      )}
                    >
                      <input
                        type="radio"
                        name="claim-drop"
                        className="sr-only"
                        checked={dropId == null}
                        onChange={() => setDropId(null)}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 rounded-pill border-2",
                          dropId == null
                            ? "border-accent-deep bg-accent-deep shadow-[inset_0_0_0_3px_var(--color-surface)]"
                            : "border-line-strong",
                        )}
                      />
                      <span className="flex-1 text-sm font-medium">Nobody — I have room</span>
                    </label>
                  ) : null}
                  {droppable.map((p) => {
                    const on = dropId === p.player_id;
                    return (
                      <label
                        key={p.player_id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border px-2.5 py-2 transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-deep",
                          on
                            ? "border-accent-deep bg-raised"
                            : "border-transparent hover:bg-raised",
                        )}
                      >
                        <input
                          type="radio"
                          name="claim-drop"
                          className="sr-only"
                          checked={on}
                          onChange={() => setDropId(p.player_id)}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 rounded-pill border-2",
                            on
                              ? "border-accent-deep bg-accent-deep shadow-[inset_0_0_0_3px_var(--color-surface)]"
                              : "border-line-strong",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.full_name}
                        </span>
                        <span className="shrink-0 microlabel-data">
                          {[p.position, p.team].filter(Boolean).join(" · ")}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {needDrop ? (
                  <p className="mt-2 text-xs text-loss">Pick who leaves before this can go in.</p>
                ) : null}
              </section>
            ) : null}
          </div>

          <footer className="px-5 pt-4 pb-5">
            {!dropping && money ? (
              <dl className="mb-3">
                <Line k="FAAB left" v={`$${faabRemaining}`} />
                <Line k="This bid" v={`−$${bid ?? 0}`} />
                <Line
                  k="Left if you win"
                  v={`$${faabRemaining - (bid ?? 0)}`}
                  tone={overBudget ? "loss" : undefined}
                  total
                />
              </dl>
            ) : null}
            <Button
              className="w-full"
              disabled={blocked || submit.isPending || placed}
              onClick={() => submit.mutate()}
            >
              {placed ? `✓ ${label}` : label}
            </Button>
            <p className="mt-2 text-center text-xs text-faint">
              {dropping || mode === "add"
                ? "Takes effect right away."
                : "Processes on waiver day. Pull it any time before then."}
            </p>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-pill text-lg font-bold ring-card transition-colors duration-150 hover:bg-raised disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Line({ k, v, tone, total }: { k: string; v: string; tone?: "loss"; total?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-0.5 text-sm",
        total && "mt-1.5 border-t border-line pt-2",
      )}
    >
      <dt className="text-muted">{k}</dt>
      <dd
        className={cn(
          "font-mono font-semibold tabular-nums",
          total && "text-base",
          tone === "loss" && "text-loss",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
