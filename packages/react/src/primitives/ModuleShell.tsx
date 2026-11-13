import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { Appearance, ValidationIssue } from "@nibblearn/core";
import { useNibblearn } from "../context/NibblearnProvider";
import { RichText } from "./RichText";
import { LiveRegion } from "./LiveRegion";

export interface ModuleShellProps {
  /** Module type, used for data attributes and styling hooks. */
  type: string;
  id: string;
  title?: string;
  instructions?: string;
  /** Small label above the title, e.g. the module category. */
  eyebrow?: ReactNode;
  /** Right-aligned header content, e.g. a counter. */
  aside?: ReactNode;
  appearance?: Appearance;
  /** Width preset. */
  width?: "default" | "wide" | "full";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Live region message for screen readers. */
  announcement?: string;
  style?: CSSProperties;
  /** Keyboard handler attached to the module root (for shortcuts). */
  onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * Common frame for every module: themed root, header, body, footer, live region.
 * Each module renders exactly one ModuleShell.
 */
export function ModuleShell({
  type,
  id,
  title,
  instructions,
  eyebrow,
  aside,
  appearance,
  width = "default",
  children,
  footer,
  className,
  announcement = "",
  style,
  onKeyDown,
}: ModuleShellProps) {
  const { theme, reducedMotion } = useNibblearn();
  const rootStyle: Record<string, string> = { ...(style as Record<string, string>) };
  if (appearance?.accent) rootStyle["--nb-accent"] = appearance.accent;
  const showHeader = !appearance?.hideHeader && (title || instructions || aside || eyebrow);
  return (
    <section
      className={clsx(
        "nb-root nb-module",
        `nb-module--${type}`,
        width !== "default" && `nb-module--${width}`,
        appearance?.compact && "nb-module--compact",
        className,
      )}
      data-nb-module={type}
      data-nb-module-id={id}
      data-nb-theme={theme}
      data-nb-motion={reducedMotion ? "reduced" : undefined}
      aria-labelledby={title ? `${id}-title` : undefined}
      style={rootStyle}
      onKeyDown={onKeyDown}
    >
      {showHeader && (
        <header className="nb-module__header">
          {(eyebrow || aside) && (
            <div className="nb-row nb-row--between">
              <div className="nb-module__eyebrow">{eyebrow}</div>
              {aside}
            </div>
          )}
          {title && (
            <h2 className="nb-module__title" id={`${id}-title`}>
              {title}
            </h2>
          )}
          {instructions && (
            <p className="nb-module__instructions">
              <RichText text={instructions} />
            </p>
          )}
        </header>
      )}
      <div className="nb-module__body">{children}</div>
      {footer && <footer className="nb-module__footer">{footer}</footer>}
      <LiveRegion message={announcement} />
    </section>
  );
}

/** Rendered when a module receives an invalid configuration. */
export function InvalidModule({ issues, type }: { issues: ValidationIssue[]; type?: string }) {
  const { t, theme } = useNibblearn();
  return (
    <div className="nb-root nb-invalid" role="alert" data-nb-theme={theme}>
      <div className="nb-invalid__title">
        <AlertTriangle aria-hidden size={18} />
        {t("common.invalidConfig")}
        {type && <code>{type}</code>}
      </div>
      <ul className="nb-invalid__list">
        {issues.slice(0, 8).map((i, idx) => (
          <li key={idx}>
            {i.path}: {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
