import { generateObject } from "ai";
import { modelForUser } from "./ai.server";
import {
  ANALYZE_SYSTEM,
  type Analysis,
  AnalysisSchema,
  filterCanonicalScoring,
} from "./import-analyze";

/**
 * BYOK consumer #1: read league SETTINGS (scoring, slots, name, season,
 * playoffs) out of whatever a commissioner pastes or drops during import —
 * `packFromRebuild` otherwise hardcodes a scoring preset and every
 * commissioner re-types their real rulebook by hand.
 *
 * Server-only half: the actual model call. Schema/prompt/merge logic lives
 * in `import-analyze.ts` (no `.server` suffix) so `import.tsx` can import it
 * client-side without pulling provider SDKs / node:crypto into the bundle.
 */

/**
 * Runs the user's own model (BYOK) over import text and extracts league
 * settings. Returns null when the user has no AI key configured — never
 * throws for that case, since AI is optional everywhere it's offered.
 */
export async function analyzeImportText(userId: string, text: string): Promise<Analysis | null> {
  const model = await modelForUser(userId);
  if (!model) return null;
  const { object } = await generateObject({
    model,
    schema: AnalysisSchema,
    system: ANALYZE_SYSTEM,
    prompt: text.slice(0, 200_000),
  });
  return { ...object, scoring: filterCanonicalScoring(object.scoring) };
}
