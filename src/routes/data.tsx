import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSources } from "@/lib/data/fns";
import type { SourceStatus } from "@/lib/data/types";

export const Route = createFileRoute("/data")({ component: DataPage });

function SourceCard({ source }: { source: SourceStatus }) {
  return (
    <article className="rounded-xl bg-surface p-5 ring-card">
      <div className="flex items-center justify-between gap-3">
        <p className="microlabel">
          {source.cost} · {source.latencyMs}ms
        </p>
        <Badge tone={source.ok ? "win" : "loss"}>{source.ok ? "Live" : "Down"}</Badge>
      </div>
      <h2 className="mt-2 font-display text-2xl">{source.name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{source.role}</p>
      <p className="mt-3 font-mono text-[11px] text-faint">{source.detail}</p>
      <p className="mt-2 text-xs leading-relaxed text-faint">{source.license}</p>
    </article>
  );
}

function DataPage() {
  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => getSources(),
    staleTime: 60_000,
  });

  return (
    <Shell>
      <p className="microlabel">How the desk is fed</p>
      <h1 className="mt-2 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
        Cheap, open, and good enough to run a league.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
        Official NFL / fantasy APIs want real money. Ledger does not buy a firehose. It imports your
        Sleeper league, reads the ESPN scoreboard, and keeps nflverse as the open archive. No keys.
        No SportsDataIO invoice.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {sources.data == null && sources.isPending
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          : sources.data?.map((s) => <SourceCard key={s.id} source={s} />)}
      </div>

      <section className="mt-12 max-w-2xl space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="font-display text-3xl text-fg">The rule that makes this free</h2>
        <p>
          Sleeper is the <span className="text-fg">data pipe</span>, not the clubhouse. Players,
          unofficial weekly stats, and trending adds come from their public API — no member
          accounts, no Sleeper login. Ledger hosts the league: seats, draft, lineups, waivers,
          standings.
        </p>
        <p>
          One commissioner can still peek at a public Sleeper league. Everyone else signs in here
          (Google, X, or email) and plays on Ledger. That is how you avoid making the group download
          another app.
        </p>

        <h2 className="pt-4 font-display text-3xl text-fg">What each layer is for</h2>
        <p>
          <span className="text-fg">Sleeper</span> is the player encyclopedia and unofficial weekly
          stat line — no keys, personal use, stay under ~1,000 calls/min. Members never touch it.
          During games we poll that unofficial line every ~15s (same feed Sleeper uses for live
          points). It is not a licensed play-by-play firehose.
        </p>
        <p>
          <span className="text-fg">ESPN public</span> is the NFL world — scoreboard, clock,
          headlines. Same JSON their site uses. Cache it. Do not sell it.
        </p>
        <p>
          <span className="text-fg">nflverse</span> is the open archive — weekly player stats and
          play-by-play on GitHub, updated nightly. Perfect for recaps, models, and historical
          leaders. Wrong tool for Sunday live scoring.
        </p>

        <h2 className="pt-4 font-display text-3xl text-fg">What we skipped on purpose</h2>
        <p>
          SportsDataIO, FantasyData, and Sportradar are cleaner and licensed for products you sell.
          They are also why most custom fantasy apps die in a spreadsheet. We do not need them to
          run friends-and-family leagues.
        </p>
        <p>
          Live official box scores with an SLA are the one thing you cannot honestly get for free.
          For a personal desk, Sleeper matchup points update during games. That is enough.
        </p>

        <h2 className="pt-4 font-display text-3xl text-fg">The AI chapter</h2>
        <p>
          Digests and smack talk do not need a stats vendor. They need a structured box score (we
          have that) and a language model. The Recap tab already writes a week dispatch from real
          matchup math. Next we point that same payload at Grok and let it talk like your league.
        </p>
      </section>
    </Shell>
  );
}
