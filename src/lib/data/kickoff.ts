const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * ESPN's pre-game detail ("9/13 - 8:20 PM EDT") as a person says it: "Sun
 * 8:20". Morning kickoffs (London) keep an "a". Anything that is not a
 * date-time comes back null so callers fall through to the raw detail.
 */
export function shortKickoff(
  detail: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!detail) return null;
  const m = detail.match(/^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const hour = Number(m[3]);
  const minute = m[4];
  const pm = m[5]!.toUpperCase() === "PM";
  // The schedule string has no year. A January date seen in the autumn is
  // next season's playoffs, not last January.
  let year = now.getFullYear();
  if (month <= 2 && now.getMonth() >= 7) year += 1;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return `${DAYS[d.getDay()]} ${hour}:${minute}${pm ? "" : "a"}`;
}
