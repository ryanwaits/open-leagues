import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const errors = [];
async function run(name, viewport, fn) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(`${name} page: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${name} console: ${msg.text()}`);
  });
  try {
    await fn(page);
  } finally {
    await page.close();
  }
}

await run("scores-desk", { width: 1280, height: 900 }, async (page) => {
  await page.goto("http://127.0.0.1:8080/scores?kind=regular&season=2025&week=18", {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/workspace/screenshots/scores-slate.png", fullPage: true });
  const card = page.locator("a[href*='/scores/']").first();
  const href = await card.getAttribute("href");
  console.log("first game href", href);
  await card.click();
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  console.log("game page snippet:\n", body.slice(0, 700));
  await page.screenshot({ path: "/workspace/screenshots/game-plays.png", fullPage: false });
  const boxBtn = page.getByRole("button", { name: "Box" });
  if (await boxBtn.count()) {
    await boxBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/workspace/screenshots/game-box.png", fullPage: false });
    console.log("box snippet:\n", (await page.locator("body").innerText()).slice(0, 500));
  }
});

await run("scores-mobile", { width: 390, height: 844 }, async (page) => {
  await page.goto("http://127.0.0.1:8080/scores/401772969", {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(2000);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  console.log("mobile overflow", overflow);
  await page.screenshot({ path: "/workspace/screenshots/game-mobile.png", fullPage: false });
});

await run("matchup", { width: 1280, height: 900 }, async (page) => {
  await page.goto("http://127.0.0.1:8080/league/lg_backyard", {
    waitUntil: "networkidle",
    timeout: 45000,
  });
  await page.waitForTimeout(2000);
  const card = page.locator("a[href*='/matchup/']").first();
  if (await card.count()) {
    const href = await card.getAttribute("href");
    console.log("matchup href", href);
    await card.click();
    await page.waitForTimeout(2500);
    console.log("matchup snippet:\n", (await page.locator("body").innerText()).slice(0, 600));
    await page.screenshot({ path: "/workspace/screenshots/matchup-page.png", fullPage: false });
  } else {
    console.log("no matchup cards on backyard");
    await page.screenshot({
      path: "/workspace/screenshots/standings-nomatch.png",
      fullPage: false,
    });
  }
});

await browser.close();
console.log("ERRORS", errors.length ? errors : "none");
if (errors.length) process.exit(2);
