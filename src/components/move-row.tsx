import { ArrowDown, ArrowLeftRight } from "lucide-react";
import type { ActivityItem } from "@/lib/data/types";
import { cn, elapsedShort } from "@/lib/utils";

/**
 * One settled move, read in a glance.
 *
 * Two marks, each doing exactly one job. The glyph says which way the player
 * went — `+` arrived, `⇄` came from a deal, `↓` left. The tile behind it says
 * how you got him: filled for a waiver, neutral for a trade, dashed and empty
 * for a free agent, nothing at all for a drop. Splitting the two is what let
 * the kind-specific icons go; a gavel and a lightning bolt were each trying to
 * carry both facts and carrying neither clearly.
 *
 * The tile keys off the kind, never the amount. A waiver won at $0 is still a
 * waiver — it cleared the Wednesday run and beat whoever else was in — and
 * must not render as the free agent someone grabbed off the wire on a Tuesday.
 * For the same reason the price shows whenever a bid exists, including zero.
 */

type Kind = "waiver" | "free_agent" | "trade" | "drop";

function kindOf(type: string): Kind {
  if (type === "waiver" || type === "free_agent" || type === "trade") return type;
  return "drop";
}

const LABEL: Record<Kind, string> = {
  waiver: "Waiver",
  free_agent: "Free",
  trade: "Trade",
  drop: "Drop",
};

const TILE: Record<Kind, string> = {
  waiver: "bg-accent/35 text-accent-fg",
  trade: "bg-raised text-fg",
  free_agent: "border border-dashed border-line-strong text-accent-strong",
  drop: "text-faint",
};

const CHIP: Record<Kind, string> = {
  waiver: "bg-accent/30 text-accent-fg",
  trade: "bg-raised text-muted",
  free_agent: "shadow-[inset_0_0_0_1px_var(--color-line-strong)] text-muted",
  drop: "text-faint",
};

export function MoveRow({ move }: { move: ActivityItem }) {
  const kind = kindOf(move.type);
  const add = move.adds[0] ?? null;
  const drop = move.drops[0] ?? null;
  // A drop has nothing arriving, so the player who left is the headline.
  const lead = add ?? drop;
  if (!lead) return null;
  const secondary = add && drop ? drop : null;
  const when = elapsedShort(move.created);

  return (
    <li className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
      <span
        aria-hidden
        className={cn("grid size-7 shrink-0 place-items-center rounded-xs", TILE[kind])}
      >
        {kind === "trade" ? (
          <ArrowLeftRight className="size-3.5" strokeWidth={2} />
        ) : kind === "drop" ? (
          <ArrowDown className="size-3.5" strokeWidth={2} />
        ) : (
          <span className="font-mono text-sm leading-none">+</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "truncate text-[13.5px] font-semibold tracking-[-0.01em]",
              !add && "font-normal text-muted",
            )}
          >
            {lead.name}
          </span>
          {lead.pos ? (
            <span className="inline-flex h-4 shrink-0 items-center rounded-xs bg-raised px-1.5 font-mono text-[9.5px] tracking-[0.06em] text-muted">
              {lead.pos}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex h-4 shrink-0 items-center rounded-xs px-1.5 microlabel-data",
              CHIP[kind],
            )}
          >
            {LABEL[kind]}
          </span>
        </span>
        {secondary ? (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="font-mono text-faint">
              &minus;
            </span>
            <span className="truncate text-[13.5px] text-muted">{secondary.name}</span>
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        {/* Zero is a real winning bid, so only null means "no price". */}
        <span className="block font-mono text-[13px] tabular-nums">
          {move.bid != null ? `$${move.bid}` : <span className="text-faint">&mdash;</span>}
        </span>
        {when ? (
          <span className="mt-0.5 block font-mono text-[10px] text-faint">{when}</span>
        ) : null}
      </span>
    </li>
  );
}
