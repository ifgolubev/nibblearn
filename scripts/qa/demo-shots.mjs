// Screenshots of each module demo frame. Usage: THEME=dark VW=1280 node scripts/qa/demo-shots.mjs <outDir>
import { chromium } from "@playwright/test";
const out = process.argv[2];
const theme = process.env.THEME ?? "light";
const vw = Number(process.env.VW ?? 1280);
const types = (
  process.env.TYPES ??
  "story-cards,flashcards,choice-challenge,true-false,match-pairs,sequence-builder,category-sort,fill-blanks,hotspot-explorer,screenshot-walkthrough,branching-scenario,conversation,process-explorer,spot-the-mistake,what-if-simulator,budget-allocator,estimate"
).split(",");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, colorScheme: theme });
await ctx.addInitScript((t) => localStorage.setItem("nibblearn-showcase-theme", t), theme);
const page = await ctx.newPage();
for (const t of types) {
  await page.goto(`http://localhost:4173/modules/${t}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page
    .locator(".demo-frame")
    .first()
    .screenshot({ path: `${out}/${theme}-${vw}-${t}.png` });
}
await browser.close();
