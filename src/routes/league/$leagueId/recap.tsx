import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Deck } from "@/components/deck";
import { Stamp } from "@/components/ghost-num";
import { Skeleton } from "@/components/ui/skeleton";
import { weekLabel } from "@/components/week-picker";
import { WeekSheet } from "@/components/week-sheet";
import { getLeagueBundle } from "@/lib/data/fns";
import type { DispatchArticle } from "@/lib/league/dispatch";
import { getDesk } from "@/lib/league/fns";

export const Route = createFileRoute("/league/$leagueId/recap")({
  validateSearch: (s: Record<string, unknown>) => ({
    week: s.week != null ? Number(s.week) : undefined,
    story: typeof s.story === "string" ? s.story : undefined,
  }),
  component: DeskPage,
});

function DeskPage() {
  const { leagueId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [weekOpen, setWeekOpen] = useState(false);
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
  const playoffStart =
    league.data?.ops?.playoffStartWeek ?? league.data?.league.settings.playoff_week_start ?? 15;
  const maxWeek = Math.max(
    playoffStart + 2,
    league.data?.ops?.regularWeeks ?? 14,
    league.data?.currentWeek ?? 1,
  );
  const desk = useQuery({
    queryKey: ["desk", leagueId, week],
    queryFn: () => getDesk({ data: { leagueId, week } }),
  });

  const articles = desk.data?.articles ?? [];
  const lead = articles.find((a) => a.kind === "lead" || a.kind === "recap") ?? articles[0];
  const story = search.story
    ? articles.find((a) => a.slug === search.story || a.id === search.story)
    : null;
  const rest = articles.filter((a) => a !== lead);

  return (
    <div>
      <Deck>
        <span className="flex items-center gap-0.5 rounded-pill bg-raised p-0.5">
          <Link
            to="/league/$leagueId/standings"
            params={{ leagueId }}
            search={{ week }}
            className="inline-flex h-8 items-center rounded-pill px-3 text-[13px] font-medium text-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep"
          >
            Table
          </Link>
          <Link
            to="/league/$leagueId/recap"
            params={{ leagueId }}
            search={{ week, story: undefined }}
            aria-current="page"
            className="inline-flex h-8 items-center rounded-pill bg-fg px-3 text-[13px] font-medium text-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-deep"
          >
            Recap
          </Link>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label="Change week"
          onClick={() => setWeekOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface pl-3.5 pr-2.5 text-sm font-medium text-fg shadow-[0_0_0_1px_var(--color-line-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep"
        >
          {weekLabel(week, playoffStart)}
          <ChevronUp className="size-3.5 text-faint" strokeWidth={2.2} />
        </button>
      </Deck>
      <header className="border-b border-line pb-4">
        <p className="microlabel">
          The desk · {league.data?.league.name ?? "League"} · {league.data?.league.season}
        </p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">
          {desk.data?.edition === "recap" ? "Recap edition" : "Prep edition"}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Official copy for this league. Written from the draft board and the week {week} slate —
          not a national wire.
        </p>
      </header>

      {desk.data == null && (desk.isPending || desk.isLoading || !desk.isFetched) ? (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
        </div>
      ) : story ? (
        <ArticleView
          article={story}
          onBack={() => navigate({ search: { week, story: undefined } })}
        />
      ) : articles.length ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            {lead ? (
              <button
                type="button"
                onClick={() => navigate({ search: { week, story: lead.slug } })}
                className="w-full text-left"
              >
                <Stamp>Official record · wk {week}</Stamp>
                <p className="microlabel">{lead.kicker}</p>
                <h3 className="mt-2 font-display text-4xl font-medium leading-[1.15] tracking-[-0.02em]">
                  <span className="hl">{lead.headline}</span>
                </h3>
                <p className="mt-3 text-base leading-relaxed text-muted">{lead.dek}</p>
                {lead.body[0] ? (
                  <p className="mt-4 text-sm leading-relaxed">{lead.body[0]}</p>
                ) : null}
                <p className="mt-3 text-sm text-muted">Read the edition →</p>
              </button>
            ) : null}
          </section>
          <aside className="space-y-0 divide-y divide-line border-t border-line lg:border-t-0">
            {rest.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate({ search: { week, story: a.slug } })}
                className="block w-full py-4 text-left"
              >
                <p className="microlabel">{kickerOf(a)}</p>
                <p className="mt-1 font-display text-2xl font-bold leading-snug tracking-[-0.03em]">
                  {a.headline}
                </p>
                <p className="mt-1 text-sm text-muted">{a.dek}</p>
              </button>
            ))}
          </aside>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">No desk copy for this week yet.</p>
      )}

      <WeekSheet
        open={weekOpen}
        onOpenChange={setWeekOpen}
        week={week}
        maxWeek={maxWeek}
        playoffStart={playoffStart}
        currentWeek={league.data?.currentWeek ?? 1}
        onPick={(w) => void navigate({ search: { week: w, story: undefined } })}
      />
    </div>
  );
}

function kickerOf(a: DispatchArticle) {
  if (a.kind === "preview") return "Matchup";
  if (a.kind === "feature") return "From the draft";
  if (a.kind === "brief") return "The card";
  if (a.kind === "recap") return "Recap";
  return a.kicker;
}

function ArticleView({ article, onBack }: { article: DispatchArticle; onBack: () => void }) {
  return (
    <article className="mx-auto mt-8 max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        The desk
      </button>
      <p className="mt-6 microlabel">{article.kicker}</p>
      <h3 className="mt-2 font-display text-4xl font-medium leading-[1.15] tracking-[-0.02em]">
        {article.headline}
      </h3>
      <p className="mt-4 text-lg leading-relaxed text-muted">{article.dek}</p>
      {article.focus.length ? <p className="mt-3 microlabel">{article.focus.join(" · ")}</p> : null}
      <div className="mt-8 space-y-4">
        {article.body.map((p) => (
          <p key={p} className="text-[15px] leading-[1.65]">
            {p}
          </p>
        ))}
      </div>
      {article.bullets.length ? (
        <ul className="mt-8 space-y-3">
          {article.bullets.map((b) => (
            <li key={b} className="border-t border-line pt-3 text-sm leading-relaxed">
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-10 microlabel">
        {article.source === "llm" ? "Written for this league" : "Desk copy · from the book"}
      </p>
    </article>
  );
}
