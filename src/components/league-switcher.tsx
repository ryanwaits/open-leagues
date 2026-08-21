import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { HeaderMenu } from "@/components/header-menu";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyLeagues } from "@/lib/league/fns";
import { type SavedLeague, useLeagueStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The league you are in, and the way to any other one. A pill in the header;
 * press it for your leagues, joining or starting another, and the desk. A
 * popover on wide screens, a sheet on phones.
 */
export function LeagueSwitcher({ current }: { current: SavedLeague | null }) {
  const { user, isPending } = useCurrentUserState();
  const remember = useLeagueStore((s) => s.remember);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mine = useQuery({
    queryKey: ["my-leagues", user?.id ?? "anon"],
    queryFn: () => listMyLeagues(),
    enabled: !isPending && Boolean(user),
    staleTime: 60_000,
  });

  if (!current) return null;
  const seats = mine.data ?? [];
  const commish = seats.some((s) => s.role === "commish");
  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted hover:bg-raised hover:text-fg";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`League: ${current.name}. Switch league`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 max-w-[11rem] items-center gap-2 rounded-pill bg-surface pr-2.5 pl-1.5 text-sm font-bold ring-card sm:max-w-[14rem]"
      >
        <Avatar
          name={current.name}
          tint
          className="size-6 rounded-pill"
          textClassName="text-[9px]"
        />
        <span className="truncate">{current.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
      </button>
      <HeaderMenu
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        align="left"
        label="Switch league"
        className="sm:w-64"
      >
        <p className="px-2.5 pt-1 pb-1.5 microlabel">Your leagues</p>
        {mine.isPending && !seats.length ? (
          <div className="mx-2.5 my-1 h-9 animate-pulse rounded-md bg-raised" />
        ) : null}
        {(seats.length ? seats : [{ ...current, role: "" }]).map((l) => {
          const on = l.leagueId === current.leagueId;
          return (
            <Link
              key={l.leagueId}
              to="/league/$leagueId"
              params={{ leagueId: l.leagueId }}
              role="menuitem"
              preload="intent"
              onClick={() => {
                remember({ leagueId: l.leagueId, name: l.name, season: l.season });
                close();
              }}
              className={cn(item, on && "bg-raised text-fg")}
            >
              <Avatar
                name={l.name}
                tint
                className="size-6 rounded-pill"
                textClassName="text-[9px]"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {l.season}
                {l.role ? ` · ${l.role}` : ""}
              </span>
            </Link>
          );
        })}
        <div className="my-1.5 border-t border-line" />
        <Link to="/join" role="menuitem" onClick={close} className={item}>
          Join a league
        </Link>
        {commish ? (
          <Link to="/new" role="menuitem" onClick={close} className={item}>
            Start a league
          </Link>
        ) : null}
        <div className="my-1.5 border-t border-line" />
        <Link to="/" role="menuitem" onClick={close} className={item}>
          The desk
        </Link>
      </HeaderMenu>
    </>
  );
}
