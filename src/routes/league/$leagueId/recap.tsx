import { createFileRoute, redirect } from "@tanstack/react-router";

/** Recap desk is parked until the copy is worth showing. Old URLs land on League. */
export const Route = createFileRoute("/league/$leagueId/recap")({
  validateSearch: (s: Record<string, unknown>) => ({
    week: s.week != null && Number.isFinite(Number(s.week)) ? Number(s.week) : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/league/$leagueId/standings",
      params: { leagueId: params.leagueId },
      search: search.week != null ? { week: search.week } : {},
    });
  },
  component: () => null,
});
