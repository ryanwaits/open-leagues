import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs-shell";

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
  head: () => ({
    meta: [{ title: "Docs · open-leagues" }],
  }),
});

function DocsLayout() {
  return (
    <DocsShell>
      <Outlet />
    </DocsShell>
  );
}
