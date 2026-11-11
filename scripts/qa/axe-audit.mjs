// Usage: node scripts/qa/axe-audit.mjs [paths...]  (needs preview server on :4173)
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const types = [
  "story-cards",
  "flashcards",
  "choice-challenge",
  "true-false",
  "match-pairs",
  "sequence-builder",
  "category-sort",
  "fill-blanks",
  "hotspot-explorer",
  "screenshot-walkthrough",
  "branching-scenario",
  "conversation",
  "process-explorer",
  "spot-the-mistake",
  "what-if-simulator",
  "budget-allocator",
  "estimate",
];
const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/modules", "/playground", "/examples", "/docs", ...types.map((t) => `/modules/${t}`)];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.VW ?? 1280), height: 900 },
});
const page = await ctx.newPage();
const agg = new Map();
for (const p of paths) {
  await page.goto("http://localhost:4173" + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  for (const v of violations)
    for (const n of v.nodes) {
      const key = `${v.id} | ${n.target.join(" ")} | ${(n.failureSummary || "").split("\n").slice(1, 2).join(" ").trim().slice(0, 140)}`;
      if (!agg.has(key)) agg.set(key, new Set());
      agg.get(key).add(p);
    }
}
for (const [k, v] of agg)
  console.log(
    `${k}\n    on: ${[...v].slice(0, 4).join(", ")}${v.size > 4 ? ` (+${v.size - 4})` : ""}`,
  );
await browser.close();
