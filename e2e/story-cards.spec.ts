import { test, expect } from "@playwright/test";
import { collectPageErrors, demoSection, expectNoHorizontalOverflow, shown } from "./helpers";

test("story-cards: card templates (media beside the text, centred text, link button)", async ({
  page,
  isMobile,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/modules/story-cards");
  const demo = demoSection(page, "story-cards");
  const card = demo.locator(".nb-story__card");
  const next = demo.getByRole("button", { name: "Next", exact: true });

  // Card 2: image to the right of the text on wide screens, stacked above it on phones.
  await next.click();
  await expect(shown(demo, "Card 2 of 6")).toBeVisible();
  await expect(card).toHaveAttribute("data-media", "right");
  const image = card.getByRole("img", { name: /Pulse Analytics dashboard/ });
  await expect(image).toBeVisible();
  const title = card.getByRole("heading", { name: "Three teams, one scoreboard" });
  const imageBox = (await image.boundingBox())!;
  const titleBox = (await title.boundingBox())!;
  if (isMobile) expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(titleBox.y);
  else expect(imageBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width - 1);
  await expectNoHorizontalOverflow(page);

  // Card 3: centred text.
  await next.click();
  await expect(shown(demo, "Card 3 of 6")).toBeVisible();
  await expect(card).toHaveAttribute("data-align", "center");
  await expect(card.locator(".nb-story__content")).toHaveCSS("text-align", "center");

  // Card 6: link button that opens in a new tab.
  await next.click();
  await next.click();
  await demo.getByRole("radio", { name: /Ask which metric moved/ }).click();
  await next.click();
  await expect(shown(demo, "Card 6 of 6")).toBeVisible();
  const link = card.getByRole("link", { name: /Open the team handbook/ });
  await expect(link).toHaveAttribute("href", "https://brightline.example/handbook");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
