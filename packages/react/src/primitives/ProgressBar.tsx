import clsx from "clsx";
import { useTranslator } from "../context/NibblearnProvider";

export interface ProgressBarProps {
  /** 0–1 */
  value: number;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  tone?: "accent" | "success";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showLabel = true,
  size = "md",
  tone = "accent",
  className,
}: ProgressBarProps) {
  const t = useTranslator();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={clsx(
        "nb-progress",
        size === "sm" && "nb-progress--sm",
        tone === "success" && "nb-progress--success",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label ?? t("common.progress")}
    >
      <div className="nb-progress__track">
        <div className="nb-progress__bar" style={{ ["--_w" as string]: `${pct}%` }} />
      </div>
      {showLabel && <span className="nb-progress__label">{pct}%</span>}
    </div>
  );
}

export interface StepDotsProps {
  total: number;
  current: number;
  className?: string;
  label?: string;
}

export function StepDots({ total, current, className, label }: StepDotsProps) {
  const t = useTranslator();
  return (
    <div
      className={clsx("nb-dots", className)}
      role="img"
      aria-label={label ?? t("common.step", { current: current + 1, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="nb-dots__dot"
          data-state={i === current ? "active" : i < current ? "done" : "todo"}
        />
      ))}
    </div>
  );
}
