import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** All built-in module types. */
export const MODULE_TYPES = [
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
  "label-diagram",
  "image-compare",
  "word-builder",
  "priority-matrix",
  "inbox-triage",
] as const;

export type ModuleType = (typeof MODULE_TYPES)[number];

/** The live demo section rendered by ModuleRenderer for a module type. */
export function demoSection(page: Page, type: string): Locator {
  return page.locator(`section[data-nb-module="${type}"]`).first();
}

/** Collects uncaught page errors so a test can assert none happened. */
export function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (err) => errors.push(err));
  return errors;
}

/** The DemoFrame "Reset" button (not a module's own reset buttons). */
export function demoResetButton(page: Page): Locator {
  return page.locator(".demo-frame__toolbar").getByRole("button", { name: "Reset", exact: true });
}

/** Asserts the document does not scroll horizontally. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

export async function screenshotTo(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

/** Completes the "Pick the right KPI" choice-challenge demo with all answers correct. */
export async function completeChoiceChallengeDemo(scope: Locator) {
  // Q1 (single)
  await expect(shown(scope, "Question 1 of 3")).toBeVisible();
  await scope.getByRole("radio", { name: /Cost per acquisition \(CPA\)/ }).click();
  await scope.getByRole("button", { name: "Check" }).click();
  await expect(shown(scope, "Correct", { exact: true }).first()).toBeVisible();
  await scope.getByRole("button", { name: "Next", exact: true }).click();
  // Q2 (multiple)
  await expect(shown(scope, "Question 2 of 3")).toBeVisible();
  await scope.getByRole("checkbox", { name: /CPC/ }).click();
  await scope.getByRole("checkbox", { name: /CPM/ }).click();
  await scope.getByRole("checkbox", { name: /ROAS/ }).click();
  await scope.getByRole("button", { name: "Check" }).click();
  await expect(shown(scope, "Correct", { exact: true }).first()).toBeVisible();
  await scope.getByRole("button", { name: "Next", exact: true }).click();
  // Q3 (single)
  await expect(shown(scope, "Question 3 of 3")).toBeVisible();
  await scope.getByRole("radio", { name: /landing page is not converting/ }).click();
  await scope.getByRole("button", { name: "Check" }).click();
  await expect(shown(scope, "Correct", { exact: true }).first()).toBeVisible();
  await scope.getByRole("button", { name: "Finish", exact: true }).click();
}

/** Flips and masters every card of a flashcards deck until the completion card appears. */
export async function masterAllFlashcards(scope: Locator, count: number) {
  for (let i = 0; i < count; i++) {
    const card = scope.getByRole("button", { name: "Flip card" });
    // The previous card animates out for a moment, so wait until only one card is left.
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    const gotIt = scope.getByRole("button", { name: "Got it" });
    await expect(gotIt).toBeEnabled();
    await gotIt.click();
    // Wait for the next card (or the completion card) before continuing.
    if (i < count - 1) {
      await expect(shown(scope, `${i + 2} of ${count}`, { exact: true })).toBeVisible();
    }
  }
  await expect(shown(scope, "All cards mastered")).toBeVisible({ timeout: 15_000 });
}

/**
 * Asserts that no heading or paragraph extends past the viewport. Catches content that is
 * silently clipped by an `overflow: hidden` ancestor (which the scrollWidth check cannot see).
 */
export async function expectNoClippedText(page: Page) {
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main h1, main h2, main h3, main p")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // Ignore content inside horizontal scrollers (code blocks, tables) and hidden elements.
        if (r.width === 0 || el.closest("pre, table, [role='region'], .nb-sr-only, .sr-only"))
          return false;
        return r.right > vw + 1 || r.left < -1;
      })
      .map((el) => `${el.tagName.toLowerCase()}: ${(el.textContent ?? "").trim().slice(0, 60)}`)
      .slice(0, 5);
  });
  expect(offenders, offenders.join("\n")).toEqual([]);
}

/**
 * `shown(scope, …)` without the module's screen-reader live region.
 * The live region repeats feedback text shortly after it appears on screen, so a plain
 * `getByText` can resolve to two elements depending on timing.
 */
export function shown(
  scope: Locator | Page,
  text: string | RegExp,
  options?: { exact?: boolean },
): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope.getByText(text, options).and(page.locator(":not(.nb-sr-only[aria-live])"));
}
