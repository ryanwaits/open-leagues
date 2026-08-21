import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PlayerCell } from "@/components/player-cell";
import type { WatchTarget } from "@/components/player-watch";
import { watchFromLine } from "@/components/player-watch";
import { SlotPts, TeamTotal, useScoreFlash } from "@/components/slot-pts";
import {
  gameHasStarted,
  liveStatLine,
  sideExpected,
  sideStillOpen,
  sideUnofficial,
} from "@/lib/data/matchup-view";
import { profileIntent } from "@/lib/data/player-view";
import { baseSlotLabel } from "@/lib/data/teams";
import type { MatchupSide, StarterLine } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

/** Band, gutter and rows all sit on this one grid — that is what keeps the
 *  centre channel unbroken from the scoreboard to the bottom of the card. */
const SPINE =
  "grid grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]";

/**
 * A roster row is this tall whether or not its game has started.
 *
 * Tall enough for the live case — headshot, name, game, stat line — so the
 * content is centred in it before kickoff rather than padded underneath. Over-
 * estimating is harmless (every row just gets roomier together); under-
 * estimating brings the shifting back, because live rows would outgrow it.
 *
 * Every row carries a top rule, the first one heavier — that rule is the seam
 * under the band. Exempting the first row instead would leave its content box a
 * pixel taller than the rest, since the border counts inside the min-height.
 */
const ROW = "min-h-[68px]";

/**
 * The matchup on a desktop.
 *
 * Two things happen here that the stacked-columns version could not do. The
 * header and the totals fuse into one band, so the card has a single seam
 * instead of three competing horizontal rhythms. And the forty-pixel gutter
 * between the rosters — which held nothing — becomes a channel that carries
 * the slot labels, so `QB` is printed once, between the two quarterbacks,
 * rather than twice at the outer edges.
 *
 * Because the band and the rows share `SPINE`, `vs` lands directly above the
 * stack of slots without needing rules of its own to say so — the band's lower
 * edge is the seam, and the channel's hairlines start where the rosters do.
 *
 * Every row is the same height in every state. `ROW` holds the live case, so a
 * game that has not kicked off sits at the same size as one that has, and the
 * gain line holds its own space so a row does not twitch taller on the poll the
 * points land. Nothing on this board moves except the numbers.
 */
export function MatchupBoard({
  title,
  action,
  label,
  home,
  away,
  prevHome,
  prevAway,
  liveHome,
  liveAway,
  leagueId,
  stats,
  onPlayer,
}: {
  title: string;
  action: ReactNode;
  label?: string | null;
  home: MatchupSide;
  away: MatchupSide | null;
  prevHome: MatchupSide | null;
  prevAway: MatchupSide | null;
  liveHome: number;
  liveAway: number;
  leagueId: string;
  stats: Record<string, Record<string, number>>;
  onPlayer: (t: WatchTarget | null) => void;
}) {
  const rows = home.starters.map((line, i) => {
    const b = away?.starters[i] ?? null;
    const aBag = line.stats ?? (line.playerId ? stats[line.playerId] : undefined);
    const bBag = b?.stats ?? (b?.playerId ? stats[b.playerId] : undefined);
    return {
      slot: line.slot,
      a: line,
      b,
      aBag,
      bBag,
      aLine: liveStatLine(line.player?.position, line.game, aBag),
      bLine: liveStatLine(b?.player?.position, b?.game, bBag),
    };
  });

  return (
    <div>
      <div className="bg-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-4 pb-3 sm:px-5">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
            {title}
          </h2>
          {action}
        </div>
        {label ? <p className="px-3 pb-3 microlabel text-live sm:px-5">{label}</p> : null}
        <div className={cn(SPINE, "items-end")}>
          <BandSide side={home} prev={prevHome} live={liveHome} leagueId={leagueId} />
          <span className="flex items-end justify-center self-stretch pb-4">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
              vs
            </span>
          </span>
          {away ? (
            <BandSide side={away} prev={prevAway} live={liveAway} leagueId={leagueId} flip />
          ) : (
            <p className="px-3 pb-4 text-right text-sm text-muted sm:px-5">Bye week</p>
          )}
        </div>
      </div>

      <ul>
        {rows.map((r, i) => (
          <li
            key={`${r.slot}-${r.a.playerId ?? "e"}`}
            className={cn(
              SPINE,
              ROW,
              "items-stretch border-t border-line first:border-line-strong",
            )}
          >
            <Half
              line={r.a}
              side={home}
              prev={prevHome?.starters[i] ?? null}
              bag={r.aBag}
              statLine={r.aLine}
              leagueId={leagueId}
              onPlayer={onPlayer}
            />
            <span className="flex items-center justify-center border-x border-line bg-raised/45">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                {baseSlotLabel(r.slot)}
              </span>
            </span>
            <Half
              line={r.b}
              side={away}
              prev={prevAway?.starters[i] ?? null}
              bag={r.bBag}
              statLine={r.bLine}
              leagueId={leagueId}
              onPlayer={onPlayer}
              flip
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BandSide({
  side,
  prev: _prev,
  live: _live,
  leagueId,
  flip = false,
}: {
  side: MatchupSide;
  prev: MatchupSide | null;
  live: number;
  leagueId: string;
  flip?: boolean;
}) {
  const open = sideStillOpen(side);
  const unofficial = sideUnofficial(side);
  const scoring = side.starters.some((s) => gameHasStarted(s.game) && !s.forecast);
  const flash = useScoreFlash(unofficial, scoring);
  return (
    <div className={cn("min-w-0 px-3 pb-4 sm:px-5", flip && "text-right")}>
      <p
        className={cn(
          "flex items-baseline gap-2 text-[15px] font-semibold",
          flip && "flex-row-reverse",
        )}
      >
        <Link
          to="/league/$leagueId/team/$rosterId"
          params={{ leagueId, rosterId: String(side.rosterId) }}
          className="truncate rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
        >
          {side.teamName}
        </Link>
        {flash > 0.04 ? (
          <span className="shrink-0 font-mono text-xs text-win motion-safe:animate-[score-flash_4.5s_ease-out_forwards]">
            +{formatPts(flash, 1)}
          </span>
        ) : null}
      </p>
      <TeamTotal
        live={unofficial}
        projected={sideExpected(side)}
        showProjected={open}
        flip={flip}
        reserve
      />
    </div>
  );
}

function Half({
  line,
  side,
  prev: _prev,
  bag,
  statLine,
  leagueId,
  onPlayer,
  flip = false,
}: {
  line: StarterLine | null;
  side: MatchupSide | null;
  prev: StarterLine | null;
  bag: Record<string, number> | undefined;
  statLine: string | null;
  leagueId: string;
  onPlayer: (t: WatchTarget | null) => void;
  flip?: boolean;
}) {
  const qc = useQueryClient();
  const live = Boolean(line && gameHasStarted(line.game) && !line.forecast);
  const flash = useScoreFlash(line?.points, live);
  const intent = line?.player ? profileIntent(qc, leagueId, line.player.player_id) : {};

  return (
    <button
      type="button"
      disabled={!line?.player || !side}
      {...intent}
      onClick={() => line && side && onPlayer(watchFromLine(line, side.teamName, statLine, bag))}
      className={cn(
        "flex min-w-0 items-center gap-1.5 px-2 py-2 text-left transition-colors duration-300 sm:gap-2 sm:px-5",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
        "disabled:cursor-default",
        flip && "flex-row-reverse text-right",
        flash > 0.04 && "bg-highlight/15",
      )}
    >
      <span className="min-w-0 flex-1">
        <PlayerCell
          player={line?.player}
          empty="—"
          compact
          dense
          game={line?.game}
          line={statLine}
          align={flip ? "right" : "left"}
        />
      </span>
      <SlotPts
        points={line?.points}
        forecast={line?.forecast}
        expected={line?.expected}
        live={live}
        reserve
        align={flip ? "left" : "right"}
        className="w-9 sm:w-16"
      />
    </button>
  );
}
