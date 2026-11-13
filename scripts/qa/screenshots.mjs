import { chromium } from "@playwright/test";
const base = "http://localhost:4173";
const out = process.argv[2];
const modules = [
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
const pages = [
  "/",
  "/modules",
  "/playground",
  "/examples",
  "/examples/welcome-to-the-agency",
  "/docs",
  ...modules.map((m) => `/modules/${m}`),
];
const browser = await chromium.launch();
const errors = [];
for (const [name, width] of [
  ["desktop", 1440],
  ["mobile", 375],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name} console: ${m.text().slice(0, 200)}`);
  });
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (overflow) errors.push(`${name} horizontal overflow at ${p}`);
    const file = `${out}/${name}${p.replace(/\//g, "_") || "_home"}.png`;
    await page.screenshot({ path: file, fullPage: p === "/" || p === "/modules" ? false : true });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no errors");
