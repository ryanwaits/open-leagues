import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyLeagues } from "@/lib/league/fns";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, isPending: sessionPending } = useCurrentUserState();
  const mine = useQuery({
    queryKey: ["my-leagues", user?.id ?? "anon"],
    queryFn: () => listMyLeagues(),
    enabled: !sessionPending && Boolean(user),
    // Keyed per user, and no cross-key carry-over: a signed-out cache must not
    // paint someone else's leagues for a frame after login.
    placeholderData: undefined,
  });

  // Mid-transition — session resolving, or the seat list still in flight for a
  // user we now know about. Paint nothing rather than the previous visitor's.
  const waiting = sessionPending || (Boolean(user) && mine.isPending);

  return <Landing user={user} sessionPending={waiting} seats={waiting ? [] : (mine.data ?? [])} />;
}
