import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { SubstrateNotice } from "@/components/substrate-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBoxMode } from "@/lib/box-mode.fns";
import { createLeague } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/new")({ component: NewLeague });

function NewLeague() {
  const { substrate } = useBoxMode();
  if (substrate) return <SubstrateNotice what="A new league" />;
  return <NewLeagueInner />;
}

function NewLeagueInner() {
  const fieldId = useId();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCount, setTeamCount] = useState(10);
  const [scoring, setScoring] = useState<"ppr" | "half" | "std">("ppr");
  const [fillHouse, setFillHouse] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      createLeague({
        data: { name, teamName, teamCount, scoring, fillHouse },
      }),
    onSuccess: (res) => {
      remember({ leagueId: res.leagueId, name, season: res.season });
      toast(`Invite code ${res.inviteCode}. You're the commissioner.`);
      void navigate({ to: "/league/$leagueId/settings", params: { leagueId: res.leagueId } });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Could not create league.";
      if (msg === "Unauthorized") {
        void navigate({ to: "/login", search: { redirect: "/new" } });
        return;
      }
      toast(msg);
    },
  });

  if (!isPending && !user) return <Navigate to="/login" search={{ redirect: "/new" }} />;

  return (
    <Shell>
      <p className="microlabel">Commissioner</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Start a league</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Import the draft you already ran, or open an empty desk. Friends join here with your invite
        — not on Sleeper.
      </p>

      <Link
        to="/import"
        className="mt-6 flex max-w-lg items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 text-left ring-card transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 ring-card-h"
      >
        <span>
          <span className="block text-sm font-semibold">Import WIFFL or a recap</span>
          <span className="mt-0.5 block text-xs text-muted">
            Known draft, ESPN PDF, or Sleeper id. You pick your seat before it becomes a league.
          </span>
        </span>
        <span className="shrink-0 microlabel">Import</span>
      </Link>

      <details className="mt-8 max-w-lg">
        <summary className="cursor-pointer microlabel hover:text-muted">
          Start empty instead
        </summary>
        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label htmlFor={`${fieldId}-name`} className="block">
            <span className="microlabel">League name</span>
            <Input
              id={`${fieldId}-name`}
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Backyard"
              required
            />
          </label>
          <label htmlFor={`${fieldId}-team`} className="block">
            <span className="microlabel">Your team</span>
            <Input
              id={`${fieldId}-team`}
              className="mt-1.5"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Night Desk"
              required
            />
          </label>
          <div>
            <p className="microlabel">Teams</p>
            <div className="mt-2 flex gap-1">
              {[8, 10, 12, 14].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTeamCount(n)}
                  className={cn(
                    "h-10 min-w-14 rounded-sm px-3 font-mono text-sm",
                    teamCount === n ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="microlabel">Scoring</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [
                  ["ppr", "PPR"],
                  ["half", "Half"],
                  ["std", "Standard"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScoring(id)}
                  className={cn(
                    "h-10 rounded-sm px-3 font-mono text-sm",
                    scoring === id ? "bg-accent text-accent-fg" : "bg-raised text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-surface p-4 ring-card">
            <input
              type="checkbox"
              checked={fillHouse}
              onChange={(e) => setFillHouse(e.target.checked)}
              className="mt-1 size-4 accent-current"
            />
            <span>
              <span className="block text-sm">Fill empty seats with house clubs</span>
              <span className="mt-1 block text-xs text-muted">
                House teams autodraft. Friends can still claim a seat with your invite code.
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending || create.isPending}>
              {create.isPending ? "Opening…" : "Open the league"}
            </Button>
            <Link to="/" className="text-sm text-muted hover:text-fg">
              Cancel
            </Link>
          </div>
        </form>
      </details>
    </Shell>
  );
}
