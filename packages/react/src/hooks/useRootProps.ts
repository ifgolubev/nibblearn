import type { CSSProperties } from "react";
import { accentTextColors, readableTextColor } from "@nibblearn/core";
import { useNibblearn, type ThemeMode } from "../context/NibblearnProvider";

export interface RootProps {
  /** Only when a provider sets the theme explicitly (see `NibblearnConfig.themeAttr`). */
  "data-nb-theme": ThemeMode | undefined;
  "data-nb-motion": "reduced" | undefined;
  style: CSSProperties;
}

/**
 * Attributes for an element with the `nb-root` class: theme, motion and the provider's design
 * tokens. Precedence: provider tokens < `extra.style` < `extra.accent` (a module's own accent).
 */
export function useRootProps(extra: { accent?: string; style?: CSSProperties } = {}): RootProps {
  const { themeAttr, reducedMotion, themeVars } = useNibblearn();
  const style: Record<string, unknown> = { ...themeVars, ...extra.style };
  if (extra.accent) {
    style["--nb-accent"] = extra.accent;
    // Without a parsable colour, keep the inherited text colour for the accent.
    const fg = readableTextColor(extra.accent);
    if (fg) style["--nb-accent-fg"] = fg;
    const soft = accentTextColors(extra.accent);
    style["--nb-accent-soft-fg-light"] = soft?.light;
    style["--nb-accent-soft-fg-dark"] = soft?.dark;
  }
  return {
    "data-nb-theme": themeAttr,
    "data-nb-motion": reducedMotion ? "reduced" : undefined,
    style: style as CSSProperties,
  };
}
