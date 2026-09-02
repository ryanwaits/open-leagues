export type DocsSlug =
  | "overview"
  | "guide"
  | "receipts"
  | "open-data"
  | "quickstart"
  | "migrate"
  | "cli"
  | "agents"
  | "state"
  | "playbooks"
  | "catalog"
  | "self-host";

export type DocsNavItem = {
  slug: DocsSlug;
  href: "/docs" | "/docs/$slug";
  label: string;
  kicker: string;
  /** Short mono badge in the sidebar. Numeric badges render muted. */
  tag?: string;
};

export type DocsNavGroup = {
  label: string;
  items: DocsNavItem[];
};

export const DOCS_GROUPS: DocsNavGroup[] = [
  {
    label: "Get started",
    items: [
      { slug: "overview", href: "/docs", label: "Overview", kicker: "What this is" },
      { slug: "guide", href: "/docs/$slug", label: "Guide", kicker: "Pain, fix, proof" },
      { slug: "receipts", href: "/docs/$slug", label: "Receipts", kicker: "Your week, as facts" },
      {
        slug: "open-data",
        href: "/docs/$slug",
        label: "Open data",
        kicker: "Two files, no key",
        tag: "json",
      },
      { slug: "quickstart", href: "/docs/$slug", label: "Quickstart", kicker: "Running a box" },
      {
        slug: "migrate",
        href: "/docs/$slug",
        label: "Migrate a league",
        kicker: "Bring a league in",
      },
    ],
  },
  {
    label: "Headless",
    items: [
      { slug: "cli", href: "/docs/$slug", label: "CLI", kicker: "The ledger slice" },
      { slug: "agents", href: "/docs/$slug", label: "Agents & MCP", kicker: "Connect a client" },
      {
        slug: "state",
        href: "/docs/$slug",
        label: "Reading league state",
        kicker: "The four reads",
      },
      {
        slug: "playbooks",
        href: "/docs/$slug",
        label: "Playbooks",
        kicker: "Skills",
        tag: "skills",
      },
    ],
  },
  {
    label: "Reference",
    items: [
      { slug: "catalog", href: "/docs/$slug", label: "Verb catalog", kicker: "Every verb" },
      { slug: "self-host", href: "/docs/$slug", label: "Self-host", kicker: "Docker / Vercel" },
    ],
  },
];

/** Flat reading order — drives prev/next and page titles. */
export const DOCS_NAV: DocsNavItem[] = DOCS_GROUPS.flatMap((g) => g.items);

/** Retired slugs, kept so old links land somewhere sensible instead of 404ing. */
export const DOCS_REDIRECTS: Record<string, DocsSlug> = {
  demo: "quickstart",
};

export function isDocsSlug(value: string): value is DocsSlug {
  return DOCS_NAV.some((item) => item.slug === value);
}

export function docsNeighbours(slug: DocsSlug): {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
} {
  const i = DOCS_NAV.findIndex((item) => item.slug === slug);
  return {
    prev: i > 0 ? DOCS_NAV[i - 1] : null,
    next: i >= 0 && i < DOCS_NAV.length - 1 ? DOCS_NAV[i + 1] : null,
  };
}
