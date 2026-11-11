import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "./Button";
import { RichText } from "./RichText";
import { useTranslator } from "../context/NibblearnProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface HintProps {
  text?: string;
  /** Called the first time the hint is revealed. */
  onReveal?: () => void;
  className?: string;
}

export function Hint({ text, onReveal, className }: HintProps) {
  const t = useTranslator();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className={["nb-hint", className].filter(Boolean).join(" ")}>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        leading={<Lightbulb aria-hidden />}
        onClick={() => {
          if (!open) onReveal?.();
          setOpen((o) => !o);
        }}
      >
        {open ? t("common.hideHint") : t("common.showHint")}
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="nb-hint__body"
            role="note"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <Lightbulb aria-hidden />
            <RichText text={text} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
