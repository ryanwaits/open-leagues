import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

test("hosted league loader bounces unsigned viewers to login", () => {
  const src = readFileSync(join(root, "src/routes/league/$leagueId.tsx"), "utf8");
  assert.match(src, /msg === "Unauthorized"/);
  assert.match(src, /throw redirect\(/);
  assert.match(src, /to:\s*"\/login"/);
});

test("the dev seed is opt-in — a self-hosted box comes up empty", () => {
  const seed = readFileSync(join(root, "src/lib/auth/seed.server.ts"), "utf8");
  const db = readFileSync(join(root, "src/lib/db.ts"), "utf8");
  assert.match(seed, /seedDevLeague/);
  assert.match(seed, /LOCAL_SEED\.userId/);
  // Nothing seeds unless the maintainer asks for it by name.
  assert.match(db, /OPENLEAGUES_DEV_SEED === "1"/);
  assert.doesNotMatch(seed, /lg_backyard/);
});

test("home onboarding split hides first-run noise", () => {
  const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
  const landing = readFileSync(join(root, "src/components/landing.tsx"), "utf8");
  assert.doesNotMatch(home, /InstallCoach/);
  assert.doesNotMatch(home, /AgentTokens/);
  assert.doesNotMatch(home, /Start empty/);
  assert.match(home, /Landing/);
  // The landing sells the headless surface; it does not recruit seats.
  assert.doesNotMatch(landing, /I have an invite/);
  const joinSrc = readFileSync(join(root, "src/routes/join.tsx"), "utf8");
  assert.doesNotMatch(joinSrc, /InstallCoach/);
  const account = readFileSync(join(root, "src/routes/account.tsx"), "utf8");
  assert.match(account, /InstallDrawerButton/);
  const fresh = readFileSync(join(root, "src/routes/new.tsx"), "utf8");
  assert.match(fresh, /Start empty instead/);
});

test("logged-out home is the landing; the demo route is gone", () => {
  const landing = readFileSync(join(root, "src/components/landing.tsx"), "utf8");
  const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
  const about = readFileSync(join(root, "src/routes/about.tsx"), "utf8");
  const demoRoute = join(root, "src/routes/demo.tsx");
  assert.match(home, /Landing/);
  assert.match(about, /redirect/);
  assert.match(about, /to: "\/"/);
  // No guest accounts, no handed-out seats, no /demo door.
  assert.equal(existsSync(demoRoute), false, "/demo must not come back");
  assert.doesNotMatch(landing, /to="\/demo"/);
});

test("in-app docs have a sidebar and cover the real guides", () => {
  const nav = readFileSync(join(root, "src/lib/docs/nav.ts"), "utf8");
  const shell = readFileSync(join(root, "src/components/docs-shell.tsx"), "utf8");
  const pages = readFileSync(join(root, "src/lib/docs/pages.tsx"), "utf8");
  const landing = readFileSync(join(root, "src/components/landing.tsx"), "utf8");
  assert.match(shell, /DOCS_GROUPS/);
  assert.match(nav, /quickstart/);
  assert.match(nav, /migrate/);
  assert.match(nav, /agents/);
  assert.match(nav, /self-host/);
  assert.match(nav, /cli/);
  assert.match(nav, /catalog/);
  assert.match(pages, /previewImport/);
  // the CLI page must describe the real script, not an invented binary
  assert.match(pages, /ledger\.mjs/);
  assert.doesNotMatch(pages, /open-leagues (getMatchups|startPlayer|placeWager) --/);
  assert.match(landing, /to=["']\/docs["']/);
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
