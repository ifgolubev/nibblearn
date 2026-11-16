import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("Editor page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByRole("heading", { name: "Blocks" })).toBeVisible();
  });

  test("edits a block and the preview follows", async ({ page }) => {
    const form = page.getByRole("region", { name: "Settings" });
    const preview = page.getByRole("region", { name: "Preview" });
    const title = form.getByRole("textbox", { name: /^Title/ }).first();
    await title.fill("Welcome aboard");
    await expect(preview.getByRole("heading", { name: "Welcome aboard" })).toBeVisible();

    // Focusing a field of the third card shows the third card in the preview.
    const items = form.locator(".nbe-item");
    const third = items.nth(2);
    const toggle = third.locator("[data-action='toggle']");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await third.getByRole("textbox").first().focus();
    await expect(preview.getByText(/Card 3 of/)).toBeVisible();
  });

  test("adds a block from the picker", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Blocks" });
    const before = await nav.getByRole("listitem").count();
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("searchbox", { name: "Search blocks" }).fill("flash");
    await page.getByRole("button", { name: /^Flashcards/ }).click();
    await expect(nav.getByRole("listitem")).toHaveCount(before + 1);
    await expect(
      page.getByRole("region", { name: "Preview" }).locator("[data-nb-module='flashcards']"),
    ).toBeVisible();
  });

  test("has no WCAG violations", async ({ page }) => {
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });

  test("fits a 320px screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await expectNoHorizontalOverflow(page);
  });
});
