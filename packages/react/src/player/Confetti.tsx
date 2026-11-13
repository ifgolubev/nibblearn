import { useMemo } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const COLORS = [
  "var(--nb-accent)",
  "var(--nb-success)",
  "var(--nb-warning)",
  "var(--nb-info)",
  "var(--nb-danger)",
];

/** Lightweight, original celebration: a handful of falling pieces. Skipped with reduced motion. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (i / count) * 100 + (((i * 37) % 10) - 5),
        delay: ((i * 53) % 40) / 100,
        duration: 1.6 + ((i * 29) % 10) / 10,
        rotate: ((i * 71) % 360) - 180,
        color: COLORS[i % COLORS.length]!,
        scale: 0.7 + ((i * 13) % 6) / 10,
      })),
    [count],
  );
  if (reduced) return null;
  return (
    <div className="nb-confetti" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="nb-confetti__piece"
          style={{ left: `${p.x}%`, background: p.color }}
          initial={{ y: -20, opacity: 0, rotate: 0, scale: p.scale }}
          animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: p.rotate * 2 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
