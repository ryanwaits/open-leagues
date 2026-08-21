import { z } from "zod";
import { SCORING_FIELDS, type ScoringBook } from "./scoring";

/**
 * Pure, client-safe half of the import analyst: the extraction schema, the
 * SYSTEM prompt, and the (pack, analysis) → pack merge. No secrets, no I/O —
 * this file has no `.server` suffix on purpose so `import.tsx` can import it
 * directly to build the review-step status line. The actual model call
 * (`analyzeImportText`, which needs the user's BYOK key) lives in
 * `import-analyze.server.ts`.
 */

const CANONICAL_KEYS = new Set(SCORING_FIELDS.map((f) => f.key));

export const AnalysisSchema = z.object({
  leagueName: z.string().nullable(),
  season: z.string().nullable(),
  scoring: z.record(z.string(), z.number()).nullable(),
  slots: z.array(z.string()).nullable(),
  playoffTeams: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const GLOSSARY = SCORING_FIELDS.map((f) => `${f.key} — ${f.label}`).join("\n");

export const ANALYZE_SYSTEM = `You extract fantasy football league SETTINGS from pasted or PDF-scraped
text (recaps, rulebooks, league-settings screenshots turned to text, CSVs).

Extraction rules:
- Only report what the text actually supports. If a field is not stated or
  cannot be inferred with reasonable confidence, set it to null — never guess
  or fill in a "typical" default.
- "scoring" is a partial map of canonical keys → point values. Only include
  keys the text gives you evidence for; omit everything else (do not zero-fill
  the whole glossary).
- Use ONLY the canonical keys below — never invent new key names, and never
  emit a key that is not in this list.
- "slots" is the starting lineup, one slot code per starter, in the order
  they appear (e.g. ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF"]). Do not
  include bench ("BN") in slots unless the text is explicit about bench size
  and you are asked for the full roster (you are not — starters only).
- "playoffTeams" is how many teams make the postseason bracket.
- "confidence": "high" when the text states settings explicitly, "medium"
  when inferred from strong context (e.g. a boxscore that only makes sense
  under one scoring rule), "low" when mostly guessed from weak signals.
- "notes" is one short sentence a commissioner would find useful — what you
  found or why confidence is low. Never longer than ~200 characters.

Canonical scoring keys (key — meaning):
${GLOSSARY}

Worked examples:
1. Text says "Half PPR" → scoring includes { "rec": 0.5 }. Do not add any
   other key unless the text also states it.
2. Text says "Passing TD: 6 pts" → scoring includes { "pass_td": 6 }.

Never fabricate a league name, season, or playoff count that is not written
in the text — leave those null rather than inventing something plausible.`;

/** Filters an LLM-emitted scoring map down to keys this app actually scores. */
export function filterCanonicalScoring(scoring: Record<string, number> | null): ScoringBook | null {
  if (!scoring) return null;
  const out: ScoringBook = {};
  for (const [k, v] of Object.entries(scoring)) {
    if (CANONICAL_KEYS.has(k) && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Pure merge shape — a subset of `ImportPack`'s settings fields, so this
 * stays independent of `import-pack.ts` (which stays read-only). */
export type MergeablePack = {
  name: string | null;
  season: string | null;
  book: ScoringBook;
  slots: string[] | null;
  playoffTeams: number | null;
};

/**
 * Overlays a detected `Analysis` onto a pack: scoring keys are overlaid
 * unconditionally (filtered to the canonical key set), while
 * name/season/slots/playoffTeams only fill in when the pack doesn't already
 * have a value — so a user's own edits in the review step always win.
 */
export function mergeAnalysis(pack: MergeablePack, analysis: Analysis | null): MergeablePack {
  if (!analysis) return pack;
  const scoring = filterCanonicalScoring(analysis.scoring);
  return {
    name: pack.name || analysis.leagueName || null,
    season: pack.season || analysis.season || null,
    book: scoring ? { ...pack.book, ...scoring } : pack.book,
    slots: pack.slots?.length ? pack.slots : (analysis.slots ?? pack.slots),
    playoffTeams: pack.playoffTeams ?? analysis.playoffTeams,
  };
}
