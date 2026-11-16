import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The standalone build (React included) on a plain HTML page. Needs `pnpm build` first.
const dist = (f: string) => fileURLToPath(new URL(`../packages/embed/dist/${f}`, import.meta.url));

const config = {
  id: "tf",
  type: "true-false",
  title: "Quick check",
  content: { statements: [{ text: "CTR is clicks divided by impressions.", isTrue: true }] },
};

test("a static page becomes interactive with <nibblearn-module>", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>
    <h1>Lesson</h1>
    <ul id="host-list"><li>Host list item</li></ul>
    <nibblearn-module id="m">
      <p>Fallback: CTR is clicks divided by impressions.</p>
      <script type="application/json">${JSON.stringify(config)}</script>
    </nibblearn-module>
  </body></html>`);
  await page.addStyleTag({ path: dist("styles.css") });
  await page.addScriptTag({ path: dist("nibblearn.global.js") });

  const module = page.locator("#m [data-nb-module='true-false']");
  await expect(module).toBeVisible();
  await expect(page.getByText(/^Fallback/)).toHaveCount(0);

  const events = page.evaluate(
    () =>
      new Promise<string>((resolve) =>
        document
          .getElementById("m")!
          .addEventListener("nibblearn:complete", (e) =>
            resolve((e as CustomEvent).detail.moduleId),
          ),
      ),
  );
  await module.getByRole("button", { name: /Mark as true/ }).click();
  await module.getByRole("button", { name: /Finish|Continue/ }).click();
  expect(await events).toBe("tf");

  // The host page keeps its own list styles.
  expect(
    await page.locator("#host-list").evaluate((el) => getComputedStyle(el).listStyleType),
  ).toBe("disc");
  expect(
    await page.evaluate(
      () => typeof (window as unknown as { Nibblearn?: { hydrate?: unknown } }).Nibblearn?.hydrate,
    ),
  ).toBe("function");
  expect(errors).toEqual([]);
});
