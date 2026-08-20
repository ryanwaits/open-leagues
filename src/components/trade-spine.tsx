import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type TradeOffer, tradeAssetLabel } from "@/components/trade-offer-card";
import { Button } from "@/components/ui/button";
import { cn, joinBits } from "@/lib/utils";

/**
 * An open offer, said the way you would say it out loud: Pollard for McCaffrey.
 *
 * This is the roster page's read on the trade book, not a second trade desk.
 * You are already looking at your own team, so your team name is the one word
 * the row never needs — the old card spent four of its six lines repeating it.
 * What is left is the swap, who it is with, and whose turn it is.
 *
 * The turn is the whole point, so it decides the row: an offer waiting on you
 * carries its buttons in the open, and an offer you sent carries the only move
 * you actually have, which is to take it back. Everything else — the projection
 * delta, the depth chart after, the sentence about it — lives on the trade desk
 * one tap away, because it is not what you came to this card for.
 */
export function TradeSpineRow({
  trade,
  myRosterId,
  leagueId,
  busy = false,
  onAccept,
  onDecline,
  onCounter,
  onWithdraw,
}: {
  trade: TradeOffer;
  myRosterId: number | null;
  leagueId: string;
  busy?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
  onWithdraw?: () => void;
}) {
  const mySide =
    myRosterId != null ? trade.sides.find((s) => s.rosterId === myRosterId) : undefined;
  const yourMove = trade.status === "proposed" && Boolean(mySide && !mySide.accepted);

  const give = trade.assets.filter((a) => a.fromRoster === myRosterId).map(tradeAssetLabel);
  const get = trade.assets.filter((a) => a.toRoster === myRosterId).map(tradeAssetLabel);

  const others = trade.sides.filter((s) => s.rosterId !== myRosterId).map((s) => s.teamName);
  const withWhom = others.length ? joinBits(others) : "the house";

  // Accepting is only ever yours to do when the offer is pointed at you; the
  // side that sent it has already said yes by sending it.
  const canDecide = yourMove && Boolean(onAccept && onDecline);
  const actions = canDecide || Boolean(onWithdraw);

  return (
    <li className="border-b border-line last:border-0">
      <Link
        to="/league/$leagueId/trades"
        params={{ leagueId }}
        className="flex w-full items-center gap-3 px-5 py-3 transition-colors duration-150 ease-out hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm tracking-[-0.01em]">
            {give.length ? <span className="text-muted">{joinBits(give)}</span> : null}
            {give.length && get.length ? (
              <span aria-hidden className="mx-1.5 text-line-strong">
                &rarr;
              </span>
            ) : null}
            {get.length ? <span className="font-bold">{joinBits(get)}</span> : null}
            {!give.length && !get.length ? <span className="text-muted">No assets</span> : null}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-pill",
                yourMove ? "bg-accent-deep" : "bg-line-strong",
              )}
            />
            <span className="truncate microlabel-data">
              {withWhom} &middot; {yourMove ? "your move" : "their move"}
            </span>
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" strokeWidth={2.2} />
      </Link>

      {/* pt-3 keeps the buttons off the hover fill, which ends at the row's own
          padding and otherwise runs straight into them. */}
      {actions ? (
        <div className="flex flex-wrap gap-2 px-5 pt-3 pb-4">
          {canDecide ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={onAccept}>
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-loss"
                disabled={busy}
                onClick={onDecline}
              >
                Decline
              </Button>
              {onCounter ? (
                <Button type="button" size="sm" variant="muted" disabled={busy} onClick={onCounter}>
                  Counter
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onWithdraw}>
              Withdraw
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
