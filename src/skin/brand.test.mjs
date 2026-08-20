import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../..");

test("brand.name is Open Leagues and shell/root/login read it", () => {
  const brand = readFileSync(join(root, "src/skin/brand.ts"), "utf8");
  assert.match(brand, /name:\s*"Open Leagues"/);
  for (const rel of ["src/components/shell.tsx", "src/routes/__root.tsx", "src/routes/login.tsx"]) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.match(src, /from "@\/skin\/brand"/);
    assert.match(src, /brand\.name/);
  }
  const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.doesNotMatch(shell, /Ledger/);
});
