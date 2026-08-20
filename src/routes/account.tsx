import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InstallDrawerButton } from "@/components/install-drawer";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listAgentTokens, mintAgentToken, revokeAgentToken } from "@/lib/league/fns";
import { type SkinPref, setSkinPref, useSkin } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  if (!isPending && !user) return <Navigate to="/login" search={{ redirect: "/account" }} />;

  return (
    <Shell>
      <p className="microlabel">You</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Account</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {user?.displayName ?? "Signed in"}
        {user?.primaryEmail ? ` · ${user.primaryEmail}` : ""}
      </p>
      <AppearancePanel />
      <AgentTokensPanel />
      <div className="mt-10 max-w-lg">
        <InstallDrawerButton />
      </div>
      <Link to="/" className="mt-8 inline-block text-sm text-muted hover:text-fg">
        Back to the desk
      </Link>
    </Shell>
  );
}

const SKIN_OPTIONS: { value: SkinPref; label: string }[] = [
  { value: "ledger", label: "Ledger" },
  { value: "boxscore", label: "Box Score" },
];

/** Per-user runtime skin picker. Same store/attribute convention as
 * ThemeToggle, one axis over. */
function AppearancePanel() {
  const skin = useSkin();
  // The stored preference is only knowable on the client; render the
  // segmented control unselected until mount so SSR and first paint agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mt-8 max-w-lg">
      <h2 className="microlabel">Appearance</h2>
      <p className="mt-1 text-sm text-muted">Pick the skin this desk renders with.</p>

      <div
        role="radiogroup"
        aria-label="Skin"
        className="mt-3 flex w-fit shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5"
      >
        {SKIN_OPTIONS.map(({ value, label }) => {
          const on = mounted && skin === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSkinPref(value)}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                on ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-faint",
                !on && "hover:text-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Mint / list / revoke personal off_ tokens for agent hosts. Plaintext once. */
function AgentTokensPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("codex");
  const [once, setOnce] = useState<string | null>(null);

  const tokens = useQuery({
    queryKey: ["agent-tokens"],
    queryFn: () => listAgentTokens(),
  });

  const mint = useMutation({
    mutationFn: () => mintAgentToken({ data: { name } }),
    onSuccess: (res) => {
      setOnce(res.token);
      void qc.invalidateQueries({ queryKey: ["agent-tokens"] });
      toast("Token created — copy it now.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not mint"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeAgentToken({ data: { id } }),
    onSuccess: () => {
      setOnce(null);
      void qc.invalidateQueries({ queryKey: ["agent-tokens"] });
      toast("Token revoked.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not revoke"),
  });

  return (
    <div className="mt-8 max-w-lg">
      <h2 className="microlabel">Agent tokens</h2>
      <p className="mt-1 text-sm text-muted">
        For Codex / Claude / Grok talking to this desk. Shown once; hashed at rest.
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mint.mutate();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="codex"
          aria-label="Token name"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={mint.isPending}>
          Create
        </Button>
      </form>

      {once ? (
        <div className="mt-3 rounded-xl bg-raised px-3 py-3">
          <p className="microlabel">Copy now — not shown again</p>
          <code className="mt-1 block break-all font-mono text-xs text-fg">{once}</code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(once);
              toast("Copied.");
            }}
          >
            Copy
          </Button>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {(tokens.data ?? []).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 ring-card"
          >
            <span>
              <span className="block font-mono text-xs">{t.prefix}…</span>
              <span className="font-mono text-[11px] text-faint">{t.name}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(t.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
