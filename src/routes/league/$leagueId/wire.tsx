import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { ClaimButton } from "@/components/claim-button";
import { ClaimDialog } from "@/components/claim-dialog";
import { Deck } from "@/components/deck";
import { PlayerCell } from "@/components/player-cell";
import { TablePager } from "@/components/table-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsPhone } from "@/lib/breakpoint";
import { getLeagueBundle, getWire } from "@/lib/data/fns";
import { headshotFor, prefetchPlayerProfile, useWarmRosterProfiles } from "@/lib/data/player-view";
import type { WirePlayer, WireScope } from "@/lib/data/types";
import { cancelClaim, getClaims } from "@/lib/league/fns";
import { useClaim } from "@/lib/league/use-claim";
import { warmQuery } from "@/lib/query-client";
import { cn, formatPts } from "@/lib/utils";

const POS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;
const SCOPES = [
  { id: "all" as const, label: "All" },
  { id: "available" as const, label: "Available" },
  { id: "free_agent" as const, label: "Free agent" },
];
const PAGE_SIZE = 10;

type WireSearch = {
  scope?: WireScope;
  pos?: (typeof POS)[number];
  page?: number;
};

export const Route = createFileRoute("/league/$leagueId/wire")({
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) => {
    const scope = deps.scope ?? "available";
    const pos = deps.pos ?? "ALL";
    return warmQuery(context.queryClient, {
      queryKey: ["wire", params.leagueId, pos, scope],
      queryFn: () =>
        getWire({
          data: { leagueId: params.leagueId, position: pos, query: "", scope },
        }),
    });
  },
  validateSearch: (s: Record<string, unknown>): WireSearch => {
    const out: WireSearch = {};
    if (s.scope === "all" || s.scope === "available" || s.scope === "free_agent") {
      out.scope = s.scope;
    }
    if (POS.includes(s.pos as (typeof POS)[number])) out.pos = s.pos as (typeof POS)[number];
    const page = parsePage(s.page);
    if (page > 1) out.page = page;
    return out;
  },
  component: WirePage,
});

function parsePage(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return Math.max(1, Number(value));
  return 1;
}

function WirePage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const isPhone = useIsPhone();
  const [visible, setVisible] = useState(25);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scope = search.scope ?? "available";
  const pos = search.pos ?? "ALL";
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const wire = useQuery({
    queryKey: ["wire", leagueId, pos, scope],
    queryFn: () =>
      getWire({
        data: { leagueId, position: pos, query: "", scope },
      }),
  });
  const needle = q.trim().toLowerCase();
  const rows = (wire.data ?? []).filter((p) => {
    if (!needle) return true;
    const hay = `${p.full_name} ${p.search_full_name ?? ""} ${p.team ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });

  const claims = useQuery({
    queryKey: ["claims", leagueId],
    queryFn: () => getClaims({ data: { leagueId } }),
    enabled: Boolean(league.data?.hosted),
  });

  // The bid and the drop belong to a claim, not to the page. Everything the
  // button and the dialog need comes from here so the wire and the player page
  // cannot disagree about whether you may add someone.
  const claim = useClaim(leagueId);
  const mineId = league.data?.myRosterId;
  const drafted = league.data?.draftStatus === "complete";
  // A cancelled or settled claim is finished business — the list is what is
  // still live, not a history of everything you ever tried.
  const pendingClaims = (claims.data?.items ?? []).filter((c) => c.status === "pending");

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(search.page ?? 1, pageCount);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const shownRows = isPhone ? rows.slice(0, visible) : pageRows;
  useWarmRosterProfiles(
    leagueId,
    (isPhone ? rows.slice(0, 16) : pageRows).map((p) => p.player_id),
  );

  // A new scope/pos/search resets the continuous list back to its first page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope/pos/needle are the deliberate reset triggers even though the body doesn't read them
  useEffect(() => {
    setVisible(25);
  }, [scope, pos, needle]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !isPhone) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => (v < rows.length ? v + 25 : v));
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isPhone, rows.length]);

  function setSearch(next: Partial<WireSearch>) {
    void navigate({
      search: (prev) => {
        const scopeNext = next.scope ?? prev.scope ?? "available";
        const posNext = next.pos ?? prev.pos ?? "ALL";
        const pageNext = next.page ?? 1;
        return {
          scope: scopeNext === "available" ? undefined : scopeNext,
          pos: posNext === "ALL" ? undefined : posNext,
          page: pageNext > 1 ? pageNext : undefined,
        };
      },
      replace: true,
    });
  }

  const wireCopy = !league.data?.hosted
    ? `Everyone not on a roster, ranked by ${league.data?.league.season ?? ""} PPR. Read-only peek.`
    : !drafted
      ? "The wire opens after the draft. Right now you can browse the pool; adds, drops, and FAAB start once the board is final."
      : league.data.ops?.waiverType === "none"
        ? "Free agency only. Instant add/drop. No claims queue."
        : league.data.ops?.waiversOpen
          ? league.data.ops.waiverType === "rolling"
            ? `Waivers are open. Claims process Wednesday in waiver order (you are #${
                league.data.standings.find((s) => s.rosterId === mineId)?.waiverPos ?? "—"
              }). After they run, leftovers are free agents — anyone just dropped still sits on waivers.`
            : `Waivers are open. Bid FAAB — you have $${league.data.faabRemaining ?? 100} left. Highest bid wins; ties go to reverse standings. After they run, leftovers are free agents — anyone just dropped still sits on waivers.`
          : `Leftovers are free agents. A player dropped this week still sits on waivers until the next run. ${
              league.data.ops?.waiverType === "faab"
                ? `You have $${league.data.faabRemaining ?? 100} FAAB left.`
                : "Next run uses rolling priority."
            }`;

  const waiversOpen = Boolean(league.data?.ops?.waiversOpen);
  const emptyCopy = needle
    ? "No one matches"
    : scope === "free_agent" && waiversOpen
      ? "Waivers are open. Free agents appear after claims process."
      : scope === "all"
        ? "No players match."
        : "No available players match.";

  return (
    <div>
      <Deck>
        <button
          type="button"
          aria-label="Filters and search"
          onClick={() => setSheetOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-pill text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.8} />
        </button>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {POS.map((p) => (
            <Chip
              key={p}
              active={pos === p}
              onClick={() => {
                setSearch({ scope, pos: p });
                window.scrollTo(0, 0);
              }}
            >
              {p}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          aria-label="Find a player to claim"
          onClick={() => setSheetOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-pill bg-fg text-base font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
        >
          ＋
        </button>
      </Deck>

      <p className="max-w-xl text-sm text-muted">{wireCopy}</p>

      {pendingClaims.length ? (
        <ul className="mt-5 space-y-2">
          {pendingClaims.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm ring-card"
            >
              <span>
                {c.mine ? "Your" : "A"} claim · +{c.add.name}
                {c.drop ? ` / −${c.drop.name}` : ""}
                {c.bid != null && c.bid > 0 ? ` · $${c.bid}` : ""} · {c.status}
              </span>
              {c.mine ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    cancelClaim({ data: { leagueId, claimId: c.id } }).then(() => {
                      void qc.invalidateQueries({ queryKey: ["claims", leagueId] });
                    })
                  }
                >
                  Pull
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 hidden gap-3 sm:flex sm:flex-col">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if ((search.page ?? 1) !== 1) setSearch({ page: 1 });
          }}
          placeholder="Search players"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {SCOPES.map((s) => (
            <Chip key={s.id} active={scope === s.id} onClick={() => setSearch({ scope: s.id })}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {POS.map((p) => (
            <Chip key={p} active={pos === p} onClick={() => setSearch({ pos: p })}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      <Drawer.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-fg/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 outline-none ring-card">
            <Drawer.Handle className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />
            <Drawer.Title className="sr-only">Filters and search</Drawer.Title>
            <Drawer.Description className="sr-only">
              Search players and filter the wire by status.
            </Drawer.Description>

            <p className="microlabel mt-4">Search</p>
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if ((search.page ?? 1) !== 1) setSearch({ page: 1 });
              }}
              placeholder="Search players"
              className="mt-2"
            />

            <p className="microlabel mt-5">Status</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {SCOPES.map((s) => (
                <Chip
                  key={s.id}
                  active={scope === s.id}
                  onClick={() => {
                    setSearch({ scope: s.id });
                    window.scrollTo(0, 0);
                  }}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <div className="mt-6 overflow-x-auto rounded-xl bg-surface ring-card">
        <table className="w-full text-left text-sm">
          <thead className="microlabel">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Status</th>
              <th className="px-3 py-3 text-right font-medium">Pts</th>
              <th className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody className={cn(wire.isFetching && wire.isPlaceholderData && "opacity-50")}>
            {wire.data == null ? (
              ["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
                <tr key={key} className="border-b border-line">
                  <td colSpan={4} className="px-4 py-3">
                    <Skeleton className="h-8" />
                  </td>
                </tr>
              ))
            ) : shownRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-sm text-muted">
                  {emptyCopy}
                </td>
              </tr>
            ) : (
              shownRows.map((p) => (
                <tr key={p.player_id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/league/$leagueId/player/$playerId"
                      params={{ leagueId, playerId: p.player_id }}
                      preload="intent"
                      className="rounded-md"
                      onPointerEnter={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                      onPointerDown={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                      onFocus={() => void prefetchPlayerProfile(qc, leagueId, p.player_id)}
                    >
                      <PlayerCell player={p} compact />
                    </Link>
                    <div className="mt-1 sm:hidden">
                      <StatusCell player={p} />
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <StatusCell player={p} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatPts(p.pts, 1)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ClaimButton
                      size="sm"
                      verdict={claim.verdictFor(
                        p.player_id,
                        p.ownedBy,
                        p.availability === "waiver",
                      )}
                      leagueId={leagueId}
                      playerId={p.player_id}
                      ownerRosterId={p.ownedBy?.rosterId}
                      onClaim={() =>
                        claim.setTarget({
                          player: p,
                          name: p.full_name,
                          headshot: headshotFor(p),
                          action:
                            claim.verdictFor(p.player_id, p.ownedBy, p.availability === "waiver")
                              .kind === "mine"
                              ? "drop"
                              : "add",
                          onWaivers: p.availability === "waiver",
                        })
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {wire.isSuccess && rows.length > 0 ? (
          <div className="hidden border-t border-line sm:block">
            <TablePager
              page={page}
              pageCount={pageCount}
              total={rows.length}
              pageSize={PAGE_SIZE}
              onPage={(next) => setSearch({ scope, pos, page: next })}
            />
          </div>
        ) : null}
        {wire.isSuccess && rows.length > 0 ? (
          <div className="microlabel border-t border-line px-4 py-3 sm:hidden">
            {rows.length} players · showing {Math.min(visible, rows.length)}
          </div>
        ) : null}
      </div>
      {isPhone ? <div ref={sentinelRef} className="h-px" /> : null}

      <ClaimDialog
        open={claim.open}
        onOpenChange={(next) => {
          if (!next) claim.setTarget(null);
        }}
        leagueId={leagueId}
        target={claim.target}
        mode={claim.mode}
        waiverType={claim.waiverType}
        faabRemaining={claim.faabRemaining}
        waiverPos={claim.waiverPos}
        droppable={claim.droppable}
        mustDrop={claim.mustDrop}
        rosterCount={claim.rosterCount}
        rosterCap={claim.rosterCap}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-sm px-3 font-mono text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
        active ? "bg-accent text-accent-fg" : "bg-raised text-muted",
      )}
    >
      {children}
    </button>
  );
}

function StatusCell({ player }: { player: WirePlayer }) {
  if (player.availability === "rostered") {
    return <span className="text-xs text-muted">{player.ownedBy?.teamName ?? "Rostered"}</span>;
  }
  if (player.availability === "waiver") return <Badge>Waiver</Badge>;
  return <Badge tone="muted">FA</Badge>;
}
