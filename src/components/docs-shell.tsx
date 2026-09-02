import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DOCS_GROUPS, type DocsSlug, isDocsSlug } from "@/lib/docs/nav";
import { DOCS_PAGES } from "@/lib/docs/pages";
import { cn } from "@/lib/utils";

function slugFromPath(pathname: string): DocsSlug {
  const tail = pathname.replace(/\/$/, "").split("/").pop() ?? "overview";
  if (tail === "docs") return "overview";
  return isDocsSlug(tail) ? tail : "overview";
}

export function DocsShell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const slug = slugFromPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-skin");
    el.setAttribute("data-skin", "console");
    return () => {
      if (prev) el.setAttribute("data-skin", prev);
      else el.removeAttribute("data-skin");
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, []);

  return (
    <div className="min-h-dvh bg-bg font-sans text-fg">
      <header className="sticky top-0 z-40 flex h-[57px] items-center gap-4 border-b border-line bg-bg px-5">
        <Link to="/" className="shrink-0 whitespace-nowrap text-[15px] font-semibold">
          open-leagues
        </Link>
        <nav className="hidden gap-4 text-sm sm:flex">
          <Link to="/docs" className="text-fg">
            Docs
          </Link>
          <a href="https://github.com/ryanwaits/open-leagues" className="text-muted hover:text-fg">
            GitHub
          </a>
          {isPending ? (
            <span className="inline-block h-4 w-10 self-center rounded bg-raised" />
          ) : user ? (
            <Link to="/account" className="text-muted hover:text-fg">
              Account
            </Link>
          ) : (
            <Link to="/login" className="text-muted hover:text-fg">
              Sign in
            </Link>
          )}
        </nav>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="rounded-pill border border-line-strong px-2.5 py-1 text-[13px] text-faint hover:text-fg md:hidden"
        >
          Menu
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_224px]">
        <aside
          className={cn(
            "border-line px-3 pt-6 pb-8 md:sticky md:top-[57px] md:h-[calc(100dvh-57px)] md:self-start md:overflow-y-auto",
            menuOpen ? "border-b pb-4" : "hidden md:block",
          )}
        >
          {DOCS_GROUPS.map((group) => (
            <div key={group.label} className="mb-7 last:mb-0">
              <p className="mb-2 px-3 font-mono text-[10.5px] font-semibold tracking-[0.12em] text-faint uppercase">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = item.slug === slug;
                const className = cn(
                  "flex items-center justify-between gap-2 rounded-[8px] px-3 py-[7px] text-[14px] leading-[1.45]",
                  active
                    ? "bg-raised font-medium text-fg"
                    : "text-muted hover:bg-band hover:text-fg",
                );
                const inner = (
                  <>
                    <span>{item.label}</span>
                    {item.tag ? (
                      <span className="rounded-[5px] border border-line-strong px-1.5 py-px font-mono text-[9px] font-semibold tracking-[0.08em] text-faint uppercase">
                        {item.tag}
                      </span>
                    ) : null}
                  </>
                );
                return item.href === "/docs" ? (
                  <Link key={item.slug} to="/docs" className={className}>
                    {inner}
                  </Link>
                ) : (
                  <Link
                    key={item.slug}
                    to="/docs/$slug"
                    params={{ slug: item.slug }}
                    className={className}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        <main className="min-w-0 border-line px-5 pt-10 pb-24 md:border-l md:px-12">
          <div className="max-w-[760px]">{children}</div>
        </main>

        <TableOfContents slug={slug} />
      </div>
    </div>
  );
}

function TableOfContents({ slug }: { slug: DocsSlug }) {
  const sections = DOCS_PAGES[slug].sections;
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    setActive(sections[0]?.id ?? "");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-70px 0px -70% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <aside className="hidden xl:sticky xl:top-[57px] xl:block xl:h-[calc(100dvh-57px)] xl:self-start xl:overflow-y-auto xl:py-10 xl:pr-5">
      <p className="mb-2.5 font-mono text-[10.5px] font-semibold tracking-[0.09em] text-faint uppercase">
        On this page
      </p>
      <nav>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              "block border-l py-1 pl-3 text-[13px]",
              active === s.id ? "border-fg text-fg" : "border-line text-faint hover:text-fg",
            )}
          >
            {s.heading}
          </a>
        ))}
      </nav>
    </aside>
  );
}
