import { test, expect } from "@playwright/test";
import { shown } from "./helpers";
import { collectPageErrors, demoSection, expectNoHorizontalOverflow } from "./helpers";

const answers: [string, number][] = [
  ["Logo", 1],
  ["Headline", 2],
  ["Offer", 3],
  ["Product shot", 4],
  ["Call to action", 5],
  ["Disclaimer", 6],
];

test("label-diagram: label every part of the display ad and complete", async ({
  page,
  isMobile,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/modules/label-diagram");
  const demo = demoSection(page, "label-diagram");
  const tray = demo.getByRole("region", { name: "Labels" });
  const zone = (i: number) => demo.getByRole("button", { name: new RegExp(`^Zone ${i}:`) });

  await expect(tray.getByRole("button")).toHaveCount(8);
  await expect(demo.getByRole("button", { name: "Check" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);

  for (const [i, [label, index]] of answers.entries()) {
    if (i === 0 && !isMobile) {
      // Drag the first label onto its zone with the mouse.
      const chip = tray.getByRole("button", { name: label, exact: true });
      await demo
        .locator(".nb-label__stage")
        .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      const from = (await chip.boundingBox())!;
      const to = (await zone(index).boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      await page.mouse.up();
      await expect(demo.locator(".nb-label__chip--overlay")).toHaveCount(0);
    } else {
      await tray.getByRole("button", { name: label, exact: true }).click();
      await zone(index).click();
    }
    await expect(zone(index)).toHaveAccessibleName(`Zone ${index}: ${label}`);
  }
  await expect(tray.getByRole("button")).toHaveCount(2);

  await demo.getByRole("button", { name: "Check" }).click();
  await expect(shown(demo, "Every label is in the right place!").first()).toBeVisible();
  for (const [, index] of answers)
    await expect(zone(index)).toHaveAttribute("data-state", "correct");
  await demo.getByRole("button", { name: "Finish" }).click();

  const card = demo.getByRole("status").filter({ hasText: "Try again" });
  await expect(card).toBeVisible();
  await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "100% score");
  await expect(shown(card, "6/6")).toBeVisible();
  await expect(shown(card, "What each part does")).toBeVisible();
  await expect(card.locator(".nb-label__note")).toHaveCount(6);

  await card.getByRole("button", { name: "Try again" }).click();
  await expect(demo.getByRole("region", { name: "Labels" }).getByRole("button")).toHaveCount(8);
  expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
});
