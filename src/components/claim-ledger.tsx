import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A claim you have in, as the two-sided fact it actually is.
 *
 * The old row shouted the dropped player's name in uppercase mono, which made
 * a person read like a machine token and let him outweigh the player you are
 * actually bidding on. So the add is the headline and the drop is the cost,
 * set below it in sentence case.
 *
 * The number that decides a blind bid is not the bid — it is how many other
 * managers are in on the same player. That count is already in the claims
 * payload and was being discarded. Their amounts stay hidden, because those
 * are sealed; the count is not.
 *
 * Withdraw hides until you want it. Every claim can be withdrawn, so a labeled
 * button on every row is the same button three times over — unlike a trade,
 * where the action is contextual and earns its label.
 */

export type WaiverClaim = {
  id: string;
  add: { id: string; name: string; pos: string | null };
  drop: { id: string; name: string; pos: string | null } | null;
  bid: number | null;
  status: string;
};

export function ClaimLedgerRow({
  claim,
  contenders = 0,
  showBid = true,
  busy = false,
  onWithdraw,
}: {
  claim: WaiverClaim;
  /** Other managers with a pending claim on the same player. */
  contenders?: number;
  /** Only FAAB leagues bid; elsewhere the figure means nothing. */
  showBid?: boolean;
  busy?: boolean;
  onWithdraw?: () => void;
}) {
  return (
    <li className="group border-b border-line last:border-0">
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold tracking-[-0.01em]">{claim.add.name}</span>
            {claim.add.pos ? (
              <span className="inline-flex h-4 shrink-0 items-center rounded-xs bg-raised px-1.5 font-mono text-[9.5px] tracking-[0.06em] text-muted">
                {claim.add.pos}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">
            {claim.drop ? (
              <>
                <span className="font-mono text-faint">&minus;</span> {claim.drop.name}
              </>
            ) : (
              "no drop"
            )}
            {contenders > 0 ? (
              <span className="text-warn">
                {" · "}
                {contenders} other{contenders === 1 ? "" : "s"} in
              </span>
            ) : null}
          </span>
        </span>

        {showBid && claim.bid != null ? (
          <span className="shrink-0 font-mono text-[15px] tabular-nums">${claim.bid}</span>
        ) : null}

        {onWithdraw ? (
          <button
            type="button"
            aria-label={`Withdraw claim for ${claim.add.name}`}
            disabled={busy}
            onClick={onWithdraw}
            // Revealed on intent, but a coarse pointer has no hover to reveal
            // it with, so touch always sees it.
            className="grid size-9 shrink-0 place-items-center rounded-pill text-faint opacity-0 transition-[opacity,background-color,color] duration-150 ease-out group-hover:opacity-100 hover:bg-raised hover:text-loss focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep [@media(pointer:coarse)]:opacity-100"
          >
            <X aria-hidden className="size-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The card's standing line: whether claims will process at all, and what your
 * open bids have committed. A claims card that cannot say "open" is asking you
 * to trust that the queue is live.
 */
export function ClaimLedgerFoot({
  open,
  week,
  staked,
  spendable,
  showMoney = true,
}: {
  open: boolean;
  week: number;
  /** Dollars committed across your pending claims. */
  staked: number;
  /** Budget left after wagers already at risk. */
  spendable: number;
  showMoney?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-5 py-3">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-pill", open ? "bg-accent-deep" : "bg-line-strong")}
        />
        <span className="microlabel-data">
          {open ? "Open" : "Closed"} &middot; week {week}
        </span>
      </span>
      {showMoney ? (
        <span className="microlabel-data">
          ${staked} in claims &middot; ${spendable} left
        </span>
      ) : null}
    </div>
  );
}
