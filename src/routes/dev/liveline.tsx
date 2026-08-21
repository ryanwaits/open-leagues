/**
 * Dev-only gallery for `<LiveLine>` — a live single line, two series, a
 * quiet spark, and a frozen (finished-game) chart, so the wrapper can be
 * eyeballed in both themes before any product surface uses it. Not linked
 * from anywhere; 404s outside `bun run dev`.
 */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LiveLine } from "@/components/live-line";
import { Shell } from "@/components/shell";
import { appendSample, fmtGameClock, readSeries, swing } from "@/lib/live/series";

export const Route = createFileRoute("/dev/liveline")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Gallery,
});

const WINDOWS = [
  { label: "30s", secs: 30 },
  { label: "2m", secs: 120 },
];

function randomWalk(prev: number, drift = 0): number {
  return prev + (Math.random() - 0.5) * 2 + drift;
}

function buildFrozenSeries(kickoff: number) {
  const points = [];
  for (let i = 0; i < 190; i++) {
    const decline = 12.7 - ((12.7 - 5.7) * i) / 189;
    const wobble = Math.sin(i / 12) * 0.4;
    points.push({ time: kickoff + i, value: decline + wobble });
  }
  return points;
}

function Gallery() {
  const [, setTick] = useState(0);
  const walkRef = useRef(50);
  const walkARef = useRef(50);
  const walkBRef = useRef(48);

  useEffect(() => {
    const id = setInterval(() => {
      walkRef.current = randomWalk(walkRef.current);
      appendSample("dev:walk", walkRef.current);
      walkARef.current = randomWalk(walkARef.current);
      appendSample("dev:walk-a", walkARef.current);
      walkBRef.current = randomWalk(walkBRef.current, 0.05);
      appendSample("dev:walk-b", walkBRef.current);
      setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const points = readSeries("dev:walk");
  const pointsA = readSeries("dev:walk-a");
  const pointsB = readSeries("dev:walk-b");

  const [tone, setTone] = useState<"brand" | "alarm">("brand");
  const [smooth, setSmooth] = useState(true);

  const mountNow = useRef(Date.now() / 1000).current;
  const frozenSeries = useRef(buildFrozenSeries(mountNow - 190)).current;

  return (
    <Shell>
      <p className="microlabel">Dev only · /dev/liveline · theme follows yours</p>
      <div className="mt-6 space-y-6">
        <section className="rounded-xl bg-surface p-5 ring-card">
          <div className="flex items-center justify-between gap-3">
            <p className="microlabel">Single line, live</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-pill bg-raised px-3 py-1 text-xs"
                onClick={() => setTone((t) => (t === "brand" ? "alarm" : "brand"))}
              >
                tone: {tone}
              </button>
              <button
                type="button"
                className="rounded-pill bg-raised px-3 py-1 text-xs"
                onClick={() => setSmooth((s) => !s)}
              >
                smooth: {smooth ? "on" : "off"}
              </button>
            </div>
          </div>
          <LiveLine
            series={points}
            height={180}
            tone={tone}
            smooth={smooth}
            referenceLine={{ value: 50, label: "PROJ 50.0" }}
            momentum={swing(points, 20, 1).dir}
            windows={WINDOWS}
          />
        </section>

        <section className="rounded-xl bg-surface p-5 ring-card">
          <p className="microlabel">Two series</p>
          <LiveLine
            series={[
              { id: "a", label: "You", points: pointsA, tone: "brand" },
              { id: "b", label: "Them", points: pointsB, tone: "muted" },
            ]}
            height={160}
          />
        </section>

        <section className="rounded-xl bg-surface p-5 ring-card">
          <p className="microlabel">Quiet spark</p>
          <LiveLine series={points} height={44} quiet />
        </section>

        <section className="rounded-xl bg-surface p-5 ring-card">
          <p className="microlabel">Frozen — scrub me, paused from frame one</p>
          <LiveLine
            series={frozenSeries}
            height={140}
            frozen
            referenceLine={{ value: 12.7, label: "PROJ 12.7" }}
            formatTime={(t) => fmtGameClock(t - (mountNow - 190))}
          />
        </section>
      </div>
    </Shell>
  );
}
