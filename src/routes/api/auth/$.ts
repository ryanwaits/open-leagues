import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/** A substrate box has no accounts, so it has no auth API either. */
const gated = async (request: Request): Promise<Response> => {
  const { isSubstrate, SUBSTRATE_REFUSAL } = await import("@/lib/box-mode");
  if (isSubstrate()) return Response.json({ error: SUBSTRATE_REFUSAL }, { status: 404 });
  return auth.handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => gated(request),
      POST: ({ request }) => gated(request),
    },
  },
});
