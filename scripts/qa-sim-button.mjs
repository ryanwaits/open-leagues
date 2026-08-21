import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);
const home = await page.locator("body").innerText();
const wiffl = home.match(/\/league\/(lg_[a-z0-9]+)/i)?.[1];
console.log("home league", wiffl);

const target = wiffl
  ? `http://127.0.0.1:8080/league/${wiffl}/matchups?week=1`
  : "http://127.0.0.1:8080/league/lg_backyard/matchups?week=1";
await page.goto(target, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2500);
const text = await page.locator("body").innerText();
console.log("has Simulate?", text.includes("Simulate this week"));
console.log("has Watch?", text.includes("Watch it tick"));
console.log("kicker", text.match(/Simulate this week|Replay lab|Watch it tick/)?.[0]);
if (await page.getByRole("button", { name: /Simulate this week|Watch it tick/ }).count()) {
  await page.getByRole("button", { name: /Simulate this week|Watch it tick/ }).click();
  await page.waitForTimeout(6500);
  const mid = await page.locator("body").innerText();
  console.log("after tick phase", mid.match(/Q\d[^·\n]+/)?.[0]);
  console.log(
    "sample line",
    mid.match(/\d+\/\d+, \d+ yds/)?.[0] ?? mid.match(/\d+ rec, \d+ yds/)?.[0],
  );
  await page.screenshot({ path: "/workspace/screenshots/sim-week1.png" });
}

await browser.close();
console.log("ERRORS", errors.length ? errors : "none");
if (errors.length) process.exit(2);
