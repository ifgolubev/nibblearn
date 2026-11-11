import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { RichText } from "./RichText";
import type { Media } from "@nibblearn/core";

export type OptionState = "idle" | "selected" | "correct" | "incorrect" | "missed";

export interface OptionCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  text: string;
  state?: OptionState;
  /** Keyboard shortcut label (e.g. "A"). */
  shortcut?: string;
  image?: Media;
  explanation?: string;
  /** For multiple choice: render a checkbox-like key. */
  multiple?: boolean;
  children?: ReactNode;
}

/** Large tactile answer card used by choice-style modules. */
export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(function OptionCard(
  { text, state = "idle", shortcut, image, explanation, multiple, className, children, ...rest },
  ref,
) {
  const showMark = state === "correct" || state === "incorrect" || state === "missed";
  const role = multiple ? "checkbox" : "radio";
  return (
    <button
      ref={ref}
      type="button"
      role={role}
      aria-checked={
        state === "selected" || state === "correct" || state === "incorrect" ? true : false
      }
      className={clsx("nb-option", image && "nb-option--with-image", className)}
      data-state={state}
      {...rest}
    >
      {shortcut && (
        <span className="nb-option__key" aria-hidden>
          {state === "selected" && multiple ? <Check strokeWidth={3} /> : shortcut}
        </span>
      )}
      {image && (
        <img className="nb-option__image" src={image.src} alt={image.alt} draggable={false} />
      )}
      <span className="nb-option__text">
        <RichText text={text} />
      </span>
      {children}
      {showMark && (
        <span className="nb-option__mark" aria-hidden>
          {state === "incorrect" ? <X strokeWidth={3} /> : <Check strokeWidth={3} />}
        </span>
      )}
      {explanation && showMark && (
        <span className="nb-option__explanation">
          <RichText text={explanation} />
        </span>
      )}
    </button>
  );
});
