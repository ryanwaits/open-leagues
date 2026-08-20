// Add-to-home-screen eligibility. Pure logic lives here so it can be
// unit-tested without a DOM; the impure localStorage/date wrapper is the
// only piece the component needs to call directly.

export const A2HS_DISMISS_KEY = "open-ff-a2hs-2"; // v2 on purpose: people who
// dismissed the old card get ONE fresh offer from the richer drawer.
export const A2HS_JOIN_KEY = "open-ff-a2hs-join"; // set on join success
export const A2HS_DAYS_KEY = "open-ff-a2hs-days"; // JSON {last:"YYYY-MM-DD",days:n}

export function standalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

export function iosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return ios || ipadOs;
}

/** Pure: fold today's date into the stored visit record. Counts distinct days. */
export function bumpDays(raw: string | null, today: string): { raw: string; days: number } {
  let last: string | undefined;
  let days = 0;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { last?: unknown; days?: unknown };
      if (typeof parsed.last === "string" && typeof parsed.days === "number") {
        last = parsed.last;
        days = parsed.days;
      }
    } catch {
      /* malformed — treat as no prior record */
    }
  }
  if (last !== today) {
    days += 1;
  }
  return { raw: JSON.stringify({ last: today, days }), days };
}

/** Pure: the drawer opens iff not standalone, not dismissed, and
 *  (joined || days >= 2). */
export function eligibleFrom(s: {
  standalone: boolean;
  dismissed: boolean;
  joined: boolean;
  days: number;
}): boolean {
  if (s.standalone) return false;
  if (s.dismissed) return false;
  return s.joined || s.days >= 2;
}

/** Impure wrapper used by the component: reads localStorage (try/catch like
 *  install-coach), calls bumpDays with today, returns eligibility. */
export function checkAndRecordVisit(): boolean {
  const standaloneNow = standalone();
  let dismissed = false;
  let joined = false;
  let days = 0;
  try {
    dismissed = localStorage.getItem(A2HS_DISMISS_KEY) === "1";
    joined = localStorage.getItem(A2HS_JOIN_KEY) === "1";
    const today = new Date().toISOString().slice(0, 10);
    const bumped = bumpDays(localStorage.getItem(A2HS_DAYS_KEY), today);
    days = bumped.days;
    localStorage.setItem(A2HS_DAYS_KEY, bumped.raw);
  } catch {
    /* ignore — no persisted state, falls back to non-eligible */
  }
  return eligibleFrom({ standalone: standaloneNow, dismissed, joined, days });
}
