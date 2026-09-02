import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { GEIST_MEDIUM, GEIST_MONO_MEDIUM } from "./fonts";
import type { Receipt } from "./receipt.server";

/**
 * The receipt as a 1200×630 PNG for link unfurls. Same facts as the page, in
 * the Ledger voice: mono tabular numbers, one green, losing is the marked
 * state. Colours are the light console skin's literal values — an og:image has
 * no theme to inherit from.
 */
const INK = "#0a0a0a";
const INK_2 = "#5c6066";
const INK_3 = "#7d8187";
const PAPER = "#fafaf8";
const PAPER_RAISED = "#ffffff";
const BAND = "#f6f5f2";
const HAIRLINE = "#e9e9e6";
const HAIRLINE_STRONG = "#d6d6d3";
const BRAND = "#6fdc93";
const ALARM = "#e0532f";

type El = { type: string; props: Record<string, unknown> };

function el(type: string, style: Record<string, unknown>, children?: unknown): El {
  return { type, props: { style, children } };
}

function fmt(n: number): string {
  return n.toFixed(1);
}

function outcomeLine(r: Receipt): string {
  if (!r.opponent) return "No opponent this week.";
  if (r.outcome === "pending") return `Projected against ${r.opponent.name}. Nothing scored yet.`;
  if (r.outcome === "tie") return `Tied with ${r.opponent.name}.`;
  const by = Math.abs(r.roster.points - r.opponent.points).toFixed(1);
  return r.outcome === "win"
    ? `Beat ${r.opponent.name} by ${by}.`
    : `Lost to ${r.opponent.name} by ${by}.`;
}

function benchLine(r: Receipt): string {
  if (r.outcome === "pending") return "The bench receipt prints after the games.";
  if (r.bench.left <= 0) return "Nothing left on the bench. Best lineup you could have set.";
  const m = r.bench.misses[0];
  const detail = m
    ? ` ${m.best.name} ${fmt(m.best.points)} sat behind ${m.started ? `${m.started.name} ${fmt(m.started.points)}` : "an empty slot"}.`
    : "";
  const said = m?.sourceLine ? ` ${m.sourceLine}` : "";
  return `Left ${fmt(r.bench.left)} on the bench.${detail}${said}`;
}

function wireLine(r: Receipt): string | null {
  const won = r.wire.moves.filter((m) => m.kind === "waiver" && m.won);
  if (won.length === 0) return null;
  const top = won.slice().sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0))[0];
  const share = top?.bidPct != null ? ` (${top.bidPct}% of budget` : "";
  const market =
    top?.medianPct != null && top.leagues != null
      ? `${share ? "; " : " ("}median ${top.medianPct}% across ${top.leagues} leagues)`
      : share
        ? ")"
        : "";
  return `Wire: ${won.length} claim${won.length === 1 ? "" : "s"} won, $${r.wire.spent} spent${top?.add ? ` — ${top.add} for $${top.bid ?? 0}${share}${market}` : ""}.`;
}

export async function renderReceiptPng(r: Receipt, origin: string): Promise<ArrayBuffer> {
  const lost = r.outcome === "loss";
  const opp = r.opponent;

  const score = el(
    "div",
    { display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" },
    [
      el("div", { display: "flex", flexDirection: "column" }, [
        el("div", { fontSize: 30, fontWeight: 500, color: INK }, r.roster.name),
        el(
          "div",
          {
            fontFamily: "Geist Mono",
            fontSize: 84,
            lineHeight: 1,
            color: lost ? ALARM : INK,
            marginTop: 8,
          },
          fmt(r.roster.points),
        ),
      ]),
      el(
        "div",
        { fontFamily: "Geist Mono", fontSize: 22, color: INK_3, paddingBottom: 18 },
        r.outcome === "pending" ? "proj" : "final",
      ),
      el("div", { display: "flex", flexDirection: "column", alignItems: "flex-end" }, [
        el("div", { fontSize: 30, fontWeight: 500, color: INK }, opp ? opp.name : "—"),
        el(
          "div",
          {
            fontFamily: "Geist Mono",
            fontSize: 84,
            lineHeight: 1,
            color: r.outcome === "win" ? ALARM : INK,
            marginTop: 8,
          },
          opp ? fmt(opp.points) : "—",
        ),
      ]),
    ],
  );

  const lines: El[] = [el("div", { fontSize: 30, color: INK, display: "flex" }, outcomeLine(r))];
  if (r.flip) {
    const took = r.flip.to === r.roster.rosterId;
    const who = r.flip.settled
      ? ` on the final box score${r.flip.by ? ` (${r.flip.by})` : ""}`
      : r.flip.by
        ? ` on ${r.flip.by}`
        : "";
    const prob =
      r.flip.probBefore != null && r.flip.beforeLabel
        ? ` You were ${Math.round(r.flip.probBefore * 100)}% at ${r.flip.beforeLabel}.`
        : "";
    lines.push(
      el(
        "div",
        { fontSize: 28, color: INK, display: "flex", marginTop: 10 },
        `${took ? "Took the lead for good" : "Lost the lead for good"} at ${r.flip.atLabel}${who}.${prob}`,
      ),
    );
  }
  lines.push(
    el("div", { fontSize: 26, color: INK_2, display: "flex", marginTop: 10 }, benchLine(r)),
  );
  if (r.agent.actions.length > 0) {
    const a = r.agent.actions[0];
    const more = r.agent.actions.length > 1 ? ` and ${r.agent.actions.length - 1} more` : "";
    lines.push(
      el(
        "div",
        { fontSize: 24, color: INK_2, display: "flex", marginTop: 10 },
        `${a?.actor ?? "An agent"} ran ${a?.tool ?? "a write"} at ${a?.atLabel ?? ""}${more}.`,
      ),
    );
  }
  const wire = wireLine(r);
  if (wire)
    lines.push(el("div", { fontSize: 24, color: INK_3, display: "flex", marginTop: 10 }, wire));

  const tree = el(
    "div",
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      background: PAPER,
      padding: 40,
      fontFamily: "Geist",
    },
    [
      el(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          background: PAPER_RAISED,
          border: `2px solid ${HAIRLINE_STRONG}`,
          borderRadius: 28,
          overflow: "hidden",
        },
        [
          el(
            "div",
            {
              display: "flex",
              justifyContent: "space-between",
              background: BAND,
              borderBottom: `2px solid ${HAIRLINE}`,
              padding: "18px 36px",
              fontFamily: "Geist Mono",
              fontSize: 22,
              color: INK_3,
            },
            [
              el("div", { display: "flex" }, `week ${r.week} · ${r.league.name}`),
              el("div", { display: "flex", alignItems: "center", gap: 12 }, [
                el("div", { width: 12, height: 12, borderRadius: 999, background: BRAND }),
                el("div", { display: "flex" }, "receipt"),
              ]),
            ],
          ),
          el("div", { display: "flex", flexDirection: "column", padding: "34px 36px", flex: 1 }, [
            score,
            el(
              "div",
              {
                display: "flex",
                flexDirection: "column",
                marginTop: 30,
                paddingTop: 26,
                borderTop: `2px solid ${HAIRLINE}`,
              },
              lines,
            ),
          ]),
          el(
            "div",
            {
              display: "flex",
              justifyContent: "space-between",
              background: BAND,
              borderTop: `2px solid ${HAIRLINE}`,
              padding: "16px 36px",
              fontFamily: "Geist Mono",
              fontSize: 20,
              color: INK_3,
            },
            [
              el("div", { display: "flex" }, `${origin.replace(/^https?:\/\//, "")}/r/…`),
              el("div", { display: "flex" }, "paste your Sleeper league →"),
            ],
          ),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Geist", data: GEIST_MEDIUM, weight: 500, style: "normal" },
      { name: "Geist Mono", data: GEIST_MONO_MEDIUM, weight: 500, style: "normal" },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  // A fresh ArrayBuffer: Response wants one, and Buffer's may be a pool slice.
  const out = new ArrayBuffer(png.byteLength);
  new Uint8Array(out).set(png);
  return out;
}
