import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PlayerCell } from "@/components/player-cell";
import type { WatchTarget } from "@/components/player-watch";
import { watchFromLine } from "@/components/player-watch";
import { SlotPts, TeamTotal } from "@/components/slot-pts";
import { liveStatLine, sideIsProjected } from "@/lib/data/matchup-view";
import { profileIntent } from "@/lib/data/player-view";
import { baseSlotLabel } from "@/lib/data/teams";
import type { MatchupSide, StarterLine } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

/** Band, gutter and rows all sit on this one grid — that is what keeps the
 *  centre channel unbroken from the scoreboard to the bottom of the card. */
const SPINE = "grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]";

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
    <div className="hidden sm:block">
      <div className="bg-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
            {title}
          </h2>
          {action}
        </div>
        {label ? <p className="px-5 pb-3 microlabel text-live">{label}</p> : null}
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
            <p className="px-5 pb-4 text-right text-sm text-muted">Bye week</p>
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
  prev,
  live,
  leagueId,
  flip = false,
}: {
  side: MatchupSide;
  prev: MatchupSide | null;
  live: number;
  leagueId: string;
  flip?: boolean;
}) {
  const projected = sideIsProjected(side);
  // A swing since the last poll, on the team's own line. Parking it beside the
  // total made the total share its width with a number that is usually absent.
  const delta = prev && !projected ? side.points - prev.points : 0;
  return (
    <div className={cn("min-w-0 px-5 pb-4", flip && "text-right")}>
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
        {delta > 0.04 ? (
          <span className="shrink-0 font-mono text-xs text-win">+{formatPts(delta, 1)}</span>
        ) : null}
      </p>
      <TeamTotal
        live={live}
        projected={side.points}
        showProjected={projected}
        flip={flip}
        reserve
      />
    </div>
  );
}

function Half({
  line,
  side,
  prev,
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
  const bump = line && !line.forecast ? (line.points ?? 0) - (prev?.points ?? 0) : 0;
  const intent = line?.player ? profileIntent(qc, leagueId, line.player.player_id) : {};

  return (
    <button
      type="button"
      disabled={!line?.player || !side}
      {...intent}
      onClick={() => line && side && onPlayer(watchFromLine(line, side.teamName, statLine, bag))}
      className={cn(
        "flex min-w-0 items-center gap-2 px-5 py-2 text-left transition-colors duration-300",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
        "disabled:cursor-default",
        flip && "flex-row-reverse text-right",
        bump > 0.04 && "bg-highlight/15",
      )}
    >
      <span className="min-w-0 flex-1">
        <PlayerCell
          player={line?.player}
          empty="—"
          compact
          game={line?.game}
          line={statLine}
          align={flip ? "right" : "left"}
        />
      </span>
      <SlotPts
        points={line?.points}
        forecast={line?.forecast}
        bump={bump}
        reserve
        align={flip ? "left" : "right"}
      />
    </button>
  );
}
