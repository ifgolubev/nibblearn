import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";
import {
  choiceChallengeSchema,
  evaluateChoice,
  questionMode,
  withOptionIds,
  type ChoiceChallengeConfig,
  type ChoiceEvaluation,
  type ChoiceOptionWithId,
} from "@nibblearn/core";
import { shuffle } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { OptionCard, type OptionState } from "../../primitives/OptionCard";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { Explanation } from "../../primitives/Explanation";
import { Hint } from "../../primitives/Hint";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./choice-challenge.css";

export type ChoiceChallengeProps = ModuleProps<ChoiceChallengeConfig>;

interface QuestionRecord {
  score: number;
  correct: boolean;
  attempts: number;
}

const LETTERS = "ABCDEFGH";

export function ChoiceChallenge({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: ChoiceChallengeProps) {
  const parsed = useMemo(() => choiceChallengeSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="choice-challenge"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <ChoiceChallengeInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts ChoiceChallengeRun with fresh state (keyed by runId). */
function ChoiceChallengeInner(props: ChoiceChallengeProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "choice-challenge",
    onComplete,
    onEvent,
    resetKey,
  });
  return <ChoiceChallengeRun key={life.runId} {...props} life={life} />;
}

function ChoiceChallengeRun({
  life,
  config,
  hideHeader,
  className,
}: ChoiceChallengeProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { questions } = config.content;
  const { behavior } = config;

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<ChoiceEvaluation | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [qAttempts, setQAttempts] = useState(0);
  const [finished, setFinished] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const question = questions[index]!;
  const mode = questionMode(question);
  const options = useMemo<ChoiceOptionWithId[]>(() => {
    const withIds = withOptionIds(question, index);
    return behavior.shuffleOptions ? shuffle(withIds, index + life.runId * 101 + 7) : withIds;
  }, [question, index, behavior.shuffleOptions, life.runId]);

  const checked = evaluation !== null;
  const locked = checked && (evaluation.correct || revealed);

  const toggle = useCallback(
    (id: string) => {
      if (checked) return;
      setSelected((prev) => {
        if (mode === "single") return prev.includes(id) ? [] : [id];
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
      life.emit("module:interact", { questionIndex: index, optionId: id });
    },
    [checked, mode, life, index],
  );

  const check = useCallback(() => {
    if (selected.length === 0 || checked) return;
    const ev = evaluateChoice(options, selected, { partialCredit: behavior.partialCredit });
    const attempts = qAttempts + 1;
    setQAttempts(attempts);
    life.attempt();
    setEvaluation(ev);
    const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
    const willReveal = ev.correct || !behavior.allowRetry || exhausted;
    setRevealed(willReveal);
    life.emit("module:answer", {
      questionIndex: index,
      selected,
      correct: ev.correct,
      score: ev.score,
      attempts,
    });
    announce(ev.correct ? t("a11y.correctAnswer") : t("a11y.incorrectAnswer"));
  }, [selected, checked, options, behavior, qAttempts, life, index, announce, t]);

  const retry = useCallback(() => {
    setEvaluation(null);
    setSelected([]);
    setRevealed(false);
    requestAnimationFrame(() =>
      optionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }, []);

  const next = useCallback(() => {
    if (!evaluation) return;
    const record: QuestionRecord = {
      score: evaluation.correct ? 1 : evaluation.score,
      correct: evaluation.correct,
      attempts: qAttempts,
    };
    // Retried-to-correct answers earn reduced credit.
    if (evaluation.correct && qAttempts > 1)
      record.score = Math.max(0.5, 1 - (qAttempts - 1) * 0.25);
    const nextRecords = [...records, record];
    setRecords(nextRecords);
    if (index + 1 >= questions.length) {
      const total = questions.length;
      const correct = nextRecords.filter((r) => r.correct).length;
      const score = nextRecords.reduce((s, r) => s + r.score, 0) / total;
      setFinished(true);
      life.complete({ score, correct, total, details: { records: nextRecords } });
      announce(t("a11y.moduleComplete"));
      return;
    }
    setIndex(index + 1);
    setSelected([]);
    setEvaluation(null);
    setRevealed(false);
    setQAttempts(0);
  }, [evaluation, qAttempts, records, index, questions.length, life, announce, t]);

  // Keyboard shortcuts: letters/numbers select, Enter checks/advances.
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toUpperCase();
      const li = LETTERS.indexOf(key);
      const ni = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const i = key.length === 1 ? (li >= 0 ? li : ni) : -1;
      if (i >= 0 && i < options.length && !checked) {
        e.preventDefault();
        toggle(options[i]!.id);
      } else if (
        e.key === "Enter" &&
        (!(target instanceof HTMLButtonElement) || target.classList.contains("nb-option"))
      ) {
        e.preventDefault();
        if (!checked) check();
        else if (locked) next();
      }
    },
    [options, checked, locked, toggle, check, next, finished],
  );

  const stateFor = (o: ChoiceOptionWithId): OptionState => {
    const isSelected = selected.includes(o.id);
    if (!checked) return isSelected ? "selected" : "idle";
    if (locked) {
      if (o.correct && isSelected) return "correct";
      if (o.correct && !isSelected) return "missed";
      if (!o.correct && isSelected) return "incorrect";
      return "idle";
    }
    // Checked but retry allowed: only reveal wrong selections.
    if (isSelected && !o.correct) return "incorrect";
    if (isSelected && o.correct) return "correct";
    return "idle";
  };

  const tone = evaluation
    ? evaluation.correct
      ? "correct"
      : evaluation.score > 0 && behavior.partialCredit
        ? "partial"
        : "incorrect"
    : "info";
  const feedbackTitle = evaluation
    ? evaluation.correct
      ? t("common.correct")
      : tone === "partial"
        ? t("common.partiallyCorrect")
        : t("common.incorrect")
    : "";
  const feedbackText = evaluation
    ? evaluation.correct
      ? (config.feedback.correct ?? undefined)
      : (config.feedback.incorrect ?? (!locked ? t("common.tryAgainLater") : undefined))
    : undefined;

  const hasImages = options.some((o) => o.image);
  const progress = finished ? 1 : index / questions.length;

  if (finished) {
    const correct = records.filter((r) => r.correct).length;
    const score = records.reduce((s, r) => s + r.score, 0) / questions.length;
    return (
      <ModuleShell
        type="choice-challenge"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={score}
          passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
          text={
            config.feedback.complete ?? t("choice.summary", { correct, total: questions.length })
          }
          stats={[
            { label: t("common.correct"), value: `${correct}/${questions.length}` },
            { label: t("common.attempts"), value: records.reduce((s, r) => s + r.attempts, 0) },
          ]}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        >
          <ul className="nb-choice__summary-list">
            {questions.map((q, i) => (
              <li
                key={i}
                className="nb-choice__summary-item"
                data-ok={records[i]?.correct ? "true" : "false"}
              >
                {records[i]?.correct ? (
                  <Check aria-label={t("common.correct")} />
                ) : (
                  <X aria-label={t("common.incorrect")} />
                )}
                <RichText text={q.prompt} />
              </li>
            ))}
          </ul>
        </CompletionCard>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      type="choice-challenge"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        behavior.showCounter && questions.length > 1 ? (
          <span className="nb-counter">
            {t("choice.question", { current: index + 1, total: questions.length })}
          </span>
        ) : undefined
      }
      eyebrow={
        behavior.showCounter && questions.length > 1 ? (
          <ProgressBar value={progress} showLabel={false} size="sm" />
        ) : undefined
      }
      onKeyDown={onKeyDown}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${life.runId}-${index}`}
          className="nb-choice__question"
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {question.image && <SafeImage media={question.image} className="nb-choice__image" />}
          <div>
            <div className="nb-choice__mode">
              {mode === "single" ? t("choice.selectOne") : t("choice.selectMany")}
            </div>
            <h3 className="nb-choice__prompt" id={`${config.id}-q${index}`}>
              <RichText text={question.prompt} />
            </h3>
            {question.context && (
              <p className="nb-choice__context">
                <RichText text={question.context} />
              </p>
            )}
          </div>
          <div
            ref={optionsRef}
            className={["nb-choice__options", hasImages && "nb-choice__options--images"]
              .filter(Boolean)
              .join(" ")}
            role={mode === "single" ? "radiogroup" : "group"}
            aria-labelledby={`${config.id}-q${index}`}
          >
            {options.map((o, i) => (
              <OptionCard
                key={o.id}
                text={o.text}
                image={o.image}
                shortcut={LETTERS[i]}
                multiple={mode === "multiple"}
                state={stateFor(o)}
                explanation={locked ? o.explanation : undefined}
                disabled={locked}
                onClick={() => toggle(o.id)}
                className={hasImages ? "nb-option--image-grid" : undefined}
              />
            ))}
          </div>

          {!checked && (
            <Hint
              text={question.hint}
              onReveal={() => life.emit("module:hint", { questionIndex: index })}
            />
          )}

          <AnimatedFeedback show={checked} tone={tone} title={feedbackTitle} text={feedbackText}>
            {evaluation &&
              locked &&
              !evaluation.correct &&
              evaluation.missedIds.length > 0 &&
              mode === "multiple" && (
                <span>
                  {t("choice.youMissed", {
                    items: options
                      .filter((o) => evaluation.missedIds.includes(o.id))
                      .map((o) => o.text)
                      .join(", "),
                  })}
                </span>
              )}
          </AnimatedFeedback>

          {locked && behavior.showExplanation && <Explanation text={question.explanation} />}

          <div className="nb-choice__footer">
            <span className="nb-muted nb-text-sm">
              {!checked &&
                selected.length > 0 &&
                mode === "multiple" &&
                t("common.selected") + `: ${selected.length}`}
            </span>
            <div className="nb-module__actions">
              {checked && !locked && (
                <Button variant="secondary" onClick={retry}>
                  {t("common.retry")}
                </Button>
              )}
              {!checked ? (
                <Button variant="primary" onClick={check} disabled={selected.length === 0}>
                  {t("common.check")}
                </Button>
              ) : (
                locked && (
                  <Button
                    variant="primary"
                    onClick={next}
                    trailing={<ArrowRight aria-hidden />}
                    autoFocus
                  >
                    {index + 1 >= questions.length ? t("common.finish") : t("common.next")}
                  </Button>
                )
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </ModuleShell>
  );
}

export default ChoiceChallenge;
