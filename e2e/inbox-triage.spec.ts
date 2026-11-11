import { test, expect, type Locator } from "@playwright/test";
import { demoSection, expectNoHorizontalOverflow } from "./helpers";

/** Expert call for every demo message, keyed by a sender pattern. */
const EXPERT: [RegExp, string][] = [
  [/^Priya Nair/, "Reply now"],
  [/^Adwave Business Support/, "Report"],
  [/^Tomás Ferreira/, "Reply now"],
  [/^Helen Brooks/, "Delegate"],
  [/^Ben Carver/, "Schedule"],
  [/^Pulse Analytics/, "Archive"],
  [/^Aisha Rahman/, "Schedule"],
];

function messageList(demo: Locator): Locator {
  return demo.getByRole("list", { name: "Messages" });
}

test.describe("Inbox triage", () => {
  test("triage every message like an expert, review the summary and retry", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Full interaction flow runs on desktop only");
    await page.goto("/modules/inbox-triage");
    const demo = demoSection(page, "inbox-triage");
    await expect(demo.getByText("0 of 7 handled")).toBeVisible();
    await expect(demo.getByText("7 unread")).toBeVisible();
    await expect(messageList(demo).getByRole("button")).toHaveCount(7);

    // Open the first message from the list, then follow "Next message" through the rest.
    await messageList(demo).getByRole("button", { name: EXPERT[0]![0] }).click();
    for (let i = 0; i < EXPERT.length; i++) {
      const [, action] = EXPERT[i]!;
      await demo.getByRole("button", { name: new RegExp(`^${action}`) }).click();
      await expect(demo.locator(".nb-inbox__coach")).toContainText("Good call");
      await expect(demo.getByText(`${i + 1} of 7 handled`)).toBeVisible();
      const label = i === EXPERT.length - 1 ? "See results" : "Next message";
      const next = demo.getByRole("button", { name: label });
      await expect(next).toBeFocused();
      await next.click();
    }

    const card = demo.getByRole("status").filter({ hasText: "Inbox zero" });
    await expect(card).toBeVisible();
    await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "100% score");
    await expect(card.getByText("7/7")).toBeVisible();
    await expect(
      card.getByText("Every priority message got the attention it needed."),
    ).toBeVisible();
    await expect(card.locator(".nb-inbox__review-item[data-status='correct']")).toHaveCount(7);

    await card.getByRole("button", { name: "Try again" }).click();
    await expect(demo.getByText("0 of 7 handled")).toBeVisible();
  });

  test("keyboard: arrows, Enter and number shortcuts; a phishing miss is called out", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Keyboard flow runs on desktop only");
    await page.goto("/modules/inbox-triage");
    const demo = demoSection(page, "inbox-triage");
    const first = messageList(demo).getByRole("button").first();
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(messageList(demo).getByRole("button").nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      demo.getByRole("heading", { name: /your ad account will be suspended/ }),
    ).toBeFocused();
    // 1 = Reply now: the wrong call for a phishing email.
    await page.keyboard.press("1");
    await expect(demo.locator(".nb-inbox__coach")).toContainText("Not the best call");
    await expect(demo.locator(".nb-inbox__coach")).toContainText("Expert call: Report");
  });

  test("narrow screens open a message full-width with a Back button", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/modules/inbox-triage");
    const demo = demoSection(page, "inbox-triage");
    await messageList(demo)
      .getByRole("button", { name: /Ben Carver/ })
      .click();
    await expect(messageList(demo)).toBeHidden();
    await expect(
      demo.getByRole("heading", { name: "Can we move next Tuesday's review?" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await demo.getByRole("button", { name: "Back to inbox" }).click();
    await expect(messageList(demo)).toBeVisible();
    await expect(messageList(demo).getByRole("button", { name: /Ben Carver/ })).toBeFocused();
  });
});
