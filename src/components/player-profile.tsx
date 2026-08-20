import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { InjuryMark, injuryMark } from "@/components/player-cell";
import { displayName, headshotFor, type Profile } from "@/lib/data/player-view";
import { isDefense } from "@/lib/data/teams";
import type { GameChip, PlayerNote, PlayerScheduleGame, SlimPlayer } from "@/lib/data/types";
import { cn, formatPts } from "@/lib/utils";

export type LeagueContext = { label: string; rows: [string, string][] } | null;

/* ---------------------------------------------------------------- sections */

export function ProfileIdentity({
  player,
  size = "md",
  context,
  children,
}: {
  player: SlimPlayer;
  size?: "md" | "lg";
  context?: LeagueContext;
  children?: React.ReactNode;
}) {
  const role = [player.position, player.team, player.number ? `#${player.number}` : null]
    .filter(Boolean)
    .join(" · ");
  const book = [
    player.age != null ? String(player.age) : null,
    player.years_exp != null ? `${player.years_exp} yr${player.years_exp === 1 ? "" : "s"}` : null,
    player.college,
    player.depth_chart_order ? `depth #${player.depth_chart_order}` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-start gap-3">
      <Avatar
        src={headshotFor(player)}
        name={displayName(player)}
        className={size === "lg" ? "size-18" : "size-14"}
        textClassName={size === "lg" ? "text-base" : "text-sm"}
      />
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "font-display font-extrabold leading-tight tracking-[-0.035em]",
            size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl",
          )}
        >
          {displayName(player)}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {role ? <span className="microlabel-data">{role}</span> : null}
          {isDefense(player.position) ? null : <InjuryMark status={player.injury_status} />}
        </div>
        {book.length ? <p className="mt-1 microlabel-data">{book.join(" · ")}</p> : null}
        {context?.label ? <p className="mt-1 text-[13px] text-muted">{context.label}</p> : null}
      </div>
      {children}
    </div>
  );
}

export type StatsHint = {
  season?: string;
  points?: number | null;
  perGame?: number | null;
  posRank?: number | null;
  gamesPlayed?: number | null;
};

export function ProfileStats({
  p,
  player,
  hint,
}: {
  p?: Profile | null;
  player: SlimPlayer;
  hint?: StatsHint;
}) {
  const season = p?.season ?? hint?.season ?? "";
  const points = p?.points ?? hint?.points;
  const perGame = p?.perGame ?? hint?.perGame;
  const posRank = p?.posRank ?? hint?.posRank;
  const games = p?.gamesPlayed ?? hint?.gamesPlayed;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4">
      <Stat
        value={points != null ? formatPts(points, 1) : "—"}
        label={`${season || "Season"} pts`}
      />
      <Stat value={perGame != null ? formatPts(perGame, 1) : "—"} label="per game" />
      <Stat value={posRank ? `${player.position ?? ""}${posRank}` : "—"} label="position rank" />
      <Stat value={games != null ? String(games) : "—"} label="games" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-b border-line px-5 py-3 last:border-r-0 sm:border-b-0">
      <span className="block font-mono text-xl font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 block microlabel-data">{label}</span>
    </div>
  );
}

export function Section({
  title,
  meta,
  children,
  bare = false,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <section className={cn(!bare && "border-b border-line last:border-0")}>
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1.5">
        <h2 className="font-display text-base font-bold tracking-[-0.03em]">{title}</h2>
        {meta ? <span className="microlabel-data">{meta}</span> : null}
      </header>
      <div className="pb-3">{children}</div>
    </section>
  );
}

export function Row({ k, v, tone }: { k: string; v: string; tone?: "loss" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-1.5">
      <span className="text-sm text-muted">{k}</span>
      <span
        className={cn(
          "font-mono text-sm font-medium tabular-nums",
          tone === "loss" && "text-loss",
          tone === "warn" && "text-warn",
        )}
      >
        {v}
      </span>
    </div>
  );
}

export function ProfileNews({ notes }: { notes: PlayerNote[] }) {
  const [open, setOpen] = useState(false);
  if (notes.length === 0) {
    return (
      <Section title="News">
        <p className="px-5 text-sm text-muted">No player notes yet.</p>
      </Section>
    );
  }
  const lead = notes[0];
  if (!lead) {
    return (
      <Section title="News">
        <p className="px-5 text-sm text-muted">No player notes yet.</p>
      </Section>
    );
  }
  const rest = notes.slice(1);
  const body = lead.text && lead.text !== lead.headline ? lead.text : "";
  const long = body.length > 160 || rest.length > 0;
  return (
    <Section title="News" meta={lead.source}>
      <div className="px-5 pb-1">
        <p className="microlabel-data">{noteWhen(lead.date)}</p>
        <p className="mt-1 text-sm font-semibold leading-snug">{lead.headline}</p>
        {body ? (
          <p className={cn("mt-1 text-[13px] leading-relaxed text-muted", !open && "line-clamp-3")}>
            {body}
          </p>
        ) : null}
        {open
          ? rest.map((n) => (
              <div key={n.id} className="mt-3 border-t border-line pt-3">
                <p className="microlabel-data">{noteWhen(n.date)}</p>
                <p className="mt-1 text-sm font-semibold leading-snug">{n.headline}</p>
                {n.text && n.text !== n.headline ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.text}</p>
                ) : null}
              </div>
            ))
          : null}
        {long ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 microlabel-data text-accent-strong"
          >
            {open ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </Section>
  );
}

export function ProfileSchedule({
  games,
  week,
}: {
  games: PlayerScheduleGame[];
  week: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (games.length === 0) {
    return (
      <Section title="Schedule">
        <p className="px-5 text-sm text-muted">No slate for this team yet.</p>
      </Section>
    );
  }
  const upcoming = games.filter((g) => g.week >= week).slice(0, 3);
  const shown = open ? games : upcoming;
  return (
    <Section title="Schedule" meta={open ? `${games.length} weeks` : "Next 3"}>
      <ul>
        {shown.map((g) => {
          const now = g.week === week;
          return (
            <li
              key={`${g.week}-${g.opp}`}
              className={cn(
                "flex items-baseline justify-between gap-3 px-5 py-1.5",
                now && "bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]",
              )}
            >
              <span className="w-10 shrink-0 microlabel-data">W{g.week}</span>
              <span className={cn("min-w-0 flex-1 truncate text-sm", g.bye && "text-muted")}>
                {g.opp}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {g.bye ? "Bye" : g.detail}
              </span>
            </li>
          );
        })}
      </ul>
      {games.length > upcoming.length ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-5 pt-1 pb-2 microlabel-data text-accent-strong"
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </Section>
  );
}

function noteWhen(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProfileThisWeek({
  p,
  player,
  game,
}: {
  p: Profile;
  player: SlimPlayer;
  game?: GameChip | null;
}) {
  const bye = p.schedule.find((g) => g.bye)?.week ?? p.byeWeek;
  const slate = p.schedule.find((g) => g.week === p.slateWeek) ?? null;
  const opp = game?.opp ?? (slate?.bye ? "Bye" : slate?.opp) ?? "—";
  const detail = game?.detail || slateDetail(slate);
  const mark = injuryMark(player.injury_status);
  const def = isDefense(player.position);
  return (
    <Section title="This week">
      <Row k="Opponent" v={opp} />
      <Row k="Game" v={detail} />
      {def ? null : (
        <Row
          k="Status"
          v={mark?.label ?? player.injury_status ?? "No designation"}
          tone={mark?.tone}
        />
      )}
      <Row k="Bye week" v={bye ? `Week ${bye}` : "Unknown"} />
    </Section>
  );
}

function slateDetail(slate: PlayerScheduleGame | null): string {
  if (!slate) return "Not scheduled";
  if (slate.bye) return "Bye week";
  if (slate.detail) return slate.detail;
  if (!slate.date) return "Scheduled";
  const d = new Date(slate.date);
  if (Number.isNaN(d.getTime())) return "Scheduled";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Splits, grouped by phase of the game. A group only appears if the player
 * logged something in it, so a receiver is not told he threw for zero yards.
 * Within a shown group every line stays, because a running back with zero
 * rushing touchdowns is a fact worth reading.
 */
const SPLIT_GROUPS: { keys: [string, string][] }[] = [
  {
    keys: [
      ["pass_yd", "Passing yards"],
      ["pass_td", "Passing TD"],
      ["pass_int", "Interceptions"],
    ],
  },
  {
    keys: [
      ["rush_yd", "Rushing yards"],
      ["rush_td", "Rushing TD"],
    ],
  },
  {
    keys: [
      ["rec", "Receptions"],
      ["rec_yd", "Receiving yards"],
      ["rec_td", "Receiving TD"],
    ],
  },
  { keys: [["fum_lost", "Fumbles lost"]] },
  {
    keys: [
      ["fgm", "Field goals"],
      ["xpm", "PATs"],
      ["fgm_50p", "FG 50+"],
    ],
  },
  {
    keys: [
      ["sack", "Sacks"],
      ["int", "Interceptions"],
      ["fum_rec", "Fumble recoveries"],
      ["def_td", "Defensive TD"],
      ["blk_kick", "Blocked kicks"],
      ["pts_allow", "Points allowed"],
      ["yds_allow", "Yards allowed"],
    ],
  },
];

export function ProfileSplits({ p }: { p: Profile }) {
  const groups = SPLIT_GROUPS.map((g) => g.keys.filter(([key]) => p.splits[key] != null)).filter(
    (rows) => rows.some(([key]) => (p.splits[key] ?? 0) !== 0),
  );

  if (groups.length === 0) {
    return (
      <Section title={`${p.season} splits`}>
        <p className="px-5 text-sm text-muted">No season splits recorded.</p>
      </Section>
    );
  }

  return (
    <Section title={`${p.season} splits`} meta="Season totals">
      {groups.map((rows, i) => (
        <div key={i} className={i > 0 ? "mt-1 border-t border-line pt-1" : undefined}>
          {rows.map(([key, label]) => (
            <Row key={key} k={label} v={fmt(p.splits[key]!)} />
          ))}
        </div>
      ))}
    </Section>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

/**
 * Last season's unofficial weeks. Green met the dashed per-game line;
 * cooler gray missed it. Empty slots are byes or games not played.
 */
export function ProfileGameLog({
  weekly,
  bye,
  perGame,
  tall = false,
}: {
  weekly: Profile["weekly"];
  bye: number | null;
  perGame: number;
  tall?: boolean;
}) {
  const drawn = weekly.filter((v): v is NonNullable<Profile["weekly"][number]> => v != null);
  if (drawn.length === 0) {
    return (
      <Section title="Week by week">
        <p className="px-5 text-sm text-muted">No games recorded for this season yet.</p>
      </Section>
    );
  }
  const top = Math.max(...drawn.map((b) => b.pts), perGame) * 1.15 || 1;
  const actuals = drawn.filter((b) => b.kind === "actual");
  const best = actuals.length ? Math.max(...actuals.map((b) => b.pts)) : null;

  return (
    <Section title="Week by week" meta={`Avg ${formatPts(perGame, 1)}`}>
      <div className="px-5 pt-2">
        <div className={cn("relative flex items-end gap-[2px]", tall ? "h-48" : "h-32")}>
          {weekly.map((bar, i) => {
            const week = i + 1;
            const isBye = bye === week;
            if (bar == null) {
              return (
                <span
                  key={week}
                  title={isBye ? `Week ${week} · bye` : `Week ${week} · no game`}
                  className="flex h-full flex-1 items-end"
                >
                  <span
                    className={cn("h-2.5 w-full rounded-xs", isBye ? "bg-line-strong" : "bg-line")}
                  />
                </span>
              );
            }
            const met = bar.kind === "actual" && bar.pts + 0.05 >= perGame;
            const fill =
              bar.kind === "proj" ? "bg-faint/35" : met ? "bg-accent-strong" : "bg-faint";
            const label =
              bar.kind === "proj"
                ? `Week ${week} · ${formatPts(bar.pts, 1)} proj`
                : `Week ${week} · ${formatPts(bar.pts, 1)}${met ? "" : " · below line"}`;
            return (
              <span key={week} title={label} className="relative flex h-full flex-1 items-end">
                {best != null && bar.kind === "actual" && bar.pts === best ? (
                  <span className="absolute inset-x-0 -top-1 text-center font-mono text-[9px] font-semibold">
                    {formatPts(bar.pts, 1)}
                  </span>
                ) : null}
                <span
                  className={cn("w-full rounded-t-xs", fill)}
                  style={{ height: `${Math.max((bar.pts / top) * 100, 2)}%` }}
                />
              </span>
            );
          })}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint"
            style={{ bottom: `${(perGame / top) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex gap-[2px] border-t border-line pt-1">
          {weekly.map((_, i) => (
            <span
              key={i}
              className="flex-1 text-center font-mono text-[8px] leading-none text-faint"
            >
              {i % 2 === 0 ? i + 1 : ""}
            </span>
          ))}
        </div>
        <p className="pt-2 pb-1 text-xs text-faint">
          Green beat the dashed line. Gray missed it.
          {bye ? ` Bye in week ${bye}.` : ""} Blank weeks are games not played.
        </p>
      </div>
    </Section>
  );
}
