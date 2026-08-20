import { useId, useState } from "react";
import { injuryMark } from "@/components/player-cell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { playerSearchKeys } from "@/lib/data/player-plays";
import type { ActivityItem, NewsItem, RosterPlayer } from "@/lib/data/types";
import type { Phase } from "@/lib/league/phase";
import { elapsedShort, formatPts } from "@/lib/utils";

/**
 * Before kickoff this is a status board, not a scoreboard.
 *
 * Sleeper's daily map is the record of *what* changed (`injury_status`,
 * body part, `news_updated`). RotoWire supplies *why* when the five-item
 * window caught that player. ESPN league headlines only appear if they
 * actually name someone on this roster.
 *
 * One player, one row: a designation, a waiver claim, and a drop on the
 * same guy merge into a single line instead of three near-duplicates.
 * Rows run newest first, capped at three with the rest behind "Show all".
 *
 *   before kickoff  status per player, newest first
 *   live / settled  what your starters actually did, best first
 */
const SHOWN = 3;

export function PlayerFeed({
  phase,
  players,
  activity,
  news,
  loading,
}: {
  phase: Phase;
  players: RosterPlayer[];
  activity: ActivityItem[];
  news: NewsItem[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rows =
    phase === "live" || phase === "settled"
      ? scoringRows(players)
      : statusRows(players, activity, news);

  // Hiding a single row behind a "+1 more" costs more room than the row did.
  const cut = rows.length > SHOWN + 1 ? rows.length - SHOWN : 0;
  const visible = open || !cut ? rows : rows.slice(0, SHOWN);

  return (
    <section className="rounded-xl bg-surface ring-card">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Your players</h2>
        <span className="microlabel-data">
          {phase === "live" || phase === "settled" ? "This week" : "Status"}
        </span>
      </header>
      {loading ? (
        <div className="space-y-2 px-5 pb-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">
          Nothing flagged on your roster. Quiet is good.
        </p>
      ) : (
        <ul id={listId}>
          {visible.map((r) => {
            const when = r.when != null ? elapsedShort(r.when) : null;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0"
              >
                {/* The name leads. Leading with the chip let a long designation
                    push the names right, so no two started at the same place. */}
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold tracking-[-0.01em]">
                      {r.title}
                    </span>
                    {r.pos ? (
                      <span className="inline-flex h-4 shrink-0 items-center rounded-xs bg-raised px-1.5 font-mono text-[9.5px] tracking-[0.06em] text-muted">
                        {r.pos}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[13px] text-muted">{r.detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  {r.value ? (
                    <span className="block font-mono text-[13px] font-semibold tabular-nums">
                      {r.value}
                    </span>
                  ) : r.tag ? (
                    <Badge tone={r.tone}>{r.tag}</Badge>
                  ) : null}
                  {when ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-faint">{when}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && cut ? (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          {/* Say what was cut. A silent slice reads as "that is all of them". */}
          <span className="microlabel-data">{open ? `All ${rows.length}` : `+${cut} more`}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
            className="-my-3 inline-flex h-11 items-center microlabel-data text-accent-strong"
          >
            {open ? "Show less" : "Show all"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type Row = {
  id: string;
  tag: string | null;
  tone: "loss" | "win" | "default" | "warn";
  title: string;
  pos: string | null;
  detail: string;
  value?: string;
  /** Epoch ms of the newest event behind this row; null when undated. */
  when: number | null;
};

/** Live and settled: what your starters actually did. */
function scoringRows(players: RosterPlayer[]): Row[] {
  return players
    .filter((p) => p.slot === "starter" && p.weekPts != null)
    .sort((a, b) => (b.weekPts ?? 0) - (a.weekPts ?? 0))
    .map((p) => ({
      id: p.player_id,
      tag: null,
      tone: "default" as const,
      title: p.full_name,
      pos: p.starterSlot ?? p.position ?? null,
      detail: [p.team, p.game?.detail].filter(Boolean).join(" · ") || "No game data",
      value: formatPts(p.weekPts, 1),
      when: null,
    }));
}

/** Before kickoff: what might cost you points, one row per player. */
function statusRows(players: RosterPlayer[], activity: ActivityItem[], news: NewsItem[]): Row[] {
  const mine = players.filter((p) => p.slot !== "taxi");
  const byPlayer = new Map<string, { bits: string[]; row: Row }>();

  for (const p of mine) {
    const s = (p.injury_status ?? "").trim();
    if (!s && !p.latest_note) continue;
    const mark = injuryMark(s);
    const bits = [
      p.injury_body_part,
      p.latest_note?.headline ??
        p.injury_notes ??
        (p.slot === "starter" ? `starting at ${p.starterSlot}` : "on your bench"),
    ].filter((b): b is string => Boolean(b));
    byPlayer.set(p.player_id, {
      bits,
      row: {
        id: `status-${p.player_id}`,
        tag: mark?.label ?? (s ? s.toUpperCase() : "Note"),
        tone: mark?.tone ?? "default",
        title: p.full_name,
        pos: p.position ?? null,
        detail: "",
        when: toMs(p.latest_note?.date ?? p.news_updated),
      },
    });
  }

  const ids = new Set(mine.map((p) => p.player_id));
  for (const item of activity.slice(0, 12)) {
    const add = item.adds.find((a) => ids.has(a.playerId));
    const drop = item.drops.find((d) => ids.has(d.playerId));
    const hit = add ?? drop;
    if (!hit) continue;
    // A zero-dollar winning bid is still a price, so only null means "no bid".
    const fragment = add ? `claimed${item.bid != null ? ` $${item.bid}` : ""}` : "dropped";
    const existing = byPlayer.get(hit.playerId);
    if (existing) {
      // The designation keeps the badge; the move joins the story line.
      existing.bits.push(fragment);
      existing.row.when = Math.max(existing.row.when ?? 0, item.created);
      continue;
    }
    byPlayer.set(hit.playerId, {
      bits: [
        `${item.teamNames.join(", ") || "Someone"} · ${item.type}${
          item.bid != null ? ` · $${item.bid}` : ""
        }`,
      ],
      row: {
        id: `move-${item.id}-${hit.playerId}`,
        tag: add ? "Add" : "Drop",
        tone: "default",
        title: hit.name,
        pos: hit.pos,
        detail: "",
        when: item.created,
      },
    });
  }

  // ESPN's feed is league-wide, so only surface a headline when it actually
  // names somebody on this roster — and only if that player has no row yet.
  const keys = mine.map((p) => ({ p, keys: playerSearchKeys(p) }));
  for (const n of news) {
    const hay = `${n.headline} ${n.description}`.toLowerCase();
    const match = keys.find(({ keys: k }) => k.some((key) => key.length > 4 && hay.includes(key)));
    if (!match || byPlayer.has(match.p.player_id)) continue;
    byPlayer.set(match.p.player_id, {
      bits: [n.headline],
      row: {
        id: `news-${n.id}`,
        tag: "News",
        tone: "default",
        title: match.p.full_name,
        pos: match.p.position ?? null,
        detail: "",
        when: toMs(n.published),
      },
    });
  }

  return [...byPlayer.values()]
    .map(({ bits, row }) => ({ ...row, detail: bits.join(" · ") }))
    .sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
}

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}
