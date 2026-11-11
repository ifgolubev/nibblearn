import { test, expect, type Locator, type Page } from "@playwright/test";
import { masterAllFlashcards } from "./helpers";

const LESSON_URL = "/examples/welcome-to-the-agency";
const STORAGE_KEY = "nibblearn:progress:welcome-to-the-agency";

function player(page: Page): Locator {
  return page.getByTestId("lesson-player");
}
function playerNav(page: Page): Locator {
  return player(page).getByRole("navigation", { name: "Lesson overview" });
}
function counter(page: Page): Locator {
  return player(page).locator(".nb-player__counter");
}

/** Opens the lesson with a clean slate (no persisted progress). */
async function openFresh(page: Page) {
  await page.goto(LESSON_URL);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(player(page).getByRole("button", { name: "Start lesson" })).toBeVisible();
}

/** Drives the "Welcome to the agency" story cards (6 cards, one embedded check). */
async function completeStoryCards(page: Page) {
  const story = player(page).locator('section[data-nb-module="story-cards"]');
  await expect(story.getByText("Card 1 of 6")).toBeVisible();
  const next = story.getByRole("button", { name: "Next", exact: true });
  for (let card = 1; card <= 4; card++) {
    await expect(story.getByText(`Card ${card} of 6`)).toBeVisible();
    await next.click();
  }
  // Card 5 carries a quick check that must be answered before moving on.
  await expect(story.getByText("Card 5 of 6")).toBeVisible();
  await expect(story.getByText("Quick check")).toBeVisible();
  await expect(next).toBeDisabled();
  await story.getByRole("radio", { name: /Ask which metric moved/ }).click();
  await expect(story.getByText("Correct", { exact: true }).first()).toBeVisible();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(story.getByText("Card 6 of 6")).toBeVisible();
  await story.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(story.getByText(/That's the lay of the land/)).toBeVisible();
}

test.describe("Lesson player", () => {
  test("intro, first activity, navigation and resume after reload", async ({ page }) => {
    await openFresh(page);
    const p = player(page);

    // Intro
    await expect(p.getByRole("heading", { name: "Welcome to the Agency" })).toBeVisible();
    await expect(p.getByText("What you'll learn")).toBeVisible();
    await expect(p.getByText("Name the four departments and what each one owns")).toBeVisible();
    await expect(p.getByText("4 activities")).toBeVisible();
    await expect(p.getByText("About 8 min")).toBeVisible();

    // Start → Activity 1 of 4, Next disabled until the activity completes.
    await p.getByRole("button", { name: "Start lesson" }).click();
    await expect(counter(page)).toHaveText("Activity 1 of 4");
    const next = playerNav(page).getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeDisabled();
    await expect(playerNav(page).getByRole("button", { name: "Back" })).toBeDisabled();
    await expect(playerNav(page).getByText("Complete this activity to continue")).toBeVisible();

    await completeStoryCards(page);
    await expect(next).toBeEnabled();
    await next.click();
    await expect(counter(page)).toHaveText("Activity 2 of 4");
    await expect(p.locator('section[data-nb-module="flashcards"]')).toBeVisible();

    // Back/forward navigation keeps completed state.
    await playerNav(page).getByRole("button", { name: "Back" }).click();
    await expect(counter(page)).toHaveText("Activity 1 of 4");
    await expect(next).toBeEnabled();
    await next.click();
    await expect(counter(page)).toHaveText("Activity 2 of 4");

    // Progress is persisted in localStorage.
    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!)).toMatchObject({
      lessonId: "welcome-to-the-agency",
      currentIndex: 1,
    });

    // Reload → intro offers to resume → continuing returns to Activity 2.
    await page.reload();
    const resume = p.getByRole("region").filter({ hasText: "Resume where you left off" });
    await expect(resume).toBeVisible();
    await expect(resume).toContainText("Activity 2 of 4");
    await expect(resume).toContainText("Completed: 1");
    await resume.getByRole("button", { name: "Continue" }).click();
    await expect(counter(page)).toHaveText("Activity 2 of 4");
    await expect(p.locator('section[data-nb-module="flashcards"]')).toBeVisible();

    // "Start over" from the intro clears progress.
    await page.reload();
    await p.getByRole("button", { name: "Start over" }).click();
    await expect(counter(page)).toHaveText("Activity 1 of 4");
    await expect(next).toBeDisabled();
  });

  test("completing all four activities reaches the summary", async ({ page, isMobile }) => {
    test.skip(isMobile, "Full lesson completion runs on desktop only");
    test.setTimeout(180_000);
    await openFresh(page);
    const p = player(page);
    const nav = playerNav(page);
    const next = nav.getByRole("button", { name: "Next", exact: true });

    await p.getByRole("button", { name: "Start lesson" }).click();

    // 1. Story cards
    await expect(counter(page)).toHaveText("Activity 1 of 4");
    await completeStoryCards(page);
    await next.click();

    // 2. Flashcards (6 cards, mastery required)
    await expect(counter(page)).toHaveText("Activity 2 of 4");
    const deck = p.locator('section[data-nb-module="flashcards"]');
    await expect(deck.getByText("1 of 6", { exact: true })).toBeVisible();
    await masterAllFlashcards(deck, 6);
    await expect(next).toBeEnabled();
    await next.click();

    // 3. Process explorer (visit all 7 stages, then Finish)
    await expect(counter(page)).toHaveText("Activity 3 of 4");
    const proc = p.locator('section[data-nb-module="process-explorer"]');
    await expect(proc.getByText("1 of 7 stages explored")).toBeVisible();
    const stages = proc.getByRole("list", { name: "Stages" }).getByRole("button");
    await expect(stages).toHaveCount(7);
    for (let i = 1; i < 7; i++) {
      await stages.nth(i).click();
      await expect(proc.getByText(`${i + 1} of 7 stages explored`)).toBeVisible();
    }
    await proc.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(proc.getByText("You explored the whole process.")).toBeVisible();
    await expect(next).toBeEnabled();
    await next.click();

    // 4. Choice challenge (3 questions)
    await expect(counter(page)).toHaveText("Activity 4 of 4");
    const quiz = p.locator('section[data-nb-module="choice-challenge"]');
    const finishLesson = nav.getByRole("button", { name: "Finish lesson" });
    await expect(finishLesson).toBeDisabled();

    await expect(quiz.getByText("Question 1 of 3")).toBeVisible();
    await quiz.getByRole("radio", { name: /Pulse Analytics dashboard/ }).click();
    await quiz.getByRole("button", { name: "Check" }).click();
    await expect(quiz.getByText("Correct", { exact: true }).first()).toBeVisible();
    await quiz.getByRole("button", { name: "Next", exact: true }).click();

    await expect(quiz.getByText("Question 2 of 3")).toBeVisible();
    await quiz.getByRole("radio", { name: /Check the Playbook page/ }).click();
    await quiz.getByRole("button", { name: "Check" }).click();
    await expect(quiz.getByText("Correct", { exact: true }).first()).toBeVisible();
    await quiz.getByRole("button", { name: "Next", exact: true }).click();

    await expect(quiz.getByText("Question 3 of 3")).toBeVisible();
    await quiz.getByRole("checkbox", { name: /Status updates and approvals/ }).click();
    await quiz.getByRole("checkbox", { name: /Questions about the brief/ }).click();
    await quiz.getByRole("checkbox", { name: /Links to final reports/ }).click();
    await quiz.getByRole("button", { name: "Check" }).click();
    await expect(quiz.getByText("Correct", { exact: true }).first()).toBeVisible();
    await quiz.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(quiz.getByText("100%", { exact: true })).toBeVisible();

    // Finish lesson → summary
    await expect(finishLesson).toBeEnabled();
    await finishLesson.click();
    await expect(p.getByText("You did it!")).toBeVisible();
    await expect(p.getByText("You finished Welcome to the Agency.")).toBeVisible();
    await expect(p.locator(".nb-summary")).toHaveAttribute("data-nb-passed", "true");
    await expect(p.getByText("4/4")).toBeVisible();
    await expect(p.getByRole("button", { name: "Retry lesson" })).toBeVisible();
    const review = p.getByRole("list", { name: "Review activities" });
    await expect(review.getByRole("listitem")).toHaveCount(4);
    await expect(review.locator("[data-status='todo']")).toHaveCount(0);

    // The showcase page reports the completion callback.
    await expect(page.getByRole("status").filter({ hasText: "onComplete" })).toContainText(
      "passed",
    );

    // Completed progress is restored as the summary after a reload.
    await page.reload();
    await expect(p.getByText("You did it!")).toBeVisible();

    // Retry clears the stored progress and starts again.
    await p.getByRole("button", { name: "Retry lesson" }).click();
    await expect(counter(page)).toHaveText("Activity 1 of 4");
    await expect(next).toBeDisabled();
  });
});
