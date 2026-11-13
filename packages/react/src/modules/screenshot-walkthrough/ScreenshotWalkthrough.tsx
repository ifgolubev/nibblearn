import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CornerDownLeft,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import {
  findAllScore,
  pointInRect,
  screenshotWalkthroughSchema,
  toPercent,
  type ScreenshotWalkthroughConfig,
  type WalkthroughStep,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./screenshot-walkthrough.css";

// useLayoutEffect warns during server rendering on React 18; fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type ScreenshotWalkthroughProps = ModuleProps<ScreenshotWalkthroughConfig>;

type Placement = "top" | "bottom" | "left" | "right";
type FeedbackKind = "missed" | "wrongInput" | null;

/** Container width below which the tooltip is rendered as a card under the stage. */
const NARROW_BREAKPOINT = 640;
/** Score penalty per miss (clicking outside the target or typing the wrong text). */
const MISS_PENALTY = 0.1;
/** Default stage aspect ratio while the image is loading and no size is configured. */
const FALLBACK_RATIO = 16 / 10;

export function ScreenshotWalkthrough({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: ScreenshotWalkthroughProps) {
  const parsed = useMemo(() => screenshotWalkthroughSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="screenshot-walkthrough"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <ScreenshotWalkthroughInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Strip the inline markup subset so text can be used in `aria-label`s. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function resolvePlacement(step: WalkthroughStep): Placement {
  if (step.tooltipPlacement !== "auto") return step.tooltipPlacement;
  return step.target.y < 50 ? "bottom" : "top";
}

/** Owns the lifecycle; every reset remounts ScreenshotWalkthroughRun with fresh state (keyed by runId). */
function ScreenshotWalkthroughInner(props: ScreenshotWalkthroughProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "screenshot-walkthrough",
    onComplete,
    onEvent,
    resetKey,
  });
  return <ScreenshotWalkthroughRun key={life.runId} {...props} life={life} />;
}

function ScreenshotWalkthroughRun({
  life,
  config,
  hideHeader,
  className,
}: ScreenshotWalkthroughProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { steps } = config.content;
  const { behavior } = config;
  const total = steps.length;

  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const [misses, setMisses] = useState(0);
  const [stepMisses, setStepMisses] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackKind>(null);
  const [shaking, setShaking] = useState(false);
  const [value, setValue] = useState("");
  const [finished, setFinished] = useState(false);
  const [naturalSizes, setNaturalSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [narrow, setNarrow] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Container-driven layout: the tooltip floats over the stage on wide containers, stacks below it on narrow ones.
  useIsomorphicLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => setNarrow(el.getBoundingClientRect().width < NARROW_BREAKPOINT);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = steps[index]!;
  const stepDone = done[index] ?? false;
  const placement = resolvePlacement(step);
  const doneCount = done.filter(Boolean).length;

  const ratio = useMemo(() => {
    const { width, height, src } = step.image;
    if (width && height) return width / height;
    const natural = naturalSizes[src];
    if (natural && natural.width > 0 && natural.height > 0) return natural.width / natural.height;
    return FALLBACK_RATIO;
  }, [step.image, naturalSizes]);

  const completeStep = useCallback(
    (i: number) => {
      const nextDone = done.map((d, j) => (j === i ? true : d));
      setDone(nextDone);
      setFeedback(null);
      setHint(false);
      setStepMisses(0);
      setValue("");
      life.emit("module:answer", { stepId: steps[i]!.id, stepIndex: i, misses: stepMisses });
      if (nextDone.every(Boolean)) {
        setFinished(true);
        life.complete({
          score: findAllScore(1, 1, misses, MISS_PENALTY),
          details: { misses, steps: total },
        });
        announce(t("a11y.moduleComplete"));
        return;
      }
      if (i + 1 < total) {
        setIndex(i + 1);
        announce(
          `${t("common.step", { current: i + 2, total })}. ${plain(steps[i + 1]!.instruction)}`,
        );
      }
    },
    [done, life, steps, stepMisses, misses, total, announce, t],
  );

  const showHint = useCallback(
    (auto: boolean) => {
      setHint(true);
      life.emit("module:hint", { stepId: step.id, stepIndex: index, auto });
    },
    [life, step.id, index],
  );

  const registerMiss = useCallback(
    (kind: Exclude<FeedbackKind, null>, payload: Record<string, unknown>) => {
      const count = stepMisses + 1;
      setStepMisses(count);
      setMisses((m) => m + 1);
      life.attempt();
      setFeedback(kind);
      if (!reduced) setShaking(true);
      life.emit("module:interact", { stepId: step.id, stepIndex: index, hit: false, ...payload });
      announce(
        kind === "missed"
          ? t("walk.missed")
          : t("walk.wrongInput", { expected: step.input?.expected ?? "" }),
      );
      if (behavior.autoHintAfterMisses > 0 && count >= behavior.autoHintAfterMisses && !hint)
        showHint(true);
    },
    [
      stepMisses,
      life,
      step.id,
      step.input?.expected,
      index,
      announce,
      t,
      behavior.autoHintAfterMisses,
      hint,
      showHint,
      reduced,
    ],
  );

  const hit = useCallback(() => {
    life.emit("module:interact", { stepId: step.id, stepIndex: index, hit: true, action: "click" });
    completeStep(index);
  }, [life, step.id, index, completeStep]);

  const onStageClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (step.action !== "click" || finished) return;
      const p = toPercent(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
      if (pointInRect(p.x, p.y, step.target, 1)) {
        hit();
        return;
      }
      if (stepDone) return;
      registerMiss("missed", {
        action: "click",
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
      });
    },
    [step, finished, stepDone, hit, registerMiss],
  );

  const submitInput = useCallback(() => {
    const expected = step.input?.expected;
    const typed = value.trim();
    if (!typed) {
      inputRef.current?.focus();
      return;
    }
    if (expected && typed.toLowerCase() !== expected.trim().toLowerCase()) {
      registerMiss("wrongInput", { action: "type", value: typed });
      inputRef.current?.focus();
      return;
    }
    life.emit("module:interact", {
      stepId: step.id,
      stepIndex: index,
      hit: true,
      action: "type",
      value: typed,
    });
    completeStep(index);
  }, [step, value, registerMiss, life, index, completeStep]);

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      setIndex(i);
      setFeedback(null);
      setHint(false);
      setStepMisses(0);
      setValue("");
      announce(`${t("common.step", { current: i + 1, total })}. ${plain(steps[i]!.instruction)}`);
    },
    [total, announce, t, steps],
  );

  const canGoNext = index + 1 < total && (stepDone || step.action === "observe");
  const canGoBack = behavior.allowBack && index > 0;

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitInput();
    }
  };

  const retry = () => {
    life.reset();
    life.emit("module:reset");
  };

  if (finished) {
    return (
      <ModuleShell
        type="screenshot-walkthrough"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
        width="wide"
      >
        <CompletionCard
          title={t("walk.complete")}
          score={findAllScore(1, 1, misses, MISS_PENALTY)}
          passThreshold={Math.max(config.scoring.passThreshold, 0.5)}
          text={config.feedback.complete ?? config.content.summary}
          stats={[
            { label: t("walk.steps"), value: total },
            { label: t("walk.misses"), value: misses },
          ]}
          onRetry={retry}
        />
      </ModuleShell>
    );
  }

  const stageVars = {
    aspectRatio: `${ratio}`,
    ["--_x" as string]: `${step.target.x}%`,
    ["--_y" as string]: `${step.target.y}%`,
    ["--_w" as string]: `${step.target.width}%`,
    ["--_h" as string]: `${step.target.height}%`,
    ["--_cx" as string]: `${step.target.x + step.target.width / 2}%`,
    ["--_cy" as string]: `${step.target.y + step.target.height / 2}%`,
  } as CSSProperties;

  const instructionId = `${config.id}-walk-instruction-${index}`;
  const actionHint =
    step.action === "click"
      ? t("walk.clickTarget")
      : step.action === "type"
        ? t("walk.typeAndConfirm")
        : "";

  const simulatedInput = (
    <input
      ref={inputRef}
      className="nb-walk__input"
      type="text"
      aria-label={t("walk.inputLabel")}
      aria-describedby={instructionId}
      aria-invalid={feedback === "wrongInput" || undefined}
      placeholder={step.input?.placeholder}
      value={value}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onInputKeyDown}
    />
  );

  let actions: ReactNode;
  if (step.action === "observe") {
    actions = (
      <Button
        variant="primary"
        size="sm"
        onClick={() => completeStep(index)}
        trailing={<ArrowRight aria-hidden />}
      >
        {index + 1 >= total ? t("common.finish") : t("common.continue")}
      </Button>
    );
  } else if (step.action === "type") {
    actions = (
      <>
        {narrow && simulatedInput}
        <Button
          variant="primary"
          size="sm"
          onClick={submitInput}
          trailing={<CornerDownLeft aria-hidden />}
        >
          {t("common.submit")}
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        {behavior.allowHint && !hint && stepMisses > 0 && !stepDone && (
          <Button
            variant="soft"
            size="sm"
            onClick={() => showHint(false)}
            leading={<Sparkles aria-hidden />}
          >
            {t("walk.showMe")}
          </Button>
        )}
        {stepDone && (
          <span className="nb-walk__done-label">
            <Check aria-hidden strokeWidth={3} />
            {t("common.completed")}
          </span>
        )}
      </>
    );
  }

  const tooltip = (
    <div
      className="nb-walk__tooltip"
      data-placement={narrow ? "stacked" : placement}
      role="group"
      aria-labelledby={instructionId}
    >
      <motion.div
        className="nb-walk__card"
        key={`${life.runId}-${index}`}
        initial={
          reduced ? false : { opacity: 0, y: placement === "top" && !narrow ? 8 : -8, scale: 0.98 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduced ? 0 : 0.26,
          ease: [0.2, 0.8, 0.2, 1],
          delay: reduced ? 0 : 0.12,
        }}
      >
        <div
          className={clsx("nb-walk__card-inner", shaking && "nb-walk__card-inner--shake")}
          onAnimationEnd={() => setShaking(false)}
        >
          <div className="nb-walk__card-head">
            {behavior.showStepNumbers && (
              <span className="nb-walk__step-badge" data-done={stepDone ? "true" : "false"}>
                {stepDone ? <Check aria-hidden strokeWidth={3} /> : index + 1}
                <span className="nb-sr-only">{t("walk.stepTitle", { current: index + 1 })}</span>
              </span>
            )}
            {step.title && <h3 className="nb-walk__card-title">{step.title}</h3>}
          </div>
          <p className="nb-walk__instruction" id={instructionId}>
            <RichText text={step.instruction} />
          </p>
          {step.note && (
            <p className="nb-walk__note">
              <RichText text={step.note} />
            </p>
          )}
          <AnimatedFeedback
            show={feedback !== null}
            tone="incorrect"
            title={
              feedback === "wrongInput"
                ? t("walk.wrongInput", { expected: step.input?.expected ?? "" })
                : t("walk.missed")
            }
            className="nb-walk__feedback"
          />
          <div className="nb-walk__card-actions">
            {actionHint && !stepDone && <span className="nb-walk__action-hint">{actionHint}</span>}
            <div className="nb-walk__buttons">{actions}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <ModuleShell
      type="screenshot-walkthrough"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("walk.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      width="wide"
      aside={<span className="nb-counter">{t("common.step", { current: index + 1, total })}</span>}
      eyebrow={<ProgressBar value={doneCount / total} showLabel={false} size="sm" />}
      footer={
        <>
          {behavior.allowBack && (
            <Button
              variant="ghost"
              onClick={() => goTo(index - 1)}
              disabled={!canGoBack}
              leading={<ArrowLeft aria-hidden />}
            >
              {t("common.back")}
            </Button>
          )}
          <span className="nb-spacer" />
          <ol className="nb-walk__dots" aria-hidden>
            {steps.map((s, i) => (
              <li
                key={s.id}
                className="nb-walk__dot"
                data-state={i === index ? "active" : done[i] ? "done" : "todo"}
              />
            ))}
          </ol>
          <span className="nb-spacer" />
          <Button
            variant="secondary"
            onClick={() => goTo(index + 1)}
            disabled={!canGoNext}
            trailing={<ArrowRight aria-hidden />}
          >
            {t("common.next")}
          </Button>
        </>
      }
    >
      <p className="nb-sr-only">
        {t("common.step", { current: index + 1, total })}. {plain(step.instruction)}
        {actionHint ? ` ${actionHint}.` : ""}
      </p>

      <div
        ref={sceneRef}
        className={clsx("nb-walk__scene", narrow && "nb-walk__scene--narrow")}
        data-action={step.action}
      >
        <div className="nb-walk__frame">
          <div className="nb-walk__bar" aria-hidden>
            <span className="nb-walk__bar-dot" />
            <span className="nb-walk__bar-dot" />
            <span className="nb-walk__bar-dot" />
            <span className="nb-walk__bar-pill">{step.image.caption ?? config.title ?? ""}</span>
          </div>
          <div className="nb-walk__stage" style={stageVars}>
            <div
              className="nb-walk__canvas"
              onClick={onStageClick}
              data-hint={hint ? "true" : undefined}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={step.image.src}
                  className="nb-walk__layer"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.32, ease: "easeOut" }}
                >
                  <SafeImage
                    media={step.image}
                    rounded={false}
                    showCaption={false}
                    className="nb-walk__image"
                    onLoaded={(size) =>
                      setNaturalSizes((prev) =>
                        prev[step.image.src] ? prev : { ...prev, [step.image.src]: size },
                      )
                    }
                  />
                </motion.div>
              </AnimatePresence>

              {step.action === "click" ? (
                <button
                  ref={targetRef}
                  type="button"
                  className="nb-walk__target nb-walk__target--button"
                  aria-label={plain(step.instruction)}
                  aria-describedby={instructionId}
                  data-done={stepDone ? "true" : "false"}
                  data-hint={hint ? "true" : "false"}
                  onClick={(e) => {
                    e.stopPropagation();
                    hit();
                  }}
                />
              ) : (
                <div
                  className="nb-walk__target"
                  data-done={stepDone ? "true" : "false"}
                  data-hint={hint ? "true" : "false"}
                  aria-hidden
                />
              )}

              {step.action === "type" && !narrow && (
                <div className="nb-walk__input-anchor">{simulatedInput}</div>
              )}

              <AnimatePresence>
                {hint && step.action === "click" && (
                  <motion.div
                    className="nb-walk__pointer"
                    aria-hidden
                    initial={reduced ? false : { opacity: 0 }}
                    animate={
                      reduced
                        ? { opacity: 1, x: 0, y: 0 }
                        : {
                            opacity: [0, 1, 1, 1],
                            x: [56, 0, 0, 0],
                            y: [56, 0, 0, 0],
                            scale: [1, 1, 0.82, 1],
                          }
                    }
                    exit={{ opacity: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 1.5, repeat: Infinity, repeatDelay: 0.5, ease: "easeOut" }
                    }
                  >
                    <MousePointer2 aria-hidden strokeWidth={2.2} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {!narrow && tooltip}
          </div>
        </div>
        {narrow && tooltip}
      </div>
    </ModuleShell>
  );
}

export default ScreenshotWalkthrough;
