import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../..");

function findTsxFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

test("styles.css references shape/type tokens by var, not literal", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(styles, /var\(--r-xs\)/);
  assert.match(styles, /var\(--font-stack-sans\)/);
  assert.doesNotMatch(styles, /--radius-xs:\s*8px/);
});

test("tokens.css defines the raw shape + type knobs", () => {
  const tokens = readFileSync(join(root, "src/skin/tokens.css"), "utf8");
  for (const name of [
    "--r-xs",
    "--r-sm",
    "--r-md",
    "--r-lg",
    "--r-xl",
    "--r-pill",
    "--font-stack-display",
    "--font-stack-sans",
    "--font-stack-mono",
  ]) {
    assert.match(tokens, new RegExp(`${name}:`), `tokens.css should define ${name}`);
  }
});

test("boxscore skin defines the full token contract", () => {
  const boxscore = readFileSync(join(root, "src/skin/skins/boxscore.css"), "utf8");
  for (const name of [
    "paper",
    "paper-raised",
    "paper-sunken",
    "band",
    "ink",
    "ink-2",
    "ink-3",
    "hairline",
    "hairline-strong",
    "brand",
    "brand-deep",
    "brand-strong",
    "brand-ink",
    "highlight",
    "alarm",
    "caution",
    "lift",
    "press-cast",
    "r-pill",
    "font-stack-sans",
  ]) {
    assert.match(boxscore, new RegExp(`--${name}:`), `boxscore.css should define --${name}`);
  }
});

test("theme.ts stores the skin under ledger-skin and stamps data-skin pre-paint", () => {
  const theme = readFileSync(join(root, "src/lib/theme.ts"), "utf8");
  assert.match(theme, /SKIN_KEY\s*=\s*"ledger-skin"/);
  assert.match(theme, /data-skin/);
  assert.match(theme, /NO_FLASH_SCRIPT/);
});

test("styles.css defines the microlabel/ring-card voice classes and the boxscore .push override", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(styles, /\.microlabel\s*\{/);
  assert.match(styles, /\.microlabel-data\s*\{/);
  assert.match(styles, /\.ring-card\s*\{/);
  assert.match(styles, /\[data-skin="boxscore"\]\s+\.push/);
});

test("no src/**/*.tsx file has residual shadow-border or bare micro-label recipes", () => {
  const tsxFiles = findTsxFiles(join(root, "src"));
  assert.ok(tsxFiles.length > 0, "expected to find .tsx files under src");

  const shadowBorderLeaks = [];
  const microlabelLeaks = [];
  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf8");
    if (/shadow-\[var\(--shadow-border/.test(content)) {
      shadowBorderLeaks.push(file);
    }
    if (/font-mono text-\[[0-9.]+px\] uppercase/.test(content)) {
      microlabelLeaks.push(file);
    }
  }

  assert.deepEqual(
    shadowBorderLeaks,
    [],
    "no .tsx file should reference shadow-[var(--shadow-border...) directly",
  );
  assert.deepEqual(
    microlabelLeaks,
    [],
    "no .tsx file should reference the raw font-mono uppercase micro-label recipe",
  );
});

test("card ring and micro-label recipes are named in representative components", () => {
  const teamMasthead = readFileSync(join(root, "src/components/team-masthead.tsx"), "utf8");
  assert.match(teamMasthead, /ring-card/);

  const account = readFileSync(join(root, "src/routes/account.tsx"), "utf8");
  assert.match(account, /microlabel/);
});

test("styles.css defines the flourish classes", () => {
  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(styles, /\.ghost-num\b/);
  assert.match(styles, /\.slot-rail\b/);
  assert.match(styles, /\.stamp\b/);
  assert.match(styles, /\.ghost-host\b/);
});

test("boxscore skin defines the --ghost token in all three blocks", () => {
  const boxscore = readFileSync(join(root, "src/skin/skins/boxscore.css"), "utf8");
  const matches = boxscore.match(/--ghost:/g) ?? [];
  assert.ok(matches.length >= 3, "expected --ghost: to appear at least 3 times in boxscore.css");
});

test("ghost-num.tsx exists and exports GhostNum and Stamp", () => {
  const ghostNum = readFileSync(join(root, "src/components/ghost-num.tsx"), "utf8");
  assert.match(ghostNum, /export function GhostNum/);
  assert.match(ghostNum, /export function Stamp/);
});

test("flourishes are mounted in representative components", () => {
  const playerProfile = readFileSync(join(root, "src/components/player-profile.tsx"), "utf8");
  assert.match(playerProfile, /GhostNum/);

  const recap = readFileSync(join(root, "src/routes/league/$leagueId/recap.tsx"), "utf8");
  assert.match(recap, /Stamp/);

  const lineupBoard = readFileSync(join(root, "src/components/lineup-board.tsx"), "utf8");
  assert.match(lineupBoard, /slot-rail/);
});

test("ledger default tokens are the x.ai/bot cut", () => {
  const tokens = readFileSync(join(root, "src/skin/tokens.css"), "utf8");
  assert.match(tokens, /--paper:\s*#fafaf8/);
  assert.match(tokens, /--paper-raised:\s*#ffffff/);
  assert.match(tokens, /--font-stack-sans:\s*"Geist"/);
  assert.match(tokens, /--font-stack-mono:\s*"Geist Mono"/);
  assert.match(tokens, /--r-xl:\s*24px/);
  assert.ok(
    (tokens.match(/--card-ring:/g) ?? []).length >= 3,
    "expected --card-ring: at least 3 times in tokens.css",
  );
  assert.ok(
    (tokens.match(/--push-edge:/g) ?? []).length >= 3,
    "expected --push-edge: at least 3 times in tokens.css",
  );

  const styles = readFileSync(join(root, "src/styles.css"), "utf8");
  assert.match(styles, /\.microlabel\s*\{[^}]*font-family:\s*var\(--font-sans\)/s);
  assert.match(styles, /h1,\s*h2,\s*h3\s*\{[^}]*font-weight:\s*500/s);
});

test("no component carries the retired push / shadow-thumb / heavy-weight recipes", () => {
  const tsxFiles = findTsxFiles(join(root, "src"));
  assert.ok(tsxFiles.length > 0, "expected to find .tsx files under src");

  const pushLeaks = [];
  const shadowThumbLeaks = [];
  const extraboldLeaks = [];
  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf8");
    if (/className="push|"push /.test(content)) {
      pushLeaks.push(file);
    }
    if (/0_1px_2px_rgb\(0_0_0\/0\.12\)/.test(content)) {
      shadowThumbLeaks.push(file);
    }
    if (/font-extrabold/.test(content)) {
      extraboldLeaks.push(file);
    }
  }

  assert.deepEqual(pushLeaks, [], "no .tsx file should carry the retired push recipe");
  assert.deepEqual(
    shadowThumbLeaks,
    [],
    "no .tsx file should carry the retired segmented-thumb drop shadow",
  );
  assert.deepEqual(extraboldLeaks, [], "no .tsx file should use font-extrabold");

  const button = readFileSync(join(root, "src/components/ui/button.tsx"), "utf8");
  assert.match(button, /primary:\s*"bg-fg text-bg/);

  const badge = readFileSync(join(root, "src/components/ui/badge.tsx"), "utf8");
  assert.doesNotMatch(badge, /font-mono/);
});

test("thumb bar uses one icon stroke and the masthead uses sans eyebrows", () => {
  const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.doesNotMatch(shell, /strokeWidth=\{1\.75\}/);

  const teamMasthead = readFileSync(join(root, "src/components/team-masthead.tsx"), "utf8");
  assert.doesNotMatch(teamMasthead, /microlabel-data/);
});

test("__root.tsx loads Geist and stamps the Ledger theme-color", () => {
  const rootTsx = readFileSync(join(root, "src/routes/__root.tsx"), "utf8");
  assert.match(rootTsx, /family=Geist/);
  assert.match(rootTsx, /#fafaf8/);
  assert.match(rootTsx, /#0d0d0d/);
  assert.doesNotMatch(rootTsx, /Jakarta|JetBrains/);
});

test("the game page rail is a pinned tablist over snap panes", () => {
  const gamePage = readFileSync(join(root, "src/routes/scores_.$gameId.tsx"), "utf8");
  assert.match(gamePage, /role="tablist"/);
  assert.match(gamePage, /touch-pan-y/);
  assert.match(gamePage, /sticky top-\[calc\(3\.75rem/);
  assert.doesNotMatch(gamePage, /bg-accent text-accent-fg/);
});

test("player sheets ride vaul, full-height, single state", () => {
  for (const file of ["src/components/player-sheet.tsx", "src/components/player-watch.tsx"]) {
    const content = readFileSync(join(root, file), "utf8");
    assert.match(content, /from "vaul"/, `${file} should import from vaul`);
    assert.doesNotMatch(content, /snapPoints/, `${file} should not use detents — one full state`);
    assert.match(content, /max-width: 639px/, `${file} should gate on the phone breakpoint`);
  }
});

test("the box score speaks in counts, not clocks", () => {
  const route = readFileSync(
    join(root, "src/routes/league/$leagueId/matchup/$week/$matchupId.tsx"),
    "utf8",
  );
  // The truncating bench grid and the old transform-driven card carousel are
  // both gone — bench is full rows, and the game pills commit on release.
  assert.doesNotMatch(route, /BenchGrid|snap-center|slateDrag/);
  // A single Preview/quarter/Final chip can't speak for a whole slate of NFL
  // games, so the header counts them instead.
  assert.doesNotMatch(route, /status\.label/);
  assert.match(route, /v .*(live|to play)/);
  // Rows opt out of the repeated red game clock; the roster/lineup rows this
  // prop defaults on for are untouched.
  assert.match(route, /clock=\{false\}/);

  const playerCell = readFileSync(join(root, "src/components/player-cell.tsx"), "utf8");
  assert.match(playerCell, /clock\s*=\s*true/, "clock should default on for every other caller");

  // Desktop V1: a pinned 400px rail (pill strip · score · line) beside a
  // flowing table column, sticky under the header at lg+.
  assert.match(route, /lg:grid-cols-\[400px_minmax/);
  assert.match(route, /lg:sticky/);
});

test("the board compares; only the box score mounts the line", () => {
  const board = readFileSync(join(root, "src/routes/league/$leagueId/matchups.tsx"), "utf8");
  // The liveline chart card is the box score's — the board only scans.
  assert.doesNotMatch(board, /MatchupEdge/);

  const matchupBoard = readFileSync(join(root, "src/components/matchup-board.tsx"), "utf8");
  // Board rows are one line — no stat line and no live clock in the meta.
  assert.doesNotMatch(matchupBoard, /line=\{statLine\}/);
  assert.match(matchupBoard, /clock=\{false\}/);
});

test("the wire's context lives in the deck on phones", () => {
  const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.match(shell, /id="deck-slot"/);

  const deck = readFileSync(join(root, "src/components/deck.tsx"), "utf8");
  assert.match(deck, /createPortal/);

  const wire = readFileSync(join(root, "src/routes/league/$leagueId/wire.tsx"), "utf8");
  assert.match(wire, /<Deck>/);
  assert.match(wire, /hidden gap-3 sm:flex/);
});
