import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { MODULE_TYPES, demoSection } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 5)
        .join("\n  ")}`,
  );
  expect(violations, summary.join("\n")).toEqual([]);
}

test.describe("Accessibility (axe)", () => {
  for (const path of [
    "/",
    "/modules",
    "/playground",
    "/examples",
    "/examples/welcome-to-the-agency",
    "/docs",
  ]) {
    test(`page ${path} has no WCAG violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page);
    });
  }

  for (const type of MODULE_TYPES) {
    test(`module page ${type} has no WCAG violations`, async ({ page }) => {
      await page.goto(`/modules/${type}`);
      await expect(demoSection(page, type)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoViolations(page);
    });
  }

  test("module demos stay accessible after interaction and in dark mode", async ({ page }) => {
    await page.goto("/modules/choice-challenge");
    const demo = demoSection(page, "choice-challenge");
    await demo.getByRole("radio", { name: /Impressions/ }).click();
    await demo.getByRole("button", { name: "Check" }).click();
    await expect(demo.getByText("Not quite")).toBeVisible();
    await expectNoViolations(page, 'section[data-nb-module="choice-challenge"]');

    await page
      .locator(".demo-frame__toolbar")
      .getByRole("button", { name: /dark mode/ })
      .click();
    await expect(page.locator('[data-demo-theme="dark"]')).toBeVisible();
    await expectNoViolations(page, '[data-demo-theme="dark"]');
  });

  test("lesson player intro and first activity are accessible", async ({ page }) => {
    await page.goto("/examples/marketing-metrics");
    await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
    // Wait for the intro fade-in to finish so contrast is measured on final colours.
    await expect(page.locator(".nb-intro")).toHaveCSS("opacity", "1");
    await expectNoViolations(page, ".nb-player");
    await page.getByRole("button", { name: "Start lesson" }).click();
    await expect(page.locator(".nb-player__counter")).toHaveText("Activity 1 of 6");
    await expect(page.locator(".nb-player__step")).toHaveCSS("opacity", "1");
    await expectNoViolations(page, ".nb-player");
  });
});
