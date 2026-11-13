import { forwardRef, type HTMLAttributes } from "react";
import clsx from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "soft";
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padded = true, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "nb-card",
        variant !== "default" && `nb-card--${variant}`,
        padded && "nb-card--padded",
        className,
      )}
      {...rest}
    />
  );
});
