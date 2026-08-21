import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:8080/league/lg_backyard/matchup/14/1", {
  waitUntil: "networkidle",
  timeout: 45000,
});
await page.waitForTimeout(2500);
const allen = page.getByRole("button", { name: /Josh Allen/ }).first();
console.log(
  "allen buttons",
  await page.getByRole("button", { name: /Josh Allen|Dak Prescott/ }).count(),
);
await allen.click();
await page.waitForTimeout(3000);
const drawer = await page
  .locator("[data-vaul-drawer], [vaul-drawer], .fixed.z-50")
  .last()
  .innerText()
  .catch(() => "");
const body = await page.locator("body").innerText();
console.log("has His plays?", body.includes("His plays"));
console.log("has Live/Final/Scheduled?", /Live|Final|Scheduled|Kickoff/.test(body));
console.log("drawer snippet:\n", (drawer || body).slice(0, 600));
await page.screenshot({ path: "/workspace/screenshots/player-watch.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://127.0.0.1:8080/league/lg_backyard/matchup/14/1", {
  waitUntil: "networkidle",
  timeout: 45000,
});
await mobile.waitForTimeout(2000);
await mobile
  .getByRole("button", { name: /Josh Allen/ })
  .first()
  .click();
await mobile.waitForTimeout(2500);
await mobile.screenshot({ path: "/workspace/screenshots/player-watch-mobile.png" });
const mob = await mobile.locator("body").innerText();
console.log("mobile his plays", mob.includes("His plays"));
console.log(
  "mobile overflow",
  await mobile.evaluate(() => document.documentElement.scrollWidth > 400),
);

await browser.close();
console.log("ERRORS", errors.filter((e) => !/favicon|404/.test(e)).slice(0, 8));
if (errors.some((e) => /Cannot|undefined|is not/.test(e))) process.exit(2);
