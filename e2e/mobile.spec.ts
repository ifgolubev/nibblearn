import { test, expect } from "@playwright/test";
import {
  MODULE_TYPES,
  demoSection,
  expectNoClippedText,
  expectNoHorizontalOverflow,
  screenshotTo,
} from "./helpers";

test.describe("Mobile layouts", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile project only");

  for (const path of [
    "/",
    "/modules",
    "/playground",
    "/playground/lesson",
    "/examples",
    "/examples/welcome-to-the-agency",
    "/docs",
  ]) {
    test(`no horizontal overflow on ${path}`, async ({ page }, testInfo) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page);
      await expectNoClippedText(page);
      await screenshotTo(page, testInfo, `page${path.replace(/\//g, "_") || "_home"}`);
    });
  }

  for (const type of MODULE_TYPES) {
    test(`module ${type} fits the viewport`, async ({ page }, testInfo) => {
      await page.goto(`/modules/${type}`);
      const demo = demoSection(page, type);
      await expect(demo).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page);
      await expectNoClippedText(page);
      const box = await demo.boundingBox();
      const vw = page.viewportSize()!.width;
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
      await screenshotTo(page, testInfo, `module_${type}`);
    });
  }

  test("320px wide screens still fit", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 320, height: 720 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    for (const type of MODULE_TYPES) {
      await page.goto(`/modules/${type}`);
      await expect(demoSection(page, type)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoClippedText(page);
    }
    await ctx.close();
  });
});
