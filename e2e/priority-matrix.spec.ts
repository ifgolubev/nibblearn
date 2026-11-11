import { test, expect } from "@playwright/test";
import { collectPageErrors, demoSection, expectNoHorizontalOverflow } from "./helpers";

const placement: Record<string, string> = {
  "Tracking is broken on Northwind's live campaign": "Do now",
  "Approve creative due to launch at 2pm today": "Do now",
  "Draft the Q3 strategy deck for Harbor Supply": "Schedule",
  "Book training on the new attribution tool": "Schedule",
  "Reformat last week's slides for an internal sync": "Delegate",
  "Pull a routine weekly export": "Delegate",
  "Reply to a vendor's newsletter survey": "Drop",
  "Tidy the shared drive's archive folder": "Drop",
};

test("priority-matrix: triage Monday morning, fix a mistake and finish", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/modules/priority-matrix");
  const demo = demoSection(page, "priority-matrix");
  await expect(demo.getByRole("group", { name: "Importance by Urgency matrix" })).toBeVisible();
  await expect(demo.getByText("0 of 8 placed")).toBeVisible();
  const quadrant = (name: string) => demo.getByRole("region", { name, exact: true });

  // Put the first task in the wrong quadrant on purpose.
  const wrong = { ...placement, "Pull a routine weekly export": "Drop" };
  for (const [task, q] of Object.entries(wrong)) {
    await demo.getByRole("button", { name: task, exact: true }).click();
    await quadrant(q)
      .getByRole("button", { name: `Place in ${q}` })
      .click();
    await expect(quadrant(q).getByRole("button", { name: task, exact: true })).toBeVisible();
  }
  await expect(demo.getByText("8 of 8 placed")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await demo.getByRole("button", { name: "Check" }).click();
  await expect(demo.getByText("7 of 8 in the right quadrant").first()).toBeVisible();
  await expect(quadrant("Drop").getByText("Belongs in Delegate")).toBeVisible();

  await demo.getByRole("button", { name: "Try again" }).click();
  const task = "Pull a routine weekly export";
  await demo.getByRole("button", { name: task, exact: true }).click();
  await quadrant("Delegate").getByRole("button", { name: "Place in Delegate" }).click();
  await demo.getByRole("button", { name: "Check" }).click();
  await expect(demo.getByText("Every task is in the right quadrant!").first()).toBeVisible();
  await demo.getByRole("button", { name: "Finish" }).click();

  const card = demo.getByRole("status").filter({ hasText: "Try again" });
  await expect(card).toBeVisible();
  await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "88% score");
  await expect(card.getByRole("group", { name: "Expert placement" })).toContainText(
    "Pull a routine weekly export",
  );
  expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
});
