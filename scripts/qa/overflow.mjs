import { chromium } from "@playwright/test";
const base = "http://localhost:4173";
const paths = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(process.env.VW ?? 375), height: 800 },
});
const page = await ctx.newPage();
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const bad = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0)
        out.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join(".")} right=${Math.round(r.right)} w=${Math.round(r.width)}`,
        );
    }
    return { sw: document.documentElement.scrollWidth, items: out.slice(0, 12) };
  });
  console.log(p, bad.sw, bad.items.join("\n  "));
}
await browser.close();
