import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, Check, Shuffle, X } from "lucide-react";
import { trueFalseSchema, shuffle, type Statement, type TrueFalseConfig } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Badge } from "../../primitives/Badge";
import { ProgressBar } from "../../primitives/ProgressBar";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./true-false.css";

export type TrueFalseProps = ModuleProps<TrueFalseConfig>;

interface Answer {
  choice: boolean;
  correct: boolean;
}

const SWIPE_THRESHOLD = 100;
const EASE = [0.2, 0.8, 0.2, 1] as const;

export function TrueFalse({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: TrueFalseProps) {
  const parsed = useMemo(() => trueFalseSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="true-false"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <TrueFalseInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts TrueFalseRun with fresh state (keyed by runId). */
function TrueFalseInner(props: TrueFalseProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "true-false",
    onComplete,
    onEvent,
    resetKey,
  });
  return <TrueFalseRun key={life.runId} {...props} life={life} />;
}

function TrueFalseRun({
  life,
  config,
  hideHeader,
  className,
}: TrueFalseProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { statements } = config.content;
  const { behavior } = config;
  const total = statements.length;

  const order = useMemo(() => {
    const ids = statements.map((_, i) => i);
    return behavior.shuffle ? shuffle(ids, life.runId * 53 + 11) : ids;
  }, [statements, behavior.shuffle, life.runId]);

  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Keyed by statement index. */
  const [records, setRecords] = useState<Record<number, Answer>>({});
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  // After advancing, keep focus inside the module so keyboard shortcuts keep working
  // (the Continue / decision buttons that held focus have just been removed or disabled).
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    stackRef.current?.focus({ preventScroll: true });
  }, [pos]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const stIndex = order[pos]!;
  const statement = statements[stIndex]!;
  const nextStatement = pos + 1 < total ? statements[order[pos + 1]!] : undefined;
  const correctCount = Object.values(records).filter((r) => r.correct).length;

  const advance = useCallback(
    (nextRecords: Record<number, Answer>) => {
      if (pos + 1 >= total) {
        const correct = Object.values(nextRecords).filter((r) => r.correct).length;
        setFinished(true);
        life.complete({
          score: correct / total,
          correct,
          total,
          details: { answers: nextRecords },
        });
        announce(t("a11y.moduleComplete"));
        return;
      }
      setPos(pos + 1);
      setAnswer(null);
      pendingFocus.current = true;
    },
    [pos, total, life, announce, t],
  );

  const continueNext = useCallback(() => {
    if (!answer) return;
    advance(records);
  }, [answer, advance, records]);

  const decide = useCallback(
    (choice: boolean, via: "button" | "swipe" | "key") => {
      if (answer || finished) return;
      const correct = choice === statement.isTrue;
      const a: Answer = { choice, correct };
      const nextRecords = { ...records, [stIndex]: a };
      setAnswer(a);
      setRecords(nextRecords);
      life.attempt();
      life.emit("module:answer", { statementIndex: stIndex, choice, correct, via });
      announce(correct ? t("a11y.correctAnswer") : t("a11y.incorrectAnswer"));
      if (!behavior.showExplanation) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => advance(nextRecords), reduced ? 200 : 700);
      }
    },
    [
      answer,
      finished,
      statement.isTrue,
      records,
      stIndex,
      life,
      announce,
      t,
      behavior.showExplanation,
      reduced,
      advance,
    ],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toUpperCase();
      if (key === "ARROWLEFT" || key === "F") {
        e.preventDefault();
        decide(false, "key");
      } else if (key === "ARROWRIGHT" || key === "T") {
        e.preventDefault();
        decide(true, "key");
      } else if (
        e.key === "Enter" &&
        answer &&
        behavior.showExplanation &&
        !(target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        continueNext();
      }
    },
    [finished, decide, answer, behavior.showExplanation, continueNext],
  );

  const restart = () => {
    life.reset();
    life.emit("module:reset");
  };

  if (finished) {
    return (
      <ModuleShell
        type="true-false"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={correctCount / total}
          passThreshold={config.scoring.passThreshold}
          text={config.feedback.complete ?? t("tf.summary", { correct: correctCount, total })}
          stats={[
            { label: t("common.correct"), value: `${correctCount}/${total}` },
            { label: t("common.incorrect"), value: total - correctCount },
          ]}
          onRetry={restart}
        >
          <ul className="nb-tf__summary-list">
            {order.map((si) => {
              const s = statements[si]!;
              const r = records[si];
              return (
                <li
                  key={si}
                  className="nb-tf__summary-item"
                  data-ok={r?.correct ? "true" : "false"}
                >
                  {r?.correct ? (
                    <Check aria-label={t("common.correct")} strokeWidth={3} />
                  ) : (
                    <X aria-label={t("common.incorrect")} strokeWidth={3} />
                  )}
                  <span className="nb-tf__summary-text">
                    <RichText text={s.text} />
                  </span>
                  <Badge tone={s.isTrue ? "success" : "danger"}>
                    {s.isTrue ? behavior.trueLabel : behavior.falseLabel}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CompletionCard>
      </ModuleShell>
    );
  }

  const exitDir = answer ? (answer.choice ? 1 : -1) : 0;

  return (
    <ModuleShell
      type="true-false"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      eyebrow={
        total > 1 ? <ProgressBar value={pos / total} showLabel={false} size="sm" /> : undefined
      }
      aside={<span className="nb-counter">{t("tf.statement", { current: pos + 1, total })}</span>}
      onKeyDown={onKeyDown}
    >
      <div className="nb-tf">
        <div
          className="nb-tf__stack"
          ref={stackRef}
          tabIndex={-1}
          role="group"
          aria-label={t("tf.statement", { current: pos + 1, total })}
        >
          {nextStatement && (
            <div
              className="nb-tf__card nb-tf__card--peek"
              aria-hidden
              key={`peek-${life.runId}-${pos + 1}`}
            >
              <div className="nb-tf__card-head">
                {nextStatement.tag && <Badge>{nextStatement.tag}</Badge>}
              </div>
              <p className="nb-tf__text">
                <RichText text={nextStatement.text} />
              </p>
            </div>
          )}
          <AnimatePresence mode="popLayout" initial={false} custom={exitDir}>
            <StatementCard
              key={`${life.runId}-${pos}`}
              statement={statement}
              answer={answer}
              swipe={behavior.swipe && !answer}
              trueLabel={behavior.trueLabel}
              falseLabel={behavior.falseLabel}
              reduced={reduced}
              onDecide={(c) => decide(c, "swipe")}
            />
          </AnimatePresence>
        </div>

        <div className="nb-tf__actions">
          <Button
            variant="secondary"
            size="lg"
            className="nb-tf__btn nb-tf__btn--false"
            onClick={() => decide(false, "button")}
            disabled={Boolean(answer)}
            aria-label={`${t("tf.markFalse")}: ${behavior.falseLabel}`}
            leading={<X aria-hidden strokeWidth={3} />}
            data-chosen={answer?.choice === false ? "true" : "false"}
          >
            {behavior.falseLabel}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="nb-tf__btn nb-tf__btn--true"
            onClick={() => decide(true, "button")}
            disabled={Boolean(answer)}
            aria-label={`${t("tf.markTrue")}: ${behavior.trueLabel}`}
            leading={<Check aria-hidden strokeWidth={3} />}
            data-chosen={answer?.choice === true ? "true" : "false"}
          >
            {behavior.trueLabel}
          </Button>
        </div>

        {!answer && (behavior.swipe || behavior.shuffle) && (
          <p className="nb-tf__hint nb-subtle nb-text-xs">
            {behavior.swipe ? t("tf.swipeHint") : null}
            {behavior.shuffle && (
              <span className="nb-tf__hint-shuffle">
                <Shuffle aria-hidden />
                {t("flash.shuffle")}
              </span>
            )}
          </p>
        )}

        <div className="nb-tf__feedback">
          <AnimatedFeedback
            show={Boolean(answer)}
            tone={answer?.correct ? "correct" : "incorrect"}
            title={answer?.correct ? t("common.correct") : t("common.incorrect")}
            text={behavior.showExplanation ? statement.explanation : undefined}
          />
          {answer && behavior.showExplanation && (
            <div className="nb-module__actions">
              <Button
                variant="primary"
                onClick={continueNext}
                trailing={<ArrowRight aria-hidden />}
                autoFocus
              >
                {pos + 1 >= total ? t("common.finish") : t("common.continue")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

interface StatementCardProps {
  statement: Statement;
  answer: Answer | null;
  swipe: boolean;
  trueLabel: string;
  falseLabel: string;
  reduced: boolean;
  onDecide: (choice: boolean) => void;
}

// forwardRef: AnimatePresence mode="popLayout" measures its child through this ref
// (required on React 18, and for the pop-out layout to work at all).
const StatementCard = forwardRef<HTMLDivElement, StatementCardProps>(function StatementCard(
  { statement, answer, swipe, trueLabel, falseLabel, reduced, onDecide },
  ref,
) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-9, 0, 9]);
  const trueOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const falseOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) onDecide(true);
    else if (info.offset.x < -SWIPE_THRESHOLD) onDecide(false);
  };

  return (
    <motion.div
      ref={ref}
      className="nb-tf__card"
      data-answer={answer ? (answer.correct ? "correct" : "incorrect") : undefined}
      data-swipe={swipe ? "true" : "false"}
      style={{ x, rotate }}
      drag={swipe ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, cursor: "grabbing" }}
      variants={{
        enter: reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 },
        center: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: (dir: number) =>
          reduced ? { opacity: 0 } : { opacity: 0, x: dir * 420, rotate: dir * 10, scale: 0.96 },
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
    >
      <div className="nb-tf__card-head">
        {statement.tag ? <Badge>{statement.tag}</Badge> : <span />}
        {answer && (
          <span className="nb-tf__mark" data-ok={answer.correct ? "true" : "false"} aria-hidden>
            {answer.correct ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
          </span>
        )}
      </div>
      {statement.image && (
        <SafeImage media={statement.image} className="nb-tf__image" showCaption={false} />
      )}
      <p className="nb-tf__text">
        <RichText text={statement.text} />
      </p>
      <motion.span
        className="nb-tf__stamp nb-tf__stamp--true"
        aria-hidden
        style={{ opacity: trueOpacity }}
        animate={answer ? { opacity: answer.choice ? 1 : 0 } : undefined}
        transition={{ duration: reduced ? 0 : 0.15 }}
      >
        <Check strokeWidth={3} />
        {trueLabel}
      </motion.span>
      <motion.span
        className="nb-tf__stamp nb-tf__stamp--false"
        aria-hidden
        style={{ opacity: falseOpacity }}
        animate={answer ? { opacity: answer.choice ? 0 : 1 } : undefined}
        transition={{ duration: reduced ? 0 : 0.15 }}
      >
        <X strokeWidth={3} />
        {falseLabel}
      </motion.span>
    </motion.div>
  );
});

export default TrueFalse;
