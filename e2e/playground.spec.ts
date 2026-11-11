import { test, expect, type Page } from "@playwright/test";

const editor = (page: Page) => page.getByRole("textbox", { name: "Module configuration JSON" });
const status = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /Valid|Invalid JSON|issue/ })
    .first();

test.describe("JSON playground", () => {
  test("validates, reports issues with paths, previews and resets", async ({ page }) => {
    await page.goto("/playground?module=choice-challenge");
    await expect(status(page)).toHaveText("Valid");
    await expect(page.locator('section[data-nb-module="choice-challenge"]')).toBeVisible();
    const original = await editor(page).inputValue();

    // 1. Broken JSON syntax.
    await editor(page).fill('{ "id": "x", ');
    await expect(status(page)).toHaveText("Invalid JSON");
    await expect(page.getByText("JSON syntax error:")).toBeVisible();
    // The last valid preview stays on screen while editing.
    await expect(page.locator('section[data-nb-module="choice-challenge"]')).toBeVisible();
    await expect(
      page.getByText("Showing the last valid configuration while you edit."),
    ).toBeVisible();

    // 2. Valid JSON with a schema problem: a question without a correct option.
    const bad = JSON.parse(original);
    bad.content.questions[0].options = bad.content.questions[0].options.map(
      (o: Record<string, unknown>) => ({
        ...o,
        correct: false,
      }),
    );
    await editor(page).fill(JSON.stringify(bad, null, 2));
    await expect(status(page)).toHaveText(/1 issue/);
    await expect(page.getByText("content.questions[0].options", { exact: true })).toBeVisible();
    await expect(page.getByText(/at least one correct option/)).toBeVisible();

    // 3. Fix it with a visible change and see the preview update.
    const fixed = JSON.parse(original);
    fixed.title = "Edited in the playground";
    await editor(page).fill(JSON.stringify(fixed, null, 2));
    await expect(status(page)).toHaveText("Valid");
    await expect(page.getByRole("heading", { name: "Edited in the playground" })).toBeVisible();

    // 4. Reset restores the original example.
    await page.getByRole("button", { name: "Reset", exact: true }).first().click();
    await expect(editor(page)).toHaveValue(original);
    await expect(page.getByRole("heading", { name: "Pick the right KPI" })).toBeVisible();
  });

  test("unknown module type is reported", async ({ page }) => {
    await page.goto("/playground?module=true-false");
    const json = JSON.parse(await editor(page).inputValue());
    json.type = "nope";
    await editor(page).fill(JSON.stringify(json));
    await expect(status(page)).toHaveText(/1 issue/);
    await expect(page.getByText(/unknown module type "nope"/)).toBeVisible();
  });

  test("switching module tabs changes the preview", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("tab", { name: "Flashcards" }).click();
    await expect(page.locator('section[data-nb-module="flashcards"]')).toBeVisible();
    await expect(page).toHaveURL(/module=flashcards/);
    await page.getByRole("tab", { name: "What-If Simulator" }).click();
    await expect(page.locator('section[data-nb-module="what-if-simulator"]')).toBeVisible();
  });

  test("download and import", async ({ page }) => {
    await page.goto("/playground?module=true-false");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("true-false.json");

    const imported = {
      id: "imported",
      type: "true-false",
      title: "Imported deck",
      content: { statements: [{ text: "Imported?", isTrue: true }] },
    };
    await page.getByLabel("Import JSON file").setInputFiles({
      name: "imported.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await expect(page.getByRole("heading", { name: "Imported deck" })).toBeVisible();
  });

  test("lesson playground renders a lesson player", async ({ page }) => {
    await page.goto("/playground/lesson");
    await expect(page.getByRole("heading", { name: "My first lesson" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible();
    await page.getByRole("button", { name: "Start lesson" }).click();
    await expect(page.locator(".nb-player__counter")).toHaveText("Activity 1 of 4");
  });
});
