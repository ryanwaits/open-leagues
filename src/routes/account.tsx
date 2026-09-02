import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InstallDrawerButton } from "@/components/install-drawer";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  deleteAiSettings,
  getAiSettings,
  listAgentTokens,
  mintAgentToken,
  revokeAgentToken,
  saveAiSettings,
  testAiSettings,
} from "@/lib/league/fns";
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
      <AiSettingsPanel />
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
  { value: "console", label: "Console" },
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
            // biome-ignore lint/a11y/useSemanticElements: segmented-control pill button; swapping to <input type="radio"> would need the control hidden and all pill/hover styling redone
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSkinPref(value)}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                on ? "bg-fg text-bg" : "text-faint",
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

type AiProvider = "anthropic" | "openai" | "google";

const AI_PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
];

/** Operator's model choice — mirrors ai.server.ts's DEFAULT_ANTHROPIC_MODEL.
 * Kept as a plain literal rather than an import: `.server.ts` modules are
 * stripped from the client bundle. */
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/** BYOK: each commissioner supplies their own provider key, encrypted at
 * rest, for AI features on desks they run (import analysis today; desk
 * news / recaps later). */
function AiSettingsPanel() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [model, setModel] = useState(DEFAULT_ANTHROPIC_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [synced, setSynced] = useState(false);

  const settings = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getAiSettings(),
  });

  useEffect(() => {
    if (settings.data && !synced) {
      setProvider(settings.data.provider);
      setModel(settings.data.model);
      setSynced(true);
    }
  }, [settings.data, synced]);

  function onProviderChange(next: AiProvider) {
    setProvider(next);
    if (next === "anthropic" && !model.trim()) setModel(DEFAULT_ANTHROPIC_MODEL);
    if (next !== "anthropic" && model === DEFAULT_ANTHROPIC_MODEL) setModel("");
  }

  const save = useMutation({
    mutationFn: () =>
      saveAiSettings({
        data: { provider, model: model.trim(), apiKey: apiKey.trim() || undefined },
      }),
    onSuccess: () => {
      setApiKey("");
      void qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast("AI settings saved.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: () => deleteAiSettings(),
    onSuccess: () => {
      setApiKey("");
      setProvider("anthropic");
      setModel(DEFAULT_ANTHROPIC_MODEL);
      setSynced(false);
      void qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast("AI key removed.");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Could not remove."),
  });

  const test = useMutation({
    mutationFn: () => testAiSettings(),
    onSuccess: (res) => toast(res.message),
    onError: (e) => toast(e instanceof Error ? e.message : "Test failed."),
  });

  return (
    <div className="mt-8 max-w-lg">
      <h2 className="microlabel">AI</h2>
      <p className="mt-1 text-sm text-muted">
        Your key powers AI features on desks you run — imports for now. Stored encrypted; never
        shown again.
      </p>

      <div
        role="radiogroup"
        aria-label="AI provider"
        className="mt-3 flex w-fit shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5"
      >
        {AI_PROVIDERS.map(({ id, label }) => {
          const on = provider === id;
          return (
            // biome-ignore lint/a11y/useSemanticElements: segmented-control pill button; swapping to <input type="radio"> would need the control hidden and all pill/hover styling redone
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onProviderChange(id)}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                on ? "bg-fg text-bg" : "text-faint",
                !on && "hover:text-muted",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <label className="mt-3 block" htmlFor="ai-model">
        <span className="microlabel">Model</span>
        <Input
          id="ai-model"
          className="mt-1.5"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            provider === "anthropic"
              ? DEFAULT_ANTHROPIC_MODEL
              : "Model id (see your provider's docs)"
          }
        />
      </label>

      <label className="mt-3 block" htmlFor="ai-key">
        <span className="microlabel">API key</span>
        <Input
          id="ai-key"
          className="mt-1.5"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={settings.data ? `•••• ${settings.data.keyLast4} saved` : "sk-…"}
          autoComplete="off"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={save.isPending || !model.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={test.isPending || !settings.data}
          onClick={() => test.mutate()}
        >
          {test.isPending ? "Testing…" : "Test"}
        </Button>
        {settings.data ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Mint / list / revoke personal off_ tokens for agent hosts. Plaintext once. */
function AgentTokensPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("codex");
  const [scope, setScope] = useState<"read" | "act">("act");
  const [once, setOnce] = useState<string | null>(null);

  const tokens = useQuery({
    queryKey: ["agent-tokens"],
    queryFn: () => listAgentTokens(),
  });

  const mint = useMutation({
    mutationFn: () => mintAgentToken({ data: { name, scope } }),
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
      {/* read = it can look; act = it can do what you could do, and nothing you couldn't. */}
      <div className="mt-2 flex items-center gap-1.5">
        {(["read", "act"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            aria-pressed={scope === s}
            className={cn(
              "rounded-pill border px-2.5 py-0.5 font-mono text-[11px]",
              scope === s
                ? "border-fg bg-fg text-bg"
                : "border-line-strong text-muted hover:text-fg",
            )}
          >
            {s}
          </button>
        ))}
        <span className="text-[12px] text-muted">
          {scope === "read" ? "reads the league, cannot move a player" : "can do what you can do"}
        </span>
      </div>

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
