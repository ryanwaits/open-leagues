import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicShell, ReceiptCard } from "@/components/receipt-card";
import { getReceipt } from "@/lib/data/fns";
import { publicOrigin, useConsoleSkin } from "@/lib/use-console-skin";

/** One roster's week, with its own og:image so the link unfurls as the card. */
export const Route = createFileRoute("/r/$leagueId/$week/$rosterId")({
  beforeLoad: ({ params }) => {
    if (!/^\d+$/.test(params.week) || !/^\d+$/.test(params.rosterId)) throw notFound();
  },
  component: ReceiptPage,
  head: ({ params }) => {
    const origin = publicOrigin();
    const og = `${origin}/api/og/r/${params.leagueId}/${params.week}/${params.rosterId}`;
    return {
      meta: [
        { title: `Week ${params.week} receipt · open-leagues` },
        { property: "og:title", content: `Week ${params.week} receipt` },
        { property: "og:image", content: og },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: og },
      ],
    };
  },
});

function ReceiptPage() {
  useConsoleSkin();
  const { leagueId, week, rosterId } = Route.useParams();
  const w = Number(week);
  const rid = Number(rosterId);
  const q = useQuery({
    queryKey: ["receipts", "card", leagueId, w, rid],
    queryFn: () => getReceipt({ data: { leagueId, week: w, rosterId: rid } }),
    staleTime: 60_000,
  });
  const permalink = `${publicOrigin()}/r/${leagueId}/${w}/${rid}`;

  return (
    <PublicShell>
      {q.isPending ? (
        <p className="mt-10 text-sm text-muted">Printing the receipt…</p>
      ) : q.error || !q.data ? (
        <div className="mt-10">
          <p className="text-[15px]">Couldn&apos;t print that receipt.</p>
          <p className="mt-2 text-sm text-muted">
            Receipts work for Sleeper leagues. A hosted league needs a seat.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
            Try another
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
            <Link
              to="/r/$leagueId"
              params={{ leagueId }}
              search={{ week: w }}
              className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase hover:text-fg"
            >
              ← {q.data.league.name} · week {w}
            </Link>
            <div className="flex items-center gap-2 font-mono text-[12px]">
              {w > 1 ? (
                <Link
                  to="/r/$leagueId/$week/$rosterId"
                  params={{ leagueId, week: String(w - 1), rosterId }}
                  className="rounded-pill border border-line-strong px-2.5 py-1 text-muted hover:text-fg"
                >
                  ← week {w - 1}
                </Link>
              ) : null}
              {w < q.data.currentWeek ? (
                <Link
                  to="/r/$leagueId/$week/$rosterId"
                  params={{ leagueId, week: String(w + 1), rosterId }}
                  className="rounded-pill border border-line-strong px-2.5 py-1 text-muted hover:text-fg"
                >
                  week {w + 1} →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <ReceiptCard receipt={q.data} permalink={permalink} />
          </div>
          <p className="mt-4 text-[13px] text-faint">
            Copy the link. It unfurls as the card in iMessage, Sleeper chat, Discord, and X.
          </p>
        </>
      )}
    </PublicShell>
  );
}
