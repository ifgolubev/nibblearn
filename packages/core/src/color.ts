/** An sRGB colour with 0–255 channels. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp255 = (v: number) => Math.min(255, Math.max(0, v));

function channel(token: string): number | null {
  const t = token.trim();
  if (/^-?\d*\.?\d+%$/.test(t)) return clamp255((parseFloat(t) / 100) * 255);
  if (/^-?\d*\.?\d+$/.test(t)) return clamp255(parseFloat(t));
  return null;
}

/**
 * Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` (comma or space syntax).
 * Returns null for anything else (named colours, `hsl()`, `oklch()`…); alpha is ignored.
 */
export function parseCssColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)?.[1];
  if (hex) {
    const full =
      hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join("") : hex.slice(0, 6);
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(v)?.[1];
  if (fn) {
    const [rgbPart] = fn.split("/");
    const parts = rgbPart!.includes(",")
      ? rgbPart!.split(",").slice(0, 3)
      : rgbPart!.trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const [r, g, b] = parts.map(channel);
    if (r == null || g == null || b == null) return null;
    return { r, g, b };
  }
  return null;
}

/** WCAG 2 relative luminance (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio between two colours (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const NEAR_BLACK: Rgb = { r: 12, g: 12, b: 15 };

/**
 * The text colour (white or Nibblearn's near-black) with more contrast on `background`, or
 * null when the colour cannot be parsed (see `parseCssColor`).
 */
export function readableTextColor(background: string): "#ffffff" | "#0c0c0f" | null {
  const bg = parseCssColor(background);
  if (!bg) return null;
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, NEAR_BLACK) ? "#ffffff" : "#0c0c0f";
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(clamp255(v)).toString(16).padStart(2, "0")).join("")}`;

/**
 * Accent-coloured text for soft accent backgrounds, readable (≥ 4.5:1) in the light and the
 * dark theme: the accent is darkened (light) or lightened (dark) only as far as needed.
 * Returns null when the colour cannot be parsed.
 */
export function accentTextColors(accent: string): { light: string; dark: string } | null {
  const base = parseCssColor(accent);
  if (!base) return null;
  const pick = (towards: Rgb, background: Rgb, start: number) => {
    for (let t = start; t <= 1; t += 0.04) {
      const c = mix(base, towards, t);
      if (contrastRatio(c, background) >= 4.5) return toHex(c);
    }
    return toHex(towards);
  };
  // Soft backgrounds: about 8% accent on white (light), 14% accent on #131316 (dark).
  const lightBg = mix({ r: 255, g: 255, b: 255 }, base, 0.08);
  const darkBg = mix({ r: 19, g: 19, b: 22 }, base, 0.14);
  return {
    light: pick({ r: 0, g: 0, b: 0 }, lightBg, 0.16),
    dark: pick({ r: 255, g: 255, b: 255 }, darkBg, 0.48),
  };
}
