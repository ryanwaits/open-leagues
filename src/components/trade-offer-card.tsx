import { formatDistanceToNow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { PlayerStatRow, type PlayerStatRowData } from "@/components/player-stat-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Projection, RosterPlayer, SlimPlayer } from "@/lib/data/types";
import type { TradeDelta } from "@/lib/league/lineup-value";
import { readTrade } from "@/lib/league/trade-read";
import { cn, joinBits, lastName } from "@/lib/utils";

/**
 * An offer, collapsed to a line you can scan and opened to the facts that
 * decide it.
 *
 * The book is a log: most of what is in it is settled, and a settled deal does
 * not need two columns of faces and a bar chart. So the row carries the four
 * things that tell you whether to look — who, what for what, what it does to
 * your starters, and where it stands — and everything else waits behind a tap.
 * The one offer actually waiting on you opens itself, because that is the row
 * you came for.
 *
 * Inside the expansion: what you get comes first because that is what you
 * opened it for; what it costs is a column, not a footnote; and the position
 * depth before and after is the fact that actually decides it.
 */

export type TradeOfferAsset = {
  fromRoster: number;
  toRoster: number;
  fromName: string;
  toName: string;
  kind: string;
  playerId: string | null;
  playerName: string | null;
  pos: string | null;
  pickNo: number | null;
  pickLabel: string | null;
  amount?: number | null;
};

export type TradeOffer = {
  id: string;
  week: number;
  status: string;
  proposerRoster: number;
  created: number;
  sides: Array<{
    rosterId: number;
    teamName: string;
    accepted: boolean;
    house: boolean;
  }>;
  assets: TradeOfferAsset[];
};

export function TradeOfferCard({
  trade,
  myRosterId,
  delta,
  projections,
  playerById,
  posBefore,
  posAfter,
  byes,
  onAccept,
  onDecline,
  onCounter,
  onPull,
  onAcceptHouse,
  busy = false,
}: {
  trade: TradeOffer;
  myRosterId: number | null;
  delta: TradeDelta | null;
  projections?: Record<string, Projection>;
  /** Roster players keyed by id — used to fill PlayerStatRow. */
  playerById?: Map<string, SlimPlayer>;
  /** Position depth counts on your roster before / after the swap. */
  posBefore?: Record<string, number>;
  posAfter?: Record<string, number>;
  /** Team → bye week; optional caveat for the read line. */
  byes?: Record<string, number>;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
  onPull?: () => void;
  onAcceptHouse?: () => void;
  busy?: boolean;
}) {
  const proposer =
    trade.sides.find((s) => s.rosterId === trade.proposerRoster)?.teamName ??
    `Team ${trade.proposerRoster}`;
  const mySide =
    myRosterId != null ? trade.sides.find((s) => s.rosterId === myRosterId) : undefined;
  const waitingOnMe = trade.status === "proposed" && Boolean(mySide && !mySide.accepted);
  const waitingNames = trade.sides.filter((s) => !s.accepted).map((s) => s.teamName);
  const involved = Boolean(mySide);

  const incoming = involved ? trade.assets.filter((a) => a.toRoster === myRosterId) : trade.assets;
  const outgoing = involved ? trade.assets.filter((a) => a.fromRoster === myRosterId) : [];

  const incomingPlayers = assetsToPlayers(incoming, playerById);
  const outgoingPlayers = assetsToPlayers(outgoing, playerById);
  const read =
    delta != null
      ? readTrade({
          delta,
          incoming: incomingPlayers,
          outgoing: outgoingPlayers,
          byes,
          week: trade.week,
        })
      : null;

  const showDecide = waitingOnMe && onAccept && onDecline;
  const showHouse = Boolean(onAcceptHouse);
  const showPull = Boolean(onPull);
  const showActions =
    trade.status === "proposed" && (showDecide || showHouse || showPull || onCounter);

  // The row you have to answer starts open. Everything else is history until
  // you ask for it.
  const [open, setOpen] = useState(waitingOnMe);
  const bodyId = useId();

  const ago = Number.isFinite(trade.created)
    ? formatDistanceToNow(trade.created, { addSuffix: true })
    : "";
  const standing = waitingOnMe
    ? "waiting on you"
    : waitingNames.length
      ? `waiting on ${waitingNames.join(", ")}`
      : "";
  const change = delta?.change ?? null;

  return (
    <li className="rounded-xl bg-surface ring-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors duration-150",
          open ? "rounded-b-none" : "hover:bg-raised",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className="shrink-0 truncate font-semibold">{proposer}</span>
            <span className="min-w-0 truncate text-muted">
              {summarise(incoming, outgoing, involved)}
            </span>
          </span>
          {/* The separator belongs to the clause after it, so a wrap never
              leaves a dangling middot at the end of the first line. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-faint">
            <span>{ago}</span>
            {standing ? <span>&middot; {standing}</span> : null}
          </span>
        </span>

        {change != null && change !== 0 ? (
          <span
            className={cn(
              "shrink-0 font-mono text-sm tabular-nums",
              change > 0 ? "text-accent-strong" : "text-loss",
            )}
            title="Change to your weekly starter total"
          >
            {change > 0 ? "+" : "\u2212"}
            {Math.abs(change).toFixed(1)}
          </span>
        ) : null}

        <Badge
          tone={
            trade.status === "processed" ? "win" : trade.status === "proposed" ? "live" : "muted"
          }
        >
          {trade.status}
        </Badge>

        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-faint transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
          strokeWidth={2.2}
        />
      </button>

      {open ? (
        <div id={bodyId} className="border-t border-line px-4 pt-3 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetColumn
              title={involved ? "You get" : "Assets"}
              assets={incoming}
              projections={projections}
              playerById={playerById}
              empty="Nothing coming in"
            />
            {involved ? (
              <AssetColumn
                title="You give"
                assets={outgoing}
                projections={projections}
                playerById={playerById}
                empty="Nothing going out"
              />
            ) : null}
          </div>

          <TradeRosterAfter before={posBefore} after={posAfter} read={read} />

          <p className="mt-3 font-mono text-[11px] text-faint">
            {trade.sides
              .map((s) => `${s.teamName} ${s.accepted ? "in" : "\u2026"}`)
              .join(" \u00b7 ")}
          </p>

          {showActions ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {showDecide ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-loss"
                    disabled={busy}
                    onClick={onDecline}
                  >
                    Decline
                  </Button>
                  {onCounter ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={onCounter}>
                      Counter
                    </Button>
                  ) : null}
                  <Button type="button" disabled={busy} onClick={onAccept}>
                    Accept
                  </Button>
                </>
              ) : null}
              {showHouse ? (
                <Button type="button" variant="outline" disabled={busy} onClick={onAcceptHouse}>
                  Accept for house
                </Button>
              ) : null}
              {showPull ? (
                <Button type="button" variant="ghost" disabled={busy} onClick={onPull}>
                  Pull offer
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The deal in one clause: what leaves, then what arrives. Reads the way people
 * say it out loud — "Pollard for Robinson" — so the row is scannable without
 * the columns underneath it.
 */
function summarise(
  incoming: TradeOfferAsset[],
  outgoing: TradeOfferAsset[],
  involved: boolean,
): string {
  const get = incoming.map(tradeAssetLabel).filter(Boolean);
  if (!involved) return get.length ? joinBits(get) : "No assets";
  const give = outgoing.map(tradeAssetLabel).filter(Boolean);
  if (give.length && get.length) return `${joinBits(give)} \u2192 ${joinBits(get)}`;
  if (get.length) return `for ${joinBits(get)}`;
  if (give.length) return `gives ${joinBits(give)}`;
  return "No assets";
}

/** One asset in as few words as it can be said: "Pollard", "Pick 2.04", "$14". */
export function tradeAssetLabel(a: TradeOfferAsset): string {
  if (a.kind === "pick") return `Pick ${a.pickLabel ?? a.pickNo}`;
  if (a.kind === "faab") return `$${a.amount ?? 0}`;
  return a.playerName ? lastName({ full_name: a.playerName }) : "Player";
}

function AssetColumn({
  title,
  assets,
  projections,
  playerById,
  empty,
}: {
  title: string;
  assets: TradeOfferAsset[];
  projections?: Record<string, Projection>;
  playerById?: Map<string, SlimPlayer>;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <p className="microlabel">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {assets.length === 0 ? (
          <li className="px-2 py-1.5 text-xs text-faint">{empty}</li>
        ) : (
          assets.map((a, i) => (
            <li key={`${a.kind}-${a.playerId ?? a.pickNo ?? a.amount}-${i}`}>
              <AssetRow asset={a} projections={projections} playerById={playerById} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function AssetRow({
  asset,
  projections,
  playerById,
}: {
  asset: TradeOfferAsset;
  projections?: Record<string, Projection>;
  playerById?: Map<string, SlimPlayer>;
}) {
  if (asset.kind === "pick") {
    return (
      <span className="inline-flex min-h-9 items-center rounded-sm bg-raised px-2 py-1 font-mono text-xs text-fg">
        Pick {asset.pickLabel ?? asset.pickNo}
      </span>
    );
  }
  if (asset.kind === "faab") {
    return (
      <span className="inline-flex min-h-9 items-center rounded-sm bg-raised px-2 py-1 font-mono text-xs text-fg">
        ${asset.amount ?? 0} FAAB
      </span>
    );
  }

  const id = asset.playerId;
  const known = id ? playerById?.get(id) : undefined;
  const player: SlimPlayer = known ?? {
    player_id: id ?? "unknown",
    full_name: asset.playerName ?? "Player",
    position: asset.pos,
    team: null,
  };
  const proj = id ? projections?.[id] : undefined;
  const data: PlayerStatRowData = {
    player,
    projection: proj?.points ?? null,
    projectionIsAverage: proj?.reason === "season-avg",
  };
  return <PlayerStatRow data={data} dense />;
}

/** Depth that actually moved. Unchanged slots (1→1) are noise. */
export function TradeRosterAfter({
  before,
  after,
  read,
}: {
  before?: Record<string, number>;
  after?: Record<string, number>;
  read?: string | null;
}) {
  const moved =
    before && after
      ? [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
          (pos) => (before[pos] ?? 0) !== (after[pos] ?? 0),
        )
      : [];
  if (!moved.length && !read) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-line pt-3">
      {before && after && moved.length > 0 ? (
        <>
          <p className="microlabel">Your roster after</p>
          <PositionBars before={before} after={after} positions={moved} />
        </>
      ) : null}
      {read ? <p className="text-sm text-muted">{read}</p> : null}
    </div>
  );
}

function PositionBars({
  before,
  after,
  positions,
}: {
  before: Record<string, number>;
  after: Record<string, number>;
  positions: string[];
}) {
  const max = Math.max(1, ...positions.map((p) => Math.max(before[p] ?? 0, after[p] ?? 0)));

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
      {positions.map((pos) => {
        const b = before[pos] ?? 0;
        const a = after[pos] ?? 0;
        const lost = a < b;
        return (
          <li key={pos} className="flex items-center gap-2 text-xs">
            <span className="w-7 shrink-0 font-mono text-[11px] text-muted">{pos}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className="h-2 rounded-xs bg-line-strong"
                style={{ width: `${Math.max(8, (b / max) * 100)}%` }}
                title={`now ${b}`}
              />
              <span
                className={cn("h-2 rounded-xs", lost ? "bg-loss" : "bg-accent-strong")}
                style={{ width: `${Math.max(8, (a / max) * 100)}%` }}
                title={`after ${a}`}
              />
            </span>
            <span
              className={cn(
                "w-8 shrink-0 text-right font-mono tabular-nums",
                lost ? "text-loss" : "text-muted",
              )}
            >
              {b}→{a}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function assetsToPlayers(
  assets: TradeOfferAsset[],
  playerById?: Map<string, SlimPlayer>,
): RosterPlayer[] {
  const out: RosterPlayer[] = [];
  for (const a of assets) {
    if (a.kind !== "player" || !a.playerId) continue;
    const known = playerById?.get(a.playerId);
    out.push({
      player_id: a.playerId,
      full_name: known?.full_name ?? a.playerName ?? "Player",
      last_name: known?.last_name,
      position: known?.position ?? a.pos,
      team: known?.team ?? null,
      injury_status: known?.injury_status,
      status: known?.status,
      slot: "bench",
      weekPts: null,
    });
  }
  return out;
}
