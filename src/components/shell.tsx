import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Radio, Trophy, UserRound } from "lucide-react";
import { InstallDrawer } from "@/components/install-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { brand } from "@/skin/brand";

export type ShellTab = {
  key: string;
  label: string;
  to:
    | "/league/$leagueId"
    | "/league/$leagueId/roster"
    | "/league/$leagueId/matchups"
    | "/league/$leagueId/standings"
    | "/league/$leagueId/wire";
  params: { leagueId: string };
  active: boolean;
  Icon: LucideIcon;
};

export function Shell({
  children,
  tabs,
  center = false,
}: {
  children: React.ReactNode;
  /**
   * Destinations for this context. Rendered as header links on desktop and as
   * the thumb bar on mobile, from one definition so the two cannot drift.
   */
  tabs?: ShellTab[];
  /** Center the page body in the remaining viewport (home / empty states). */
  center?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasHydrated = useLeagueStore((s) => s.hasHydrated);
  const recent = useLeagueStore((s) => s.recent);
  const league = hasHydrated ? recent[0] : undefined;
  const { isPending } = useCurrentUserState();
  const inLeague = pathname.startsWith("/league/");
  const inScores = pathname.startsWith("/scores");

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex min-h-15 max-w-6xl items-center gap-3 px-4">
          {/* Inside a league the tabs are the identity; the wordmark only
              earns its slot on the outside pages, where it is the way home. */}
          {!inLeague ? (
            <Link
              to={league ? "/league/$leagueId" : "/"}
              params={league ? { leagueId: league.leagueId } : undefined}
              className="shrink-0"
            >
              <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.03em]">
                {brand.name}
              </span>
            </Link>
          ) : null}
          {tabs?.length ? (
            <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex">
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  to={t.to}
                  params={t.params}
                  search={(prev) => prev}
                  preload="intent"
                  className={cn(
                    "shrink-0 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
                    t.active ? "bg-fg text-bg" : "text-muted hover:bg-raised hover:text-fg",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : (
            <nav className="hidden items-center gap-1 md:flex">
              {league ? (
                <Link
                  to="/league/$leagueId"
                  params={{ leagueId: league.leagueId }}
                  className={cn(
                    "rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                    inLeague ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
                  )}
                >
                  {league.name}
                </Link>
              ) : null}
              <Link
                to="/scores"
                className={cn(
                  "rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                  inScores ? "bg-raised text-fg" : "text-muted hover:bg-raised hover:text-fg",
                )}
              >
                Scores
              </Link>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {isPending ? (
              <div className="size-8 animate-pulse rounded-pill bg-raised" />
            ) : (
              <>
                <SignedIn>
                  {/* League settings live in this menu now, not a header gear. */}
                  <UserButton leagueId={inLeague ? (pathname.split("/")[2] ?? null) : null} />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-medium text-muted hover:text-fg"
                  >
                    Sign in
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 md:pb-12",
          center && "items-center justify-center",
        )}
      >
        {children}
      </main>

      <InstallDrawer />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md md:hidden">
        {tabs?.length ? (
          <div
            className="mx-auto grid max-w-lg px-2 pb-[env(safe-area-inset-bottom)]"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                params={t.params}
                search={(prev) => prev}
                preload="intent"
                className={cn(
                  "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150",
                  t.active ? "bg-raised text-fg" : "text-faint",
                )}
              >
                <t.Icon className="size-4" strokeWidth={1.9} />
                <span className="max-w-full truncate px-1">{t.label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
            {league ? (
              <Link
                to="/league/$leagueId"
                params={{ leagueId: league.leagueId }}
                className={cn(
                  "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                  inLeague ? "bg-raised text-fg" : "text-faint",
                )}
              >
                <Trophy className="size-4" strokeWidth={1.75} />
                League
              </Link>
            ) : (
              <Link
                to="/"
                className={cn(
                  "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                  pathname === "/" ? "bg-raised text-fg" : "text-faint",
                )}
              >
                <Trophy className="size-4" strokeWidth={1.75} />
                Home
              </Link>
            )}
            <Link
              to="/scores"
              className={cn(
                "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                inScores ? "bg-raised text-fg" : "text-faint",
              )}
            >
              <Radio className="size-4" strokeWidth={1.75} />
              Scores
            </Link>
            {isPending ? (
              <div className="mx-1 min-h-12" />
            ) : (
              <>
                <SignedIn>
                  <Link
                    to="/join"
                    className={cn(
                      "mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium transition-colors duration-150",
                      pathname === "/join" ? "bg-raised text-fg" : "text-faint",
                    )}
                  >
                    <UserRound className="size-4" strokeWidth={1.75} />
                    Join
                  </Link>
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="mx-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[11px] font-medium text-faint"
                  >
                    <UserRound className="size-4" strokeWidth={1.75} />
                    Sign in
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
