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
const before = await page.locator("body").innerText();
console.log("BEFORE has Watch?", before.includes("Watch it tick"));
console.log("Allen line before:\n", before.match(/Josh Allen[\s\S]{0,160}/)?.[0]);
await page.getByRole("button", { name: "Watch it tick" }).click();
await page.waitForTimeout(1500);
const kick = await page.locator("body").innerText();
console.log("KICKOFF snippet:\n", kick.match(/Josh Allen[\s\S]{0,160}/)?.[0]);
console.log("score at ko", kick.match(/(\d+\.\d+)–(\d+\.\d+)/)?.[0]);
await page.screenshot({ path: "/workspace/screenshots/replay-kickoff.png" });
await page.waitForTimeout(8500);
const mid = await page.locator("body").innerText();
console.log("MID snippet:\n", mid.match(/Josh Allen[\s\S]{0,180}/)?.[0]);
console.log("phase", mid.match(/Q\d[^·\n]+/)?.[0], mid.match(/\d+\/9/)?.[0]);
await page.screenshot({ path: "/workspace/screenshots/replay-mid.png" });

await page.goto("http://127.0.0.1:8080/scores", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2000);
const scores = await page.locator("body").innerText();
console.log("SCORES header:\n", scores.split("\n").slice(8, 20).join("\n"));

await browser.close();
console.log("ERRORS", errors.length ? errors : "none");
if (errors.length) process.exit(2);
