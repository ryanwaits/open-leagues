import { type ReactNode, useId, useState } from "react";
import { AGENT_TOOLS } from "@/lib/agent/catalog";
import { AGENT_CORE } from "@/lib/agent/core";
import type { MatchupPair } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import {
  CODEX_ANSWER,
  CODEX_PROMPT,
  CODEX_TRANSCRIPT,
  KNOBS_FIXTURE,
  MATCHUPS_FIXTURE,
  type Playbook,
  PURSE_FIXTURE,
  type Snippet,
} from "./fixtures";

/* ── prose ─────────────────────────────────────────────────────────── */

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-muted">{children}</p>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[13px] leading-relaxed text-faint">{children}</p>;
}

export function Inline({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[13px] text-fg">
      {children}
    </code>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted marker:text-faint">
      {children}
    </ul>
  );
}

export function Callout({
  tone = "flat",
  children,
}: {
  tone?: "flat" | "warn";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-r-xs border border-line border-l-2 bg-band px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted",
        tone === "warn" ? "border-l-warn" : "border-l-line-strong",
      )}
    >
      {children}
    </div>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 mb-2 font-mono text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">
      {children}
    </p>
  );
}

/* ── code ──────────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => {},
        );
      }}
      className="shrink-0 rounded-pill border border-line-strong px-2.5 py-0.5 font-mono text-[10.5px] text-faint hover:border-faint hover:text-fg"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function Frame({
  label,
  action,
  children,
}: {
  label?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-sm border border-line-strong bg-surface">
      {label ? (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-band px-3.5 py-1.5 font-mono text-[11.5px] text-faint">
          <span className="min-w-0 truncate">{label}</span>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Pre({ label, children }: { label?: string; children: string }) {
  return (
    <Frame label={label} action={<CopyButton text={children} />}>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.75px] leading-[1.7]">
        {children}
      </pre>
    </Frame>
  );
}

/** Tabbed variants of one command — install targets, clients, CLI examples. */
export function TabbedCode({ snippets, label }: { snippets: Snippet[]; label?: string }) {
  const [active, setActive] = useState(snippets[0].key);
  const current = snippets.find((s) => s.key === active) ?? snippets[0];
  return (
    <div className="mt-4">
      {label ? <Caption>{label}</Caption> : null}
      <div className="flex flex-wrap gap-1">
        {snippets.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            aria-pressed={s.key === active}
            className={cn(
              "rounded-[7px] px-2.5 py-1 font-mono text-[11.5px]",
              s.key === active ? "bg-fg text-bg" : "text-faint hover:bg-band hover:text-fg",
            )}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <Frame label={current.label} action={<CopyButton text={current.body} />}>
        <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.75px] leading-[1.7]">
          {current.body}
        </pre>
      </Frame>
    </div>
  );
}

/* ── tables ────────────────────────────────────────────────────────── */

export function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-sm border border-line-strong bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {head.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-line bg-band px-3.5 py-2 text-left font-mono text-[10.5px] font-semibold tracking-[0.07em] text-faint uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-t border-line first:border-t-0">
                {row.map((cell, i) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: column position is the identity
                    key={i}
                    className="px-3.5 py-2 align-top text-muted"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] text-fg">{children}</span>;
}

export function Pill({
  tone = "flat",
  children,
}: {
  tone?: "flat" | "ink" | "on" | "off";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-pill border px-2 py-px font-mono text-[10px] tracking-[0.04em] whitespace-nowrap",
        tone === "on" && "border-accent-deep text-accent-strong",
        tone === "ink" && "border-line-strong bg-band text-fg",
        tone === "off" && "border-line bg-band text-faint",
        tone === "flat" && "border-line bg-band text-faint",
      )}
    >
      {children}
    </span>
  );
}

/* ── steps ─────────────────────────────────────────────────────────── */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-2 list-none pl-0">{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="relative pt-6 pl-10">
      <span className="absolute top-6 left-0 flex h-[22px] w-[22px] items-center justify-center rounded-pill border border-line-strong bg-surface font-mono text-[11px] text-faint tabular-nums">
        {n}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-[52px] bottom-0 left-[11px] w-px bg-line last:hidden"
      />
      <h3 className="font-display text-[15.5px] font-medium text-fg">{title}</h3>
      {children}
    </li>
  );
}

/* ── the Codex session ─────────────────────────────────────────────── */

export function TranscriptReplay() {
  const [shown, setShown] = useState(CODEX_TRANSCRIPT.length);
  const done = shown >= CODEX_TRANSCRIPT.length;

  function replay() {
    setShown(0);
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= CODEX_TRANSCRIPT.length) clearInterval(timer);
    }, 250);
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">
          codex exec · preseason 2026
        </span>
        <button
          type="button"
          onClick={replay}
          className="rounded-[7px] border border-line-strong px-2.5 py-1 font-mono text-[11.5px] text-faint hover:text-fg"
        >
          Replay
        </button>
      </div>
      <div className="overflow-hidden rounded-sm border border-line-strong bg-surface">
        <div className="flex items-center gap-1.5 border-b border-line bg-band px-3.5 py-1.5">
          <span className="h-2 w-2 rounded-pill bg-line-strong" />
          <span className="h-2 w-2 rounded-pill bg-line-strong" />
          <span className="h-2 w-2 rounded-pill bg-line-strong" />
          <span className="ml-1 font-mono text-[11.5px] text-faint">codex · open-leagues</span>
        </div>
        <div className="border-b border-line px-4 py-2.5 text-[14px]">
          <span className="text-faint">› </span>
          {CODEX_PROMPT}
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.75px] leading-[1.7]">
          {CODEX_TRANSCRIPT.map((call, i) => (
            <span key={call.id} className={cn("block", i < shown ? "" : "opacity-[0.18]")}>
              <span className="text-faint">mcp:</span> open-leagues/{call.name}{" "}
              <span className={call.ok ? "text-faint" : "text-loss"}>
                {call.ok ? "completed" : "failed"}
              </span>
            </span>
          ))}
        </pre>
        <div
          className={cn(
            "flex items-baseline gap-2.5 border-t border-line px-4 py-3 text-[14px]",
            done ? "" : "invisible",
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-pill bg-accent" />
          <span>
            <b className="font-semibold">{CODEX_ANSWER.team}</b> — {CODEX_ANSWER.record} — vs{" "}
            <b className="font-semibold">{CODEX_ANSWER.opponent}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── getMatchups: raw vs rendered ──────────────────────────────────── */

function fmtPoints(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

function MatchupBoard({ pair }: { pair: MatchupPair }) {
  const home = pair.home;
  const away = pair.away;
  if (!away) return null;
  return (
    <div className="overflow-x-auto rounded-sm border border-line-strong bg-surface">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-b border-line bg-band px-4 py-2.5">
          <div>
            <div className="text-[14px] font-medium">{home.teamName}</div>
            <div className="font-mono text-[10.5px] text-faint">
              {home.manager} · roster {home.rosterId} · {fmtPoints(home.points)}
            </div>
          </div>
          <div className="font-mono text-[10.5px] text-faint">wk 1</div>
          <div className="text-right">
            <div className="text-[14px] font-medium">{away.teamName}</div>
            <div className="font-mono text-[10.5px] text-faint">
              {away.manager} · roster {away.rosterId} · {fmtPoints(away.points)}
            </div>
          </div>
        </div>
        {home.starters.map((hs, i) => {
          const as = away.starters[i];
          return (
            <div
              key={`${hs.slot}-${hs.playerId}`}
              className="grid grid-cols-[minmax(0,1fr)_44px_36px_44px_minmax(0,1fr)] items-center gap-2 border-t border-line px-4 py-2 text-[13px] first:border-t-0"
            >
              <span className="min-w-0">
                <span className="block truncate">{hs.player?.full_name}</span>
                <span className="font-mono text-[10px] text-faint">
                  {hs.player?.position} · {hs.player?.team} · {hs.game?.detail}
                </span>
              </span>
              <span className="text-right font-mono text-[12.5px] text-muted tabular-nums">
                {fmtPoints(hs.points)}
              </span>
              <span className="text-center font-mono text-[10px] font-semibold tracking-[0.05em] text-faint">
                {hs.slot}
              </span>
              <span className="font-mono text-[12.5px] text-muted tabular-nums">
                {fmtPoints(as.points)}
              </span>
              <span className="min-w-0 text-right">
                <span className="block truncate">{as.player?.full_name}</span>
                <span className="font-mono text-[10px] text-faint">
                  {as.player?.position} · {as.player?.team} · {as.game?.detail}
                </span>
              </span>
            </div>
          );
        })}
        <div className="border-t border-line bg-band px-4 py-2 font-mono text-[10.5px] text-faint">
          matchupId {pair.matchupId} · {pair.kind} · every filled slot scores 0, no snaps played
        </div>
      </div>
    </div>
  );
}

export function MatchupPreview({ caption }: { caption: string }) {
  const [raw, setRaw] = useState(false);
  const json = JSON.stringify(MATCHUPS_FIXTURE, null, 2);
  return (
    <div className="mt-5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">
          {caption}
        </span>
        <span className="inline-flex rounded-pill border border-line-strong p-0.5">
          {(
            [
              ["rendered", false],
              ["raw", true],
            ] as const
          ).map(([label, isRaw]) => (
            <button
              key={label}
              type="button"
              onClick={() => setRaw(isRaw)}
              aria-pressed={raw === isRaw}
              className={cn(
                "rounded-pill px-3 py-0.5 font-mono text-[11px]",
                raw === isRaw ? "bg-fg text-bg" : "text-faint hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      {raw ? (
        <Frame label="response · application/json" action={<CopyButton text={json} />}>
          <pre className="max-h-[520px] overflow-auto px-4 py-3.5 font-mono text-[12.25px] leading-[1.65]">
            {json}
          </pre>
        </Frame>
      ) : (
        <MatchupBoard pair={MATCHUPS_FIXTURE[0]} />
      )}
    </div>
  );
}

/* ── the purse ─────────────────────────────────────────────────────── */

export function PurseCard() {
  const { budget, remaining, atRisk, spendable } = PURSE_FIXTURE;
  const freePct = Math.round((spendable / budget) * 100);
  const riskPct = Math.round((atRisk / budget) * 100);
  return (
    <div className="mt-4 overflow-hidden rounded-sm border border-line-strong bg-surface">
      <div className="flex h-2.5 bg-raised" aria-hidden="true">
        <span className="block bg-accent" style={{ width: `${freePct}%` }} />
        <span className="block bg-warn" style={{ width: `${riskPct}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {[
          ["remaining", remaining],
          ["at risk", atRisk],
          ["spendable", spendable],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="border-t border-line px-4 py-3 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0"
          >
            <div className="font-mono text-[10px] tracking-[0.06em] text-faint uppercase">
              {label}
            </div>
            <div className="mt-0.5 font-mono text-[18px] tabular-nums">${value}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-band px-4 py-2 font-mono text-[10.5px] text-faint">
        faabBudget ${budget} · wagerCap ${KNOBS_FIXTURE.wagerCap} · exposureCap $
        {KNOBS_FIXTURE.exposureCap} · bookLocked {String(KNOBS_FIXTURE.bookLocked)}
      </div>
    </div>
  );
}

/* ── playbooks ─────────────────────────────────────────────────────── */

export function PlaybookList({ playbooks }: { playbooks: Playbook[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-sm border border-line-strong bg-surface">
      {playbooks.map((pb) => (
        <div key={pb.say} className="border-t border-line px-4 py-3.5 first:border-t-0">
          <div className="text-[14px]">
            <span className="font-mono text-faint">› </span>“{pb.say}”
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {pb.chain.map((step, i) => (
              <span key={step.verb} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-[10.5px] text-faint">→</span> : null}
                {step.pause ? (
                  <span className="text-[12px] text-faint">{step.verb}</span>
                ) : (
                  <span
                    className={cn(
                      "rounded-[6px] border bg-band px-1.5 py-px font-mono text-[10.5px] whitespace-nowrap",
                      step.write
                        ? "border-line-strong font-medium text-fg"
                        : "border-line text-muted",
                    )}
                  >
                    {step.verb}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10.5px] text-faint">{pb.skill}</div>
        </div>
      ))}
    </div>
  );
}

/* ── the catalog ───────────────────────────────────────────────────── */

export function CatalogTable() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [kind, setKind] = useState("");
  const [wiredOnly, setWiredOnly] = useState(false);
  const searchId = useId();
  const wiredId = useId();

  const term = query.trim().toLowerCase();
  const rows = AGENT_TOOLS.filter((t) => {
    if (term && !t.id.toLowerCase().includes(term)) return false;
    if (scope && t.scope !== scope) return false;
    if (kind && t.kind !== kind) return false;
    if (wiredOnly && !AGENT_CORE.has(t.id)) return false;
    return true;
  });

  const control =
    "rounded-[8px] border border-line-strong bg-surface px-2.5 py-1 font-mono text-[12px] text-fg";

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter verbs…"
          aria-label="Filter verbs"
          className={cn(control, "min-w-[190px]")}
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Scope"
          className={control}
        >
          <option value="">all scopes</option>
          <option value="spectator">spectator</option>
          <option value="manager">manager</option>
          <option value="commish">commish</option>
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Kind"
          className={control}
        >
          <option value="">all kinds</option>
          <option value="read">read</option>
          <option value="atomic">atomic</option>
          <option value="workflow">workflow</option>
        </select>
        <label
          htmlFor={wiredId}
          className="flex cursor-pointer items-center gap-1.5 font-mono text-[11.5px] text-faint"
        >
          <input
            id={wiredId}
            type="checkbox"
            checked={wiredOnly}
            onChange={(e) => setWiredOnly(e.target.checked)}
          />
          wired to MCP only
        </label>
        <span className="ml-auto font-mono text-[11.5px] text-faint tabular-nums">
          {rows.length} of {AGENT_TOOLS.length}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-sm border border-line-strong bg-surface">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead className="sticky top-0">
              <tr>
                {["Verb", "Scope", "Kind", "MCP"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-line bg-band px-3.5 py-2 text-left font-mono text-[10.5px] font-semibold tracking-[0.07em] text-faint uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-line first:border-t-0">
                  <td className="px-3.5 py-2 font-mono text-[12.5px] whitespace-nowrap text-fg">
                    {t.id}
                  </td>
                  <td className="px-3.5 py-2">
                    <Pill>{t.scope}</Pill>
                  </td>
                  <td className="px-3.5 py-2">
                    <Pill tone={t.kind === "read" ? "flat" : "ink"}>{t.kind}</Pill>
                  </td>
                  <td className="px-3.5 py-2">
                    {AGENT_CORE.has(t.id) ? (
                      <Pill tone="on">wired</Pill>
                    ) : (
                      <Pill tone="off">—</Pill>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3.5 py-3 text-faint">
                    No verb matches that filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
