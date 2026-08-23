import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PushRegister } from "@/components/push-register";
import { AuthProvider } from "@/lib/auth/provider";
import type { RouterContext } from "@/lib/query-client";
import { NO_FLASH_SCRIPT, useSkin, useTheme } from "@/lib/theme";
import { brand } from "@/skin/brand";
import appCss from "../styles.css?url";

const APP_NAME = brand.name;
// Resolved at RUNTIME, not build time: SSR reads the env (set on the host —
// scrapers only ever see the SSR HTML), the client reads its own location so
// hydration agrees. Docker builds never need the value inlined.
const host =
  typeof window === "undefined"
    ? (process.env.VITE_PUBLIC_HOSTNAME ?? import.meta.env.VITE_PUBLIC_HOSTNAME)
    : window.location.hostname;
const ogImage = host && host !== "localhost" ? `https://${host}/og.jpg` : undefined;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "A custom fantasy football desk for your leagues — standings, matchups, scores, and weekly recaps.",
      },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#fafaf8" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0d0d0d" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

const THEME_COLOR = {
  ledger: { light: "#fafaf8", dark: "#0d0d0d" },
  boxscore: { light: "#fbfaf6", dark: "#141519" },
} as const;

function RootDocument() {
  const { resolved } = useTheme();
  const skin = useSkin();
  const { queryClient } = Route.useRouteContext();

  // The SSR'd meta values are Ledger's, for first paint. Once mounted, keep
  // both theme-color metas in sync with whatever skin is actually active.
  useEffect(() => {
    const colors = THEME_COLOR[skin];
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    for (const meta of metas) {
      const media = meta.getAttribute("media");
      if (media?.includes("dark")) meta.setAttribute("content", colors.dark);
      else if (media?.includes("light")) meta.setAttribute("content", colors.light);
    }
  }, [skin]);

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Stamps data-theme before first paint. Must stay inline and before
            the body, or the page flashes light on a dark device. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme/skin stamp, literal string from src/lib/theme.ts, no user input */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <PushRegister />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        </QueryClientProvider>
        <Toaster
          theme={resolved}
          position="bottom-center"
          offset={16}
          gap={10}
          duration={4000}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full items-start gap-3 rounded-lg bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--hairline),var(--lift)]",
              title: "text-sm font-medium text-fg",
              description: "mt-0.5 font-mono text-[11px] leading-relaxed text-muted",
              icon: "shrink-0 [&>svg]:size-4",
              success: "[&_[data-icon]]:text-accent-strong",
              error: "[&_[data-icon]]:text-loss",
              actionButton:
                "ml-auto shrink-0 rounded-pill bg-fg px-3 py-1.5 text-xs font-medium text-bg",
              closeButton: "rounded-pill border border-line bg-surface text-faint",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}
