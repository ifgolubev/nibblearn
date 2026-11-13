import { test, expect } from "@playwright/test";
import { shown } from "./helpers";
import { collectPageErrors, demoSection, expectNoHorizontalOverflow } from "./helpers";

const answers = [
  ["ROAS", "=", "Revenue", "÷", "Ad spend"],
  ["CPA", "=", "Spend", "÷", "Conversions"],
  ["Confirm", "the", "brief", "before", "you", "build", "the", "campaign"],
  ["Escalate", "early", "and", "bring", "a", "proposed", "fix"],
];

test("word-builder: build every answer, fix a mistake and see the summary", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/modules/word-builder");
  const demo = demoSection(page, "word-builder");
  const bank = demo.getByRole("group", { name: "Word bank" });
  const answer = demo.getByRole("list", { name: "Your answer" });

  for (let i = 0; i < answers.length; i++) {
    await expect(shown(demo, `Item ${i + 1} of 4`)).toBeVisible();
    const tokens = answers[i]!;
    if (i === 0) {
      // First try: swap the last two operands, then retry from the first mistake.
      for (const tok of ["ROAS", "=", "Ad spend", "÷", "Revenue"]) {
        await bank.getByRole("button", { name: tok, exact: true }).first().click();
      }
      await demo.getByRole("button", { name: "Check" }).click();
      await expect(shown(demo, "3 of 5 tiles in the right place")).toBeVisible();
      await expect(answer.locator("[data-state='incorrect']")).toHaveCount(2);
      await demo.getByRole("button", { name: "Try again" }).click();
      await expect(answer.getByRole("button")).toHaveCount(2);
      for (const tok of tokens.slice(2)) {
        await bank.getByRole("button", { name: tok, exact: true }).first().click();
      }
    } else {
      for (const tok of tokens) {
        await bank.getByRole("button", { name: tok, exact: true }).first().click();
      }
    }
    await expect(answer.getByRole("button")).toHaveCount(tokens.length);
    await demo.getByRole("button", { name: "Check" }).click();
    await expect(shown(demo, "That's the right order!")).toBeVisible();
    await expect(answer.locator("[data-state='correct']")).toHaveCount(tokens.length);
    await expectNoHorizontalOverflow(page);
    await demo.getByRole("button", { name: i === answers.length - 1 ? "Finish" : "Next" }).click();
  }

  const card = demo.getByRole("status").filter({ hasText: "Try again" });
  await expect(card).toBeVisible();
  await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "94% score");
  await expect(shown(card, "4/4")).toBeVisible();
  await expect(card.locator(".nb-word__summary-item[data-state='correct']")).toHaveCount(4);
  expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
});
