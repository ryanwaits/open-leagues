import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

test("hosted league loader bounces unsigned viewers to login", () => {
  const src = readFileSync(join(root, "src/routes/league/$leagueId.tsx"), "utf8");
  assert.match(src, /msg === "Unauthorized"/);
  assert.match(src, /throw redirect\(/);
  assert.match(src, /to:\s*"\/login"/);
});

test("local WIFFL seed claims hands for the seed user", () => {
  const src = readFileSync(join(root, "src/lib/auth/seed.server.ts"), "utf8");
  assert.match(src, /seedLocalWiffl/);
  assert.match(src, /teamName === "hands"/);
  assert.match(src, /LOCAL_SEED\.userId/);
});

test("home onboarding split hides first-run noise", () => {
  const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
  assert.doesNotMatch(home, /InstallCoach/);
  assert.doesNotMatch(home, /AgentTokens/);
  assert.doesNotMatch(home, /Start empty/);
  assert.match(home, /GuestHome/);
  assert.match(home, /FirstHome/);
  assert.match(home, /DeskHome/);
  assert.match(home, /I have an invite/);
  assert.match(home, /I'm starting the league/);
  const joinSrc = readFileSync(join(root, "src/routes/join.tsx"), "utf8");
  assert.doesNotMatch(joinSrc, /InstallCoach/);
  const account = readFileSync(join(root, "src/routes/account.tsx"), "utf8");
  assert.match(account, /InstallDrawerButton/);
  const fresh = readFileSync(join(root, "src/routes/new.tsx"), "utf8");
  assert.match(fresh, /Start empty instead/);
});

test("join login bounce preserves invite code in redirect", () => {
  const src = readFileSync(join(root, "src/routes/join.tsx"), "utf8");
  assert.doesNotMatch(src, /redirect:\s*["']\/join["']/, "bare /join redirect drops ?code=");
  const bounces = [
    ...src.matchAll(
      /redirect:\s*code\.trim\(\)\s*\?[\s\S]*?`\/join\?code=\$\{encodeURIComponent\(code\.trim\(\)\)\}`[\s\S]*?:\s*["']\/join["']/g,
    ),
  ];
  assert.equal(bounces.length, 2, "both Navigate and unauthorized navigate must keep code=");
  assert.match(src, /code=/);
});
