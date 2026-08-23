import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { A2HS_JOIN_KEY } from "@/lib/a2hs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { joinLeague, previewInvite } from "@/lib/league/fns";
import { useLeagueStore } from "@/lib/store";

type Search = { code?: string };

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: JoinLeague,
});

function JoinLeague() {
  const codeId = useId();
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const remember = useLeagueStore((s) => s.remember);
  const [code, setCode] = useState(search.code ?? "");
  const [rosterId, setRosterId] = useState<number | "">("");

  const preview = useQuery({
    queryKey: ["invite", code.trim().toUpperCase()],
    queryFn: () => previewInvite({ data: { code: code.trim() } }),
    enabled: code.trim().length >= 4,
  });

  const join = useMutation({
    mutationFn: () =>
      joinLeague({
        data: {
          code,
          teamName: "",
          rosterId: rosterId === "" ? null : rosterId,
        },
      }),
    onSuccess: (res) => {
      remember({ leagueId: res.leagueId, name: res.name || "My league", season: res.season });
      try {
        localStorage.setItem(A2HS_JOIN_KEY, "1");
      } catch {
        /* ignore */
      }
      void navigate({ to: "/league/$leagueId", params: { leagueId: res.leagueId } });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Could not join.";
      if (msg === "Unauthorized") {
        void navigate({
          to: "/login",
          search: {
            redirect: code.trim() ? `/join?code=${encodeURIComponent(code.trim())}` : "/join",
          },
        });
        return;
      }
      toast(msg);
    },
  });

  if (!isPending && !user) {
    return (
      <Navigate
        to="/login"
        search={{
          redirect: code.trim() ? `/join?code=${encodeURIComponent(code.trim())}` : "/join",
        }}
      />
    );
  }

  const pack = preview.data;

  return (
    <Shell>
      <p className="microlabel">Member</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Join a league</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Paste the invite code. If seats have names, pick yours.
      </p>
      <form
        className="mt-8 max-w-lg space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate();
        }}
      >
        <label htmlFor={codeId} className="block">
          <span className="microlabel">Invite code</span>
          <Input
            id={codeId}
            className="mt-1.5 uppercase tracking-[0.2em]"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setRosterId("");
            }}
            placeholder="YARD26"
            required
            maxLength={8}
          />
        </label>
        {pack ? (
          <div>
            <p className="text-sm">
              {pack.name} <span className="text-faint">· {pack.season}</span>
            </p>
            {pack.seats.length ? (
              <label className="mt-3 block">
                <span className="microlabel">Open seats</span>
                <select
                  className="mt-1.5 h-10 w-full rounded-md bg-surface px-3 text-base text-fg shadow-[0_0_0_1px_var(--color-line-strong)] sm:text-sm"
                  value={rosterId}
                  onChange={(e) => setRosterId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Next open seat</option>
                  {pack.seats.map((s) => (
                    <option key={s.rosterId} value={s.rosterId}>
                      {s.teamName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-2 text-sm text-muted">No open seats left.</p>
            )}
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending || join.isPending || (pack != null && pack.seats.length === 0)}
          >
            {join.isPending ? "Joining…" : "Claim"}
          </Button>
          <Link to="/" className="text-sm text-muted hover:text-fg">
            Cancel
          </Link>
        </div>
      </form>
    </Shell>
  );
}
