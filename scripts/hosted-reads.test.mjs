import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

/** Slice one `export const name = createServerFn…` through the next export. */
function handlerSrc(fileSrc, name) {
  const start = fileSrc.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} not found`);
  const next = fileSrc.indexOf("\nexport const ", start + 1);
  return next < 0 ? fileSrc.slice(start) : fileSrc.slice(start, next);
}

function fnSrc(fileSrc, name) {
  const start = fileSrc.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} not found`);
  const next = fileSrc.indexOf("\nexport async function ", start + 1);
  return next < 0 ? fileSrc.slice(start) : fileSrc.slice(start, next);
}

test("hosted league GETs require assertLeagueReader; previewInvite stays public", () => {
  const dataFns = readFileSync(join(root, "src/lib/data/fns.ts"), "utf8");
  const leagueFns = readFileSync(join(root, "src/lib/league/fns.ts"), "utf8");

  for (const name of [
    "getLeagueBundle",
    "getMatchups",
    "getTeam",
    "getWire",
    "getActivity",
    "getWeekProjections",
    "getRecap",
    "getTicks",
  ]) {
    const src = handlerSrc(dataFns, name);
    assert.match(src, /assertLeagueViewer/, `${name} must gate on a seat`);
  }

  for (const name of [
    "getDesk",
    "getBook",
    "getClaims",
    "getTrades",
    "getTradablePicks",
    "getMockPool",
    "getSchedule",
  ]) {
    const src = handlerSrc(leagueFns, name);
    assert.match(src, /assertLeagueViewer/, `${name} must gate on a seat`);
  }

  const draft = handlerSrc(leagueFns, "getDraft");
  assert.match(draft, /assertLeagueViewer/, "getDraft writes house picks — keep the seat gate");

  const preview = handlerSrc(leagueFns, "previewInvite");
  assert.doesNotMatch(preview, /assertLeagueViewer/, "previewInvite must stay ungated");
});

test("there is no public-league exception left in the engine", () => {
  const eng = readFileSync(join(root, "src/lib/league/engine.server.ts"), "utf8");
  // Every read is a seat read. No demo id, no sandbox id, no source_league_id
  // backdoor — a self-hosted box has no league a stranger may read.
  assert.doesNotMatch(eng, /assertLeagueReader/);
  assert.doesNotMatch(eng, /lg_sandbox/);
  assert.doesNotMatch(eng, /DEMO_HOSTED_ID/);
});
