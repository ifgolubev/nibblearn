import { type ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./Button";
import { RichText } from "./RichText";
import { useTranslator } from "../context/NibblearnProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface CompletionCardProps {
  title?: string;
  /** Supports inline markup. */
  text?: string;
  /** 0–1. When provided a score ring is shown. */
  score?: number;
  /** Threshold for the "pass" styling. */
  passThreshold?: number;
  stats?: { label: string; value: ReactNode }[];
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Shared completion state used at the end of every module. */
export function CompletionCard({
  title,
  text,
  score,
  passThreshold = 0.7,
  stats,
  onRetry,
  retryLabel,
  actions,
  className,
  children,
}: CompletionCardProps) {
  const t = useTranslator();
  const reduced = useReducedMotion();
  const hasScore = typeof score === "number";
  const pct = hasScore ? Math.round(Math.max(0, Math.min(1, score)) * 100) : 100;
  const pass = !hasScore || score >= passThreshold;
  const [drawn, setDrawn] = useState(reduced);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(id);
  }, []);
  const r = 48;
  const c = 2 * Math.PI * r;

  const heading = title ?? (pass ? t("common.wellDone") : t("common.keepGoing"));

  return (
    <motion.div
      className={clsx("nb-complete", pass && "nb-complete--pass", className)}
      role="status"
      initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      {hasScore ? (
        <div className="nb-complete__ring" aria-label={t("common.scorePercent", { percent: pct })}>
          <svg viewBox="0 0 112 112" aria-hidden>
            <circle className="nb-ring-track" cx="56" cy="56" r={r} />
            <circle
              className="nb-ring-value"
              cx="56"
              cy="56"
              r={r}
              strokeDasharray={c}
              strokeDashoffset={drawn ? c * (1 - pct / 100) : c}
            />
          </svg>
          <div className="nb-complete__ring-label">{pct}%</div>
        </div>
      ) : (
        <motion.div
          className="nb-complete__icon"
          initial={reduced ? false : { scale: 0.85, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.1 }}
        >
          <Check aria-hidden strokeWidth={3} />
        </motion.div>
      )}
      <h3 className="nb-complete__title">{heading}</h3>
      {text && (
        <p className="nb-complete__text">
          <RichText text={text} />
        </p>
      )}
      {stats && stats.length > 0 && (
        <dl className="nb-complete__stats">
          {stats.map((s) => (
            <div className="nb-stat" key={s.label}>
              <dd className="nb-stat__value">{s.value}</dd>
              <dt className="nb-stat__label">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}
      {children}
      {(onRetry || actions) && (
        <div className="nb-complete__actions">
          {onRetry && (
            <Button variant="secondary" onClick={onRetry} leading={<RotateCcw aria-hidden />}>
              {retryLabel ?? t("common.retry")}
            </Button>
          )}
          {actions}
        </div>
      )}
    </motion.div>
  );
}
