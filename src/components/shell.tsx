import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { BarChart3, House, Radio, Search, Shield, Swords, Trophy, UserRound } from "lucide-react";
import { InstallDrawer } from "@/components/install-drawer";
import { LeagueSwitcher } from "@/components/league-switcher";
import { LogoMark } from "@/components/logo";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getLeagueBundle, getScores } from "@/lib/data/fns";
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

/**
 * Outside a league the header still points at the one you were last in, so
 * Scores and the desk never feel like leaving. Players is hosted-only.
 */
function leagueTabs(leagueId: string, hosted: boolean): ShellTab[] {
  const tabs: ShellTab[] = [
    {
      key: "home",
      label: "Home",
      to: "/league/$leagueId",
      params: { leagueId },
      active: false,
      Icon: House,
    },
    {
      key: "roster",
      label: "My Team",
      to: "/league/$leagueId/roster",
      params: { leagueId },
      active: false,
      Icon: Shield,
    },
    {
      key: "matchups",
      label: "Matchups",
      to: "/league/$leagueId/matchups",
      params: { leagueId },
      active: false,
      Icon: Swords,
    },
    {
      key: "standings",
      label: "League",
      to: "/league/$leagueId/standings",
      params: { leagueId },
      active: false,
      Icon: BarChart3,
    },
  ];
  if (hosted) {
    tabs.push({
      key: "wire",
      label: "Players",
      to: "/league/$leagueId/wire",
      params: { leagueId },
      active: false,
      Icon: Search,
    });
  }
  return tabs;
}

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
  const { user, isPending } = useCurrentUserState();
  const inLeague = pathname.startsWith("/league/");
  const inScores = pathname.startsWith("/scores");
  const routeLeagueId = inLeague ? (pathname.split("/")[2] ?? null) : null;
  // The league the header speaks for: the one you are in, else the last one.
  const league = hasHydrated
    ? ((routeLeagueId
        ? (recent.find((r) => r.leagueId === routeLeagueId) ?? {
            leagueId: routeLeagueId,
            name: "League",
            season: "",
          })
        : recent[0]) ?? null)
    : null;
  const leagueId = league?.leagueId ?? null;
  // Same key the league layout uses, so in a league this is a cache read.
  const bundle = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId: leagueId! } }),
    enabled: Boolean(leagueId) && Boolean(user),
    staleTime: 60_000,
  });
  const current = league ? { ...league, name: bundle.data?.league.name ?? league.name } : null;
  // Same key the scores page warms; ESPN is cached server-side, so this is cheap.
  const board = useQuery({
    queryKey: ["scores", "now"],
    queryFn: () => getScores({ data: {} }),
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const live =
    Boolean(bundle.data?.scoringLive) || Boolean(board.data?.games.some((g) => g.state === "in"));
  const navTabs = tabs?.length
    ? tabs
    : leagueId && user
      ? leagueTabs(leagueId, Boolean(bundle.data?.hosted))
      : [];
  const showWordmark = !current || !user;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="shrink-0" aria-label={`${brand.name} — the desk`}>
            <span className="flex items-center gap-2">
              <LogoMark className="size-6" />
              {showWordmark ? (
                <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em]">
                  {brand.name}
                </span>
              ) : null}
            </span>
          </Link>
          {user && current ? <LeagueSwitcher current={current} /> : null}
          {navTabs.length ? (
            <>
              <span className="hidden h-6 w-px shrink-0 bg-line md:block" aria-hidden="true" />
              <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex">
                {navTabs.map((t) => (
                  <Link
                    key={t.key}
                    to={t.to}
                    params={t.params}
                    search={(prev) => prev}
                    preload="intent"
                    className={cn(
                      "shrink-0 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors duration-150",
                      t.active ? "bg-fg text-bg" : "text-fg/55 hover:bg-raised hover:text-fg",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </nav>
            </>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to="/scores"
              aria-label={live ? "NFL scores · games in progress" : "NFL scores"}
              className={cn(
                "relative inline-flex h-9 items-center gap-1.5 rounded-pill text-sm font-medium transition-colors duration-150 max-sm:size-9 max-sm:justify-center max-sm:shadow-[0_0_0_1px_var(--color-line-strong)] sm:px-3",
                inScores ? "bg-raised text-fg" : "text-fg/55 hover:bg-raised hover:text-fg",
              )}
            >
              <Radio className="size-[18px] sm:size-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">Scores</span>
              {live ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-live ring-2 ring-bg sm:static sm:ml-0.5 sm:ring-0 sm:shadow-[0_0_0_3px_color-mix(in_oklab,var(--alarm)_18%,transparent)]"
                />
              ) : null}
            </Link>
            {isPending ? (
              <div className="size-8 animate-pulse rounded-pill bg-raised" />
            ) : (
              <>
                <SignedIn>
                  <UserButton leagueId={routeLeagueId} />
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 backdrop-blur-md md:hidden">
        {navTabs.length ? (
          <div
            className="mx-auto grid max-w-lg px-2 pb-[env(safe-area-inset-bottom)]"
            style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}
          >
            {navTabs.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                params={t.params}
                search={(prev) => prev}
                preload="intent"
                className={cn(
                  "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150",
                  t.active ? "bg-fg/6 text-fg" : "text-faint",
                )}
              >
                <t.Icon className="size-[18px]" strokeWidth={1.8} />
                <span className="max-w-full truncate px-1">{t.label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mx-auto grid max-w-lg grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
            <Link
              to="/"
              className={cn(
                "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150",
                pathname === "/" ? "bg-fg/6 text-fg" : "text-faint",
              )}
            >
              <Trophy className="size-[18px]" strokeWidth={1.8} />
              Home
            </Link>
            <Link
              to="/scores"
              className={cn(
                "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150",
                inScores ? "bg-fg/6 text-fg" : "text-faint",
              )}
            >
              <Radio className="size-[18px]" strokeWidth={1.8} />
              Scores
            </Link>
            {isPending ? (
              <div className="mx-0.5 min-h-12" />
            ) : (
              <>
                <SignedIn>
                  <Link
                    to="/join"
                    className={cn(
                      "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium transition-colors duration-150",
                      pathname === "/join" ? "bg-fg/6 text-fg" : "text-faint",
                    )}
                  >
                    <UserRound className="size-[18px]" strokeWidth={1.8} />
                    Join
                  </Link>
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill py-1 text-[10.5px] font-medium text-faint"
                  >
                    <UserRound className="size-[18px]" strokeWidth={1.8} />
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
