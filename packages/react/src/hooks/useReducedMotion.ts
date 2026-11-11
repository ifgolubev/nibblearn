import { useReducedMotion as useMotionReducedMotion } from "motion/react";
import { useNibblearn } from "../context/NibblearnProvider";

/** True when animations should be minimised (OS preference or provider override). */
export function useReducedMotion(): boolean {
  const os = useMotionReducedMotion();
  const { reducedMotion } = useNibblearn();
  return Boolean(reducedMotion || os);
}
