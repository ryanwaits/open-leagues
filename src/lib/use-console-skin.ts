import { useEffect } from "react";

/** Public pages wear the console skin regardless of the viewer's league skin. */
export function useConsoleSkin(): void {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-skin");
    el.setAttribute("data-skin", "console");
    return () => {
      if (prev) el.setAttribute("data-skin", prev);
      else el.removeAttribute("data-skin");
    };
  }, []);
}

/** Absolute origin for og:image and permalinks; SSR reads the host env. */
export function publicOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const host = process.env.VITE_PUBLIC_HOSTNAME ?? import.meta.env.VITE_PUBLIC_HOSTNAME;
  return host && host !== "localhost" ? `https://${host}` : "http://localhost:8080";
}
