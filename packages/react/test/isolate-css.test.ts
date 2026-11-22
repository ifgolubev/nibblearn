import { describe, expect, it } from "vitest";
// @ts-expect-error build script without type declarations
import { boostSelector, isolateCss } from "../../../scripts/isolate-css.mjs";

const boost = boostSelector as (selector: string) => string;
const isolate = isolateCss as (css: string) => string;

describe("styles.isolated.css generator", () => {
  it("raises every selector by one id of specificity", () => {
    expect(boost(".nb-btn")).toBe(".nb-btn:not(#\\#)");
    expect(boost(":where(.nb-root) :where(p)")).toBe(":where(.nb-root) :where(p):not(#\\#)");
    expect(boost('.nb-root[data-nb-theme="dark"] .nb-card:hover')).toBe(
      '.nb-root[data-nb-theme="dark"] .nb-card:hover:not(#\\#)',
    );
  });

  it("keeps pseudo-elements at the end of the selector", () => {
    expect(boost(".nb-btn::before")).toBe(".nb-btn:not(#\\#)::before");
    expect(boost(".nb-range::-webkit-slider-thumb:hover")).toBe(
      ".nb-range:not(#\\#)::-webkit-slider-thumb:hover",
    );
    expect(boost(":where(.nb-root) ::selection")).toBe(":where(.nb-root) :not(#\\#)::selection");
    expect(boost("a:after")).toBe("a:not(#\\#):after");
  });

  it("leaves token definitions alone so themes still override them", () => {
    const out = isolate(
      ".nb-root { --nb-accent: #3b5bdb; --nb-radius: 8px }\n.nb-root { color: var(--nb-fg) }",
    );
    expect(out).toContain(".nb-root { --nb-accent: #3b5bdb; --nb-radius: 8px }");
    expect(out).toContain(".nb-root:not(#\\#) { color: var(--nb-fg) }");

    const mixed = isolate(".nb-root { --nb-bg: #fff; color-scheme: light; --nb-fg: #111 }");
    expect(mixed.replace(/\s+/g, " ").replace(/ ?}/g, " }")).toContain(
      ".nb-root { --nb-bg: #fff; --nb-fg: #111 } .nb-root:not(#\\#) { color-scheme: light }",
    );
  });

  it("changes selectors only: declarations, media queries and keyframes stay as they are", () => {
    const out = isolate(
      [
        ".a, .b::after { color: red }",
        "@media (min-width: 10px) { .c { margin: 0 } }",
        "@container nb (min-width: 640px) { .d { gap: 1px } }",
        "@keyframes nb-x { from { opacity: 0 } 50% { opacity: 0.5 } to { opacity: 1 } }",
      ].join("\n"),
    );
    expect(out).toContain(".a:not(#\\#), .b:not(#\\#)::after { color: red }");
    expect(out).toContain("@media (min-width: 10px) { .c:not(#\\#) { margin: 0 } }");
    expect(out).toContain("@container nb (min-width: 640px) { .d:not(#\\#) { gap: 1px } }");
    expect(out).toContain(
      "@keyframes nb-x { from { opacity: 0 } 50% { opacity: 0.5 } to { opacity: 1 } }",
    );
  });

  it("starts with a rule that sends unset properties back to browser defaults", () => {
    const out = isolate(".nb-btn { color: red }");
    const revert = out.indexOf("all: revert");
    expect(revert).toBeGreaterThan(-1);
    // Before the library's own rules, so every one of them still applies.
    expect(revert).toBeLessThan(out.indexOf(".nb-btn:not(#\\#)"));
    const selector = out.slice(0, out.indexOf("{"));
    // Zero specificity apart from the boost: any class rule of the library is stronger.
    expect(selector).toContain(":where(.nb-root) :where(");
    // Host elements with their own classes and SVG presentation attributes are left alone.
    expect(selector).toContain('[class^="nb-"]');
    expect(selector).toContain(":not(svg, svg *)");
    // The `hidden` attribute keeps working.
    expect(out).toMatch(/\[hidden\][^{]*\{\s*display: none/);
    // So does `draggable`, which Chromium and Safari apply through a style.
    expect(out).toMatch(/\[draggable="false"\][^{]*\{\s*-webkit-user-drag: none/);
    expect(out).toMatch(/\[draggable="true"\][^{]*\{\s*-webkit-user-drag: element/);
  });
});
