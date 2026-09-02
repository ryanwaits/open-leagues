import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { LOCAL_SEED } from "@/lib/auth/local-seed";
import { configuredLoginSocials } from "@/lib/auth/providers";
import { getQueryClient } from "@/lib/query-client";
import { brand } from "@/skin/brand";

const devPrefill = import.meta.env.DEV ? LOCAL_SEED : { email: "", password: "", name: "" };

type Search = { redirect?: string };

const loadSocialProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const raw = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host") ?? "";
  const host = raw.split(":")[0] ?? "";
  return configuredLoginSocials(host);
});

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  loader: () => loadSocialProviders(),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const social = Route.useLoaderData();
  const navigate = useNavigate();
  const dest = redirect?.startsWith("/") ? redirect : "/";
  const socialNames = [...new Set(social.map((p) => p.label))];
  const socialCopy =
    socialNames.length === 0
      ? ""
      : socialNames.length === 1
        ? ` ${socialNames[0]} is available on this host.`
        : ` ${socialNames.slice(0, -1).join(", ")} and ${socialNames[socialNames.length - 1]} are available on this host.`;
  const [mode, setMode] = useState<"in" | "up">("in");
  // The maintainer's fixture credentials are a dev convenience. A production
  // build — which is what a self-hoster runs — opens on empty fields.
  const [email, setEmail] = useState<string>(devPrefill.email);
  const [password, setPassword] = useState<string>(devPrefill.password);
  const [name, setName] = useState<string>(devPrefill.name);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) throw new Error(res.error.message ?? "Sign-up failed");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign-in failed");
      }
      await authClient.getSession();
      getQueryClient().removeQueries({ queryKey: ["my-leagues"] });
      void navigate({ to: dest });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-3xl tracking-tight">
          {brand.name}
        </Link>
        <p className="mt-2 text-sm text-muted">
          Your open-leagues account — not Sleeper, not ESPN.
          {socialCopy}
        </p>

        {authEnabled && social.length > 0 ? (
          <div className="mt-8 space-y-2">
            {social.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (p.kind === "native") {
                    void authClient.signIn.social({ provider: "google", callbackURL: dest });
                    return;
                  }
                  void signIn(p.providerId, { callbackURL: dest });
                }}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : null}

        {!authEnabled ? <p className="mt-8 text-sm text-muted">Sign-in is disabled.</p> : null}

        {authEnabled ? (
          <form className="mt-8 space-y-3" onSubmit={(e) => void onEmail(e)}>
            <p className="microlabel">{mode === "up" ? "Create an account" : "Email"}</p>
            {mode === "up" ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                required
              />
            ) : null}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@league.com"
              required
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={8}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted hover:text-fg"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Already have an account?" : "Need an account?"}
            </button>
          </form>
        ) : null}

        <Link to="/" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Home
        </Link>
      </div>
    </main>
  );
}
