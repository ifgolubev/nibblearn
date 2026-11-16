import { test, expect } from "@playwright/test";
import { demoSection, expectNoHorizontalOverflow } from "./helpers";

test("accordion: open every panel with the keyboard", async ({ page }) => {
  await page.goto("/modules/accordion");
  const demo = demoSection(page, "accordion");
  const triggers = demo.locator(".nb-acc__trigger");
  await expect(triggers.first()).toBeVisible();
  const count = await triggers.count();
  for (let i = 0; i < count; i++) {
    await triggers.nth(i).focus();
    await page.keyboard.press("Enter");
    await expect(triggers.nth(i)).toHaveAttribute("aria-expanded", "true");
  }
  await expect(demo.getByText(`${count} of ${count} opened`)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("tabs: arrow keys move between tabs", async ({ page }) => {
  await page.goto("/modules/tabs");
  const demo = demoSection(page, "tabs");
  const tabs = demo.getByRole("tab");
  await tabs.first().click();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(demo.getByRole("tabpanel")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("carousel: buttons and dots move through the slides", async ({ page }) => {
  await page.goto("/modules/carousel");
  const demo = demoSection(page, "carousel");
  await expect(demo.getByRole("button", { name: "Previous slide" })).toBeDisabled();
  await demo.getByRole("button", { name: "Next slide" }).click();
  await expect(demo.getByRole("group", { name: "2 of 4" })).toBeVisible();
  await demo.getByRole("button", { name: "Go to slide 4" }).click();
  await expect(demo.getByRole("button", { name: "Next slide" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test("carousel: keyboard focus stays on Next at the last slide", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow");
  await page.goto("/modules/carousel");
  const demo = demoSection(page, "carousel");
  const next = demo.getByRole("button", { name: "Next slide" });
  await next.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Enter");
  await expect(demo.getByRole("group", { name: "4 of 4" })).toBeVisible();
  await expect(next).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(demo.getByRole("group", { name: "3 of 4" })).toBeVisible();
});

test("callout and columns render", async ({ page }) => {
  await page.goto("/modules/callout");
  await expect(demoSection(page, "callout").getByRole("note")).toBeVisible();
  await page.goto("/modules/columns");
  await expect(demoSection(page, "columns").locator(".nb-columns__col")).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
});
