import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CircleX, Minus, Plus, Target, ThumbsUp } from "lucide-react";
import clsx from "clsx";
import {
  estimateAccuracy,
  estimateSchema,
  estimateStart,
  formatEstimate,
  formatEstimateDelta,
  snapEstimate,
  type EstimateAccuracy,
  type EstimateBand,
  type EstimateConfig,
  type EstimateQuestion,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { Explanation } from "../../primitives/Explanation";
import { Hint } from "../../primitives/Hint";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./estimate.css";

export type EstimateProps = ModuleProps<EstimateConfig>;

interface EstimateRecord {
  id?: string;
  guess: number;
  answer: number;
  band: EstimateBand;
  score: number;
}

const TICKS = 10;

const BAND_ICON: Record<EstimateBand, ReactNode> = {
  bullseye: <Target aria-hidden strokeWidth={2.5} />,
  close: <ThumbsUp aria-hidden strokeWidth={2.5} />,
  off: <CircleX aria-hidden strokeWidth={2.5} />,
};

export function Estimate({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: EstimateProps) {
  const parsed = useMemo(() => estimateSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="estimate"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <EstimateInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts EstimateRun with fresh state (keyed by runId). */
function EstimateInner(props: EstimateProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "estimate",
    onComplete,
    onEvent,
    resetKey,
  });
  return <EstimateRun key={life.runId} {...props} life={life} />;
}

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

function decimalsOf(step: number): number {
  const s = String(step);
  const e = s.indexOf("e-");
  if (e >= 0) return Number(s.slice(e + 2));
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

/** Percent questions are typed as percentages (2.8), stored as fractions (0.028). */
function inputScale(q: EstimateQuestion): number {
  return q.format === "percent" ? 100 : 1;
}

function toInputString(q: EstimateQuestion, value: number): string {
  const scale = inputScale(q);
  const digits = Math.max(0, decimalsOf(q.step) - (scale === 100 ? 2 : 0));
  return String(Number((value * scale).toFixed(Math.min(10, digits))));
}

function pctOf(q: EstimateQuestion, value: number): number {
  return Math.min(100, Math.max(0, ((value - q.min) / (q.max - q.min)) * 100));
}

/** Keep marker labels inside the scale near its edges. */
function alignFor(pct: number): "start" | "center" | "end" {
  return pct < 12 ? "start" : pct > 88 ? "end" : "center";
}

function useCurrencySymbol(currency: string): string {
  const { locale } = useNibblearn();
  return useMemo(() => {
    try {
      return (
        new Intl.NumberFormat(locale, { style: "currency", currency })
          .formatToParts(0)
          .find((p) => p.type === "currency")?.value ?? currency
      );
    } catch {
      return currency;
    }
  }, [currency, locale]);
}

/* ----------------------------------------------------------------------------
 * Reveal scale: guess marker, answer marker dropping in, band between them
 * -------------------------------------------------------------------------- */

function RevealScale({
  question,
  guess,
  band,
  format,
}: {
  question: EstimateQuestion;
  guess: number;
  band: EstimateBand;
  format: (v: number) => string;
}) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const g = pctOf(question, guess);
  const a = pctOf(question, question.answer);
  const left = Math.min(g, a);
  const width = Math.abs(g - a);
  return (
    <div className="nb-est__scale nb-est__scale--reveal" data-band={band}>
      <div className="nb-est__rail">
        <div className="nb-est__track" aria-hidden />
        <motion.div
          className="nb-est__band"
          aria-hidden
          style={
            {
              "--_l": left / 100,
              "--_w": width / 100,
              transformOrigin: a >= g ? "left center" : "right center",
            } as CSSProperties
          }
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduced ? 0 : 0.36, delay: reduced ? 0 : 0.28, ease: "easeOut" }}
        />
        <div
          className="nb-est__marker nb-est__marker--guess"
          data-align={alignFor(g)}
          style={{ "--_p": g / 100 } as CSSProperties}
        >
          <span className="nb-est__pin" aria-hidden />
          <span className="nb-est__marker-label">
            <span className="nb-est__marker-name">{t("estimate.yourGuess")}</span>{" "}
            <span className="nb-est__marker-value">{format(guess)}</span>
          </span>
        </div>
        <motion.div
          className="nb-est__marker nb-est__marker--answer"
          data-align={alignFor(a)}
          style={{ "--_p": a / 100 } as CSSProperties}
          initial={reduced ? false : { opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22, delay: 0.08 }
          }
        >
          <span className="nb-est__marker-label">
            <span className="nb-est__marker-name">{t("estimate.answer")}</span>{" "}
            <span className="nb-est__marker-value">{format(question.answer)}</span>
          </span>
          <span className="nb-est__pin" aria-hidden />
        </motion.div>
      </div>
      <div className="nb-est__range-meta" aria-hidden>
        <span>{format(question.min)}</span>
        <span>{format(question.max)}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * One question (keyed by index: fresh state per question)
 * -------------------------------------------------------------------------- */

interface QuestionViewProps {
  moduleId: string;
  question: EstimateQuestion;
  index: number;
  isLast: boolean;
  currency: string;
  focusOnMount: boolean;
  onLock: (guess: number, accuracy: EstimateAccuracy) => void;
  onNext: () => void;
  onHint: () => void;
}

function QuestionView({
  moduleId,
  question,
  index,
  isLast,
  currency,
  focusOnMount,
  onLock,
  onNext,
  onHint,
}: QuestionViewProps) {
  const { t, locale } = useNibblearn();
  const reduced = useReducedMotion();
  const symbol = useCurrencySymbol(currency);
  const initial = useMemo(() => estimateStart(question), [question]);
  const [guess, setGuess] = useState(initial);
  const [inputText, setInputText] = useState(() => toInputString(question, initial));
  const [result, setResult] = useState<EstimateAccuracy | null>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) sliderRef.current?.focus();
  }, [focusOnMount]);

  const format = useCallback(
    (v: number) => formatEstimate(question, v, { currency, locale }),
    [question, currency, locale],
  );

  const setValue = useCallback(
    (raw: number) => {
      const v = snapEstimate(question, raw);
      setGuess(v);
      setInputText(toInputString(question, v));
    },
    [question],
  );

  const commitInput = useCallback((): number => {
    const n = Number.parseFloat(inputText.replace(",", "."));
    if (!Number.isFinite(n)) {
      setInputText(toInputString(question, guess));
      return guess;
    }
    const v = snapEstimate(question, n / inputScale(question));
    setGuess(v);
    setInputText(toInputString(question, v));
    return v;
  }, [inputText, question, guess]);

  const lock = useCallback(
    (value: number = guess) => {
      if (result) return;
      const acc = estimateAccuracy(question, value);
      setGuess(value);
      setResult(acc);
      onLock(value, acc);
    },
    [result, guess, question, onLock],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      // Buttons (Lock in, Next, ± and hint) handle Enter themselves.
      if (target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (result) onNext();
      else if (target instanceof HTMLInputElement && target.type === "number") lock(commitInput());
      else lock();
    },
    [result, onNext, lock, commitInput],
  );

  const sliderId = `${moduleId}-q${index}-slider`;
  const inputId = `${moduleId}-q${index}-input`;
  const promptId = `${moduleId}-q${index}-prompt`;
  const pct = pctOf(question, guess);
  const scale = inputScale(question);
  const prefix = question.format === "currency" ? symbol : undefined;
  const suffix = question.format === "percent" ? "%" : question.unit;

  let deltaText = "";
  if (result) {
    const delta = formatEstimateDelta(question, result.delta, {
      currency,
      locale,
      pointsLabel: t("estimate.pp"),
    });
    const negligible = result.error <= question.step / 2 + 1e-12;
    deltaText = negligible
      ? t("estimate.exact")
      : result.delta > 0
        ? t("estimate.tooHigh", { delta })
        : t("estimate.tooLow", { delta });
  }

  return (
    <div className="nb-est__question" onKeyDown={onKeyDown}>
      <div className="nb-est__prompt-wrap">
        <h3 className="nb-est__prompt" id={promptId}>
          <RichText text={question.prompt} />
        </h3>
        {question.context && (
          <p className="nb-est__context">
            <RichText text={question.context} />
          </p>
        )}
      </div>

      <div className="nb-est__stage" data-state={result ? "revealed" : "guessing"}>
        <div className="nb-est__readout">
          {result ? (
            <span className="nb-est__readout-label">{t("estimate.yourEstimate")}</span>
          ) : (
            <label htmlFor={sliderId} className="nb-est__readout-label">
              {t("estimate.yourEstimate")}
            </label>
          )}
          <output htmlFor={result ? undefined : sliderId} className="nb-est__value" aria-live="off">
            {format(guess)}
          </output>
        </div>

        {result ? (
          <RevealScale question={question} guess={guess} band={result.band} format={format} />
        ) : (
          <div className="nb-est__scale">
            <div className="nb-est__control">
              <Button
                icon
                variant="secondary"
                className="nb-est__step"
                aria-label={t("estimate.decrease")}
                disabled={guess <= question.min}
                onClick={() => setValue(guess - question.step)}
              >
                <Minus aria-hidden />
              </Button>
              <div className="nb-est__rail">
                <input
                  ref={sliderRef}
                  id={sliderId}
                  type="range"
                  className="nb-est__range"
                  min={question.min}
                  max={question.max}
                  step={question.step}
                  value={guess}
                  aria-valuetext={format(guess)}
                  aria-describedby={promptId}
                  style={{ "--_pct": `${pct}%` } as CSSProperties}
                  onChange={(e) => setValue(Number(e.target.value))}
                />
                <div className="nb-est__ticks" aria-hidden>
                  {Array.from({ length: TICKS + 1 }, (_, i) => (
                    <span
                      key={i}
                      className={clsx("nb-est__tick", i % 5 === 0 && "nb-est__tick--major")}
                      style={{ "--_p": i / TICKS } as CSSProperties}
                    />
                  ))}
                </div>
              </div>
              <Button
                icon
                variant="secondary"
                className="nb-est__step"
                aria-label={t("estimate.increase")}
                disabled={guess >= question.max}
                onClick={() => setValue(guess + question.step)}
              >
                <Plus aria-hidden />
              </Button>
            </div>
            <div className="nb-est__range-meta" aria-hidden>
              <span>{format(question.min)}</span>
              <span>{format(question.max)}</span>
            </div>
          </div>
        )}
      </div>

      {!result && (
        <div className="nb-est__entry">
          <label htmlFor={inputId} className="nb-est__entry-label">
            {t("estimate.exactValue")}
          </label>
          <div className="nb-est__field">
            {prefix && (
              <span className="nb-est__affix" aria-hidden>
                {prefix}
              </span>
            )}
            <input
              id={inputId}
              type="number"
              inputMode="decimal"
              className="nb-est__input"
              min={question.min * scale}
              max={question.max * scale}
              step={Number((question.step * scale).toFixed(10))}
              value={inputText}
              aria-describedby={`${inputId}-range`}
              onChange={(e) => {
                setInputText(e.target.value);
                const n = Number.parseFloat(e.target.value.replace(",", "."));
                if (Number.isFinite(n)) setGuess(snapEstimate(question, n / scale));
              }}
              onBlur={() => commitInput()}
            />
            {suffix && (
              <span className="nb-est__affix" aria-hidden>
                {suffix}
              </span>
            )}
          </div>
          <span id={`${inputId}-range`} className="nb-est__entry-range">
            {t("estimate.range", { min: format(question.min), max: format(question.max) })}
          </span>
        </div>
      )}

      {!result && <Hint text={question.hint} onReveal={onHint} />}

      <AnimatePresence initial={false}>
        {result && (
          <motion.div
            key="result"
            className="nb-est__result"
            data-band={result.band}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.28, delay: reduced ? 0 : 0.3 }}
          >
            <div className="nb-est__verdict">
              <span className="nb-est__badge" data-band={result.band}>
                {BAND_ICON[result.band]}
                {t(`estimate.${result.band}`)}
              </span>
              <span className="nb-est__accuracy">
                {t("estimate.accuracy")}: <strong>{Math.round(result.score * 100)}%</strong>
              </span>
            </div>
            <p className="nb-est__delta">
              {deltaText} {t("estimate.answerIs", { value: format(question.answer) })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {result && <Explanation text={question.explanation} />}

      <div className="nb-est__footer">
        {!result && <span className="nb-est__kbd nb-muted">{t("estimate.keyboardHint")}</span>}
        <div className="nb-module__actions">
          {!result ? (
            <Button key="lock" variant="primary" onClick={() => lock()}>
              {t("estimate.lockIn")}
            </Button>
          ) : (
            <Button
              key="next"
              variant="primary"
              onClick={onNext}
              trailing={<ArrowRight aria-hidden />}
              autoFocus
            >
              {isLast ? t("common.finish") : t("common.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Module
 * -------------------------------------------------------------------------- */

function EstimateRun({
  life,
  config,
  hideHeader,
  className,
}: EstimateProps & { life: ModuleLifecycle }) {
  const { t, locale } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { questions, currency } = config.content;
  const { behavior } = config;

  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<EstimateRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const question = questions[index]!;
  const answered = records.length > index;

  const onLock = useCallback(
    (guess: number, acc: EstimateAccuracy) => {
      life.attempt();
      const record: EstimateRecord = {
        ...(question.id ? { id: question.id } : {}),
        guess,
        answer: question.answer,
        band: acc.band,
        score: Number(acc.score.toFixed(4)),
      };
      setRecords((prev) => [...prev.slice(0, index), record]);
      life.emit("module:answer", { questionIndex: index, ...record });
      const value = formatEstimate(question, question.answer, { currency, locale });
      announce(`${t(`estimate.${acc.band}`)} ${t("estimate.answerIs", { value })}`);
    },
    [life, question, index, currency, locale, announce, t],
  );

  const onNext = useCallback(() => {
    if (!answered) return;
    if (index + 1 >= questions.length) {
      const total = questions.length;
      const bullseyes = records.filter((r) => r.band === "bullseye").length;
      const score = records.reduce((s, r) => s + r.score, 0) / total;
      setFinished(true);
      life.complete({ score, correct: bullseyes, total, details: { answers: records } });
      announce(t("a11y.moduleComplete"));
      return;
    }
    setIndex(index + 1);
  }, [answered, index, questions.length, records, life, announce, t]);

  const onHint = useCallback(
    () => life.emit("module:hint", { questionIndex: index }),
    [life, index],
  );

  const retry = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  const multi = behavior.showCounter && questions.length > 1;

  if (finished) {
    const total = questions.length;
    const bullseyes = records.filter((r) => r.band === "bullseye").length;
    const score = records.reduce((s, r) => s + r.score, 0) / total;
    return (
      <ModuleShell
        type="estimate"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={score}
          passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
          text={config.feedback.complete ?? t("estimate.summary", { count: bullseyes, total })}
          stats={[
            { label: t("estimate.averageAccuracy"), value: `${Math.round(score * 100)}%` },
            { label: t("estimate.bullseyes"), value: `${bullseyes}/${total}` },
          ]}
          onRetry={retry}
        >
          <ul className="nb-est__summary">
            {questions.map((q, i) => {
              const r = records[i];
              if (!r) return null;
              const fmt = (v: number) => formatEstimate(q, v, { currency, locale });
              return (
                <li key={i} className="nb-est__summary-item" data-band={r.band}>
                  <span
                    className="nb-est__summary-icon"
                    role="img"
                    aria-label={t(`estimate.${r.band}`)}
                  >
                    {BAND_ICON[r.band]}
                  </span>
                  <span className="nb-est__summary-body">
                    <span className="nb-est__summary-prompt">
                      <RichText text={q.prompt} />
                    </span>
                    <span className="nb-est__summary-meta">
                      {t("estimate.guessVsAnswer", { guess: fmt(r.guess), answer: fmt(r.answer) })}
                    </span>
                  </span>
                  <span className="nb-est__summary-score">{Math.round(r.score * 100)}%</span>
                </li>
              );
            })}
          </ul>
        </CompletionCard>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      type="estimate"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        multi ? (
          <span className="nb-counter">
            {t("estimate.question", { current: index + 1, total: questions.length })}
          </span>
        ) : undefined
      }
      eyebrow={
        multi ? (
          <ProgressBar
            value={(index + (answered ? 1 : 0)) / questions.length}
            showLabel={false}
            size="sm"
          />
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${life.runId}-${index}`}
          className="nb-est"
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <QuestionView
            moduleId={config.id}
            question={question}
            index={index}
            isLast={index + 1 >= questions.length}
            currency={currency}
            focusOnMount={index > 0}
            onLock={onLock}
            onNext={onNext}
            onHint={onHint}
          />
        </motion.div>
      </AnimatePresence>
    </ModuleShell>
  );
}

export default Estimate;
