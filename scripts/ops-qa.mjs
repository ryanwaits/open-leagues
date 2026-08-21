#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (err) => errors.push(String(err.message)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const email = `opsqa_${Date.now()}@ledger.test`;
const password = "ledger-ops-qa-26";

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: "Need an account?" }).click();
  await page.getByPlaceholder("Display name").fill("QA Commish");
  await page.getByPlaceholder("you@league.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });

  await page.goto(`${base}/new`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByPlaceholder("The Backyard").fill("Ops Desk");
  await page.getByPlaceholder("Night Desk").fill("Night Desk");
  await page.getByRole("button", { name: "Open the league" }).click();
  await page.waitForURL(/\/league\/lg_/, { timeout: 20000 });
  const leagueId = page.url().match(/league\/(lg_[a-z0-9]+)/)?.[1];
  if (!leagueId) throw new Error(`No league id in ${page.url()}`);

  await page.goto(`${base}/league/${leagueId}/trades`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const tradeText = await page.locator("body").innerText();
  if (!/unused picks|Draft hasn't happened/i.test(tradeText)) {
    throw new Error("Trades page missing pre-draft pick copy");
  }
  const pickBtns = page.getByRole("button", { name: /^Pick R/ });
  const pickCount = await pickBtns.count();
  if (pickCount < 4) throw new Error(`Expected unused picks, found ${pickCount}`);
  await pickBtns.nth(0).click();
  await pickBtns.nth(1).click();
  await pickBtns.nth(Math.floor(pickCount / 2)).click();
  await page.getByRole("button", { name: "Propose trade" }).click();
  await page.waitForTimeout(1000);
  const houseBtn = page.getByRole("button", { name: "Accept for house" });
  if (await houseBtn.count()) {
    await houseBtn.click();
    await page.waitForTimeout(900);
  }
  const after = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/trades-predraft.png" });
  if (!/processed|proposed|via /i.test(after)) {
    throw new Error("Trade did not appear after propose");
  }

  await page.goto(`${base}/league/${leagueId}/draft`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const draftText = await page.locator("body").innerText();
  if (!/Pick stock|R1/i.test(draftText)) throw new Error("Draft missing pick stock");
  await page.screenshot({ path: "/workspace/screenshots/draft-stock.png" });

  await page.goto(`${base}/league/${leagueId}/wire`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/workspace/screenshots/wire-predraft.png" });

  await page.goto(`${base}/league/${leagueId}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const settings = await page.locator("body").innerText();
  if (!/FAAB/i.test(settings) || !/league clock/i.test(settings)) {
    throw new Error("Settings missing FAAB/clock copy");
  }
  await page.screenshot({ path: "/workspace/screenshots/settings-ops.png" });

  await page.goto(`${base}/league/${leagueId}/matchups`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/workspace/screenshots/matchups-predraft.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/league/${leagueId}/trades`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  await page.screenshot({ path: "/workspace/screenshots/trades-mobile.png" });

  console.log(JSON.stringify({ ok: true, leagueId, pickCount, overflow, errors }, null, 2));
  if (errors.length) process.exit(2);
  if (overflow) process.exit(3);
  process.exit(0);
} catch (err) {
  await page.screenshot({ path: "/workspace/screenshots/ops-qa-fail.png" }).catch(() => {});
  const text = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        url: page.url(),
        errors,
        text: text.slice(0, 800),
      },
      null,
      2,
    ),
  );
  process.exit(1);
} finally {
  await browser.close();
}
