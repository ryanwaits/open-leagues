import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { bumpDays, eligibleFrom } from "./a2hs.ts";

const root = join(import.meta.dirname, "../..");

test("bumpDays: first visit is day 1", () => {
  const { days } = bumpDays(null, "2026-08-20");
  assert.equal(days, 1);
});

test("bumpDays: same day again stays at 1", () => {
  const first = bumpDays(null, "2026-08-20");
  const again = bumpDays(first.raw, "2026-08-20");
  assert.equal(again.days, 1);
});

test("bumpDays: a new day increments", () => {
  const first = bumpDays(null, "2026-08-20");
  const next = bumpDays(first.raw, "2026-08-21");
  assert.equal(next.days, 2);
});

test("bumpDays: malformed raw JSON resets to 1 without throwing", () => {
  assert.doesNotThrow(() => bumpDays("{not json", "2026-08-20"));
  const { days } = bumpDays("{not json", "2026-08-20");
  assert.equal(days, 1);
});

test("eligibleFrom: standalone is never eligible", () => {
  assert.equal(eligibleFrom({ standalone: true, dismissed: false, joined: true, days: 5 }), false);
});

test("eligibleFrom: dismissed is never eligible", () => {
  assert.equal(eligibleFrom({ standalone: false, dismissed: true, joined: true, days: 5 }), false);
});

test("eligibleFrom: joined on day 1 is eligible", () => {
  assert.equal(eligibleFrom({ standalone: false, dismissed: false, joined: true, days: 1 }), true);
});

test("eligibleFrom: not joined but 2+ days is eligible", () => {
  assert.equal(eligibleFrom({ standalone: false, dismissed: false, joined: false, days: 2 }), true);
});

test("eligibleFrom: not joined and only 1 day is not eligible", () => {
  assert.equal(
    eligibleFrom({ standalone: false, dismissed: false, joined: false, days: 1 }),
    false,
  );
});

test("shell.tsx mounts InstallDrawer", () => {
  const src = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.match(src, /InstallDrawer/);
});

test("join.tsx sets A2HS_JOIN_KEY on join success", () => {
  const src = readFileSync(join(root, "src/routes/join.tsx"), "utf8");
  assert.match(src, /A2HS_JOIN_KEY/);
});

test("install-coach.tsx no longer exists", () => {
  assert.equal(existsSync(join(root, "src/components/install-coach.tsx")), false);
});
