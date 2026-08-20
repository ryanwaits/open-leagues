import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
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

export function PlayerCell({
  player,
  empty = "Empty",
  compact = false,
  game = null,
  align = "left",
  line = null,
}: {
  player: SlimPlayer | null | undefined;
  empty?: string;
  compact?: boolean;
  game?: GameChip | null;
  align?: "left" | "right";
  line?: string | null;
}) {
  if (!player) {
    return <span className="text-sm text-faint">{empty}</span>;
  }
  const isDef = player.position === "DEF";
  const src = isDef
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
  const name = isDef && player.team ? dstLabel(player.team) : player.full_name;
  const meta = [player.position, player.team].filter(Boolean).join(" · ");

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar
        src={src}
        name={name}
        className={compact ? "size-8" : "size-9"}
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
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          {isDef ? null : <InjuryMark status={player.injury_status} />}
        </span>
        <span className="block truncate microlabel">
          {meta}
          {gameLabel(game, player.team)}
        </span>
        {line ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted normal-case tracking-normal">
            {line}
          </span>
        ) : null}
      </span>
    </span>
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
