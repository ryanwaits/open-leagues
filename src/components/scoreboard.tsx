import { Link } from "@tanstack/react-router";
import type { ScoreGame } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function TeamRow({
  abbr,
  name,
  logo,
  score,
  winner,
  state,
}: {
  abbr: string;
  name: string;
  logo: string;
  score: string;
  winner: boolean | null;
  state: ScoreGame["state"];
}) {
  const dim = state === "post" && winner === false;
  return (
    <div className={cn("flex items-center gap-2.5", dim && "opacity-45")}>
      {logo ? (
        <img src={logo} alt="" className="size-6 object-contain" />
      ) : (
        <span className="size-6 rounded-sm bg-raised" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium">{abbr}</span>
        <span className="hidden text-muted sm:inline"> {name}</span>
      </span>
      <span className="font-mono text-base tabular-nums">{state === "pre" ? "" : score}</span>
    </div>
  );
}

export function GameCard({ game }: { game: ScoreGame }) {
  const tone = game.state === "in" ? "live" : game.state === "post" ? "muted" : "default";
  return (
    <Link
      to="/scores/$gameId"
      params={{ gameId: game.id }}
      className="flex flex-col gap-2.5 rounded-lg bg-surface p-3.5 ring-card transition-[box-shadow] duration-150 ring-card-h"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{game.state === "in" ? "Live" : game.detail}</Badge>
        {game.state !== "in" && game.state !== "pre" ? null : (
          <span className="font-mono text-[11px] text-faint">{game.detail}</span>
        )}
      </div>
      <TeamRow {...game.away} state={game.state} />
      <TeamRow {...game.home} state={game.state} />
    </Link>
  );
}

export function ScoreStrip({ games }: { games: ScoreGame[] }) {
  if (!games.length) {
    return <p className="text-sm text-muted">No NFL games on the board.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}
