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
import { projectionTone } from "@/lib/live/game-series";
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
  const dividers = [0, 1, 2, 3];
  return (
    <svg
      viewBox="0 0 300 96"
      className="h-[124px] w-full"
      role="img"
      aria-label="Waiting for kickoff"
    >
      <text x="8" y="18" className="microlabel-data" style={{ fill: "var(--ink-2)" }}>
        {`PROJ ${formatPts(baseline, 1)}`}
      </text>
      <line
        x1="8"
        y1="48"
        x2="292"
        y2="48"
        stroke="var(--ink-3)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      {dividers.map((q) => {
        const x0 = 8 + (q * 284) / 4;
        const x1 = 8 + ((q + 1) * 284) / 4;
        const mid = (x0 + x1) / 2;
        return (
          <g key={q}>
            {q > 0 ? (
              <line
                x1={x0}
                y1="40"
                x2={x0}
                y2="56"
                stroke="var(--ink-3)"
                strokeWidth="1"
                opacity="0.4"
              />
            ) : null}
            <text
              x={mid}
              y="88"
              textAnchor="middle"
              className="microlabel-data"
              style={{ fill: "var(--ink-3)" }}
            >
              {`Q${q + 1}`}
            </text>
          </g>
        );
      })}
    </svg>
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
            windowSecs={windowSecs ?? Math.max(600, now - s.kickoffWall + 120)}
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
            windowSecs={Math.max(3600, lastElapsed) + 60}
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
