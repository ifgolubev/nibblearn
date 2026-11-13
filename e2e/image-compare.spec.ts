import { test, expect } from "@playwright/test";
import { shown } from "./helpers";
import { collectPageErrors, demoSection, expectNoHorizontalOverflow } from "./helpers";

test("image-compare: explore both versions, answer the question and complete", async ({
  page,
  isMobile,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/modules/image-compare");
  const demo = demoSection(page, "image-compare");
  const slider = demo.getByRole("slider", { name: "Compare Before and After" });
  await expect(slider).toHaveAttribute("aria-valuenow", "50");
  await expect(slider).toHaveAttribute("aria-valuetext", "50% Before");
  await expectNoHorizontalOverflow(page);
  await expect(shown(demo, "Which change most likely lifted conversion the most?")).toHaveCount(0);

  if (!isMobile) {
    // Drag the divider with the mouse to the right edge of the stage.
    const stage = demo.locator(".nb-cmp__stage");
    await stage.scrollIntoViewIfNeeded();
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 5 });
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => Number(await slider.getAttribute("aria-valuenow")))
      .toBeGreaterThanOrEqual(95);
    // The far-right "before" note is now revealed and opens a card.
    await demo.getByRole("button", { name: "Note 3: Nine fields before any value" }).click();
    const card = demo.getByRole("group", { name: "Nine fields before any value" });
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
  } else {
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
  }

  // Keyboard: all the way to the other side.
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", /^9[0-5]$/);
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuetext", "0% Before");
  await expect(demo.locator(".nb-cmp__progress")).toHaveText("You've explored both versions.");

  await expect(shown(demo, "Which change most likely lifted conversion the most?")).toBeVisible();
  await demo.getByRole("radio", { name: /Cutting the form from nine fields to three/ }).click();
  await demo.getByRole("button", { name: "Check" }).click();
  await expect(shown(demo, /On a sign-up page the form/)).toBeVisible();
  await demo.getByRole("button", { name: "Finish" }).click();

  const card = demo.getByRole("status").filter({ hasText: "Restart" });
  await expect(card).toBeVisible();
  await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "100% score");
  await expect(shown(card, /Good CRO removes friction/)).toBeVisible();

  await card.getByRole("button", { name: "Restart" }).click();
  await expect(demo.getByRole("slider")).toHaveAttribute("aria-valuenow", "50");
  expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
});
