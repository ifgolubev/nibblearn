import { test, expect } from "@playwright/test";
import { shown } from "./helpers";
import { demoSection } from "./helpers";

test.describe("Branching scenario", () => {
  test("plays the good path to the success ending and can explore another path", async ({
    page,
  }) => {
    await page.goto("/modules/branching-scenario");
    const demo = demoSection(page, "branching-scenario");

    // The demo has an intro, so a Start button is shown first.
    const start = demo.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeVisible();
    await expect(shown(demo, /Dana Whitfield/).first()).toBeVisible();
    await start.click();

    // Decision 1
    await expect(shown(demo, "The call opens cold")).toBeVisible();
    await expect(shown(demo, "What do you do?")).toBeVisible();
    const cont = demo.getByRole("button", { name: "Continue", exact: true });
    await expect(cont).toBeDisabled();
    await demo.getByRole("radio", { name: /Acknowledge the gap/ }).click();
    await cont.click();
    await expect(shown(demo, /You validated the concern/)).toBeVisible();
    await expect(shown(demo, "+3 points")).toBeVisible();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();

    // Decision 2
    await expect(shown(demo, "A door opens")).toBeVisible();
    const history = demo.getByRole("list", { name: "Your decisions" });
    await expect(history).toContainText("Decision 1");
    await expect(history).toContainText("Acknowledge the gap");
    await demo.getByRole("radio", { name: /Walk through the data together/ }).click();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(shown(demo, "+4 points")).toBeVisible();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();

    // Ending
    await expect(shown(demo, "Great outcome")).toBeVisible();
    await expect(shown(demo, "Renewed, with a plan")).toBeVisible();
    await expect(shown(demo, /The winning pattern/)).toBeVisible();
    await expect(shown(demo, "100%", { exact: true })).toBeVisible();

    const again = demo.getByRole("button", { name: "Explore another path" });
    await expect(again).toBeVisible();
    await again.click();
    // Back at the beginning: either the intro or the first decision.
    await expect(
      demo
        .getByRole("button", { name: "Start", exact: true })
        .or(shown(demo, "The call opens cold")),
    ).toBeVisible();
    await expect(shown(demo, "Great outcome")).toHaveCount(0);
    await expect(demo.getByRole("list", { name: "Your decisions" })).toHaveCount(0);
  });

  test("a poor choice leads to a failure ending", async ({ page }) => {
    await page.goto("/modules/branching-scenario");
    const demo = demoSection(page, "branching-scenario");
    const start = demo.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeVisible();
    await start.click();

    await demo.getByRole("radio", { name: /Explain that the checkout redesign/ }).click();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(shown(demo, "-2 points")).toBeVisible();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(shown(demo, "Walls go up")).toBeVisible();
    await demo.getByRole("radio", { name: /Hold your ground/ }).click();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(shown(demo, "-3 points")).toBeVisible();
    await demo.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(shown(demo, "Poor outcome")).toBeVisible();
    await expect(shown(demo, "Churned")).toBeVisible();
    await expect(demo.getByRole("button", { name: "Explore another path" })).toBeVisible();
  });
});

test.describe("Simulated conversation", () => {
  // Incoming messages play with typing delays (up to ~2.2 s each).
  test.setTimeout(120_000);
  const reply = { timeout: 30_000 };

  test("picking replies until the summary appears", async ({ page }) => {
    await page.goto("/modules/conversation");
    const demo = demoSection(page, "conversation");
    await expect(demo.locator(".nb-conv__name")).toHaveText("Priya Nair");
    const log = demo.getByRole("log");

    await expect(log).toContainText("Hey, are you still around?", reply);
    await expect(log).toContainText("old 15% code", reply);
    await expect(shown(demo, "Choose your reply")).toBeVisible(reply);

    await demo.getByRole("button", { name: /Pausing the affected ads now/ }).click();
    await expect(log).toContainText("Pausing the affected ads now");
    await expect(
      shown(demo.locator(".nb-module__body"), /You answered the question she did not ask/),
    ).toBeVisible();
    await expect(demo.getByRole("img", { name: "Effectiveness: 95%" })).toBeVisible();

    await expect(log).toContainText("I can see spend has stopped.", reply);
    await demo.getByRole("button", { name: /Correct, three ad sets/ }).click(reply);

    await expect(log).toContainText("Live again with 25%", reply);
    await demo.getByRole("button", { name: /Glad it's sorted/ }).click(reply);

    await expect(log).toContainText("That would be great.", reply);
    await expect(shown(demo, "Conversation summary")).toBeVisible(reply);
    await expect(
      shown(demo.locator(".nb-module__body"), "The conversation went well"),
    ).toBeVisible();
    await expect(shown(demo, /act first, scope the problem/)).toBeVisible();
    await expect(shown(demo, "Tones you used")).toBeVisible();
    await expect(shown(demo, "Your replies")).toBeVisible();

    const replay = demo.getByRole("button", { name: "Replay conversation" });
    await expect(replay).toBeVisible();
    await replay.click();
    await expect(shown(demo, "Conversation summary")).toHaveCount(0);
    await expect(demo.getByRole("button", { name: /Pausing the affected ads now/ })).toBeVisible(
      reply,
    );
  });
});
