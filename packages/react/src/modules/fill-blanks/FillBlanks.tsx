import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion } from "motion/react";
import { Check, Lightbulb, X } from "lucide-react";
import clsx from "clsx";
import {
  attemptScore,
  buildWordBank,
  evaluateFillBlanks,
  fillBlanksSchema,
  parseTemplate,
  type Blank,
  type FillBlanksConfig,
  type FillBlanksEvaluation,
  type WordBankEntry,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { Explanation } from "../../primitives/Explanation";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./fill-blanks.css";

export type FillBlanksProps = ModuleProps<FillBlanksConfig>;

export function FillBlanks({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: FillBlanksProps) {
  const parsed = useMemo(() => fillBlanksSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="fill-blanks"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <FillBlanksLifecycle
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function FillBlanksLifecycle({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: FillBlanksProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "fill-blanks",
    onComplete,
    onEvent,
    resetKey,
  });
  // Keying the body on runId resets every piece of local state on reset/retry.
  return (
    <FillBlanksBody
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface BodyProps {
  config: FillBlanksConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

type SlotState = "empty" | "filled" | "selected" | "correct" | "incorrect";

function FillBlanksBody({ config, life, hideHeader, className }: BodyProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { content, behavior } = config;
  const isBank = behavior.mode === "word-bank";

  const segments = useMemo(() => parseTemplate(content.template), [content.template]);
  const blankOrder = useMemo(
    () => segments.filter((s) => s.kind === "blank").map((s) => s.id),
    [segments],
  );
  const blankById = useMemo(() => new Map(content.blanks.map((b) => [b.id, b])), [content.blanks]);
  const bank = useMemo<WordBankEntry[]>(
    () =>
      buildWordBank(content.blanks, content.distractors, {
        shuffle: behavior.shuffleBank,
        seed: 17 + life.runId * 131,
      }),
    [content.blanks, content.distractors, behavior.shuffleBank, life.runId],
  );
  const chipById = useMemo(() => new Map(bank.map((c) => [c.id, c])), [bank]);
  const longestAnswer = useMemo(
    () =>
      Math.max(
        6,
        ...content.blanks.flatMap((b) => b.answers.map((a) => a.length)),
        ...content.distractors.map((d) => d.length),
      ),
    [content.blanks, content.distractors],
  );

  // Word-bank: blankId -> chipId. Typed: blankId -> text.
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [selectedBlank, setSelectedBlank] = useState<string | null>(null);
  const [openHints, setOpenHints] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<FillBlanksEvaluation | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const slotRefs = useRef(new Map<string, HTMLButtonElement | HTMLInputElement>());
  const checkRef = useRef<HTMLButtonElement>(null);

  const answers = useMemo<Record<string, string | undefined>>(() => {
    const out: Record<string, string | undefined> = {};
    for (const id of blankOrder) {
      out[id] = isBank ? chipById.get(placed[id] ?? "")?.text : typed[id];
    }
    return out;
  }, [blankOrder, isBank, chipById, placed, typed]);

  const allFilled = blankOrder.every((id) => (answers[id] ?? "").trim().length > 0);
  const checked = evaluation !== null;
  const usedChipIds = useMemo(() => new Set(Object.values(placed)), [placed]);

  const focusSlot = useCallback((id: string | null) => {
    requestAnimationFrame(() => {
      if (id) slotRefs.current.get(id)?.focus();
      else checkRef.current?.focus();
    });
  }, []);

  const nextEmpty = useCallback(
    (map: Record<string, string>, after?: string) => {
      const start = after ? blankOrder.indexOf(after) + 1 : 0;
      const ordered = [...blankOrder.slice(start), ...blankOrder.slice(0, start)];
      return ordered.find((id) => !map[id]) ?? null;
    },
    [blankOrder],
  );

  const placeChip = useCallback(
    (chipId: string) => {
      if (checked || locked || usedChipIds.has(chipId)) return;
      const target = selectedBlank && !placed[selectedBlank] ? selectedBlank : nextEmpty(placed);
      if (!target) return;
      const next = { ...placed, [target]: chipId };
      setPlaced(next);
      setSelectedBlank(null);
      life.emit("module:interact", { blankId: target, word: chipById.get(chipId)?.text });
      focusSlot(nextEmpty(next, target));
    },
    [checked, locked, usedChipIds, selectedBlank, placed, nextEmpty, life, chipById, focusSlot],
  );

  const onSlotClick = useCallback(
    (id: string) => {
      if (locked) return;
      if (placed[id]) {
        if (checked && evaluation?.blanks[id]) return; // keep correct words after a check
        const next = { ...placed };
        delete next[id];
        setPlaced(next);
        setSelectedBlank(id);
        if (checked) setEvaluation(null);
        life.emit("module:interact", { blankId: id, removed: true });
        return;
      }
      setSelectedBlank((prev) => (prev === id ? null : id));
    },
    [locked, placed, checked, evaluation, life],
  );

  const toggleHint = useCallback(
    (id: string) => {
      setOpenHints((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        life.emit("module:hint", { blankId: id });
        return [...prev, id];
      });
    },
    [life],
  );

  const check = useCallback(() => {
    if (!allFilled || checked || locked) return;
    const ev = evaluateFillBlanks(content.blanks, answers, {
      caseSensitive: behavior.caseSensitive,
      lenient: behavior.lenient,
    });
    const n = attempts + 1;
    setAttempts(n);
    life.attempt();
    setEvaluation(ev);
    setSelectedBlank(null);
    const exhausted = behavior.maxAttempts > 0 && n >= behavior.maxAttempts;
    const done = ev.correct || !behavior.allowRetry || exhausted;
    life.emit("module:answer", {
      answers,
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? t("a11y.correctAnswer")
        : `${t("a11y.incorrectAnswer")} ${t("fill.correctCount", { correct: ev.correctCount, total: content.blanks.length })}`,
    );
    if (done) {
      const score = ev.correct ? Math.max(0.5, attemptScore(n)) : ev.score * attemptScore(n);
      setLocked(true);
      setFinalScore(score);
      life.complete({
        score,
        correct: ev.correctCount,
        total: content.blanks.length,
        details: { answers, attempts: n },
      });
      announce(t("a11y.moduleComplete"));
    }
  }, [allFilled, checked, locked, content.blanks, answers, behavior, attempts, life, announce, t]);

  const retry = useCallback(() => {
    if (!evaluation) return;
    const wrong = blankOrder.filter((id) => !evaluation.blanks[id]);
    if (isBank) {
      const next = { ...placed };
      for (const id of wrong) delete next[id];
      setPlaced(next);
    } else {
      const next = { ...typed };
      for (const id of wrong) next[id] = "";
      setTyped(next);
    }
    setEvaluation(null);
    setSelectedBlank(null);
    focusSlot(wrong[0] ?? null);
  }, [evaluation, blankOrder, isBank, placed, typed, focusSlot]);

  const onInputKey = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (checked && !locked) retry();
        else check();
      }
    },
    [check, checked, locked, retry],
  );

  const slotState = (id: string): SlotState => {
    const filled = (answers[id] ?? "").trim().length > 0;
    if (checked && evaluation) return evaluation.blanks[id] ? "correct" : "incorrect";
    if (selectedBlank === id && !filled) return "selected";
    return filled ? "filled" : "empty";
  };

  const total = content.blanks.length;
  const tone = evaluation
    ? evaluation.correct
      ? "correct"
      : evaluation.correctCount > 0
        ? "partial"
        : "incorrect"
    : "info";
  const feedbackTitle = evaluation
    ? evaluation.correct
      ? t("fill.allCorrect")
      : t("fill.correctCount", { correct: evaluation.correctCount, total })
    : "";
  const feedbackText = evaluation
    ? evaluation.correct
      ? (config.feedback.correct ?? undefined)
      : (config.feedback.incorrect ?? (!locked ? t("common.tryAgainLater") : undefined))
    : undefined;

  const renderSlot = (blank: Blank, index: number) => {
    const id = blank.id;
    const state = slotState(id);
    const text = answers[id] ?? "";
    const invalid = state === "incorrect";
    const showAnswer = locked && invalid;
    const hintOpen = openHints.includes(id);
    const chipId = placed[id];
    return (
      <span className="nb-fill__slot-wrap" data-state={state}>
        {isBank ? (
          <button
            ref={(el) => {
              if (el) slotRefs.current.set(id, el);
              else slotRefs.current.delete(id);
            }}
            type="button"
            className="nb-fill__slot"
            data-state={state}
            aria-label={
              text
                ? `${t("fill.blank", { index })}: ${text}. ${t("fill.removeWord")}`
                : t("fill.blank", { index })
            }
            aria-pressed={state === "selected"}
            aria-invalid={invalid || undefined}
            disabled={locked}
            onClick={() => onSlotClick(id)}
            style={{ ["--_ch" as string]: `${longestAnswer}ch` }}
          >
            {chipId ? (
              <motion.span
                className="nb-fill__word"
                layoutId={reduced ? undefined : `${life.runId}-${chipId}`}
              >
                {text}
              </motion.span>
            ) : (
              <span className="nb-fill__placeholder" aria-hidden>
                {index}
              </span>
            )}
            {(state === "correct" || state === "incorrect") && (
              <span className="nb-fill__mark" aria-hidden>
                {state === "correct" ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
              </span>
            )}
          </button>
        ) : (
          <span
            className="nb-fill__slot nb-fill__slot--input"
            data-state={state}
            style={{ ["--_ch" as string]: `${longestAnswer}ch` }}
          >
            <input
              ref={(el) => {
                if (el) slotRefs.current.set(id, el);
                else slotRefs.current.delete(id);
              }}
              className="nb-fill__input"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={t("fill.blank", { index })}
              aria-invalid={invalid || undefined}
              placeholder={t("fill.typeAnswer")}
              value={text}
              disabled={locked || (checked && state === "correct")}
              readOnly={checked && !locked && state === "incorrect"}
              onChange={(e) => {
                setTyped((prev) => ({ ...prev, [id]: e.target.value }));
              }}
              onKeyDown={onInputKey}
            />
            {(state === "correct" || state === "incorrect") && (
              <span className="nb-fill__mark" aria-hidden>
                {state === "correct" ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
              </span>
            )}
          </span>
        )}
        {blank.hint && !locked && (
          <button
            type="button"
            className="nb-fill__hint-btn"
            aria-label={`${t("common.hint")}: ${t("fill.blank", { index })}`}
            aria-expanded={hintOpen}
            onClick={() => toggleHint(id)}
          >
            <Lightbulb aria-hidden />
          </button>
        )}
        {showAnswer && (
          <span className="nb-fill__answer">{t("fill.answer", { answer: blank.answers[0]! })}</span>
        )}
      </span>
    );
  };

  return (
    <ModuleShell
      type="fill-blanks"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("fill.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        <span className="nb-counter">
          {t("common.item", {
            current: blankOrder.filter((id) => (answers[id] ?? "").trim()).length,
            total,
          })}
        </span>
      }
    >
      <p
        className={clsx("nb-fill__text", locked && "nb-fill__text--locked")}
        data-mode={behavior.mode}
      >
        {segments.map((seg, i) => {
          if (seg.kind === "text") return <RichText key={i} text={seg.value} />;
          const blank = blankById.get(seg.id);
          if (!blank) return null;
          return (
            <Fragment key={`${seg.id}-${i}`}>
              {renderSlot(blank, blankOrder.indexOf(seg.id) + 1)}
            </Fragment>
          );
        })}
      </p>

      {openHints.length > 0 && !locked && (
        <ul className="nb-fill__hints">
          {blankOrder.map((id, i) => {
            const blank = blankById.get(id);
            if (!blank?.hint || !openHints.includes(id)) return null;
            return (
              <motion.li
                key={id}
                className="nb-fill__hint"
                role="note"
                initial={reduced ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
              >
                <Lightbulb aria-hidden />
                <span>
                  <strong>{t("fill.blank", { index: i + 1 })}</strong> ·{" "}
                  <RichText text={blank.hint} />
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}

      {isBank && !locked && (
        <div className="nb-fill__bank" role="group" aria-label={t("fill.wordBank")}>
          <div className="nb-fill__bank-label">{t("fill.wordBank")}</div>
          <div className="nb-fill__chips">
            {bank.map((chip) => {
              const used = usedChipIds.has(chip.id);
              return (
                <span key={chip.id} className="nb-fill__chip-cell">
                  {used ? (
                    <span className="nb-fill__chip nb-fill__chip--ghost" aria-hidden>
                      {chip.text}
                    </span>
                  ) : (
                    <motion.button
                      type="button"
                      className="nb-fill__chip"
                      layoutId={reduced ? undefined : `${life.runId}-${chip.id}`}
                      disabled={checked || !nextEmpty(placed)}
                      onClick={() => placeChip(chip.id)}
                      whileTap={reduced ? undefined : { scale: 0.96 }}
                    >
                      {chip.text}
                    </motion.button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <AnimatedFeedback show={checked} tone={tone} title={feedbackTitle} text={feedbackText} />

      {locked && behavior.showExplanation && <Explanation text={content.explanation} />}

      {!locked && (
        <div className="nb-fill__footer">
          <span className="nb-muted nb-text-sm">
            {!checked &&
              !allFilled &&
              t("common.remaining", {
                count: blankOrder.filter((id) => !(answers[id] ?? "").trim()).length,
              })}
          </span>
          <div className="nb-module__actions">
            {checked ? (
              <Button variant="primary" onClick={retry} autoFocus>
                {t("common.retry")}
              </Button>
            ) : (
              <Button ref={checkRef} variant="primary" onClick={check} disabled={!allFilled}>
                {t("common.check")}
              </Button>
            )}
          </div>
        </div>
      )}

      {locked && evaluation && (
        <CompletionCard
          score={finalScore}
          passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
          text={config.feedback.complete ?? undefined}
          stats={[
            { label: t("common.correct"), value: `${evaluation.correctCount}/${total}` },
            { label: t("common.attempts"), value: attempts },
          ]}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        />
      )}
    </ModuleShell>
  );
}

export default FillBlanks;
