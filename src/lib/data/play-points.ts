import { applyBook, type ScoringBook } from "@/lib/league/scoring";
import type { PlaySegment, TrackedPlayer } from "./play-tags";
import { canonTeam, playerTeam } from "./teams";
import type { GamePlay } from "./types";

export type PlayCredit = {
  tracked: TrackedPlayer;
  bag: Record<string, number>;
  /** League points this one play was worth to that player. */
  points: number;
};

/** Blank out parenthesised runs (tacklers, holders) without shifting indexes. */
function coreOf(text: string): string {
  let depth = 0;
  let out = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (depth > 0) out += " ";
    else out += ch;
    if (ch === ")" && depth > 0) depth -= 1;
  }
  return out;
}

function yardsOf(play: GamePlay, core: string): number {
  if (typeof play.yardage === "number") return play.yardage;
  const m = core.match(/for (-?\d+) yards?/i);
  if (m) return Number(m[1]);
  if (/for no gain/i.test(core)) return 0;
  return 0;
}

function fgBucket(dist: number): string {
  if (dist < 20) return "fgm_0_19";
  if (dist < 30) return "fgm_20_29";
  if (dist < 40) return "fgm_30_39";
  if (dist < 50) return "fgm_40_49";
  return "fgm_50p";
}

/**
 * What one play credits to each tracked player named in it, read off ESPN's
 * text the way a stat crew would: who threw, who caught, who ran, who kicked.
 * Bonuses that depend on game totals (100-yd games) are not per-play and are
 * left to the week line.
 */
export function playCredits(play: GamePlay, segs: PlaySegment[], book: ScoringBook): PlayCredit[] {
  const text = play.text;
  const core = coreOf(text);
  const type = play.type.toLowerCase();
  const yards = yardsOf(play, core);
  const td = /touchdown/.test(type) || /\bTOUCHDOWN\b/.test(core);
  const nullified = /NULLIFIED|REVERSED|No Play/i.test(core);
  const twoPt = /TWO-POINT CONVERSION/i.test(core);
  const twoPtGood = twoPt && /SUCCEEDS/i.test(core);
  const passIdx = core.search(/\bpass(?:es|ed)?\b/i);
  const sackIdx = core.search(/\bsacked\b/i);
  const kickIdx = core.search(/\b(?:kicks|punts)\b/i);
  const isPass = passIdx >= 0 || /pass|intercept/.test(type);
  const isSack = sackIdx >= 0 || /sack/.test(type);
  const isKickoff = /kickoff/.test(type) || /\bkicks\b/i.test(core);
  const isPunt = /punt/.test(type) || /\bpunts\b/i.test(core);
  const intercepted = /INTERCEPTED/i.test(core) || /intercept/.test(type);
  const incomplete = /incomplet/.test(type) || /\bincomplete\b/i.test(core);
  const fumbleLostTo = core.match(/FUMBLES.*?RECOVERED by ([A-Z]{2,4})-/i);

  const out: PlayCredit[] = [];
  const seen = new Set<string>();
  for (const seg of segs) {
    if (seg.kind !== "player") continue;
    const id = seg.tracked.player.player_id;
    if (seen.has(id)) continue;
    // A name inside parentheses is a tackler or holder, not the ball carrier.
    if (core[seg.start] === " " && text[seg.start] !== " ") continue;
    seen.add(id);
    const bag: Record<string, number> = {};
    const after = core.slice(seg.start + seg.text.length);
    const fi = seg.text[0]?.toUpperCase() ?? "";

    if (nullified) {
      // nothing counts
    } else if (/field goal/.test(type) || /yard field goal/i.test(core)) {
      const dist = Number(core.match(/(\d+)\s+yard field goal/i)?.[1] ?? 0);
      if (/is GOOD/i.test(core)) bag[fgBucket(dist)] = 1;
      else bag.fgmiss = 1;
    } else if (/^\s+extra point is/i.test(after)) {
      if (/^\s+extra point is GOOD/i.test(after)) bag.xpm = 1;
      else bag.xpmiss = 1;
    } else if ((isKickoff || isPunt) && kickIdx >= 0 && seg.start > kickIdx) {
      // The returner: "… to HOU 32. J.Jackson pushed ob at HOU 40 for 8 yards"
      const ret = Number(after.match(/for (-?\d+) yards?/i)?.[1] ?? 0);
      const k = isKickoff ? "kr" : "pr";
      bag[k] = 1;
      bag[`${k}_yd`] = ret;
      if (td) bag[`${k}_td`] = 1;
    } else if (isKickoff || isPunt) {
      // Kicker/punter on a kick: nothing fantasy-scored.
    } else if (twoPt) {
      if (!twoPtGood) {
        // failed try: nothing
      } else if (isPass) {
        bag[seg.start < passIdx ? "pass_2pt" : "rec_2pt"] = 1;
      } else {
        bag.rush_2pt = 1;
      }
    } else if (isSack && (passIdx < 0 || seg.start < Math.max(sackIdx, passIdx))) {
      bag.pass_sack = 1;
    } else if (isPass) {
      const passer = passIdx >= 0 ? seg.start < passIdx : false;
      if (passer) {
        if (intercepted) {
          bag.pass_int = 1;
          bag.pass_inc = 1;
        } else if (incomplete) {
          bag.pass_inc = 1;
        } else {
          bag.pass_cmp = 1;
          bag.pass_yd = yards;
          if (td) bag.pass_td = 1;
        }
      } else if (!intercepted && !incomplete) {
        bag.rec = 1;
        bag.rec_yd = yards;
        if (td) bag.rec_td = 1;
      }
    } else {
      bag.rush_att = 1;
      bag.rush_yd = yards;
      if (td) bag.rush_td = 1;
    }

    // "W.Marks … FUMBLES (T.Wilson), RECOVERED by LV-J.Hummel" — lost if the
    // other side came up with it and this player is the one who coughed it up.
    if (fumbleLostTo && !nullified) {
      const fumbler = core.slice(0, core.search(/FUMBLES/i));
      const named = new RegExp(`\\b${fi}\\.`).test(fumbler) && fumbler.includes(seg.text);
      const lostTo = canonTeam(fumbleLostTo[1]);
      const own = playerTeam(seg.tracked.player);
      if (named && lostTo && own && lostTo !== own) {
        bag.fum = 1;
        bag.fum_lost = 1;
      }
    }

    const points = applyBook(book, bag);
    out.push({ tracked: seg.tracked, bag, points });
  }
  return out;
}

/** "+2.1", "-1", "+0.45" — league points with the decimals they actually have. */
export function formatPlayPts(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
  return `${sign}${fixed}`;
}
