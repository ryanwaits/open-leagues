import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const week = search.week ?? league.data?.currentWeek ?? 1;
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
                <p className="microlabel">{lead.kicker}</p>
                <h3 className="mt-2 font-display text-4xl font-extrabold leading-[1.15] tracking-[-0.03em]">
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
      <h3 className="mt-2 font-display text-4xl font-extrabold leading-[1.15] tracking-[-0.03em]">
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
