import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

function src(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("home does not reuse a signed-out my-leagues cache after login", () => {
  const home = src("src/routes/index.tsx");
  assert.match(home, /queryKey:\s*\[\s*"my-leagues".*user\?\.id/);
  assert.match(home, /enabled:\s*!sessionPending && Boolean\(user\)/);
  assert.match(home, /placeholderData:\s*undefined/);
  assert.match(home, /waiting \?/);

  const login = src("src/routes/login.tsx");
  assert.match(login, /removeQueries\(\{\s*queryKey:\s*\[\s*"my-leagues"\s*\]/);
  assert.match(login, /authClient\.getSession\(\)/);
});

test("lineup writes invalidate matchups even if the observer unmounts", () => {
  const helper = src("src/lib/league/lineup-cache.ts");
  assert.match(helper, /export function invalidateAfterLineup/);
  assert.match(helper, /queryKey:\s*\[\s*"matchups"/);
  assert.match(helper, /refetchType:\s*"all"/);

  for (const rel of [
    "src/routes/league/$leagueId/index.tsx",
    "src/routes/league/$leagueId/roster.tsx",
    "src/routes/league/$leagueId/team/$rosterId.tsx",
  ]) {
    const file = src(rel);
    assert.match(
      file,
      /invalidateAfterLineup\(qc, leagueId\)/,
      `${rel} must invalidate matchups after a lineup write`,
    );
    assert.match(
      file,
      /await startPlayer/,
      `${rel} must invalidate inside mutationFn, not only onSuccess`,
    );
  }
});

test("loaders warm cache instead of blocking on stale ensureQueryData", () => {
  const client = src("src/lib/query-client.ts");
  assert.match(client, /export function warmQuery/);
  assert.match(client, /localStorage\.getItem\(PERSIST_STORAGE_KEY\)/);
  assert.match(client, /hydrate\(client/);
  assert.match(client, /shouldStaleOnRestore/);
  assert.match(client, /refetchType:\s*"none"/);

  const league = src("src/routes/league/$leagueId.tsx");
  assert.match(league, /warmQuery\(/);
  assert.doesNotMatch(league, /ensureQueryData\(/);

  const scores = src("src/routes/scores.tsx");
  assert.match(scores, /warmQuery\(/);
  assert.doesNotMatch(scores, /ensureQueryData\(/);
});

test("league header and new sheets keep last-known instead of isLoading unmount", () => {
  const league = src("src/routes/league/$leagueId.tsx");
  assert.doesNotMatch(league, /\{q\.isLoading \?/);
  assert.match(league, /q\.data == null && q\.isPending/);

  for (const rel of [
    "src/routes/league/$leagueId/draft.tsx",
    "src/routes/league/$leagueId/settings.tsx",
    "src/routes/league/$leagueId/player/$playerId.tsx",
    "src/routes/scores_.$gameId.tsx",
    "src/components/schedule-desk.tsx",
  ]) {
    const file = src(rel);
    assert.doesNotMatch(file, /if \(q\.isLoading\)/, `${rel} still gates on q.isLoading`);
    assert.doesNotMatch(file, /if \(league\.isLoading\)/, `${rel} still gates on league.isLoading`);
  }

  const mock = src("src/routes/league/$leagueId/mock.tsx");
  assert.match(mock, /league\.data == null && league\.isPending/);
  assert.ok(
    mock.indexOf("league.data == null && league.isPending") < mock.indexOf("!league.data?.hosted"),
    "mock must not treat a pending bundle as a Sleeper peek",
  );
});

test("wire keeps previous rows and warms the list on intent", () => {
  const wire = src("src/routes/league/$leagueId/wire.tsx");
  assert.doesNotMatch(wire, /placeholderData:\s*undefined/);
  assert.match(wire, /warmQuery\(/);
  assert.match(wire, /prefetchPlayerProfile/);
});

test("player profiles prefetch on intent and paint identity from cache", () => {
  const view = src("src/lib/data/player-view.ts");
  assert.match(view, /export function prefetchPlayerProfile/);
  assert.match(view, /export function findCachedSlimPlayer/);
  assert.match(view, /export function useWarmRosterProfiles/);

  const page = src("src/routes/league/$leagueId/player/$playerId.tsx");
  assert.match(page, /prefetchQuery\(profileQueryOptions/);
  assert.match(page, /findCachedWirePlayer/);
  assert.match(page, /hint=/);
  assert.doesNotMatch(page, /if \(q\.isLoading\)/);

  const profileServer = src("src/lib/data/player-profile.server.ts");
  assert.match(profileServer, /weekly-ppr-2025\.json/);

  const lineup = src("src/components/lineup-board.tsx");
  assert.match(lineup, /onIntentPlayer/);
  assert.match(lineup, /onPointerEnter/);

  const sheet = src("src/components/player-sheet.tsx");
  assert.match(sheet, /ProfileStats/);
  assert.match(sheet, /hint=/);
  assert.doesNotMatch(sheet, /q\.data == null && q\.isPending/);

  const board = src("src/components/matchup-board.tsx");
  assert.match(board, /profileIntent/);
});

test("activity and team do not wait on the full bundle", () => {
  const activity = src("src/routes/league/$leagueId/activity.tsx");
  assert.doesNotMatch(activity, /enabled:\s*Boolean\(league\.data\)/);

  const team = src("src/routes/league/$leagueId/team/$rosterId.tsx");
  assert.doesNotMatch(team, /enabled:\s*Boolean\(league\.data\)/);
});

test("parked recap route redirects onto standings", () => {
  const recap = src("src/routes/league/$leagueId/recap.tsx");
  assert.match(recap, /redirect/);
  assert.match(recap, /\/league\/\$leagueId\/standings/);
});
