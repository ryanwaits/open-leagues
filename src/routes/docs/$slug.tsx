import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { DOCS_NAV, DOCS_REDIRECTS, isDocsSlug } from "@/lib/docs/nav";
import { DocsArticle } from "@/lib/docs/pages";

export const Route = createFileRoute("/docs/$slug")({
  beforeLoad: ({ params }) => {
    if (params.slug === "overview") {
      throw redirect({ to: "/docs" });
    }
    const moved = DOCS_REDIRECTS[params.slug];
    if (moved) {
      throw redirect({ to: "/docs/$slug", params: { slug: moved } });
    }
    if (!isDocsSlug(params.slug)) throw notFound();
  },
  component: DocsSlugPage,
  head: ({ params }) => {
    const item = DOCS_NAV.find((p) => p.slug === params.slug);
    return {
      meta: [{ title: `${item?.label ?? "Docs"} · open-leagues` }],
    };
  },
});

function DocsSlugPage() {
  const { slug } = Route.useParams();
  if (!isDocsSlug(slug) || slug === "overview") return null;
  return <DocsArticle slug={slug} />;
}
