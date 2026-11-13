// Renders every Storybook story and checks for page errors and axe violations.
// Usage: serve apps/storybook/storybook-static, then: SB=http://localhost:6007 node scripts/qa/storybook-smoke.mjs
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.SB ?? "http://localhost:6007";
const index = await (await fetch(`${base}/index.json`)).json();
const stories = Object.values(index.entries).filter((e) => e.type === "story");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
let failures = 0;
for (const s of stories) {
  const errors = [];
  const onErr = (e) => errors.push(e.message);
  page.on("pageerror", onErr);
  await page.goto(`${base}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const rendered = await page.locator("#storybook-root *").count();
  const { violations } = await new AxeBuilder({ page })
    .include("#storybook-root")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  page.off("pageerror", onErr);
  const bad = errors.length || !rendered || violations.length;
  if (bad) failures++;
  console.log(
    `${bad ? "FAIL" : "ok  "} ${s.id}${errors.length ? ` errors=${errors.join("; ").slice(0, 160)}` : ""}${violations.length ? ` axe=${violations.map((v) => v.id).join(",")}` : ""}`,
  );
}
console.log(`${stories.length} stories, ${failures} failing`);
await browser.close();
process.exit(failures ? 1 : 0);
