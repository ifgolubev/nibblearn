import { type ReactNode } from "react";
import clsx from "clsx";
import { Check, Info, Lightbulb, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { RichText } from "./RichText";
import { useReducedMotion } from "../hooks/useReducedMotion";

export type FeedbackTone = "correct" | "incorrect" | "partial" | "info" | "neutral";

export interface FeedbackProps {
  tone: FeedbackTone;
  title?: ReactNode;
  /** Supports inline markup. */
  text?: string;
  children?: ReactNode;
  className?: string;
  /** Rendered as a live region so screen readers announce it. */
  live?: boolean;
}

const icons: Record<FeedbackTone, ReactNode> = {
  correct: <Check aria-hidden strokeWidth={3} />,
  incorrect: <X aria-hidden strokeWidth={3} />,
  partial: <Sparkles aria-hidden />,
  info: <Info aria-hidden />,
  neutral: <Lightbulb aria-hidden />,
};

export function Feedback({ tone, title, text, children, className, live = true }: FeedbackProps) {
  return (
    <div
      className={clsx("nb-feedback", `nb-feedback--${tone}`, className)}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <div className="nb-feedback__icon">{icons[tone]}</div>
      <div className="nb-feedback__body">
        {title && <div className="nb-feedback__title">{title}</div>}
        {text && (
          <div className="nb-feedback__text">
            <RichText text={text} />
          </div>
        )}
        {children && <div className="nb-feedback__text">{children}</div>}
      </div>
    </div>
  );
}

/** Feedback that animates in/out. Pass `null`/`undefined` props.tone to hide. */
export function AnimatedFeedback({ show, ...props }: FeedbackProps & { show: boolean }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key={props.tone}
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Feedback {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
