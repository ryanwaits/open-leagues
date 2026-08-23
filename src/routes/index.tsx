import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyLeagues } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const remember = useLeagueStore((s) => s.remember);
  const { user, isPending: sessionPending } = useCurrentUserState();
  const mine = useQuery({
    queryKey: ["my-leagues", user?.id ?? "anon"],
    queryFn: () => listMyLeagues(),
    enabled: !sessionPending && Boolean(user),
    placeholderData: undefined,
  });

  const seats = mine.data ?? [];
  const waiting = sessionPending || (Boolean(user) && mine.data == null && !mine.isError);
  const commish = seats.some((s) => s.role === "commish");

  return (
    <Shell center>
      {waiting ? (
        <div className="h-24 w-full max-w-sm animate-pulse rounded-xl bg-surface" />
      ) : !user ? (
        <GuestHome />
      ) : seats.length === 0 ? (
        <FirstHome />
      ) : (
        <DeskHome
          seats={seats}
          commish={commish}
          onOpen={(l) => remember({ leagueId: l.leagueId, name: l.name, season: l.season })}
        />
      )}
    </Shell>
  );
}

function GuestHome() {
  return (
    <section className="w-full max-w-md text-center">
      <p className="microlabel">Hosted here · no other app</p>
      <h1 className="mt-3 font-display text-5xl font-medium leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl">
        Your league, <span className="hl">your desk</span>.
      </h1>
      <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted">
        Sign in to a seat you already have, or join with an invite.
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/join">I have an invite</Link>
        </Button>
      </div>
    </section>
  );
}

function FirstHome() {
  return (
    <section className="w-full max-w-md text-center">
      <p className="microlabel">No leagues yet</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-[-0.02em] text-balance">
        How are you getting in?
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted">
        Members claim a seat. Commissioners import or open a new desk, then send the invite.
      </p>
      <ul className="mt-8 space-y-2 text-left">
        <li>
          <PathCard to="/join" title="I have an invite" hint="Paste the code and pick your team." />
        </li>
        <li>
          <PathCard
            to="/new"
            title="I'm starting the league"
            hint="Import WIFFL or open an empty desk, then share the join link."
          />
        </li>
      </ul>
    </section>
  );
}

function DeskHome({
  seats,
  commish,
  onOpen,
}: {
  seats: { leagueId: string; name: string; season: string; role: string }[];
  commish: boolean;
  onOpen: (l: { leagueId: string; name: string; season: string }) => void;
}) {
  return (
    <section className="w-full max-w-lg text-center">
      <p className="microlabel">Your leagues</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.02em]">The desk</h1>
      <ul className="mt-6 space-y-2 text-left">
        {seats.map((l) => (
          <li key={l.leagueId}>
            <Link
              to="/league/$leagueId"
              params={{ leagueId: l.leagueId }}
              preload="intent"
              onClick={() => onOpen(l)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 text-left ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
            >
              <span>
                <span className="block text-sm font-semibold">{l.name}</span>
                <span className="font-mono text-[11px] text-faint">
                  {l.season} · {l.role}
                </span>
              </span>
              <ArrowRight className="size-4 text-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-strong" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-center gap-4 text-sm">
        <Link to="/join" className="text-muted hover:text-fg">
          Join another
        </Link>
        {commish ? (
          <Link to="/new" className="text-muted hover:text-fg">
            Start another
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function PathCard({ to, title, hint }: { to: "/join" | "/new"; title: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 text-left ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-strong" />
    </Link>
  );
}
