import { test, expect } from "@playwright/test";
import { MODULE_TYPES } from "./helpers";

test.describe("Navigation", () => {
  test("homepage loads with the hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Tiny interactions\.\s*Real learning\./,
      }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Nibblearn/);
  });

  test("main nav links work", async ({ page, isMobile }) => {
    test.skip(isMobile, "The main nav is hidden behind the menu button on mobile");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });

    await nav.getByRole("link", { name: "Modules" }).click();
    await expect(page).toHaveURL(/\/modules$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `${MODULE_TYPES.length} interactive learning modules`,
    );

    await nav.getByRole("link", { name: "Examples" }).click();
    await expect(page).toHaveURL(/\/examples$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Complete, playable lessons");

    await nav.getByRole("link", { name: "Playground" }).click();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edit JSON, see it live");

    await nav.getByRole("link", { name: "Docs" }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The logo links home.
    await page.getByRole("link", { name: "Nibblearn" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("theme toggle adds and removes the dark class on <html>", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });

  test("unknown routes render the 404 page", async ({ page }) => {
    await page.goto("/this/route/does/not/exist");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("unknown module type renders the 404 page", async ({ page }) => {
    await page.goto("/modules/not-a-module");
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  });

  test("mobile menu opens and navigates", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile-only");
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Toggle menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("navigation", { name: "Mobile" });
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Playground" }).click();
    await expect(page).toHaveURL(/\/playground$/);
    // The menu closes after navigating.
    await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
  });
});
