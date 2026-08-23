import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LiveLine } from "@/components/live-line";
import { Button } from "@/components/ui/button";
import { getTicks } from "@/lib/data/fns";
import { isHostedLeague } from "@/lib/data/types";
import type { BookBundle } from "@/lib/league/book.server";
import { placeWager } from "@/lib/league/fns";
import { fmtSpread, spreadPoints, spreadSummary } from "@/lib/live/spread-series";
import { cn } from "@/lib/utils";

/**
 * Staking FAAB on a matchup.
 *
 * The same instrument as the claim dialog on purpose: nothing pre-fills the
 * amount, a hard stop over what you hold, and a soft warning where the
 * consequence is real but the call is yours. Betting and bidding spend the same
 * money, so they should not feel like different machines.
 */

export type TicketTarget = {
  matchupId: number;
  kind: "spread" | "moneyline";
  sideRoster: number;
  sideName: string;
  againstName: string;
  /** The quoted number, stored with the wager so settlement cannot drift. */
  line: number;
  /** Profit per dollar staked. 1 on a spread, which is built to be a coin flip. */
  mult: number;
  /** What the button said, e.g. "−13.5" or "71%". */
  priceLabel: string;
  ownGame: boolean;
};

export function WagerTicket({
  open,
  onOpenChange,
  leagueId,
  week,
  target,
  book,
  /** Total already committed to pending waiver claims, for the collision warning. */
  claimsPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  week?: number;
  target: TicketTarget | null;
  book: BookBundle;
  claimsPending: number;
}) {
  const qc = useQueryClient();
  const [stake, setStake] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (open) {
      setStake(null);
      setFailure(null);
      setPlaced(false);
    }
  }, [open]);

  // Same query key as `LinePanel` so the two share one cache entry.
  const ticks = useQuery({
    queryKey: ["ticks", leagueId, week, target?.matchupId],
    queryFn: () =>
      getTicks({ data: { leagueId, week: week ?? 0, matchupId: target?.matchupId ?? 0 } }),
    enabled: Boolean(leagueId) && week != null && target != null && isHostedLeague(leagueId),
    staleTime: 30_000,
  });
  const pts = spreadPoints(ticks.data ?? []);
  const sum = spreadSummary(pts);

  const submit = useMutation({
    mutationFn: () =>
      placeWager({
        data: {
          leagueId,
          matchupId: target?.matchupId ?? 0,
          kind: target?.kind ?? "spread",
          sideRoster: target?.sideRoster ?? 0,
          line: target?.line ?? 0,
          stake: stake ?? 0,
        },
      }),
    onSuccess: () => {
      setPlaced(true);
      for (const key of ["book", "league", "team"]) {
        void qc.invalidateQueries({ queryKey: [key, leagueId] });
      }
      toast(`$${stake} on ${target?.sideName ?? "it"}.`);
      window.setTimeout(() => onOpenChange(false), 700);
    },
    onError: (e) => setFailure(e instanceof Error ? e.message : "That did not go through."),
  });

  if (!target) return null;

  const free = book.purse.free;
  const left = free - (stake ?? 0);
  const overFree = stake != null && stake > free;
  const overCap = stake != null && stake > book.caps.wager;
  const overExposure = stake != null && book.purse.atRisk + stake > book.caps.exposure;
  const noStake = stake == null;
  const blocked = overFree || overCap || overExposure || noStake;
  // A stake does not take money from a queued claim — claims are only checked
  // on waiver day, against whatever is left by then. Which is exactly why it is
  // worth saying out loud here.
  const strands = !blocked && claimsPending > 0 && left < claimsPending;

  const label = placed
    ? "Wager placed"
    : submit.isPending
      ? "Placing…"
      : noStake
        ? "Enter a stake"
        : overFree
          ? "Over your balance"
          : overCap
            ? `Cap is $${book.caps.wager}`
            : overExposure
              ? `Over the $${book.caps.exposure} exposure cap`
              : "Place the wager";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-fg/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-line-strong)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
            <div className="min-w-0">
              <Dialog.Title asChild>
                <span className="block truncate font-display text-base font-bold tracking-[-0.02em]">
                  {target.sideName} {target.priceLabel}
                </span>
              </Dialog.Title>
              <Dialog.Description asChild>
                <span className="block truncate microlabel-data">
                  vs {target.againstName} · week {book.week}
                </span>
              </Dialog.Description>
            </div>
            {target.ownGame ? (
              <span className="shrink-0 rounded-pill bg-highlight px-2.5 py-1 microlabel-data text-accent-fg">
                your game
              </span>
            ) : null}
          </header>

          {failure ? (
            <p className="flex gap-2 border-b border-line bg-loss/10 px-5 py-3 text-sm text-loss">
              <span aria-hidden>⚠</span>
              <span>{failure}</span>
            </p>
          ) : null}
          {strands ? (
            <p className="flex gap-2 border-b border-line bg-loss/10 px-5 py-3 text-sm text-loss">
              <span aria-hidden>⚠</span>
              <span>
                This leaves ${left} for waivers. Your ${claimsPending} in pending claims would not
                all clear.
              </span>
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-line px-5 py-4">
              {sum ? (
                <div className="mb-3">
                  <span className="microlabel-data">
                    opened {fmtSpread(sum.first)} · now {fmtSpread(sum.last)}
                  </span>
                  <LiveLine
                    series={pts}
                    value={sum.last}
                    tone="brand"
                    height={48}
                    quiet
                    smooth={false}
                    windowSecs={43200}
                    formatValue={fmtSpread}
                    padding={{ top: 6, right: 8, bottom: 2, left: 0 }}
                    ariaLabel="Spread today"
                  />
                </div>
              ) : null}
              <span className="microlabel-data">Your stake</span>
              <div className="mt-2.5 flex items-center gap-3">
                <StepButton
                  label="Lower stake"
                  disabled={!stake}
                  onClick={() => setStake(Math.max(0, (stake ?? 0) - 1))}
                >
                  −
                </StepButton>
                <div
                  className={cn(
                    "flex items-baseline rounded-md bg-raised px-3.5 py-1.5 ring-card focus-within:shadow-[0_0_0_1px_var(--color-accent-deep)]",
                    (overFree || overCap || overExposure) && "shadow-[0_0_0_1px_var(--color-loss)]",
                  )}
                >
                  <span className="font-mono text-xl font-bold text-faint">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    aria-label="Stake in FAAB dollars"
                    data-testid="wager-stake"
                    value={stake == null ? "" : String(stake)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                      setStake(digits === "" ? null : Number(digits));
                    }}
                    className={cn(
                      "w-[3.4ch] bg-transparent font-mono text-2xl font-bold tabular-nums tracking-[-0.03em] outline-none placeholder:text-faint/60",
                      (overFree || overCap || overExposure) && "text-loss",
                    )}
                  />
                </div>
                <StepButton label="Raise stake" onClick={() => setStake((stake ?? 0) + 1)}>
                  +
                </StepButton>
              </div>
              <p className="mt-2 text-xs text-faint">
                {target.mult === 1
                  ? "Even money — a spread is built to be a coin flip."
                  : target.mult > 1
                    ? `Pays ${target.mult}× your stake. You are taking the underdog.`
                    : `Pays ${target.mult}× your stake. You are taking the favourite.`}{" "}
                Cap is ${book.caps.wager} a wager, ${book.caps.exposure} at risk at once.
              </p>
            </section>
          </div>

          <footer className="px-5 pt-4 pb-5">
            <dl className="mb-3">
              <Line k="FAAB free" v={`$${free}`} />
              <Line k="This stake" v={`−$${stake ?? 0}`} />
              <Line
                k="Pays if it lands"
                v={`+$${Math.floor((stake ?? 0) * target.mult)}`}
                tone="win"
              />
              <Line
                k="Left for waivers"
                v={`$${Math.max(0, left)}`}
                tone={strands || overFree ? "loss" : undefined}
                total
              />
            </dl>
            {book.pool.balance < book.pool.committed ? (
              <p className="mb-3 text-xs text-faint">
                The pool holds ${book.pool.balance} against ${book.pool.committed} committed. If
                every open wager wins, payouts scale down.
              </p>
            ) : null}
            <Button
              className="w-full"
              data-testid="wager-submit"
              disabled={blocked || submit.isPending || placed}
              onClick={() => submit.mutate()}
            >
              {placed ? `✓ ${label}` : label}
            </Button>
            <p className="mt-2 text-center text-xs text-faint">
              Held the moment you place it. The book closes after the last refresh.
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

function Line({
  k,
  v,
  tone,
  total,
}: {
  k: string;
  v: string;
  tone?: "loss" | "win";
  total?: boolean;
}) {
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
          tone === "win" && "text-accent-strong",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
