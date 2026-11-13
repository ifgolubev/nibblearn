import clsx from "clsx";
import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "danger" | "warning" | "info";
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx("nb-badge", tone !== "neutral" && `nb-badge--${tone}`, className)}
      {...rest}
    />
  );
}
