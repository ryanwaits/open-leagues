import { Link, Navigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { HeaderMenu } from "@/components/header-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { authEnabled, signOut } from "./client";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

/**
 * Auth state components — plain wrappers around `useCurrentUserState()`.
 *
 * Auth is ON by default (including the sandbox live preview, which does real
 * sign-in). Visitors are signed out until they authenticate. The shared dev
 * user only appears when auth is explicitly disabled (`VITE_AUTH_ENABLED=false`).
 * While the session is still resolving, gates that care about signed-out state
 * render nothing so there's no signed-out flash on hard reload.
 */

/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
export const SIGN_IN_PATH = "/login";

/** Render children only when a user is present (real session, or the disabled-auth dev user). */
export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? children : null;
}

/**
 * Render children only once we KNOW the visitor is signed out (`isPending` has
 * cleared and there is no user). Hidden while the session is still loading.
 */
export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

/**
 * Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
 * `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
 * session loading, which feels like a second "Loading…" on /login.
 *
 * Guard routes by waiting out `isPending` first (see `use-current-user`), then
 * render this.
 */
export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

/**
 * The signed-in account mark: just the avatar, opening a menu underneath.
 * Who you are, where your settings live, and the way out sit behind one
 * press instead of cluttering the header. Sign-out only appears when auth
 * is enabled (the disabled-auth dev user has nothing to sign out of).
 */
export function UserButton({ leagueId }: { leagueId?: string | null }) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  const item =
    "block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-raised hover:text-fg";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
      >
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="size-8 rounded-pill object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-pill bg-raised font-mono text-xs font-medium">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      <HeaderMenu
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        align="right"
        label="Account"
        className="sm:w-56"
      >
        <div className="border-b border-line px-3 pt-1.5 pb-2.5">
          <span className="block truncate text-sm font-semibold">{label}</span>
          {user.primaryEmail && user.displayName ? (
            <span className="block truncate font-mono text-[11px] text-faint">
              {user.primaryEmail}
            </span>
          ) : null}
        </div>
        <div className="pt-1.5">
          {/* Theme lives here now, not in the header: set once, rarely touched. */}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-sm font-medium text-muted">Theme</span>
            <ThemeToggle />
          </div>
          {leagueId ? (
            <Link
              to="/league/$leagueId/settings"
              params={{ leagueId }}
              role="menuitem"
              onClick={close}
              className={item}
            >
              League settings
            </Link>
          ) : null}
          <Link to="/account" role="menuitem" onClick={close} className={item}>
            Account
          </Link>
          <Link to="/" role="menuitem" onClick={close} className={item}>
            The desk
          </Link>
          {authEnabled && (
            <>
              <div className="my-1.5 border-t border-line" />
              <button type="button" role="menuitem" onClick={() => void signOut()} className={item}>
                Sign out
              </button>
            </>
          )}
        </div>
      </HeaderMenu>
    </>
  );
}
