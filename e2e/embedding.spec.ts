import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The CSS contract for embedding Nibblearn in a host page, checked on a plain page (the showcase
// uses Tailwind, whose preflight would hide regressions). The markup mirrors what
// NibblearnProvider and a module render; the React side is covered by unit tests.
const styles = ["tokens.css", "base.css", "primitives.css"].map((f) =>
  fileURLToPath(new URL(`../packages/react/src/styles/${f}`, import.meta.url)),
);

const host = (wrapper: boolean) => {
  const content = `
    <h2 id="host-heading">Lesson text</h2>
    <p id="host-p">A paragraph written by the host.</p>
    <ul id="host-list"><li>First point</li><li>Second point</li></ul>
    <button id="host-button">Host button</button>
    <section class="nb-root nb-module" data-nb-theme="light" style="--nb-accent: #ff0000">
      <button class="nb-btn nb-btn--primary" id="module-button">Check</button>
      <ul id="module-list"><li>Reset inside modules</li></ul>
      <div id="module-soft" style="background: var(--nb-accent-soft); color: var(--nb-accent-hover)">x</div>
    </section>`;
  return wrapper
    ? `<div class="nb-provider nb-theme" data-nb-theme="light" style="--nb-accent: #ff0000">${content}</div>`
    : content;
};

async function load(page: Page, wrapper: boolean) {
  // Durations become 0 under reduced motion, so colours are read without a transition.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"></head><body>${host(wrapper)}</body></html>`,
  );
  for (const path of styles) await page.addStyleTag({ path });
}

const css = (page: Page, selector: string, prop: string) =>
  page.locator(selector).evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** A computed colour as sRGB channels (browsers may report color-mix() results as oklab()). */
const rgbOf = (page: Page, selector: string, prop: string) =>
  page.locator(selector).evaluate((el, p) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.fillStyle = getComputedStyle(el).getPropertyValue(p);
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, prop);

for (const wrapper of [true, false]) {
  test(`host content keeps its styles ${wrapper ? "inside the provider wrapper" : "without a wrapper"}`, async ({
    page,
  }) => {
    await load(page, wrapper);
    expect(await css(page, "#host-list", "list-style-type")).toBe("disc");
    expect(await css(page, "#host-heading", "margin-top")).not.toBe("0px");
    expect(await css(page, "#host-p", "margin-top")).not.toBe("0px");
    expect(await css(page, "#host-button", "background-color")).not.toBe("rgba(0, 0, 0, 0)");
    // Inside a module the reset still applies.
    expect(await css(page, "#module-list", "list-style-type")).toBe("none");
    // The module uses the accent passed to it.
    expect(await css(page, "#module-button", "background-color")).toBe("rgb(255, 0, 0)");
    // Derived shades follow the custom accent (reddish, not the default blue).
    const [sr, sg, sb] = await rgbOf(page, "#module-soft", "background-color");
    expect(sr).toBeGreaterThan(sg!);
    expect(sr).toBeGreaterThan(sb!);
    const [hr, hg, hb] = await rgbOf(page, "#module-soft", "color");
    expect(hr).toBeGreaterThan(200);
    expect(Math.max(hg!, hb!)).toBeLessThan(40);
  });
}

test("the wrapper does not change the host colour scheme", async ({ page }) => {
  await page.setContent(
    `<!doctype html><html><body style="color-scheme: dark"><div class="nb-provider nb-theme" data-nb-theme="light"><p id="p">x</p></div></body></html>`,
  );
  for (const path of styles) await page.addStyleTag({ path });
  expect(await css(page, ".nb-provider", "color-scheme")).toBe("dark");
});
