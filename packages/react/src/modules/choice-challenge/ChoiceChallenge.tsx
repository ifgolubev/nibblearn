import { useCallback, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import {
  choiceChallengeSchema,
  choiceReviewSchema,
  evaluateChoice,
  questionMode,
  withOptionIds,
  type ChoiceChallengeConfig,
  type ChoiceEvaluation,
  type ChoiceOptionWithId,
  type ChoiceQuestion,
  type ChoiceReview,
  type ChoiceReviewInput,
  type ChoiceReviewItem,
} from "@nibblearn/core";
import { shuffle } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { runKey } from "../runKey";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useFocusSync } from "../../hooks/useFocusSync";
import * as G from "../../hooks/stateGuards";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Badge } from "../../primitives/Badge";
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

export interface ChoiceChallengeProps extends ModuleProps<ChoiceChallengeConfig> {
  /**
   * External evaluation (`behavior.evaluation: "external"`): called once, when the learner
   * submits, with the selected option ids of every question in config order. The same data
   * is in `onComplete` as `details.responses`.
   */
  onSubmit?: (responses: string[][]) => void;
  /**
   * Show a graded attempt, read-only, instead of the questions: what the learner chose, the
   * correct options and the explanations. Nothing is emitted or completed in this view.
   */
  review?: ChoiceReviewInput | null;
}

interface QuestionRecord {
  score: number;
  correct: boolean;
  attempts: number;
  /** Option ids of the final answer. */
  selected: string[];
}

const optionIdList = G.arrayOf(G.str, 8);

const LETTERS = "ABCDEFGH";

export function ChoiceChallenge({ config: rawConfig, review, ...rest }: ChoiceChallengeProps) {
  const parsed = useMemo(() => choiceChallengeSchema.safeParse(rawConfig), [rawConfig]);
  const parsedReview = useMemo(
    () => (review == null ? null : choiceReviewSchema.safeParse(review)),
    [review],
  );
  if (!parsed.success) {
    return (
      <InvalidModule
        type="choice-challenge"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  if (parsedReview) {
    if (!parsedReview.success) {
      return (
        <InvalidModule
          type="choice-challenge"
          issues={parsedReview.error.issues.map((i) => ({
            path: ["review", ...i.path].join("."),
            message: i.message,
          }))}
        />
      );
    }
    return (
      <ChoiceReviewView
        config={parsed.data}
        review={parsedReview.data}
        hideHeader={rest.hideHeader}
        className={rest.className}
      />
    );
  }
  return <ChoiceChallengeInner config={parsed.data} {...rest} />;
}

/** Owns the lifecycle; every reset remounts ChoiceChallengeRun with fresh state (keyed by runId). */
function ChoiceChallengeInner(props: ChoiceChallengeProps) {
  const { config, onComplete, onEvent, resetKey, initialState, onStateChange, mode, focus } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "choice-challenge",
    onComplete,
    onEvent,
    resetKey,
    config,
    initialState,
    onStateChange,
    mode,
    focus,
  });
  return config.behavior.evaluation === "external" ? (
    <ChoiceExternalRun key={runKey(life, config)} {...props} life={life} />
  ) : (
    <ChoiceChallengeRun key={runKey(life, config)} {...props} life={life} />
  );
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

  // Progress is saved in the state snapshot (initialState / onStateChange).
  const [index, setIndex] = usePersistedState(life, "index", 0, G.int(0, questions.length - 1));
  const question = questions[index]!;
  const mode = questionMode(question);
  const options = useMemo<ChoiceOptionWithId[]>(() => {
    const withIds = withOptionIds(question, index);
    return behavior.shuffleOptions ? shuffle(withIds, index + life.runId * 101 + 7) : withIds;
  }, [question, index, behavior.shuffleOptions, life.runId]);

  const [selected, setSelected] = usePersistedState<string[]>(
    life,
    "selected",
    [],
    G.arrayOf(G.oneOf(options.map((o) => o.id)), 8),
  );
  const [checkedSaved, setChecked] = usePersistedState(life, "checked", false, G.bool);
  const [revealed, setRevealed] = usePersistedState(life, "revealed", false, G.bool);
  const [records, setRecords] = usePersistedState<QuestionRecord[]>(
    life,
    "records",
    [],
    G.arrayOf(
      G.shape<QuestionRecord>({
        score: G.range(0, 1),
        correct: G.bool,
        attempts: G.int(0, 100_000),
        // Sessions saved before answers were recorded have no selection.
        selected: (raw) => (raw === undefined ? [] : optionIdList(raw)),
      }),
      questions.length,
    ),
  );
  const [qAttempts, setQAttempts] = usePersistedState(life, "qAttempts", 0, G.int(0, 100_000));
  const [finished, setFinished] = usePersistedState(life, "finished", false, G.bool);
  useFocusSync(life, ["content", "questions"], questions.length, (i) => {
    setIndex(i);
    setSelected([]);
    setChecked(false);
    setRevealed(false);
    setFinished(false);
  });
  const optionsRef = useRef<HTMLDivElement>(null);

  // The evaluation is derived from the selection, so restoring the selection restores it too.
  const evaluation = useMemo<ChoiceEvaluation | null>(
    () =>
      checkedSaved && selected.length
        ? evaluateChoice(options, selected, { partialCredit: behavior.partialCredit })
        : null,
    [checkedSaved, selected, options, behavior.partialCredit],
  );
  const checked = evaluation !== null;
  const locked = evaluation !== null && (evaluation.correct || revealed);

  const toggle = useCallback(
    (id: string) => {
      if (checked) return;
      setSelected((prev) => {
        if (mode === "single") return prev.includes(id) ? [] : [id];
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
      life.emit("module:interact", { action: "select", questionIndex: index, optionId: id });
    },
    [checked, mode, life, index, setSelected],
  );

  const check = useCallback(() => {
    if (selected.length === 0 || checked) return;
    const ev = evaluateChoice(options, selected, { partialCredit: behavior.partialCredit });
    const attempts = qAttempts + 1;
    setQAttempts(attempts);
    life.attempt();
    setChecked(true);
    const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
    const willReveal = ev.correct || !behavior.allowRetry || exhausted;
    setRevealed(willReveal);
    life.emit("module:answer", {
      questionIndex: index,
      itemIndex: index,
      selected,
      response: selected,
      correct: ev.correct,
      score: ev.score,
      attempts,
    });
    announce(ev.correct ? t("a11y.correctAnswer") : t("a11y.incorrectAnswer"));
  }, [
    selected,
    checked,
    options,
    behavior,
    qAttempts,
    life,
    index,
    announce,
    t,
    setQAttempts,
    setChecked,
    setRevealed,
  ]);

  const retry = useCallback(() => {
    setChecked(false);
    setSelected([]);
    setRevealed(false);
    requestAnimationFrame(() =>
      optionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }, [setChecked, setSelected, setRevealed]);

  const next = useCallback(() => {
    if (!evaluation) return;
    const record: QuestionRecord = {
      score: evaluation.correct ? 1 : evaluation.score,
      correct: evaluation.correct,
      attempts: qAttempts,
      selected,
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
      life.complete({
        score,
        correct,
        total,
        details: { records: nextRecords, responses: nextRecords.map((r) => r.selected) },
      });
      announce(t("a11y.moduleComplete"));
      return;
    }
    setIndex(index + 1);
    setSelected([]);
    setChecked(false);
    setRevealed(false);
    setQAttempts(0);
  }, [
    evaluation,
    selected,
    qAttempts,
    records,
    index,
    questions.length,
    life,
    announce,
    t,
    setRecords,
    setFinished,
    setIndex,
    setSelected,
    setChecked,
    setRevealed,
    setQAttempts,
  ]);

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
                    autoFocus={life.autoFocus}
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

/** Image, mode label, prompt and context of one question. */
function QuestionHead({
  question,
  mode,
  headingId,
}: {
  question: ChoiceQuestion;
  /** Omit to hide the "select one / all that apply" instruction (read-only views). */
  mode?: "single" | "multiple";
  headingId: string;
}) {
  const { t } = useNibblearn();
  return (
    <>
      {question.image && <SafeImage media={question.image} className="nb-choice__image" />}
      <div>
        {mode && (
          <div className="nb-choice__mode">
            {mode === "single" ? t("choice.selectOne") : t("choice.selectMany")}
          </div>
        )}
        <h3 className="nb-choice__prompt" id={headingId}>
          <RichText text={question.prompt} />
        </h3>
        {question.context && (
          <p className="nb-choice__context">
            <RichText text={question.context} />
          </p>
        )}
      </div>
    </>
  );
}

/**
 * External evaluation: the config has no correct answers. The learner answers every question
 * (and may go back), then submits once; the host grades the responses.
 */
function ChoiceExternalRun({
  life,
  config,
  hideHeader,
  className,
  onSubmit,
}: ChoiceChallengeProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { questions } = config.content;
  const { behavior } = config;

  const [index, setIndex] = usePersistedState(life, "index", 0, G.int(0, questions.length - 1));
  /** Selected option ids per question. */
  const [responses, setResponses] = usePersistedState<string[][]>(
    life,
    "responses",
    [],
    G.arrayOf(optionIdList, questions.length),
  );
  const [finished, setFinished] = usePersistedState(life, "finished", false, G.bool);
  useFocusSync(life, ["content", "questions"], questions.length, (i) => {
    setIndex(i);
    setFinished(false);
  });

  const question = questions[index]!;
  const mode = questionMode(question);
  const options = useMemo<ChoiceOptionWithId[]>(() => {
    const withIds = withOptionIds(question, index);
    return behavior.shuffleOptions ? shuffle(withIds, index + life.runId * 101 + 7) : withIds;
  }, [question, index, behavior.shuffleOptions, life.runId]);
  const selected = useMemo(
    () => (responses[index] ?? []).filter((id) => options.some((o) => o.id === id)),
    [responses, index, options],
  );
  const isLast = index + 1 >= questions.length;
  // Preview (editors) never blocks on unanswered questions.
  const canAdvance = life.preview || selected.length > 0;

  const toggle = useCallback(
    (id: string) => {
      if (finished) return;
      setResponses((prev) => {
        const next = questions.map((_, i) => prev[i] ?? []);
        const current = next[index]!;
        next[index] =
          mode === "single"
            ? current.includes(id)
              ? []
              : [id]
            : current.includes(id)
              ? current.filter((x) => x !== id)
              : [...current, id];
        return next;
      });
      life.emit("module:interact", { action: "select", questionIndex: index, optionId: id });
    },
    [finished, setResponses, questions, index, mode, life],
  );

  const next = useCallback(() => {
    if (finished || !canAdvance) return;
    life.emit("module:answer", {
      questionIndex: index,
      itemIndex: index,
      selected,
      response: selected,
    });
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    // Only ids that exist in the config are handed over.
    const all = questions.map((q, i) => {
      const valid = new Set(withOptionIds(q, i).map((o) => o.id));
      return (responses[i] ?? []).filter((id) => valid.has(id));
    });
    life.attempt();
    setFinished(true);
    life.complete({ details: { evaluation: "external", responses: all } });
    if (!life.preview) onSubmit?.(all);
    announce(t("choice.submitted"));
  }, [
    finished,
    canAdvance,
    life,
    index,
    selected,
    isLast,
    setIndex,
    questions,
    responses,
    setFinished,
    onSubmit,
    announce,
    t,
  ]);

  const back = useCallback(() => {
    if (finished || index === 0) return;
    setIndex(index - 1);
  }, [finished, index, setIndex]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toUpperCase();
      const li = LETTERS.indexOf(key);
      const ni = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const i = key.length === 1 ? (li >= 0 ? li : ni) : -1;
      if (i >= 0 && i < options.length) {
        e.preventDefault();
        toggle(options[i]!.id);
      } else if (
        e.key === "Enter" &&
        (!(target instanceof HTMLButtonElement) || target.classList.contains("nb-option"))
      ) {
        e.preventDefault();
        next();
      }
    },
    [finished, options, toggle, next],
  );

  if (finished) {
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
          title={t("choice.submitted")}
          text={config.feedback.complete ?? t("choice.submittedText")}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        />
      </ModuleShell>
    );
  }

  const hasImages = options.some((o) => o.image);
  const headingId = `${config.id}-q${index}`;
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
          <ProgressBar value={index / questions.length} showLabel={false} size="sm" />
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
          <QuestionHead question={question} mode={mode} headingId={headingId} />
          <div
            className={["nb-choice__options", hasImages && "nb-choice__options--images"]
              .filter(Boolean)
              .join(" ")}
            role={mode === "single" ? "radiogroup" : "group"}
            aria-labelledby={headingId}
          >
            {options.map((o, i) => (
              <OptionCard
                key={o.id}
                text={o.text}
                image={o.image}
                shortcut={LETTERS[i]}
                multiple={mode === "multiple"}
                state={selected.includes(o.id) ? "selected" : "idle"}
                onClick={() => toggle(o.id)}
                className={hasImages ? "nb-option--image-grid" : undefined}
              />
            ))}
          </div>

          <Hint
            text={question.hint}
            onReveal={() => life.emit("module:hint", { questionIndex: index })}
          />

          <div className="nb-choice__footer">
            <Button
              variant="ghost"
              onClick={back}
              disabled={index === 0}
              leading={<ArrowLeft aria-hidden />}
            >
              {t("common.back")}
            </Button>
            <div className="nb-module__actions">
              <Button
                variant="primary"
                onClick={next}
                disabled={!canAdvance}
                trailing={
                  isLast ? <Check aria-hidden strokeWidth={3} /> : <ArrowRight aria-hidden />
                }
              >
                {isLast ? t("choice.submit") : t("common.next")}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </ModuleShell>
  );
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Read-only view of a graded attempt. */
function ChoiceReviewView({
  config,
  review,
  hideHeader,
  className,
}: {
  config: ChoiceChallengeConfig;
  review: ChoiceReview;
  hideHeader?: boolean;
  className?: string;
}) {
  const { questions } = config.content;
  return (
    <ModuleShell
      type="choice-challenge"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      appearance={config.appearance}
      className={className}
    >
      <ol className="nb-choice__review">
        {questions.map((q, i) => (
          <li key={i} className="nb-choice__review-item">
            <ReviewQuestion
              question={q}
              index={i}
              total={questions.length}
              item={review.items[i]}
              headingId={`${config.id}-review-q${i}`}
            />
          </li>
        ))}
      </ol>
    </ModuleShell>
  );
}

function ReviewQuestion({
  question,
  index,
  total,
  item,
  headingId,
}: {
  question: ChoiceQuestion;
  index: number;
  total: number;
  item: ChoiceReviewItem | undefined;
  headingId: string;
}) {
  const { t } = useNibblearn();
  const options = withOptionIds(question, index);
  // Ids that are not options of this question are ignored.
  const selected = (item?.selected ?? []).filter((id) => options.some((o) => o.id === id));
  const local = options.filter((o) => o.correct).map((o) => o.id);
  // Correct options come from the host; a locally checked config can supply them too.
  const correctIds = item?.correct ?? (local.length > 0 ? local : null);
  const verdict =
    item?.isCorrect ??
    (correctIds
      ? selected.length === correctIds.length && selected.every((id) => correctIds.includes(id))
      : undefined);
  const answered = selected.length > 0;
  const mode =
    question.mode ?? ((correctIds?.length ?? 0) > 1 || selected.length > 1 ? "multiple" : "single");
  const hasImages = options.some((o) => o.image);

  const stateFor = (id: string): OptionState => {
    const isSelected = selected.includes(id);
    if (correctIds) {
      const isCorrect = correctIds.includes(id);
      if (isSelected) return isCorrect ? "correct" : "incorrect";
      return isCorrect ? "missed" : "idle";
    }
    if (!isSelected) return "idle";
    return verdict === undefined ? "selected" : verdict ? "correct" : "incorrect";
  };
  const explanationFor = (o: ChoiceOptionWithId) => {
    const fromHost = item?.optionExplanations;
    return fromHost && own(fromHost, o.id) ? fromHost[o.id] : o.explanation;
  };

  return (
    <section className="nb-choice__question" aria-labelledby={headingId}>
      <div className="nb-choice__review-head">
        <span className="nb-counter">{t("choice.question", { current: index + 1, total })}</span>
        {!answered ? (
          <Badge>{t("choice.notAnswered")}</Badge>
        ) : verdict === undefined ? null : (
          <Badge tone={verdict ? "success" : "danger"}>
            {verdict ? <Check aria-hidden /> : <X aria-hidden />}
            {verdict ? t("common.correct") : t("common.incorrect")}
          </Badge>
        )}
      </div>
      <QuestionHead question={question} headingId={headingId} />
      <div
        className={["nb-choice__options", hasImages && "nb-choice__options--images"]
          .filter(Boolean)
          .join(" ")}
        role={mode === "single" ? "radiogroup" : "group"}
        aria-labelledby={headingId}
      >
        {options.map((o, i) => (
          <OptionCard
            key={o.id}
            text={o.text}
            image={o.image}
            shortcut={LETTERS[i]}
            multiple={mode === "multiple"}
            state={stateFor(o.id)}
            explanation={explanationFor(o)}
            disabled
            className={hasImages ? "nb-option--image-grid" : undefined}
          >
            {(selected.includes(o.id) || correctIds?.includes(o.id)) && (
              <span className="nb-sr-only">
                {selected.includes(o.id) && ` (${t("choice.yourAnswer")})`}
                {correctIds?.includes(o.id) && ` (${t("choice.correctAnswer")})`}
              </span>
            )}
          </OptionCard>
        ))}
      </div>
      <Explanation text={item?.explanation ?? question.explanation} />
    </section>
  );
}

export default ChoiceChallenge;
