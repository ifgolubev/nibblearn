import { describe, expect, it } from "vitest";
import {
  accentTextColors,
  contrastRatio,
  parseCssColor,
  readableTextColor,
  relativeLuminance,
} from "../src";

describe("parseCssColor", () => {
  it.each([
    ["#fff", { r: 255, g: 255, b: 255 }],
    ["#000F", { r: 0, g: 0, b: 0 }],
    ["#3b5bdb", { r: 59, g: 91, b: 219 }],
    ["#3B5BDB80", { r: 59, g: 91, b: 219 }],
    ["rgb(1, 2, 3)", { r: 1, g: 2, b: 3 }],
    ["rgba(10,20,30,0.5)", { r: 10, g: 20, b: 30 }],
    ["rgb(10 20 30 / 50%)", { r: 10, g: 20, b: 30 }],
    ["rgb(100%, 0%, 50%)", { r: 255, g: 0, b: 127.5 }],
    ["  #ABC  ", { r: 170, g: 187, b: 204 }],
  ])("%s", (value, rgb) => {
    expect(parseCssColor(value)).toEqual(rgb);
  });

  it.each([
    "red",
    "hsl(0 100% 50%)",
    "oklch(0.7 0.1 250)",
    "#12",
    "#12345",
    "rgb(1, 2)",
    "rgb(a, b, c)",
    "",
  ])("rejects %j", (value) => {
    expect(parseCssColor(value)).toBeNull();
  });
});

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21);
    expect(contrastRatio({ r: 59, g: 91, b: 219 }, { r: 255, g: 255, b: 255 })).toBeGreaterThan(
      4.5,
    );
  });

  it.each([
    ["#facc15", "#0c0c0f"],
    ["#fde047", "#0c0c0f"],
    ["#ffffff", "#0c0c0f"],
    ["#3b5bdb", "#ffffff"],
    ["#0f172a", "#ffffff"],
    ["#dc2626", "#ffffff"],
    ["#91a7ff", "#0c0c0f"],
  ])("text on %s is %s", (bg, fg) => {
    expect(readableTextColor(bg)).toBe(fg);
  });

  it("returns null for colours it cannot parse", () => {
    expect(readableTextColor("rebeccapurple")).toBeNull();
  });
});

describe("accentTextColors", () => {
  const bg = (hex: string, accent: string, t: number) => {
    const a = parseCssColor(accent)!;
    const b = parseCssColor(hex)!;
    return { r: b.r + (a.r - b.r) * t, g: b.g + (a.g - b.g) * t, b: b.b + (a.b - b.b) * t };
  };
  it.each(["#facc15", "#a3e635", "#22d3ee", "#3b5bdb", "#7f1d1d", "#ffffff", "#000000"])(
    "%s is readable on soft accent backgrounds in both themes",
    (accent) => {
      const c = accentTextColors(accent)!;
      expect(
        contrastRatio(parseCssColor(c.light)!, bg("#ffffff", accent, 0.08)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(parseCssColor(c.dark)!, bg("#131316", accent, 0.14)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
  it("returns null for unparsable colours", () => {
    expect(accentTextColors("var(--x)")).toBeNull();
  });
});
