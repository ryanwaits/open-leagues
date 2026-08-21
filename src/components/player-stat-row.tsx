import { PlayerCell } from "@/components/player-cell";
import type { SlimPlayer } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

/**
 * A player, with the numbers you need to judge him.
 *
 * The trade desk used to render a name and a position, which is not enough to
 * decide anything — so people left the page to look a player up and came back
 * to a cleared form. Every figure here is already computed for another surface:
 * the projection from getProjections, per-game and rank from the player
 * profile, the weekly shape from its `weekly` series.
 *
 * Presentational only. It fetches nothing; the caller supplies the data.
 */
export type PlayerStatRowData = {
  player: SlimPlayer;
  /** This week, under the league's book. */
  projection?: number | null;
  /** True when `projection` is a season average rather than a forecast. */
  projectionIsAverage?: boolean;
  perGame?: number | null;
  /** e.g. "WR2". */
  posRank?: string | null;
  /** Up to 8 recent weeks; null is a week with no game. */
  weekly?: (number | null)[];
  byeWeek?: number | null;
};

export function PlayerStatRow({
  data,
  selected = false,
  onSelect,
  onPeek,
  dense = false,
}: {
  data: PlayerStatRowData;
  selected?: boolean;
  onSelect?: () => void;
  onPeek?: () => void;
  dense?: boolean;
}) {
  const rowAction = onSelect ?? onPeek;
  // Two targets only when both handlers exist; otherwise the whole row shares
  // the single callback and the avatar does not need its own hit target.
  const avatarPeek = onSelect && onPeek ? onPeek : undefined;
  const interactive = Boolean(rowAction);

  const weekly = data.weekly ?? [];
  const showSpark = !dense;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role/tabIndex/onKeyDown are added whenever onClick is (see `interactive` above); can't be a real <button> because it can nest its own "Peek" button (avatarPeek) as a descendant
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={rowAction}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                rowAction?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left",
        selected ? "bg-accent text-accent-fg" : interactive && "hover:bg-raised",
        interactive &&
          "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep",
      )}
    >
      <div className="relative min-w-0 flex-1">
        {avatarPeek ? (
          <button
            type="button"
            aria-label={`Peek ${data.player.full_name}`}
            className={cn(
              "absolute top-1/2 left-0 z-10 -translate-y-1/2 rounded-pill",
              dense ? "size-8" : "size-9",
            )}
            onClick={(e) => {
              e.stopPropagation();
              avatarPeek();
            }}
          />
        ) : null}
        <PlayerCell player={data.player} compact={dense} />
        {data.byeWeek != null ? (
          <div className={cn("mt-0.5", dense ? "pl-10" : "pl-[2.875rem]")}>
            <span className="rounded-pill bg-raised px-1.5 py-0.5 microlabel-data">
              BYE {data.byeWeek}
            </span>
          </div>
        ) : null}
      </div>

      {showSpark ? <Sparkline weekly={weekly} /> : null}

      <div className="w-10 shrink-0 text-right">
        <span
          className={cn(
            "block font-mono text-sm tabular-nums",
            data.projectionIsAverage && !selected && "text-muted",
          )}
        >
          {formatPts(data.projection, 1)}
        </span>
        <span className="block microlabel-data">{data.projectionIsAverage ? "AVG" : "PROJ"}</span>
      </div>

      {data.posRank ? (
        <span
          className={cn(
            "shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
            isEliteRank(data.posRank) ? "bg-highlight text-accent-fg" : "bg-raised text-muted",
          )}
        >
          {data.posRank}
        </span>
      ) : (
        <span className="w-8 shrink-0" aria-hidden />
      )}
    </div>
  );
}

/** Last 8 weeks as plain bars — shape only, no axes. */
function Sparkline({ weekly }: { weekly: (number | null)[] }) {
  const window = weekly.slice(-8);
  // Empty series still reserves the slot so row height stays steady in a list.
  if (window.length === 0) {
    return <span className="inline-block h-[18px] w-11 shrink-0" aria-hidden />;
  }
  const max = Math.max(1, ...window.map((v) => v ?? 0));
  return (
    <span className="inline-flex h-[18px] w-11 shrink-0 items-end gap-px" aria-hidden>
      {window.map((v, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length sparkline bars, no identity beyond position
          key={i}
          className={cn(
            "min-w-[3px] flex-1 rounded-xs",
            v == null ? "bg-line-strong" : "bg-accent-strong",
          )}
          style={{
            // px heights — % height on flex children is unreliable here
            height: v == null ? 7 : Math.max(3, Math.round((v / max) * 18)),
          }}
        />
      ))}
    </span>
  );
}

/** Elite depth for the chip highlight: QB1–6, RB1–9, WR1–9, TE1–5. */
function isEliteRank(rank: string): boolean {
  const m = /^([A-Za-z]+)(\d+)$/.exec(rank.trim());
  if (!m) return false;
  const pos = m[1]!.toUpperCase();
  const n = Number(m[2]);
  const cap = ({ QB: 6, RB: 9, WR: 9, TE: 5 } as Record<string, number>)[pos];
  return cap != null && n >= 1 && n <= cap;
}
