import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/avatar";
import type { MatchupSide } from "@/lib/data/types";
import type { LineupHealth, Phase } from "@/lib/league/phase";
import { cn, formatPts } from "@/lib/utils";

/**
 * The only block on My Team allowed to raise its voice. An unfillable starting
 * slot is the one thing that can cost a manager a week with no recourse, so it
 * is the one thing that gets the alarm treatment. Everything else stays calm,
 * or the warning stops meaning anything.
 *
 * Calm is now silence. A banner that says "Roster is set" and points at a
 * lineup already on screen is a header for a page that has one — it trains
 * people to skip the top of My Team, which is exactly where the alarm lives.
 * So the hero renders only when there is something to do (a broken slot, a
 * draft to join) or something you cannot get from the board underneath it
 * (a live score, a finished week). Otherwise it returns null and the lineup
 * becomes the top of the page.
 */
export function PhaseHero(props: {
  phase: Phase;
  health: LineupHealth;
  leagueId: string;
  week: number;
  me: MatchupSide | null;
  them: MatchupSide | null;
  draftStatus: "none" | "pending" | "live" | "complete";
  editable: boolean;
  /** How many broken slots auto-fill can actually solve. */
  fixable: number;
  fixing: boolean;
  onFix: () => void;
}) {
  const { phase, health, leagueId, week, me, them, draftStatus, editable, fixable, fixing, onFix } =
    props;

  // A board still to run: there is no roster to reason about, so the draft is
  // the only thing worth pointing at. `none` is a Sleeper import — no board of
  // ours to open, so no banner.
  const drafting = draftStatus === "pending" || draftStatus === "live";
  if (phase === "preseason" && drafting) {
    return (
      <Shell tone="calm">
        <Body
          kicker={draftStatus === "live" ? "Draft is live" : "Preseason"}
          title={draftStatus === "live" ? "Your pick is waiting" : "The draft hasn't run yet"}
          body="Rosters open once the board closes. Nothing to set until then."
        />
        <Link
          to="/league/$leagueId/draft"
          params={{ leagueId }}
          className="push inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg"
        >
          {draftStatus === "live" ? "Go to the board" : "Open the draft"}
        </Link>
      </Shell>
    );
  }

  // Broken lineup outranks everything else, in every phase where it can still
  // be fixed.
  const needsFixing = editable && !health.ok && phase !== "live" && phase !== "settled";
  if (needsFixing) {
    const empty = health.issues.filter((i) => i.kind === "empty").length;
    const inactive = health.issues.filter((i) => i.kind === "inactive").length;
    const bye = health.issues.filter((i) => i.kind === "bye").length;
    return (
      <Shell tone="alarm">
        <Body
          kicker={phase === "gameday" ? "Games have started" : "Before kickoff"}
          title={`${health.issues.length} ${health.issues.length === 1 ? "slot needs" : "slots need"} you`}
          body={describeIssues(empty, inactive, bye)}
          tone="alarm"
        />
        {/* Only offer to do it for them when there is actually somebody on the
            bench who can fill the hole. Otherwise send them to the wire. */}
        {fixable > 0 ? (
          <button
            type="button"
            onClick={onFix}
            disabled={fixing}
            className="push inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg disabled:opacity-60"
          >
            {fixing ? "Setting…" : "Fix my lineup"}
          </button>
        ) : (
          <Link
            to="/league/$leagueId/wire"
            params={{ leagueId }}
            className="inline-flex h-11 shrink-0 items-center rounded-pill border border-line-strong px-5 text-sm font-semibold hover:bg-raised"
          >
            Find a replacement
          </Link>
        )}
      </Shell>
    );
  }

  if (phase === "live" && me) {
    const winning = them ? me.points >= them.points : true;
    return (
      <Shell tone="good">
        <div className="flex w-full flex-col gap-3">
          <span className="flex items-center gap-2 microlabel-data text-muted">
            <span className="size-1.5 animate-pulse rounded-pill bg-live" />
            Live · week {week} · {health.yetToPlay} yet to play
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar src={me.avatar} name={me.teamName} className="size-9" tint />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{me.teamName}</span>
                <span className="block microlabel-data">you</span>
              </span>
            </span>
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {formatPts(me.points, 1)}
            </span>
            <span className="font-mono text-xl text-faint">–</span>
            <span className="font-mono text-3xl font-semibold tabular-nums text-muted">
              {formatPts(them?.points ?? 0, 1)}
            </span>
            {them ? (
              <span className="ml-auto flex min-w-0 items-center gap-2.5">
                <span className="min-w-0 text-right">
                  <span className="block truncate text-sm font-bold">{them.teamName}</span>
                  <span className="block microlabel-data">{winning ? "trailing" : "ahead"}</span>
                </span>
                <Avatar src={them.avatar} name={them.teamName} className="size-9" tint />
              </span>
            ) : null}
          </div>
        </div>
        <Link
          to="/league/$leagueId/matchups"
          params={{ leagueId }}
          search={{ week }}
          className="inline-flex h-11 shrink-0 items-center rounded-pill border border-line-strong px-5 text-sm font-semibold hover:bg-raised"
        >
          Open the box
        </Link>
      </Shell>
    );
  }

  // A 0-0 week has not been played, whatever the NFL scoreboard says.
  if (phase === "settled" && me && them && (me.points > 0 || them.points > 0)) {
    const margin = me.points - them.points;
    const won = margin >= 0;
    return (
      <Shell tone={won ? "good" : "calm"}>
        <Body
          kicker={`Week ${week} final`}
          title={
            won
              ? `You won by ${formatPts(Math.abs(margin), 1)}`
              : `You lost by ${formatPts(Math.abs(margin), 1)}`
          }
          body={`${me.teamName} ${formatPts(me.points, 1)} against ${them.teamName} ${formatPts(them.points, 1)}.`}
        />
        <Link
          to="/league/$leagueId/recap"
          params={{ leagueId }}
          search={{ week, story: undefined }}
          className="push inline-flex h-11 shrink-0 items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg"
        >
          Read the desk
        </Link>
      </Shell>
    );
  }

  // Preseason with a set roster, midweek, gameday before kickoff, an open
  // waiver window: all real, none of them a thing you have to do. The wire and
  // the lineup both have permanent tabs; they do not need a banner as well.
  return null;
}

function describeIssues(empty: number, inactive: number, bye: number): string {
  const parts: string[] = [];
  if (empty) parts.push(`${empty} slot${empty === 1 ? "" : "s"} empty`);
  if (inactive) parts.push(`${inactive} starting a player who is ruled out`);
  if (bye) parts.push(`${bye} on a bye`);
  const total = empty + inactive + bye;
  const tail = total === 1 ? "It will not score." : "They will not score.";
  return `${parts.join(" · ")}. ${tail}`;
}

function Shell({ tone, children }: { tone: "calm" | "alarm" | "good"; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl px-5 py-5",
        tone === "calm" && "bg-surface ring-card",
        tone === "alarm" &&
          "bg-[color-mix(in_oklab,var(--alarm)_12%,var(--paper-raised))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--alarm)_40%,transparent),var(--lift)]",
        tone === "good" &&
          "bg-[color-mix(in_oklab,var(--brand)_16%,var(--paper-raised))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--brand)_45%,transparent),var(--lift)]",
      )}
    >
      {children}
    </section>
  );
}

function Body({
  kicker,
  title,
  body,
  tone,
}: {
  kicker: string;
  title: string;
  body: string;
  tone?: "alarm";
}) {
  return (
    <div className="min-w-0 flex-1 basis-64">
      <p className={cn("microlabel-data", tone === "alarm" ? "text-loss" : "text-faint")}>
        {kicker}
      </p>
      <h2 className="mt-1.5 font-display text-xl font-extrabold tracking-[-0.03em]">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </div>
  );
}
