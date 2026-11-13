import { test, expect } from "@playwright/test";
import { shown } from "./helpers";
import { MODULE_TYPES, demoSection } from "./helpers";

const N = MODULE_TYPES.length;

test.describe("Module gallery", () => {
  test("shows a card for every module", async ({ page }) => {
    await page.goto("/modules");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `${N} interactive learning modules`,
    );
    await expect(shown(page, `${N} of ${N} modules`)).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(N);
  });

  test("category filter reduces the count and updates the URL", async ({ page }) => {
    await page.goto("/modules");
    const tabs = page.getByRole("tablist", { name: "Categories" });
    await tabs.getByRole("tab", { name: "Practice" }).click();
    await expect(page).toHaveURL(/[?&]category=practice/);
    await expect(tabs.getByRole("tab", { name: "Practice" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const count = await page.getByRole("article").count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(N);
    await expect(shown(page, `${count} of ${N} modules`)).toBeVisible();

    // Every visible card is tagged "practice".
    const badges = page.getByRole("article").locator("span.capitalize");
    for (const text of await badges.allTextContents()) expect(text.trim()).toBe("practice");

    // Back to all.
    await tabs.getByRole("tab", { name: "All" }).click();
    await expect(page).not.toHaveURL(/category=/);
    await expect(page.getByRole("article")).toHaveCount(N);
  });

  test("category filter in the URL is applied on load", async ({ page }) => {
    await page.goto("/modules?category=simulate");
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByRole("article").getByRole("heading")).toHaveText([
      "What-If Simulator",
      "Budget Allocator",
    ]);
  });

  test("search narrows the list to Flashcards", async ({ page }) => {
    await page.goto("/modules");
    const search = page.getByRole("searchbox", { name: "Search modules" });
    await search.fill("flash");
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article").getByRole("heading")).toHaveText("Flashcards");
    await expect(shown(page, `1 of ${N} modules`)).toBeVisible();

    await search.fill("zzzz-no-such-module");
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(shown(page, /No modules match/)).toBeVisible();
  });

  test("Try it opens a dialog with a live module and Close dismisses it", async ({ page }) => {
    await page.goto("/modules");
    const flashcards = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Flashcards" }),
    });
    await flashcards.getByRole("button", { name: "Try it" }).click();

    const dialog = page.getByRole("dialog", { name: "Flashcards preview" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Flashcards" })).toBeVisible();
    const demo = dialog.locator('section[data-nb-module="flashcards"]');
    await expect(demo).toBeVisible();
    // The module is live: flipping a card works inside the dialog.
    const card = demo.getByRole("button", { name: "Flip card" });
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");

    await dialog.getByRole("button", { name: "Close preview" }).click();
    await expect(dialog).toBeHidden();
  });

  test("card links open the module page", async ({ page }) => {
    await page.goto("/modules");
    await page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Match the Pairs" }) })
      .getByRole("link", { name: "Match the Pairs" })
      .click();
    await expect(page).toHaveURL(/\/modules\/match-pairs$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Match the Pairs");
    await expect(demoSection(page, "match-pairs")).toBeVisible();
  });
});
