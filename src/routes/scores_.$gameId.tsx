import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Star } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Avatar } from "@/components/avatar";
import { Deck } from "@/components/deck";
import { PlayerPeek } from "@/components/player-peek";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGameSummary } from "@/lib/data/fns";
import { drivesForLiveFeed, fieldPct, spotFromSituation, withLiveSnap } from "@/lib/data/game-feed";
import { formatPlayPts, playCredits } from "@/lib/data/play-points";
import { type PlaySegment, type TrackedPlayer, tagPlayText } from "@/lib/data/play-tags";
import { canonTeam, isDefense, playerHeadshot, playerTeam, teamLogo } from "@/lib/data/teams";
import type { BoxRow, GameDrive, GamePlay, GameSummary, TeamBox } from "@/lib/data/types";
import { type GameTracking, useGameTracking } from "@/lib/data/use-game-tracking";
import { useSwipe } from "@/lib/swipe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scores_/$gameId")({
  component: GamePage,
});

type Tab = "plays" | "box" | "scoring";
type Filter = "all" | "scoring";

/** Which name is open, and on which play — so a 4s refetch does not close it. */
type Peek = { key: string; tracked: TrackedPlayer };

function GamePage() {
  const { gameId } = Route.useParams();
  const [tab, setTab] = useState<Tab>("plays");
  const [filter, setFilter] = useState<Filter>("all");
  const [peek, setPeek] = useState<Peek | null>(null);
  const closePeek = useCallback(() => setPeek(null), []);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paneH, setPaneH] = useState<number>();
  const q = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getGameSummary({ data: { gameId } }),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "in") return 4_000;
      if (state === "pre") return 20_000;
      return false;
    },
  });
  const tracking = useGameTracking(q.data);
  const g = q.data;
  const live = g?.state === "in";
  const tracked = tracking.tracked;
  const activeFilter: Filter = filter;

  const scoringCount = g?.scoring.length ?? 0;
  const TABS = useMemo(
    () =>
      [
        ["plays", "Plays"],
        ["box", "Box"],
        ["scoring", scoringCount ? `Scoring · ${scoringCount}` : "Scoring"],
      ] as const,
    [scoringCount],
  );
  const idx = TABS.findIndex(([id]) => id === tab);

  const pickTab = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(TABS.length - 1, i));
      setTab(TABS[clamped][0]);
      // Tab switches are high-frequency product UI: no easing, no travel.
      // The new pane paints immediately, reading from the top.
      window.scrollTo(0, 0);
    },
    [TABS],
  );

  const onTablistKeys = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        pickTab(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        pickTab(idx - 1);
      }
    },
    [idx, pickTab],
  );

  // A deliberate sideways touch drag switches panes; a vertical scroll never
  // does. The panes are transform-driven — there is no free x-scroll to drift.
  const swipe = useSwipe((dir) => pickTab(idx + dir));
  const atEdge = (idx === 0 && swipe.drag > 0) || (idx === TABS.length - 1 && swipe.drag < 0);
  const edgeDrag = atEdge ? swipe.drag / 3 : swipe.drag;

  // Rail gets a hairline once its 1px sentinel scrolls out of view (i.e. it's
  // stuck). The sentinel only mounts once the loading skeleton gives way to
  // the real page, so re-run when data first lands to pick up the ref.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reattaches once the sentinel node exists (data load), not read directly in the effect body
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry) setStuck(!entry.isIntersecting);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [g != null]);

  // Height-sync the snap row to the active pane so short panes don't trail
  // empty space and the row doesn't clamp to the tallest pane. Re-measures
  // on tab change (via idx) and whenever fresh game data lands.
  // biome-ignore lint/correctness/useExhaustiveDependencies: g drives a remeasure on live refetches even though it isn't read in the effect body
  useLayoutEffect(() => {
    const el = paneRefs.current[idx];
    if (!el) return;
    setPaneH(el.scrollHeight);
  }, [idx, g]);

  useEffect(() => {
    const el = paneRefs.current[idx];
    if (!el) return;
    const ro = new ResizeObserver(() => setPaneH(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx]);

  return (
    <Shell>
      {q.data == null && q.isPending ? (
        <>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-4 h-36" />
          <Skeleton className="mt-4 h-80" />
        </>
      ) : q.error || !g ? (
        <>
          <Back />
          <p className="mt-4 text-sm text-muted">Could not load that box score.</p>
        </>
      ) : (
        <>
          <Back />
          <ScoreHead g={g} live={live} />

          <Deck>
            <div
              role="tablist"
              aria-label="Game views"
              onKeyDown={onTablistKeys}
              className="flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5"
            >
              {TABS.map(([id, label], i) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => pickTab(i)}
                  className={cn(
                    "h-8 rounded-pill px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep",
                    tab === id ? "bg-fg text-bg" : "text-faint hover:text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "plays" && g.drives.length ? (
              <div className="flex shrink-0 gap-1">
                <FilterChip on={activeFilter === "all"} onClick={() => setFilter("all")}>
                  All
                </FilterChip>
                <FilterChip on={activeFilter === "scoring"} onClick={() => setFilter("scoring")}>
                  Scoring
                </FilterChip>
              </div>
            ) : null}
          </Deck>

          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
          <div
            className={cn(
              "hidden sm:block sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 mt-4 bg-bg/90 px-4 py-2 backdrop-blur-md",
              stuck && "border-b border-line",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Game views"
                onKeyDown={onTablistKeys}
                className="flex shrink-0 items-center gap-0.5 rounded-pill bg-raised p-0.5"
              >
                {TABS.map(([id, label], i) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    tabIndex={tab === id ? 0 : -1}
                    onClick={() => pickTab(i)}
                    className={cn(
                      "h-8 rounded-pill px-3.5 text-sm font-medium transition-colors duration-150",
                      tab === id ? "bg-fg text-bg" : "text-faint hover:text-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "plays" && g.drives.length ? (
                <div className="flex gap-1">
                  <FilterChip on={activeFilter === "all"} onClick={() => setFilter("all")}>
                    All
                  </FilterChip>
                  <FilterChip on={activeFilter === "scoring"} onClick={() => setFilter("scoring")}>
                    Scoring
                  </FilterChip>
                </div>
              ) : null}
            </div>
          </div>

          <div className="-mx-4 overflow-hidden" style={paneH ? { height: paneH } : undefined}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: touch-swipe surface; the rail tablist above is the keyboard/AT path */}
            <div
              {...swipe.handlers}
              className="flex touch-pan-y items-start"
              style={{ transform: `translateX(calc(${idx * -100}% + ${edgeDrag}px))` }}
            >
              <div
                ref={(el) => {
                  paneRefs.current[0] = el;
                }}
                className="w-full shrink-0 overflow-hidden px-4"
              >
                <PlayFeed
                  g={g}
                  live={live}
                  filter={activeFilter}
                  tracking={tracking}
                  peek={peek}
                  setPeek={setPeek}
                  closePeek={closePeek}
                />
              </div>
              <div
                ref={(el) => {
                  paneRefs.current[1] = el;
                }}
                className="w-full shrink-0 overflow-hidden px-4"
              >
                <BoxTables g={g} tracked={tracked} />
              </div>
              <div
                ref={(el) => {
                  paneRefs.current[2] = el;
                }}
                className="w-full shrink-0 overflow-hidden px-4"
              >
                <ScoringList
                  g={g}
                  tracking={tracking}
                  peek={peek}
                  setPeek={setPeek}
                  closePeek={closePeek}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function Back() {
  return (
    <Link
      to="/scores"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ChevronLeft className="size-4" strokeWidth={1.75} />
      NFL scores
    </Link>
  );
}

function FilterChip({
  on,
  onClick,
  tone = "default",
  children,
}: {
  on: boolean;
  onClick: () => void;
  tone?: "default" | "accent";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 font-mono text-xs tracking-wide",
        on && tone === "accent" && "bg-accent/15 text-accent-strong",
        on && tone === "default" && "bg-raised text-fg",
        !on && "text-muted hover:bg-raised",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ head */

function ScoreHead({ g, live }: { g: GameSummary; live: boolean }) {
  const awayDim = g.state === "post" && g.away.winner === false;
  const homeDim = g.state === "post" && g.home.winner === false;
  const poss = live ? canonTeam(g.possession) : null;
  return (
    <section className="mt-4 rounded-xl bg-surface px-4 py-5 ring-card sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="microlabel">
          {g.seasonType === "pre"
            ? "Preseason"
            : g.seasonType === "post"
              ? "Postseason"
              : "Regular"}{" "}
          · Week {g.week} · {g.season}
        </p>
        <Badge tone={live ? "live" : g.state === "post" ? "win" : "default"}>
          {live ? g.detail || "Live" : g.detail || "Scheduled"}
        </Badge>
      </div>
      <TeamScore
        team={g.away}
        dim={awayDim}
        ball={poss != null && poss === canonTeam(g.away.abbr)}
      />
      <div className="my-2" />
      <TeamScore
        team={g.home}
        dim={homeDim}
        ball={poss != null && poss === canonTeam(g.home.abbr)}
      />
      {live && (g.situation || g.possession) ? (
        <p className="mt-4 font-mono text-xs text-live">
          {g.possession ? `${g.possession} ball` : null}
          {g.possession && g.situation ? " · " : null}
          {g.situation}
        </p>
      ) : null}
      {g.lastPlay ? (
        <p className="mt-2 text-sm text-muted">
          <span className="microlabel">Last play </span>
          {g.lastPlay}
        </p>
      ) : null}
      {live ? <p className="mt-3 microlabel">Public ESPN box · ticks every 4s</p> : null}
    </section>
  );
}

function Football({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-35 12 12)" />
      <path
        d="M8.2 14.6l7.6-5.2"
        stroke="var(--paper-raised)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TeamScore({
  team,
  dim,
  ball,
}: {
  team: GameSummary["home"];
  dim: boolean;
  ball: boolean;
}) {
  const logo = team.logo || teamLogo(team.abbr);
  return (
    <div className={cn("flex items-center gap-3", dim && "opacity-45")}>
      {logo ? (
        <img src={logo} alt="" className="size-9 object-contain" />
      ) : (
        <span className="size-9 rounded-sm bg-raised" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-lg">
          <span className="truncate">{team.name}</span>
          {ball ? (
            <span
              title="Has the ball"
              className="inline-flex shrink-0 items-center gap-1 text-live"
            >
              <Football className="size-3.5" />
              <span className="sr-only">has the ball</span>
            </span>
          ) : null}
        </p>
        {team.record ? <p className="font-mono text-[11px] text-faint">{team.record}</p> : null}
      </div>
      <p className="font-display text-4xl tabular-nums tracking-tight">{team.score || "—"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ plays */

type PeekProps = {
  tracking: GameTracking;
  peek: Peek | null;
  setPeek: (p: Peek | null) => void;
  closePeek: () => void;
};

function PlayFeed({
  g,
  live,
  filter,
  tracking,
  peek,
  setPeek,
  closePeek,
}: { g: GameSummary; live: boolean; filter: Filter } & PeekProps) {
  const drives = useMemo(() => {
    const ordered = drivesForLiveFeed(g.drives, live);
    const pinned = live ? withLiveSnap(ordered, g.lastPlay, g.detail) : ordered;
    if (filter === "all") return pinned;
    return pinned
      .map((d) => ({
        ...d,
        plays: d.plays.filter((p) => p.scoring),
      }))
      .filter((d) => d.plays.length);
  }, [g.drives, g.lastPlay, g.detail, live, filter]);

  if (!g.drives.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre"
          ? "No plays yet — waiting on kickoff."
          : "No play-by-play posted for this game."}
      </p>
    );
  }
  if (!drives.length) {
    return <p className="mt-4 text-sm text-muted">No scoring plays yet.</p>;
  }
  const poss = live ? canonTeam(g.possession) : null;
  return (
    <div className="mt-3 space-y-3">
      {drives.map((d, i) => {
        const isLive = live && i === 0 && filter === "all";
        return (
          <DriveCard
            key={d.id}
            d={d}
            g={g}
            isLive={isLive}
            poss={poss}
            tracking={tracking}
            peek={peek}
            setPeek={setPeek}
            closePeek={closePeek}
          />
        );
      })}
    </div>
  );
}

function DriveCard({
  d,
  g,
  isLive,
  poss,
  tracking,
  peek,
  setPeek,
  closePeek,
}: { d: GameDrive; g: GameSummary; isLive: boolean; poss: string | null } & PeekProps) {
  const meta = [d.result, d.description].filter(Boolean).join(" · ");
  const driveTeam = canonTeam(d.team);
  // ESPN keeps a finished drive "current" until the next one opens (the
  // kickoff lands on it). Down-and-distance belongs to whoever has the ball.
  const onBall = isLive && driveTeam != null && (poss == null || poss === driveTeam);
  const start = onBall && driveTeam ? fieldPct(driveTeam, d.start) : null;
  const ball = onBall && driveTeam ? fieldPct(driveTeam, spotFromSituation(g.situation)) : null;
  return (
    <article className="rounded-xl bg-surface ring-card">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
        {d.logo ? (
          <img src={d.logo} alt={d.team} className="size-4 object-contain" />
        ) : (
          <span className="font-mono text-[10px] text-faint">{d.team}</span>
        )}
        <p className="min-w-0 flex-1 truncate microlabel">{meta || d.team || "Drive"}</p>
        {onBall && g.situation ? (
          <Badge tone="live" className="shrink-0 max-sm:max-w-[60%] max-sm:truncate">
            Live · {g.situation}
          </Badge>
        ) : isLive ? (
          <Badge tone="live" className="shrink-0">
            Live
          </Badge>
        ) : null}
      </header>
      {onBall && ball != null ? (
        <div className="px-3 pt-2.5 sm:px-4">
          <div className="relative h-1.5 overflow-hidden rounded-pill bg-raised">
            {start != null && ball > start ? (
              <span
                className="absolute inset-y-0 rounded-pill bg-accent-deep"
                style={{ left: `${start}%`, width: `${ball - start}%` }}
              />
            ) : null}
            <span className="absolute inset-y-0 w-0.5 bg-fg" style={{ left: `${ball}%` }} />
          </div>
          <div className="mt-1 flex justify-between microlabel-data">
            <span>{d.start ? `${d.start} · start` : "own goal"}</span>
            <span>{spotFromSituation(g.situation) ?? ""}</span>
            <span>goal</span>
          </div>
        </div>
      ) : null}
      <ol className="py-1">
        {d.plays.map((p) => (
          <PlayRow
            key={p.id}
            p={p}
            poss={poss}
            tracking={tracking}
            peek={peek}
            setPeek={setPeek}
            closePeek={closePeek}
          />
        ))}
      </ol>
    </article>
  );
}

function PlayRow({
  p,
  poss,
  tracking,
  peek,
  setPeek,
  closePeek,
}: { p: GamePlay; poss: string | null } & PeekProps) {
  const segs = useMemo(() => tagPlayText(p.text, tracking.tracked), [p.text, tracking.tracked]);
  const credits = useMemo(
    () => playCredits(p, segs, tracking.book).filter((c) => Math.abs(c.points) >= 0.005),
    [p, segs, tracking.book],
  );
  return (
    <li className={cn("flex items-start gap-3 px-3 py-1.5 sm:px-4", p.scoring && "bg-accent/8")}>
      <span className="w-10 shrink-0 whitespace-nowrap pt-0.5 font-mono text-[11px] leading-5 tabular-nums text-faint sm:w-16">
        <span className="max-sm:hidden">{p.period ? `Q${p.period} ` : ""}</span>
        {p.clock}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-6">
        <TaggedText
          segs={segs}
          playKey={p.id}
          poss={poss}
          tracking={tracking}
          peek={peek}
          setPeek={setPeek}
          closePeek={closePeek}
        />
      </p>
      {credits.length ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          {credits.map((c) => (
            <span
              key={c.tracked.player.player_id}
              title={`${c.tracked.player.full_name} · league points on this play`}
              className={cn(
                "font-mono text-xs leading-5 font-semibold tabular-nums",
                c.tracked.side === "mine" ? "text-accent-strong" : "text-loss",
              )}
            >
              {formatPlayPts(c.points)}
            </span>
          ))}
        </span>
      ) : p.scoring ? (
        <span className="shrink-0 font-mono text-xs leading-5 tabular-nums text-muted">
          {p.awayScore}–{p.homeScore}
        </span>
      ) : null}
    </li>
  );
}

/** Play text with tracked names turned into tappable tags. */
function TaggedText({
  segs,
  playKey,
  poss,
  tracking,
  peek,
  setPeek,
  closePeek,
}: { segs: PlaySegment[]; playKey: string; poss: string | null } & PeekProps) {
  return (
    <>
      {segs.map((s) => {
        if (s.kind === "text") return <span key={`${playKey}@${s.start}`}>{s.text}</span>;
        const key = `${playKey}:${s.tracked.player.player_id}@${s.start}`;
        const open = peek?.key === key;
        const team = playerTeam(s.tracked.player);
        const onField =
          poss != null &&
          team != null &&
          (isDefense(s.tracked.player.position) ? poss !== team : poss === team);
        return (
          <span key={key} className="relative inline-block align-baseline">
            <PlayerTag
              tracked={s.tracked}
              open={open}
              onClick={() => setPeek(open ? null : { key, tracked: s.tracked })}
            />
            {open ? (
              <PlayerPeek
                tracked={s.tracked}
                onField={onField}
                leagueId={tracking.leagueId}
                week={tracking.week}
                matchupId={tracking.matchupId}
                onClose={closePeek}
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

function PlayerTag({
  tracked,
  open,
  onClick,
}: {
  tracked: TrackedPlayer;
  open: boolean;
  onClick: () => void;
}) {
  const p = tracked.player;
  const mine = tracked.side === "mine";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "mx-0.5 inline-flex h-6 items-center gap-1 rounded-pill py-0 pr-2 pl-0.5 align-middle text-xs font-semibold whitespace-nowrap",
        mine ? "bg-accent/15 text-accent-strong" : "bg-loss/12 text-loss",
        open && (mine ? "ring-2 ring-accent-deep" : "ring-2 ring-loss/60"),
      )}
    >
      <Avatar
        src={playerHeadshot(p.player_id, p.espn_id)}
        name={p.full_name}
        className="size-5 rounded-full bg-raised"
        textClassName="text-[7px]"
      />
      {p.full_name}
    </button>
  );
}

/* ---------------------------------------------------------------- scoring */

function ScoringList({ g, tracking, peek, setPeek, closePeek }: { g: GameSummary } & PeekProps) {
  if (!g.scoring.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre" ? "Nothing on the board yet." : "No scoring plays posted."}
      </p>
    );
  }
  return (
    <ol className="mt-3 divide-y divide-line rounded-xl bg-surface ring-card">
      {g.scoring.map((s) => (
        <li key={s.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
          {s.logo ? (
            <img src={s.logo} alt="" className="mt-0.5 size-5 object-contain" />
          ) : (
            <span className="mt-0.5 w-5 font-mono text-[10px] text-faint">{s.team}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-6">
              <TaggedText
                segs={tagPlayText(s.text, tracking.tracked)}
                playKey={`s-${s.id}`}
                poss={null}
                tracking={tracking}
                peek={peek}
                setPeek={setPeek}
                closePeek={closePeek}
              />
            </p>
            <p className="font-mono text-[11px] text-faint">
              Q{s.period} {s.clock}
              {s.type ? ` · ${s.type}` : ""}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
            {s.awayScore}–{s.homeScore}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------- box */

function rowTracked(row: BoxRow, tracked: TrackedPlayer[]): TrackedPlayer | null {
  for (const t of tracked) {
    const espn = t.player.espn_id != null ? String(t.player.espn_id) : null;
    if (espn && row.id === espn) return t;
  }
  const name = row.name.toLowerCase();
  for (const t of tracked) {
    const last = (t.player.last_name ?? "").toLowerCase();
    const fi = (t.player.first_name ?? t.player.full_name)[0]?.toLowerCase();
    if (last.length > 2 && fi && name.startsWith(fi) && name.endsWith(last)) return t;
  }
  return null;
}

function BoxTables({ g, tracked }: { g: GameSummary; tracked: TrackedPlayer[] }) {
  if (!g.box.length) {
    return (
      <p className="mt-4 text-sm text-muted">
        {g.state === "pre" ? "Box opens at kickoff." : "No box score posted."}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-8">
      {g.box.map((team) => (
        <TeamBoxBlock key={team.abbr} team={team} tracked={tracked} />
      ))}
    </div>
  );
}

function TeamBoxBlock({ team, tracked }: { team: TeamBox; tracked: TrackedPlayer[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {team.logo ? <img src={team.logo} alt="" className="size-6 object-contain" /> : null}
        <h2 className="font-display text-2xl tracking-tight">{team.name}</h2>
      </div>
      {team.teamStats.length ? (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-surface px-4 py-3 ring-card sm:grid-cols-5">
          {team.teamStats.map((s) => (
            <div key={s.label}>
              <dt className="microlabel-data">{s.label}</dt>
              <dd className="font-mono text-sm tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="space-y-4">
        {team.groups.map((group) => (
          <div key={group.name} className="overflow-x-auto rounded-xl bg-surface ring-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 text-left microlabel">{group.label}</th>
                  {group.headers.map((h) => (
                    <th key={h} className="px-2 py-2 text-right microlabel">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const t = rowTracked(row, tracked);
                  return (
                    <tr
                      key={row.id}
                      className={cn("border-b border-line last:border-0", t && "bg-accent/6")}
                    >
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          {row.headshot ? (
                            <img
                              src={row.headshot}
                              alt=""
                              className="size-6 rounded-sm object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                          <span className="flex min-w-0 items-center gap-1.5 truncate">
                            {t ? (
                              <Star
                                className={cn(
                                  "size-3 shrink-0 fill-current",
                                  t.side === "mine" ? "text-accent-strong" : "text-loss",
                                )}
                                strokeWidth={0}
                                aria-label={t.side === "mine" ? "Your player" : "Opponent's player"}
                              />
                            ) : null}
                            {row.jersey ? (
                              <span className="font-mono text-[11px] text-faint">{row.jersey}</span>
                            ) : null}
                            <span className="truncate">{row.name}</span>
                          </span>
                        </span>
                      </td>
                      {row.stats.map((v, i) => (
                        <td
                          key={`${row.id}-${group.headers[i] ?? v}`}
                          className="px-2 py-1.5 text-right font-mono tabular-nums"
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
