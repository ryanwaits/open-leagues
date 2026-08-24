import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { shortKickoff } from "@/lib/data/kickoff";
import { canonTeam, dstLabel, playerHeadshot, teamLogo } from "@/lib/data/teams";
import type { GameChip, SlimPlayer } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/** Short mark next to a name. Q is caution; everything worse is alarm. */
export function injuryMark(status?: string | null): {
  letter: string;
  label: string;
  tone: "warn" | "loss";
  title: string;
} | null {
  const raw = (status ?? "").trim();
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s === "questionable" || s === "q") {
    return { letter: "Q", label: "QUEST", tone: "warn", title: raw };
  }
  if (s === "doubtful" || s === "d" || s.includes("doubtful")) {
    return { letter: "D", label: "DOUBT", tone: "loss", title: raw };
  }
  if (s === "pup" || s.includes("pup") || s.includes("physically unable")) {
    return { letter: "PUP", label: "PUP", tone: "loss", title: raw };
  }
  if (s === "out" || s.startsWith("out")) {
    return { letter: "O", label: "OUT", tone: "loss", title: raw };
  }
  if (s === "ir" || s.includes("injured reserve")) {
    return { letter: "IR", label: "IR", tone: "loss", title: raw };
  }
  if (s.includes("suspend")) {
    return { letter: "SUS", label: "SUS", tone: "loss", title: raw };
  }
  const cut = raw.slice(0, 5).toUpperCase();
  return { letter: raw.slice(0, 3).toUpperCase(), label: cut, tone: "loss", title: raw };
}

export function InjuryMark({ status, className }: { status?: string | null; className?: string }) {
  const mark = injuryMark(status);
  if (!mark) return null;
  return (
    <Badge
      tone={mark.tone}
      title={mark.title}
      className={cn("shrink-0 px-1.5 py-0 text-[9px] font-semibold leading-4", className)}
    >
      {mark.letter}
    </Badge>
  );
}

/**
 * `Christian McCaffrey` does not fit in half a phone; `C. McCaffrey` does. A
 * formatter, not a data change — the full name is one breakpoint away.
 */
export function shortName(player: SlimPlayer): string {
  if (player.position === "DEF") return dstLabel(player.team);
  const [first = "", ...rest] = player.full_name.trim().split(/\s+/);
  if (rest.length === 0) return player.full_name;
  // A first name that is already initials — A.J., D.K., T.J. — is shorter than
  // anything we would replace it with, and cutting it to "A." loses the person.
  const lead = /^[A-Z]\.[A-Z]\.?$/i.test(first) ? first : `${first[0]}.`;
  return `${lead} ${rest.join(" ")}`;
}

export function PlayerCell({
  player,
  empty = "Empty",
  compact = false,
  dense = false,
  quiet = false,
  game = null,
  align = "left",
  line = null,
  clock = true,
}: {
  player: SlimPlayer | null | undefined;
  empty?: string;
  compact?: boolean;
  /** Phone-width squeeze: smaller mark, initial + surname under `sm`. */
  dense?: boolean;
  /**
   * The ledger voice: one sentence-case sub-line — team · opp · kickoff — in
   * place of the uppercase position/team/detail string. The slot rail beside
   * the row already says the position.
   */
  quiet?: boolean;
  game?: GameChip | null;
  align?: "left" | "right";
  line?: string | null;
  /**
   * The `quiet` sub-line's live clock / "Final" segment. Off in a matchup
   * box score, where a repeated red game clock on every row is noise — the
   * opponent, kickoff time, and stat line still show. On everywhere else.
   */
  clock?: boolean;
}) {
  if (!player) {
    return <span className="text-sm text-faint">{empty}</span>;
  }
  const isDef = player.position === "DEF";
  const src = isDef
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
  const name = isDef && player.team ? dstLabel(player.team) : player.full_name;
  const short = dense ? shortName(player) : name;
  const meta = [player.position, player.team].filter(Boolean).join(" · ");

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        dense && "gap-2 sm:gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar
        src={src}
        name={name}
        className={dense ? "size-7 sm:size-8" : compact ? "size-8" : "size-9"}
        textClassName="text-[10px]"
      >
        {game?.state === "in" ? (
          <span className="absolute right-0.5 bottom-0.5 size-1.5 rounded-pill bg-live ring-2 ring-bg" />
        ) : null}
      </Avatar>
      <span className="min-w-0">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            align === "right" && "flex-row-reverse",
          )}
        >
          <span
            className={cn(
              "truncate text-sm font-medium text-fg",
              dense && "text-[13px] sm:text-sm",
            )}
          >
            {dense && short !== name ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="max-sm:hidden">{name}</span>
              </>
            ) : (
              name
            )}
          </span>
          {isDef ? null : <InjuryMark status={player.injury_status} />}
        </span>
        {quiet ? (
          <span className="block truncate text-xs text-faint">
            {quietLine(player, game, line, clock)}
          </span>
        ) : (
          <span className="block truncate microlabel">
            {meta}
            {gameLabel(game, player.team)}
          </span>
        )}
        {line && !quiet ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted normal-case tracking-normal">
            {line}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * One line, every state, so rows never change height:
 *   pre      DAL · @ NYG · Sun 8:20
 *   live     @ NYG · Q3 8:53 · 6/10, 47 yds   (clock in coral, ball dot if they have it)
 *   final    @ NYG · Final · 14/21, 186 yds · 1 TD
 * Once the game is on, the own-team mark gives way to the stat line — the
 * player already says which team; the opponent is the context that stays.
 */
function quietLine(player: SlimPlayer, game: GameChip | null, line?: string | null, clock = true) {
  const team = player.position === "DEF" ? null : player.team;
  if (!game) return [team].filter(Boolean).join(" · ") || "—";
  const started = game.state === "in" || game.state === "post";
  const when =
    game.state === "pre"
      ? (shortKickoff(game.detail) ?? game.detail)
      : !clock
        ? null
        : game.state === "post"
          ? "Final"
          : [game.detail, game.situation].filter(Boolean).join(" · ") || "Live";
  const ball =
    clock &&
    game.state === "in" &&
    Boolean(game.possession) &&
    canonTeam(game.possession) != null &&
    canonTeam(game.possession) === canonTeam(player.team);
  const lead = started
    ? [game.opp].filter(Boolean).join(" · ")
    : [team, game.opp].filter(Boolean).join(" · ");
  return (
    <>
      {lead}
      {when ? (
        <span className={game.state === "in" ? "text-live" : undefined}>
          {lead ? " · " : ""}
          {when}
          {ball ? (
            <span
              className="ml-1 inline-block size-1.5 translate-y-[-1px] rounded-pill bg-live align-middle"
              title="Has the ball"
            />
          ) : null}
        </span>
      ) : null}
      {started && line ? <span className="text-muted">{` · ${line}`}</span> : null}
    </>
  );
}

function gameLabel(game: GameChip | null, team?: string | null) {
  if (!game) return null;
  const bits = [game.opp, game.detail].filter(Boolean);
  if (game.state === "in" && game.situation) bits.push(game.situation);
  if (!bits.length && game.state !== "in") return null;
  const ball =
    game.state === "in" &&
    Boolean(game.possession) &&
    canonTeam(game.possession) != null &&
    canonTeam(game.possession) === canonTeam(team);
  return (
    <span className={game.state === "in" ? "text-live" : undefined}>
      {bits.length ? ` · ${bits.join(" · ")}` : null}
      {ball ? (
        <span className="text-live" title="Has the ball">
          {" · "}
          <span className="inline-block size-1.5 translate-y-[-1px] rounded-pill bg-live align-middle" />
        </span>
      ) : null}
    </span>
  );
}
