import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { NoLinks } from "./RichText";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "soft" | "ghost" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  /** Icon-only round button. Provide an aria-label. */
  icon?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    block,
    icon,
    leading,
    trailing,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "nb-btn",
        `nb-btn--${variant}`,
        size !== "md" && `nb-btn--${size}`,
        block && "nb-btn--block",
        icon && "nb-btn--icon",
        className,
      )}
      {...rest}
    >
      <NoLinks>
        {leading}
        {children}
        {trailing}
      </NoLinks>
    </button>
  );
});
