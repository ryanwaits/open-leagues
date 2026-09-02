import { createFileRoute } from "@tanstack/react-router";
import { DocsArticle } from "@/lib/docs/pages";

export const Route = createFileRoute("/docs/")({
  component: () => <DocsArticle slug="overview" />,
  head: () => ({
    meta: [{ title: "Docs · open-leagues" }],
  }),
});
