import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

export const THEME_KEY = "ledger-theme";

export type SkinPref = "ledger" | "boxscore" | "console";
export const SKIN_KEY = "ledger-skin"; // the ONE key; no other spelling

/**
 * Runs before paint, inlined into <head>. Stamps a concrete theme on <html> so
 * the first frame is already correct — without it the page flashes light before
 * hydration. Kept as a string because it has to be a literal in the document.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(p!=="light"&&p!=="dark"){p=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",p);var s=localStorage.getItem(${JSON.stringify(
  SKIN_KEY,
)});if(s==="boxscore"||s==="console")document.documentElement.setAttribute("data-skin",s)}catch(e){}})()`;

function isPref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

export function readPref(): ThemePref {
  if (typeof localStorage === "undefined") return "system";
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isPref(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function systemTheme(): Resolved {
  if (typeof matchMedia === "undefined") return "light";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolve(pref: ThemePref): Resolved {
  return pref === "system" ? systemTheme() : pref;
}

/** Applies the resolved theme to <html>. Everything else keys off that. */
function paint(pref: ThemePref) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode — the choice just won't persist */
  }
  paint(pref);
  emit();
}

/**
 * Three-state, not a toggle: someone who never touches this still gets the
 * right answer when their phone flips at sunset.
 */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      paint("system");
      emit();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return {
    pref,
    resolved: resolve(pref),
    setPref: useCallback((next: ThemePref) => setThemePref(next), []),
  };
}

function isSkinPref(v: unknown): v is SkinPref {
  return v === "boxscore" || v === "console";
}

export function readSkin(): SkinPref {
  if (typeof localStorage === "undefined") return "ledger";
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    return isSkinPref(raw) ? raw : "ledger";
  } catch {
    return "ledger";
  }
}

/** Applies the resolved skin to <html>. Absent attribute = ledger, same
 * convention as data-accent. */
function paintSkin(skin: SkinPref) {
  if (typeof document === "undefined") return;
  if (skin === "ledger") document.documentElement.removeAttribute("data-skin");
  else document.documentElement.setAttribute("data-skin", skin);
}

export function setSkinPref(skin: SkinPref) {
  try {
    if (skin === "ledger") localStorage.removeItem(SKIN_KEY);
    else localStorage.setItem(SKIN_KEY, skin);
  } catch {
    /* private mode — the choice just won't persist */
  }
  paintSkin(skin);
  emit();
}

export function useSkin() {
  return useSyncExternalStore(subscribe, readSkin, () => "ledger" as SkinPref);
}
