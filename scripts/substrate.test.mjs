import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("substrate is the default; league mode is the deliberate step", () => {
  const mode = read("src/lib/box-mode.ts");
  assert.match(mode, /OPENLEAGUES_MODE/);
  assert.match(mode, /raw === "league" \|\| raw === "box" \? "league" : "substrate"/);
  assert.match(read("docker-compose.yml"), /OPENLEAGUES_MODE: "league"/);
  assert.match(read("package.json"), /OPENLEAGUES_MODE=\$\{OPENLEAGUES_MODE:-league\} vite dev/);
  assert.doesNotMatch(
    read("render.yaml"),
    /key: (OPENLEAGUES_MODE|BETTER_AUTH_URL|GOOGLE_CLIENT|VAPID)/,
  );
  assert.match(read("src/lib/box-mode.fns.ts"), /getBoxMode = createServerFn/);
  assert.match(read(".env.example"), /OPENLEAGUES_MODE=/);
});

test("every door a person would walk through is gated on a substrate", () => {
  for (const p of [
    "src/routes/login.tsx",
    "src/routes/account.tsx",
    "src/routes/new.tsx",
    "src/routes/import.tsx",
    "src/routes/join.tsx",
    "src/routes/league/$leagueId.tsx",
  ]) {
    const src = read(p);
    assert.match(src, /useBoxMode\(\)/, p);
    assert.match(src, /<SubstrateNotice what=/, p);
  }
  assert.match(read("src/routes/api/auth/$.ts"), /isSubstrate\(\)/);
  assert.match(read("src/components/docs-shell.tsx"), /substrate \? null/);
});

test("the public MCP door is rate-limited and confined to PUBLIC_CORE", () => {
  const mcp = read("src/routes/api/mcp.ts");
  assert.match(mcp, /rateLimited\(request\)/);
  assert.match(mcp, /PUBLIC_CORE\.has\(name\)/);
  assert.match(mcp, /SUBSTRATE_REFUSAL/);
  const core = read("src/lib/agent/core.ts");
  // nothing in PUBLIC_CORE needs a seat or a person
  const pub = core.slice(core.indexOf("PUBLIC_CORE"));
  for (const v of [
    "getAgentContext",
    "startPlayer",
    "placeWager",
    "freezeStrategy",
    "recordLabRun",
    "getWeekProjections",
    "listMyLeagues",
  ]) {
    assert.ok(!pub.includes(`"${v}"`), `${v} must not be public`);
  }
});

test("the lab skills know how to keep a strategy on a box with no accounts", () => {
  for (const p of ["open-leagues-lab-discover", "open-leagues-lab-run"]) {
    assert.match(
      read(`skills/${p}/SKILL.md`),
      /~\/\.open-leagues\/labs\/<name>\/strategy\.json/,
      p,
    );
  }
  assert.match(read("src/lib/agent/context-prompt.md"), /\*\*substrate\*\*/);
});
