import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { decryptSecret, encryptSecret } from "./ai.server.ts";
import { mergeAnalysis } from "./import-analyze.ts";

const root = join(import.meta.dirname, "../../..");

/* ------------------------------------------------------------- crypto -- */

test("encryptSecret/decryptSecret roundtrips", () => {
  const secret = "test-runtime-secret-do-not-use-in-prod";
  const plain = "sk-ant-super-secret-key-value";
  const payload = encryptSecret(plain, secret);
  assert.notEqual(payload, plain);
  assert.ok(!payload.includes(plain));
  assert.equal(decryptSecret(payload, secret), plain);
});

test("decryptSecret throws on a tampered payload (bad GCM tag)", () => {
  const secret = "test-runtime-secret-do-not-use-in-prod";
  const payload = encryptSecret("sk-ant-super-secret-key-value", secret);
  const [iv, enc, tag] = payload.split(":");
  // Flip the tag's first character to a value guaranteed different from the
  // original (base64 alphabet is a superset of "A"/"B") — GCM must refuse.
  const flipped = tag[0] === "A" ? "B" : "A";
  const tampered = [iv, enc, `${flipped}${tag.slice(1)}`].join(":");
  assert.throws(() => decryptSecret(tampered, secret));
});

test("decryptSecret throws with the wrong secret", () => {
  const payload = encryptSecret("sk-ant-super-secret-key-value", "secret-one");
  assert.throws(() => decryptSecret(payload, "secret-two"));
});

/* -------------------------------------------------------- mergeAnalysis -- */

test("mergeAnalysis returns pack unchanged when analysis is null", () => {
  const pack = {
    name: "My League",
    season: "2026",
    book: { rec: 1 },
    slots: ["QB"],
    playoffTeams: 6,
  };
  assert.deepEqual(mergeAnalysis(pack, null), pack);
});

test("mergeAnalysis overlays scoring keys filtered to the canonical set", () => {
  const pack = {
    name: null,
    season: null,
    book: { rec: 1, pass_td: 4 },
    slots: null,
    playoffTeams: null,
  };
  const analysis = {
    leagueName: null,
    season: null,
    scoring: { rec: 0.5, pass_td: 6, made_up_key: 99 },
    slots: null,
    playoffTeams: null,
    confidence: "high",
    notes: "",
  };
  const merged = mergeAnalysis(pack, analysis);
  assert.equal(merged.book.rec, 0.5);
  assert.equal(merged.book.pass_td, 6);
  assert.ok(!("made_up_key" in merged.book), "unknown scoring keys must be dropped");
});

test("mergeAnalysis fills name/season/slots/playoffTeams only when unset", () => {
  const pack = { name: "Kept", season: null, book: {}, slots: null, playoffTeams: 8 };
  const analysis = {
    leagueName: "Detected League",
    season: "2025",
    scoring: null,
    slots: ["QB", "RB", "RB"],
    playoffTeams: 4,
    confidence: "medium",
    notes: "",
  };
  const merged = mergeAnalysis(pack, analysis);
  assert.equal(merged.name, "Kept", "existing name must not be overwritten");
  assert.equal(merged.season, "2025", "unset season fills from analysis");
  assert.deepEqual(merged.slots, ["QB", "RB", "RB"], "unset slots fill from analysis");
  assert.equal(merged.playoffTeams, 8, "existing playoffTeams must not be overwritten");
});

/* ------------------------------------------------------------ source asserts -- */

test("getUserAiMasked never returns key_enc plaintext, only a masked shape", () => {
  const src = readFileSync(join(root, "src/lib/league/ai.server.ts"), "utf8");
  const fn = src.slice(src.indexOf("export async function getUserAiMasked"));
  const body = fn.slice(0, fn.indexOf("\nexport async function deleteUserAi"));
  assert.match(body, /keyLast4/);
  assert.doesNotMatch(body, /return\s+row/);
  assert.doesNotMatch(body, /key_enc:\s*row\.key_enc/);
});

test("default Anthropic model is claude-sonnet-5", () => {
  const src = readFileSync(join(root, "src/lib/league/ai.server.ts"), "utf8");
  assert.match(src, /claude-sonnet-5/);
});

test("account.tsx has an AI settings section", () => {
  const src = readFileSync(join(root, "src/routes/account.tsx"), "utf8");
  assert.match(src, /AiSettingsPanel/);
  assert.match(src, /<h2 className="microlabel">AI<\/h2>/);
  assert.match(src, /getAiSettings|saveAiSettings|testAiSettings|deleteAiSettings/);
});

test("import.tsx calls analyzeImport", () => {
  const src = readFileSync(join(root, "src/routes/import.tsx"), "utf8");
  assert.match(src, /analyzeImport/);
});

test("fns.ts exports the five AI server fns", () => {
  const src = readFileSync(join(root, "src/lib/league/fns.ts"), "utf8");
  for (const name of [
    "getAiSettings",
    "saveAiSettings",
    "deleteAiSettings",
    "testAiSettings",
    "analyzeImport",
  ]) {
    assert.match(src, new RegExp(`export const ${name} = createServerFn`));
  }
  // No fn should select or forward the raw encrypted key column.
  assert.doesNotMatch(src, /key_enc/);
});
