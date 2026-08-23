/**
 * One line, three phases, one surface. The pace-adjusted expected final
 * (`liveProjection()` per sample) is the only series drawn — raw points stay
 * in the header number and captions, never a second line, because the
 * question this block answers is "is he going to get there?", not "how many
 * does he have right now" (that number is already shown elsewhere on every
 * surface this renders on).
 */
import { useRef } from "react";
import { LiveLine } from "@/components/live-line";
import { chartWindowSecs, projectionTone } from "@/lib/live/game-series";
import { fmtGameClock } from "@/lib/live/series";
import type { ProjectionSeries } from "@/lib/live/use-projection-series";
import { cn, formatPts } from "@/lib/utils";

function signedPts(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatPts(Math.abs(n), 1)}`;
}

const MOMENTUM_LABEL = { up: "heating up", down: "cooling off", flat: "steady" } as const;
const MOMENTUM_TONE = {
  up: "text-accent-strong",
  down: "text-loss",
  flat: "text-muted",
} as const;

function PreBody({ baseline }: { baseline: number }) {
  // One sample so <LiveLine> mounts liveline; liveline itself treats <2
  // points as empty and paints the same "No data to display" wave the
  // matchup chart uses when it has nothing in the window yet.
  return (
    <LiveLine
      series={[{ time: 0, value: baseline }]}
      value={baseline}
      height={124}
      windowSecs={3600}
      padding={{ left: 8, right: 36, top: 10, bottom: 18 }}
      momentum={false}
      emptyText="No data to display"
      ariaLabel="Waiting for kickoff"
    />
  );
}

export function ProjectionBlock({
  s,
  kickoffLabel,
  className,
  windowSecs,
}: {
  s: ProjectionSeries;
  kickoffLabel?: string | null;
  className?: string;
  /** Overrides the computed real-time window — for demo/replay games, where
   * wall-clock elapsed time bears no relation to the simulated game clock. */
  windowSecs?: number;
}) {
  const mountNowRef = useRef(Date.now() / 1000);
  const tone = projectionTone(s.expected, s.baseline);
  const toneClass = tone === "brand" ? "text-accent-strong" : "text-loss";
  const delta = s.expected - s.baseline;
  const now = Date.now() / 1000;
  const lastElapsed = s.final.at(-1)?.time ?? 3600;

  let headRight: React.ReactNode;
  let footLeft: React.ReactNode;
  let footRight: React.ReactNode;

  if (s.phase === "pre") {
    headRight = <span>{`starts at ${formatPts(s.baseline, 1)}`}</span>;
    footLeft = <span>{`kicks off ${kickoffLabel ?? "soon"}`}</span>;
    footRight = <span>the line starts here</span>;
  } else if (s.phase === "in") {
    headRight = (
      <span
        className={toneClass}
      >{`on pace ${formatPts(s.expected, 1)} · ${signedPts(delta)}`}</span>
    );
    footLeft = <span>{`${formatPts(s.pts, 1)} pts · ${fmtGameClock(lastElapsed)}`}</span>;
    footRight = <span className={MOMENTUM_TONE[s.swing.dir]}>{MOMENTUM_LABEL[s.swing.dir]}</span>;
  } else {
    headRight = (
      <span
        className={toneClass}
      >{`final ${formatPts(s.expected, 1)} · ${signedPts(delta)} v proj`}</span>
    );
    footLeft = (
      <span>{`proj ${formatPts(s.baseline, 1)} → final ${formatPts(s.expected, 1)}`}</span>
    );
    footRight = <span>frozen · scrub it</span>;
  }

  return (
    <section className={cn("rounded-md bg-raised p-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="microlabel-data">projection</p>
        <p className="microlabel-data">{headRight}</p>
      </div>

      <div className="mt-2">
        {s.phase === "pre" ? (
          <PreBody baseline={s.baseline} />
        ) : s.phase === "in" ? (
          <LiveLine
            series={s.live}
            value={s.expected}
            tone={tone}
            height={124}
            windowSecs={windowSecs ?? chartWindowSecs(now - s.kickoffWall)}
            referenceLine={{ value: s.baseline, label: `PROJ ${formatPts(s.baseline, 1)}` }}
            momentum={s.swing.dir}
            padding={{ left: 8, right: 36, top: 10, bottom: 18 }}
            ariaLabel="Projection this game"
          />
        ) : (
          <LiveLine
            series={s.final}
            frozen
            tone={tone}
            height={124}
            windowSecs={chartWindowSecs(Math.max(3600, lastElapsed))}
            referenceLine={{ value: s.baseline, label: `PROJ ${formatPts(s.baseline, 1)}` }}
            formatTime={(t) => fmtGameClock(t - (mountNowRef.current - lastElapsed))}
            padding={{ left: 8, right: 36, top: 10, bottom: 18 }}
            ariaLabel="Projection, final"
          />
        )}
      </div>

      <div className="mt-2 flex justify-between microlabel-data">
        {footLeft}
        {footRight}
      </div>
    </section>
  );
}
