import { test, expect, type Locator } from "@playwright/test";
import { shown } from "./helpers";
import {
  MODULE_TYPES,
  collectPageErrors,
  completeChoiceChallengeDemo,
  demoResetButton,
  demoSection,
  masterAllFlashcards,
} from "./helpers";

test.describe("Module pages render", () => {
  for (const type of MODULE_TYPES) {
    test(`/modules/${type} renders the live demo and Reset works`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto(`/modules/${type}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const demo = demoSection(page, type);
      await expect(demo).toBeVisible();
      await expect(demo.getByRole("heading").first()).toBeVisible();

      await demoResetButton(page).click();
      await expect(demoSection(page, type)).toBeVisible();
      await expect(page.locator("section[data-nb-module]")).toHaveCount(1);

      expect(errors, errors.map((e) => e.message).join("\n")).toEqual([]);
    });
  }
});

test.describe("Module interactions", () => {
  test.skip(({ isMobile }) => isMobile, "Full interaction flows run on desktop only");

  test("choice-challenge: answer all three questions correctly", async ({ page }) => {
    await page.goto("/modules/choice-challenge");
    const demo = demoSection(page, "choice-challenge");
    await expect(demo.getByRole("button", { name: "Check" })).toBeDisabled();

    await completeChoiceChallengeDemo(demo);

    const card = demo.getByRole("status").filter({ hasText: "Try again" });
    await expect(card).toBeVisible();
    await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "100% score");
    await expect(shown(card, "100%", { exact: true })).toBeVisible();
    await expect(shown(card, "3/3")).toBeVisible();
    await expect(card.locator(".nb-choice__summary-item[data-ok='true']")).toHaveCount(3);

    await card.getByRole("button", { name: "Try again" }).click();
    await expect(shown(demo, "Question 1 of 3")).toBeVisible();
    await expect(demo.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  test("true-false: answer all eight statements with the buttons", async ({ page }) => {
    await page.goto("/modules/true-false");
    const demo = demoSection(page, "true-false");
    const answers = [true, false, true, false, true, false, true, false];

    for (let i = 0; i < answers.length; i++) {
      await expect(shown(demo, `Statement ${i + 1} of 8`)).toBeVisible();
      const name = answers[i] ? /Mark as true/ : /Mark as false/;
      await demo.getByRole("button", { name }).click();
      await expect(shown(demo, "Correct", { exact: true }).first()).toBeVisible();
      const isLast = i === answers.length - 1;
      await demo.getByRole("button", { name: isLast ? "Finish" : "Continue", exact: true }).click();
    }

    const card = demo.getByRole("status").filter({ hasText: "Try again" });
    await expect(card).toBeVisible();
    await expect(shown(card, "100%", { exact: true })).toBeVisible();
    await expect(shown(card, /Myths busted/)).toBeVisible();
    await expect(card.getByRole("listitem")).toHaveCount(8);
    await expect(card.locator("li[data-ok='true']")).toHaveCount(8);
  });

  test("flashcards: flip and master every card", async ({ page }) => {
    await page.goto("/modules/flashcards");
    const demo = demoSection(page, "flashcards");
    await expect(shown(demo, "0 mastered")).toBeVisible();
    await expect(shown(demo, "8 to review")).toBeVisible();
    await expect(demo.getByRole("button", { name: "Got it" })).toBeDisabled();

    await masterAllFlashcards(demo, 8);

    await expect(shown(demo, "All cards mastered")).toBeVisible();
    await demo.getByRole("button", { name: "Restart" }).click();
    await expect(shown(demo, "1 of 8", { exact: true })).toBeVisible();
    await expect(shown(demo, "0 mastered")).toBeVisible();
  });

  test("fill-blanks: fill from the word bank and check", async ({ page }) => {
    await page.goto("/modules/fill-blanks");
    const demo = demoSection(page, "fill-blanks");
    const bank = demo.getByRole("group", { name: "Word bank" });
    const check = demo.getByRole("button", { name: "Check" });
    await expect(check).toBeDisabled();

    // Tapping a word fills the next empty blank, in template order.
    for (const word of ["ad spend", "conversions", "clicks", "impressions"]) {
      await bank.getByRole("button", { name: word, exact: true }).click();
    }
    await expect(demo.getByRole("button", { name: "Blank 1: ad spend" })).toBeVisible();
    await expect(demo.getByRole("button", { name: "Blank 4: impressions" })).toBeVisible();
    await expect(check).toBeEnabled();
    await check.click();

    await expect(shown(demo, "All blanks filled correctly!")).toBeVisible();
    await expect(demo.getByRole("button", { name: /^Blank \d/ })).toHaveCount(4);
    for (const blank of await demo.getByRole("button", { name: /^Blank \d/ }).all()) {
      await expect(blank).toHaveAttribute("data-state", "correct");
    }
    await expect(demo.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("match-pairs: tap to connect every pair", async ({ page }) => {
    await page.goto("/modules/match-pairs");
    const demo = demoSection(page, "match-pairs");
    const pairs: Record<string, string> = {
      CPM: "What 1,000 ad impressions cost",
      CPC: "What a single click costs",
      CTR: "Share of impressions that turned into clicks",
      CPA: "What one acquisition (lead or sale) costs",
      ROAS: "Revenue earned for every unit of ad spend",
      Frequency: "Average number of times one person saw the ad",
      Reach: "Number of unique people who saw the ad",
      "Conversion rate": "Share of visitors who completed the goal",
    };
    await expect(shown(demo, "0 of 8 matched")).toBeVisible();
    const left = demo.getByRole("group", { name: "Metric" });
    const right = demo.getByRole("group", { name: "What it tells you" });

    for (let matched = 1; matched <= 8; matched++) {
      // Pick the first unmatched tile in the current round (rounds hold 4 pairs each).
      const tile = left.getByRole("button").and(demo.locator("[data-state='idle']")).first();
      await expect(tile).toBeVisible({ timeout: 15_000 });
      const name = (await tile.textContent())?.trim() ?? "";
      expect(pairs[name], `unknown tile "${name}"`).toBeTruthy();
      await tile.click();
      await right.getByRole("button", { name: pairs[name], exact: true }).click();
      await expect(shown(demo, `${matched} of 8 matched`)).toBeVisible();
    }

    // Announced to screen readers only.
    await expect(demo.getByRole("status").filter({ hasText: "All pairs matched!" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(shown(demo, "100%", { exact: true })).toBeVisible();
    await expect(demo.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("sequence-builder: reorder with the arrow buttons and check", async ({ page }) => {
    await page.goto("/modules/sequence-builder");
    const demo = demoSection(page, "sequence-builder");
    const list = demo.getByRole("list", { name: "Launching a paid media campaign" });
    await expect(list.getByRole("listitem")).toHaveCount(7);

    // Correct order, taken from examples/src/modules/sequence-builder.ts.
    const target = [
      "Receive and clarify the client brief",
      "Research the audience and the competition",
      "Build the media plan and budget split",
      "Produce and approve creative assets",
      "Set up campaigns, tracking and QA",
      "Launch and optimise in-flight",
      "Report results and recommend next steps",
    ];
    const rowTexts = async () =>
      (await list.locator(".nb-seq__text").allTextContents()).map((t) => t.trim());

    for (let i = 0; i < target.length; i++) {
      let current = (await rowTexts()).indexOf(target[i]!);
      expect(current, `row "${target[i]}" not found`).toBeGreaterThanOrEqual(0);
      while (current > i) {
        await demo.getByRole("button", { name: `Move up: ${target[i]}` }).click();
        current--;
        await expect.poll(async () => (await rowTexts()).indexOf(target[i]!)).toBe(current);
      }
    }
    expect(await rowTexts()).toEqual(target);

    await demo.getByRole("button", { name: "Check" }).click();
    await expect(shown(demo, "Perfect order!")).toBeVisible();
    await expect(list.locator("li[data-state='correct']")).toHaveCount(7);
    await demo.getByRole("button", { name: "Finish" }).click();
    await expect(shown(demo, "100%", { exact: true })).toBeVisible();
    await expect(shown(demo, /That is the Brightline launch playbook/)).toBeVisible();
    await expect(demo.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("what-if-simulator: moving a slider with the keyboard updates the outputs", async ({
    page,
  }) => {
    await page.goto("/modules/what-if-simulator");
    const demo = demoSection(page, "what-if-simulator");
    const cvr = demo.getByRole("slider", { name: "Conversion rate" });
    await expect(cvr).toHaveAttribute("aria-valuetext", "2%");
    const table = demo.getByRole("table", { name: "Results" });
    // Defaults: 10,000 / 1.5 = 6,666 clicks; floor(6666 × 0.02) = 133 conversions.
    await expect(table.getByRole("row", { name: /Conversions 133/ })).toBeVisible();
    const before = await demo.locator(".nb-sim__heroes").textContent();

    await cvr.focus();
    await page.keyboard.press("ArrowRight");
    await expect(cvr).toHaveAttribute("aria-valuetext", "2.5%");
    // floor(6666 × 0.025) = 166 conversions.
    await expect(table.getByRole("row", { name: /Conversions 166/ })).toBeVisible();
    await expect(demo.locator(".nb-sim__heroes")).not.toHaveText(before ?? "");

    // Step buttons are the keyboard-friendly alternative and clamp at the bounds.
    await demo.getByRole("button", { name: "Decrease Conversion rate" }).click();
    await expect(cvr).toHaveAttribute("aria-valuetext", "2%");
  });

  test("budget-allocator: rebalance to the goal, lock in and compare with the optimum", async ({
    page,
  }) => {
    await page.goto("/modules/budget-allocator");
    const demo = demoSection(page, "budget-allocator");
    const search = demo.getByRole("slider", { name: "Search & social" });
    await expect(search).toHaveAttribute("aria-valuetext", "20% · $24,000");
    const table = demo.getByRole("table", { name: "Allocation" });
    await expect(table.getByRole("row", { name: /Premium CTV 20% \$24,000/ })).toBeAttached();
    await expect(demo.locator(".nb-budget__goal")).toHaveAttribute("data-met", "false");
    await expect(demo.locator(".nb-budget__goal-status")).toHaveText("Not yet — keep rebalancing.");
    const sumOfShares = async () =>
      (await demo
        .getByRole("slider")
        .evaluateAll((els) =>
          els.reduce((s, el) => s + Number((el as HTMLInputElement).value), 0),
        )) as number;

    // Search & social up to its 45% cap with the keyboard.
    await search.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect(search).toHaveAttribute("aria-valuetext", "45% · $54,000");
    await expect(demo.getByRole("button", { name: "Increase Search & social" })).toBeDisabled();
    expect(await sumOfShares()).toBe(100);

    // Hold it there, trim out-of-home to its 5% minimum and feed premium CTV.
    const lock = demo.getByRole("button", { name: "Lock Search & social" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    const dooh = demo.getByRole("button", { name: "Decrease Digital out-of-home" });
    for (let i = 0; i < 3; i++) await dooh.click();
    await expect(dooh).toBeDisabled();
    for (let i = 0; i < 3; i++)
      await demo.getByRole("button", { name: "Increase Premium CTV" }).click();
    await expect(demo.getByRole("slider", { name: "Premium CTV" })).toHaveAttribute(
      "aria-valuetext",
      "25% · $30,000",
    );
    await expect(search).toHaveAttribute("aria-valuetext", "45% · $54,000");
    expect(await sumOfShares()).toBe(100);
    await expect(demo.locator(".nb-budget__goal")).toHaveAttribute("data-met", "true");

    await demo.getByRole("button", { name: "Lock in plan" }).click();
    await expect(demo.getByRole("heading", { name: "Results" })).toBeFocused();
    await expect(shown(demo, "Optimal plan", { exact: true }).first()).toBeVisible();
    await expect(shown(demo, "96% of optimal", { exact: true })).toBeVisible();
    const card = demo.getByRole("status").filter({ hasText: "Try again" });
    await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "96% score");
    for (const s of await demo.getByRole("slider").all()) await expect(s).toBeDisabled();

    await card.getByRole("button", { name: "Try again" }).click();
    await expect(demo.getByRole("button", { name: "Lock in plan" })).toBeVisible();
    await expect(search).toHaveAttribute("aria-valuetext", "20% · $24,000");
  });

  test("estimate: answer all five questions and see the summary", async ({ page }) => {
    await page.goto("/modules/estimate");
    const demo = demoSection(page, "estimate");
    const answers = ["2.8", "21.4", "38", "16.8", "4.1"];
    for (let i = 0; i < answers.length; i++) {
      await expect(shown(demo, `Question ${i + 1} of 5`)).toBeVisible();
      const input = demo.getByRole("spinbutton", { name: "Exact value" });
      await expect(input).toBeVisible();
      await input.fill(answers[i]!);
      await input.press("Enter");
      await expect(shown(demo, "Bullseye!", { exact: true })).toBeVisible();
      await expect(demo.locator(".nb-est__delta")).toContainText("Spot on.");
      const next = demo.getByRole("button", { name: i === answers.length - 1 ? "Finish" : "Next" });
      await expect(next).toBeFocused();
      await page.keyboard.press("Enter");
    }
    const card = demo.getByRole("status").filter({ hasText: "Try again" });
    await expect(card).toBeVisible();
    await expect(card.locator(".nb-complete__ring")).toHaveAttribute("aria-label", "100% score");
    await expect(shown(card, "5/5")).toBeVisible();
    await expect(card.locator(".nb-est__summary-item[data-band='bullseye']")).toHaveCount(5);

    await card.getByRole("button", { name: "Try again" }).click();
    await expect(shown(demo, "Question 1 of 5")).toBeVisible();
  });

  test("estimate: the slider reveals a miss with the gap between guess and answer", async ({
    page,
  }) => {
    await page.goto("/modules/estimate");
    const demo = demoSection(page, "estimate");
    const slider = demo.getByRole("slider", { name: "Your estimate" });
    await expect(slider).toHaveAttribute("aria-valuetext", "5%");
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", "6%");
    await page.keyboard.press("Enter");
    await expect(shown(demo, "Way off", { exact: true })).toBeVisible();
    await expect(shown(demo, /You were 3\.2\s+pp too high\./)).toBeVisible();
    await expect(demo.locator(".nb-est__marker--answer")).toContainText("2.8%");
    await expect(demo.locator(".nb-est__marker--guess")).toContainText("6%");
  });

  test("hotspot-explorer: visiting every marker completes the tour", async ({ page }) => {
    await page.goto("/modules/hotspot-explorer");
    const demo = demoSection(page, "hotspot-explorer");
    await expect(shown(demo, "0 of 6 explored")).toBeVisible();
    const labels = [
      "Date range picker",
      "Spend card",
      "ROAS card",
      "Daily spend vs. revenue chart",
      "Channel breakdown table",
      "Attribution section in the sidebar",
    ];
    const markerFor = (i: number): Locator =>
      demo.getByRole("button", { name: `Hotspot ${i + 1}: ${labels[i]}` });
    for (let i = 0; i < labels.length; i++) {
      await expect(markerFor(i)).toHaveAttribute("data-visited", "false");
    }

    // Open the first marker, then walk the rest with the panel's Next button
    // (the floating panel can cover neighbouring markers).
    await markerFor(0).click();
    await expect(markerFor(0)).toHaveAttribute("aria-expanded", "true");
    for (let i = 0; i < labels.length; i++) {
      const panel = demo.locator('[role="group"][aria-labelledby*="-hs-"]');
      await expect(panel).toBeVisible();
      await expect(markerFor(i)).toHaveAttribute("data-visited", "true");
      await expect(shown(demo, `${i + 1} of 6 explored`)).toBeVisible();
      if (i < labels.length - 1) await panel.getByRole("button", { name: "Next" }).click();
    }
    await expect(shown(demo, "You explored everything!")).toBeVisible();
    await expect(demo.getByRole("button", { name: "Restart" })).toBeVisible();
  });
});
