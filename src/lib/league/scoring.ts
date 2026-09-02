export type ScoringBook = Record<string, number>;

export const SCORING_FIELDS: Array<{
  key: string;
  group: string;
  label: string;
  step: number;
}> = [
  { key: "pass_yd", group: "Passing", label: "Passing yards", step: 0.01 },
  { key: "pass_td", group: "Passing", label: "Passing TD", step: 1 },
  { key: "pass_int", group: "Passing", label: "Interception", step: 1 },
  { key: "pass_2pt", group: "Passing", label: "Passing 2-pt", step: 1 },
  { key: "rush_yd", group: "Rushing", label: "Rushing yards", step: 0.01 },
  { key: "rush_td", group: "Rushing", label: "Rushing TD", step: 1 },
  { key: "rush_2pt", group: "Rushing", label: "Rushing 2-pt", step: 1 },
  { key: "rec", group: "Receiving", label: "Reception", step: 0.1 },
  { key: "rec_yd", group: "Receiving", label: "Receiving yards", step: 0.01 },
  { key: "rec_td", group: "Receiving", label: "Receiving TD", step: 1 },
  { key: "rec_2pt", group: "Receiving", label: "Receiving 2-pt", step: 1 },
  { key: "fum_lost", group: "Turnovers", label: "Fumble lost", step: 1 },
  { key: "fum", group: "Turnovers", label: "Fumble (not lost)", step: 1 },
  { key: "kr_yd", group: "Returns", label: "Kick return yards", step: 0.01 },
  { key: "kr_td", group: "Returns", label: "Kick return TD", step: 1 },
  { key: "pr_yd", group: "Returns", label: "Punt return yards", step: 0.01 },
  { key: "pr_td", group: "Returns", label: "Punt return TD", step: 1 },
  { key: "st_td", group: "Returns", label: "Special teams TD", step: 1 },
  { key: "kr", group: "Returns", label: "Kick return", step: 1 },
  { key: "pr", group: "Returns", label: "Punt return", step: 1 },
  { key: "bonus_pass_yd_300", group: "Bonuses", label: "300 pass yards", step: 1 },
  { key: "bonus_rush_yd_100", group: "Bonuses", label: "100 rush yards", step: 1 },
  { key: "bonus_rec_yd_100", group: "Bonuses", label: "100 rec yards", step: 1 },
  { key: "bonus_rush_rec_yd_100", group: "Bonuses", label: "100 rush+rec yards", step: 1 },
  { key: "pass_cmp", group: "Passing", label: "Completion", step: 0.1 },
  { key: "pass_inc", group: "Passing", label: "Incompletion", step: 0.1 },
  { key: "pass_sack", group: "Passing", label: "QB sacked", step: 0.5 },
  { key: "fgm_0_19", group: "Kicking", label: "FG 0–19", step: 1 },
  { key: "fgm_20_29", group: "Kicking", label: "FG 20–29", step: 1 },
  { key: "fgm_30_39", group: "Kicking", label: "FG 30–39", step: 1 },
  { key: "fgm_40_49", group: "Kicking", label: "FG 40–49", step: 1 },
  { key: "fgm_50p", group: "Kicking", label: "FG 50+", step: 1 },
  { key: "xpm", group: "Kicking", label: "PAT made", step: 1 },
  { key: "fgmiss", group: "Kicking", label: "FG missed", step: 1 },
  { key: "xpmiss", group: "Kicking", label: "PAT missed", step: 1 },
  { key: "sack", group: "Defense", label: "Sack", step: 0.5 },
  { key: "int", group: "Defense", label: "DEF INT", step: 1 },
  { key: "fum_rec", group: "Defense", label: "Fumble recovery", step: 1 },
  { key: "def_td", group: "Defense", label: "DEF TD", step: 1 },
  { key: "safe", group: "Defense", label: "Safety", step: 1 },
  { key: "blk_kick", group: "Defense", label: "Blocked kick", step: 1 },
  { key: "yds_allow_0_99", group: "Yards allowed", label: "0–99 yards", step: 1 },
  { key: "yds_allow_100_199", group: "Yards allowed", label: "100–199", step: 1 },
  { key: "yds_allow_200_299", group: "Yards allowed", label: "200–299", step: 1 },
  { key: "yds_allow_300_349", group: "Yards allowed", label: "300–349", step: 1 },
  { key: "yds_allow_350_399", group: "Yards allowed", label: "350–399", step: 1 },
  { key: "yds_allow_400_449", group: "Yards allowed", label: "400–449", step: 1 },
  { key: "yds_allow_450p", group: "Yards allowed", label: "450+", step: 1 },
  { key: "pts_allow_0", group: "Points allowed", label: "0 points", step: 1 },
  { key: "pts_allow_1_6", group: "Points allowed", label: "1–6", step: 1 },
  { key: "pts_allow_7_13", group: "Points allowed", label: "7–13", step: 1 },
  { key: "pts_allow_14_20", group: "Points allowed", label: "14–20", step: 1 },
  { key: "pts_allow_21_27", group: "Points allowed", label: "21–27", step: 1 },
  { key: "pts_allow_28_34", group: "Points allowed", label: "28–34", step: 1 },
  { key: "pts_allow_35p", group: "Points allowed", label: "35+", step: 1 },
];

const CLASSIC: ScoringBook = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -1,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec: 1,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
  fum: 0,
  kr_yd: 0,
  kr_td: 6,
  pr_yd: 0,
  pr_td: 6,
  st_td: 6,
  kr: 0,
  pr: 0,
  bonus_pass_yd_300: 0,
  bonus_rush_yd_100: 0,
  bonus_rec_yd_100: 0,
  bonus_rush_rec_yd_100: 0,
  pass_cmp: 0,
  pass_inc: 0,
  pass_sack: 0,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  xpm: 1,
  fgmiss: -1,
  xpmiss: -1,
  sack: 1,
  int: 2,
  fum_rec: 2,
  def_td: 6,
  safe: 2,
  blk_kick: 2,
  yds_allow_0_99: 0,
  yds_allow_100_199: 0,
  yds_allow_200_299: 0,
  yds_allow_300_349: 0,
  yds_allow_350_399: 0,
  yds_allow_400_449: 0,
  yds_allow_450p: 0,
  pts_allow_0: 10,
  pts_allow_1_6: 7,
  pts_allow_7_13: 4,
  pts_allow_14_20: 1,
  pts_allow_21_27: 0,
  pts_allow_28_34: -1,
  pts_allow_35p: -4,
};

export function bookFromPreset(preset: "ppr" | "half" | "std"): ScoringBook {
  return { ...CLASSIC, rec: preset === "ppr" ? 1 : preset === "half" ? 0.5 : 0 };
}

export function presetOf(book: ScoringBook): "ppr" | "half" | "std" {
  const rec = book.rec ?? 0;
  if (rec >= 0.9) return "ppr";
  if (rec >= 0.4) return "half";
  return "std";
}

export function scoringLabel(book: ScoringBook): string {
  const rec = presetOf(book);
  const recLab = rec === "ppr" ? "PPR" : rec === "half" ? "Half PPR" : "Standard";
  const pass = book.pass_td === 6 ? "6pt pass TD" : book.pass_td === 4 ? "4pt pass TD" : null;
  return [recLab, pass].filter(Boolean).join(" · ");
}

export function fromSleeperSettings(raw: Record<string, number> | null | undefined): ScoringBook {
  const book = bookFromPreset("ppr");
  if (!raw) return book;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) book[k] = v;
  }
  if (book.fgm_50p == null && typeof book.fgm_50_59 === "number") {
    book.fgm_50p = book.fgm_50_59;
  }
  return book;
}

const LINEAR_SKIP = new Set([
  "pts_allow_0",
  "pts_allow_1_6",
  "pts_allow_7_13",
  "pts_allow_14_20",
  "pts_allow_21_27",
  "pts_allow_28_34",
  "pts_allow_35p",
  "yds_allow_0_99",
  "yds_allow_100_199",
  "yds_allow_200_299",
  "yds_allow_300_349",
  "yds_allow_350_399",
  "yds_allow_400_449",
  "yds_allow_450p",
  "bonus_pass_yd_300",
  "bonus_pass_yd_400",
  "bonus_rush_yd_100",
  "bonus_rush_yd_200",
  "bonus_rec_yd_100",
  "bonus_rec_yd_200",
  "bonus_rush_rec_yd_100",
]);

/**
 * Yardage bonuses are tiers, not stacks: Sleeper pays the 200-yard bonus
 * instead of the 100-yard one, never both. Computed from the yards so a bag
 * with or without Sleeper's own bonus flags scores the same.
 */
function tieredBonus(book: ScoringBook, yards: number, tiers: [number, string][]): number {
  for (const [at, key] of tiers) {
    if (yards >= at && (book[key] ?? 0)) return book[key] ?? 0;
  }
  return 0;
}

function dstAllow(book: ScoringBook, allowed: number | undefined): number {
  if (typeof allowed !== "number") return 0;
  if (allowed <= 0) return book.pts_allow_0 ?? 0;
  if (allowed <= 6) return book.pts_allow_1_6 ?? 0;
  if (allowed <= 13) return book.pts_allow_7_13 ?? 0;
  if (allowed <= 20) return book.pts_allow_14_20 ?? 0;
  if (allowed <= 27) return book.pts_allow_21_27 ?? 0;
  if (allowed <= 34) return book.pts_allow_28_34 ?? 0;
  return book.pts_allow_35p ?? 0;
}

function dstYards(book: ScoringBook, yards: number | undefined): number {
  if (typeof yards !== "number") return 0;
  if (yards < 100) return book.yds_allow_0_99 ?? 0;
  if (yards < 200) return book.yds_allow_100_199 ?? 0;
  if (yards < 300) return book.yds_allow_200_299 ?? 0;
  if (yards < 350) return book.yds_allow_300_349 ?? 0;
  if (yards < 400) return book.yds_allow_350_399 ?? 0;
  if (yards < 450) return book.yds_allow_400_449 ?? 0;
  return book.yds_allow_450p ?? 0;
}

export function applyBook(
  book: ScoringBook,
  stats: Record<string, number> | null | undefined,
): number {
  if (!stats) return 0;
  let pts = 0;
  for (const [k, w] of Object.entries(book)) {
    if (typeof w !== "number" || LINEAR_SKIP.has(k)) continue;
    const v = stats[k];
    if (typeof v === "number") pts += w * v;
  }
  if (typeof stats.pts_allow === "number") pts += dstAllow(book, stats.pts_allow);
  if (typeof stats.yds_allow === "number") pts += dstYards(book, stats.yds_allow);
  pts += tieredBonus(book, stats.pass_yd ?? 0, [
    [400, "bonus_pass_yd_400"],
    [300, "bonus_pass_yd_300"],
  ]);
  pts += tieredBonus(book, stats.rush_yd ?? 0, [
    [200, "bonus_rush_yd_200"],
    [100, "bonus_rush_yd_100"],
  ]);
  pts += tieredBonus(book, stats.rec_yd ?? 0, [
    [200, "bonus_rec_yd_200"],
    [100, "bonus_rec_yd_100"],
  ]);
  if ((book.bonus_rush_rec_yd_100 ?? 0) && (stats.rush_yd ?? 0) + (stats.rec_yd ?? 0) >= 100) {
    pts += book.bonus_rush_rec_yd_100;
  }
  if (typeof stats.fgm_50_59 === "number" && book.fgm_50p && stats.fgm_50p == null) {
    pts += book.fgm_50p * stats.fgm_50_59;
  }
  if (typeof stats.fgm_60p === "number" && book.fgm_50p) {
    pts += book.fgm_50p * stats.fgm_60p;
  }
  return Math.round(pts * 100) / 100;
}

export function isClassicPreset(book: ScoringBook): boolean {
  const base = bookFromPreset(presetOf(book));
  for (const { key } of SCORING_FIELDS) {
    if ((book[key] ?? 0) !== (base[key] ?? 0)) return false;
  }
  return true;
}

export function parseBook(
  raw: string | null | undefined,
  fallback: "ppr" | "half" | "std",
): ScoringBook {
  if (raw) {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v && typeof v === "object") return v as ScoringBook;
    } catch {
      /* ignore */
    }
  }
  return bookFromPreset(fallback);
}
