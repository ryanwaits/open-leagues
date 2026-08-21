import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

function findSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSourceFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(full);
    }
  }
  return files;
}

test("only live-line.tsx imports liveline", () => {
  // Built at runtime, not written as a literal here, so a source grep for the
  // import string doesn't also flag this test file as an importer.
  const marker = `from ${JSON.stringify("liveline")}`;
  const importers = findSourceFiles(root).filter((f) => readFileSync(f, "utf8").includes(marker));
  assert.deepEqual(importers, [join(root, "components/live-line.tsx")]);
});

test("live-line.tsx encodes the locked design decisions", () => {
  const src = readFileSync(join(root, "components/live-line.tsx"), "utf8");
  assert.match(src, /badgeVariant="minimal"/);
  assert.match(src, /useTheme\(/);
  assert.match(src, /clampLerp\(/);
});

test("live-line.tsx has no literal hex colours outside the three token fallbacks", () => {
  const src = readFileSync(join(root, "components/live-line.tsx"), "utf8");
  const hexLiterals = src.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  assert.equal(hexLiterals.length, 3, `expected exactly 3 hex literals, got ${hexLiterals.length}`);
});
