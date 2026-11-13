import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import {
  attemptScore,
  clampComparePosition,
  compareExploreProgress,
  compareKeyStep,
  evaluateChoice,
  imageCompareSchema,
  isAnnotationRevealed,
  revealPositionFor,
  trackCompareReach,
  type ChoiceEvaluation,
  type CompareAnnotation,
  type CompareReach,
  type ImageCompareConfig,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { Explanation } from "../../primitives/Explanation";
import { OptionCard, type OptionState } from "../../primitives/OptionCard";
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./image-compare.css";

export type ImageCompareProps = ModuleProps<ImageCompareConfig>;

/** Container width (px) from which annotation cards float over the image. */
const FLOAT_BREAKPOINT = 640;
const LETTERS = "ABCDE";
/** Half the handle width plus a small inset (px). */
const HANDLE_HALF = 34;

export function ImageCompare({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: ImageCompareProps) {
  const parsed = useMemo(() => imageCompareSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="image-compare"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <ImageCompareInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts ImageCompareRun with fresh state (keyed by runId). */
function ImageCompareInner(props: ImageCompareProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "image-compare",
    onComplete,
    onEvent,
    resetKey,
  });
  return <ImageCompareRun key={life.runId} {...props} life={life} />;
}

/** Floating-card position next to a marker (percentages of the stage). */
function cardStyle(a: CompareAnnotation): CSSProperties {
  const gap = 3;
  const style: CSSProperties = {};
  if (a.x > 50) style.right = `${100 - a.x + gap}%`;
  else style.left = `${a.x + gap}%`;
  if (a.y > 55) style.bottom = `${Math.max(2, 100 - a.y - 6)}%`;
  else style.top = `${Math.max(2, a.y - 6)}%`;
  return style;
}

interface DragState {
  id: number;
  mode: "pending" | "drag";
  startX: number;
  startY: number;
}

function ImageCompareRun({
  config,
  life,
  hideHeader,
  className,
}: ImageCompareProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { before, after, annotations, question, takeaway } = config.content;
  const { behavior } = config;
  const annotationIds = useMemo(() => annotations.map((a) => a.id), [annotations]);
  const initial = clampComparePosition(behavior.initialPosition);

  const [position, setPosition] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [reach, setReach] = useState<CompareReach>({ min: initial, max: initial });
  const [opened, setOpened] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [attempts, setAttempts] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragRef = useRef<DragState | null>(null);
  const reachRef = useRef<CompareReach>(reach);
  const exploredRef = useRef(false);
  const positionRef = useRef(position);
  const openedRef = useRef<string[]>(opened);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setStageWidth(el.clientWidth);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  const wide = stageWidth >= FLOAT_BREAKPOINT;
  // On small stages 44px markers would overlap; they become decorative and the notes
  // list below the image is the interactive (and accessible) way to open notes.
  const compactMarkers = stageWidth > 0 && stageWidth < 480;
  const progress = compareExploreProgress(reach, opened, annotationIds);
  const unlocked = !behavior.requireExplore || progress.explored;

  const complete = useCallback(
    (result: { score?: number; attempts?: number }) => {
      setFinished(true);
      setScore(result.score);
      life.complete({
        ...(result.score !== undefined
          ? { score: result.score, correct: result.score === 1 ? 1 : 0, total: 1 }
          : {}),
        details: {
          opened: openedRef.current,
          reach: reachRef.current,
          ...(result.attempts !== undefined ? { attempts: result.attempts } : {}),
        },
      });
      announce(t("a11y.moduleComplete"));
    },
    [life, announce, t],
  );

  /** Runs after every reach / opened change made by the learner. */
  const checkExplored = useCallback(
    (nextReach: CompareReach, nextOpened: string[]) => {
      if (exploredRef.current || !behavior.requireExplore) return;
      if (!compareExploreProgress(nextReach, nextOpened, annotationIds).explored) return;
      exploredRef.current = true;
      life.emit("module:interact", { action: "explored" });
      if (question) announce(`${t("compare.explored")} ${t("compare.question")}`);
      else complete({});
    },
    [behavior.requireExplore, annotationIds, life, question, announce, t, complete],
  );

  const moveTo = useCallback(
    (raw: number) => {
      const p = clampComparePosition(raw);
      positionRef.current = p;
      setPosition(p);
      setInteracted(true);
      const next = trackCompareReach(reachRef.current, p);
      if (next !== reachRef.current) {
        reachRef.current = next;
        setReach(next);
        checkExplored(next, openedRef.current);
      }
    },
    [checkExplored],
  );

  const positionFromClientX = (clientX: number): number => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return positionRef.current;
    return ((clientX - r.left) / r.width) * 100;
  };

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort (e.g. synthetic events) */
    }
    setDragging(true);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-nb-cmp-ignore]")) return;
    const fromHandle = Boolean(target.closest(".nb-cmp__handle"));
    if (e.pointerType === "mouse" || fromHandle) {
      e.preventDefault();
      handleRef.current?.focus({ preventScroll: true });
      dragRef.current = { id: e.pointerId, mode: "drag", startX: e.clientX, startY: e.clientY };
      startDrag(e);
      if (!fromHandle) moveTo(positionFromClientX(e.clientX));
    } else {
      dragRef.current = { id: e.pointerId, mode: "pending", startX: e.clientX, startY: e.clientY };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.mode === "pending") {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      d.mode = "drag";
      startDrag(e);
    }
    moveTo(positionFromClientX(e.clientX));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (d.mode === "pending" && !cancelled) moveTo(positionFromClientX(e.clientX));
    setDragging(false);
    if (d.mode === "drag" || !cancelled)
      life.emit("module:interact", { action: "slide", position: positionRef.current });
  };

  const onSliderKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const next = compareKeyStep(positionRef.current, e.key);
    if (next === null) return;
    e.preventDefault();
    moveTo(next);
    life.emit("module:interact", { action: "slide", position: next });
  };

  const openNote = useCallback(
    (a: CompareAnnotation, fromList: boolean) => {
      const target = revealPositionFor(a, positionRef.current);
      if (target !== positionRef.current) moveTo(target);
      setActiveId(a.id);
      life.emit("module:interact", { annotationId: a.id });
      announce(a.title);
      if (!openedRef.current.includes(a.id)) {
        const next = [...openedRef.current, a.id];
        openedRef.current = next;
        setOpened(next);
        checkExplored(reachRef.current, next);
      }
      if (!fromList) requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    },
    [moveTo, life, announce, checkExplored],
  );

  const closeNote = useCallback(() => {
    const id = activeId;
    setActiveId(null);
    requestAnimationFrame(() => {
      if (id) markerRefs.current.get(id)?.focus({ preventScroll: true });
    });
  }, [activeId]);

  const restart = () => {
    life.reset();
    life.emit("module:reset");
  };

  const ratio =
    before.image.width && before.image.height
      ? `${before.image.width} / ${before.image.height}`
      : naturalRatio
        ? `${naturalRatio}`
        : "16 / 10";
  const active = activeId ? annotations.find((a) => a.id === activeId) : undefined;
  const activeIndex = active ? annotations.indexOf(active) : -1;
  const activeVisible = active ? isAnnotationRevealed(active, position) : false;
  const sideLabel = (side: "before" | "after") => (side === "before" ? before.label : after.label);
  // Keep the handle inside the frame near the edges (it is 60px wide, centred on the divider).
  const handleX = (position / 100) * stageWidth;
  const handleShift =
    stageWidth > 0
      ? Math.max(0, HANDLE_HALF - handleX) - Math.max(0, handleX - (stageWidth - HANDLE_HALF))
      : 0;
  const valueText = t("compare.valueText", { percent: Math.round(position), label: before.label });

  const card = active && (
    <motion.div
      key={active.id}
      ref={cardRef}
      className={clsx("nb-cmp__card", wide && "nb-cmp__card--floating")}
      style={wide ? cardStyle(active) : undefined}
      data-side={active.side}
      data-nb-cmp-ignore=""
      role="group"
      aria-labelledby={`${config.id}-note-${active.id}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeNote();
        }
      }}
      initial={reduced ? false : { opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="nb-cmp__card-head">
        <span className="nb-cmp__card-num" aria-hidden>
          {activeIndex + 1}
        </span>
        <div className="nb-cmp__card-titles">
          <span className="nb-cmp__card-side">
            {t("compare.onSide", { label: sideLabel(active.side) })}
          </span>
          <h3 className="nb-cmp__card-title" id={`${config.id}-note-${active.id}`}>
            {active.title}
          </h3>
        </div>
        <Button
          icon
          size="sm"
          variant="ghost"
          aria-label={t("common.close")}
          onClick={closeNote}
          className="nb-cmp__close"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="nb-cmp__card-body">
        <RichText text={active.text} paragraphs />
      </div>
    </motion.div>
  );

  return (
    <ModuleShell
      type="image-compare"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("compare.instructions"))}
      appearance={config.appearance}
      className={className}
      width="wide"
      announcement={message}
      aside={
        annotations.length > 0 ? (
          <span className="nb-counter">
            {t("compare.notesOpened", { count: progress.openedCount, total: progress.total })}
          </span>
        ) : undefined
      }
    >
      <div
        ref={stageRef}
        className="nb-cmp__stage"
        style={
          {
            aspectRatio: ratio,
            "--_pos": position,
            "--_shift": `${Math.round(handleShift)}px`,
          } as CSSProperties
        }
        data-dragging={dragging ? "true" : undefined}
        data-interacted={interacted ? "true" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        <div className="nb-cmp__layer nb-cmp__layer--after">
          <SafeImage media={after.image} showCaption={false} rounded={false} />
        </div>
        <div className="nb-cmp__layer nb-cmp__layer--before">
          <SafeImage
            media={before.image}
            showCaption={false}
            rounded={false}
            onLoaded={({ width, height }) => {
              if (width && height && !(before.image.width && before.image.height))
                setNaturalRatio(width / height);
            }}
          />
        </div>

        <span
          className="nb-cmp__chip nb-cmp__chip--before"
          data-dim={position < 14 ? "true" : undefined}
          aria-hidden
        >
          {before.label}
        </span>
        <span
          className="nb-cmp__chip nb-cmp__chip--after"
          data-dim={position > 86 ? "true" : undefined}
          aria-hidden
        >
          {after.label}
        </span>

        {annotations.map((a, i) => {
          const visible = isAnnotationRevealed(a, position);
          const isOpen = opened.includes(a.id);
          if (compactMarkers) {
            return (
              <span
                key={a.id}
                className="nb-cmp__marker nb-cmp__marker--static"
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
                data-side={a.side}
                data-visible={visible ? "true" : "false"}
                data-opened={isOpen ? "true" : undefined}
                data-active={activeId === a.id ? "true" : undefined}
                aria-hidden
              >
                <span className="nb-cmp__marker-dot">
                  {isOpen && activeId !== a.id ? <Check strokeWidth={3} /> : i + 1}
                </span>
              </span>
            );
          }
          return (
            <button
              key={a.id}
              ref={(el) => {
                if (el) markerRefs.current.set(a.id, el);
                else markerRefs.current.delete(a.id);
              }}
              type="button"
              className="nb-cmp__marker"
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
              data-side={a.side}
              data-visible={visible ? "true" : "false"}
              data-opened={isOpen ? "true" : undefined}
              data-active={activeId === a.id ? "true" : undefined}
              data-nb-cmp-ignore=""
              tabIndex={visible ? 0 : -1}
              aria-hidden={visible ? undefined : true}
              aria-label={t("compare.note", { index: i + 1, title: a.title })}
              aria-expanded={activeId === a.id}
              onClick={() => (activeId === a.id ? closeNote() : openNote(a, false))}
            >
              <span className="nb-cmp__marker-dot" aria-hidden>
                {isOpen && activeId !== a.id ? <Check strokeWidth={3} /> : i + 1}
              </span>
            </button>
          );
        })}

        <div className="nb-cmp__divider">
          <span className="nb-cmp__line" aria-hidden />
          <div
            ref={handleRef}
            className="nb-cmp__handle"
            role="slider"
            tabIndex={0}
            aria-label={t("compare.slider", { before: before.label, after: after.label })}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={valueText}
            onKeyDown={onSliderKey}
          >
            <ChevronLeft aria-hidden strokeWidth={2.75} />
            <ChevronRight aria-hidden strokeWidth={2.75} />
          </div>
        </div>

        {wide && <AnimatePresence initial={false}>{activeVisible && card}</AnimatePresence>}
      </div>

      {!wide && <AnimatePresence initial={false}>{card}</AnimatePresence>}

      {behavior.requireExplore && (
        <div className="nb-cmp__progress" data-done={progress.explored ? "true" : undefined}>
          {progress.explored ? (
            <span className="nb-cmp__progress-done">
              <Check aria-hidden strokeWidth={3} />
              {t("compare.explored")}
            </span>
          ) : (
            <>
              <span className="nb-cmp__progress-text">{t("compare.explore")}</span>
              <span className="nb-cmp__progress-steps">
                <ProgressStep done={progress.afterSeen} label={after.label} t={t} />
                <ProgressStep done={progress.beforeSeen} label={before.label} t={t} />
                {annotations.length > 0 && (
                  <span
                    className="nb-cmp__step"
                    data-done={progress.openedCount >= progress.total ? "true" : undefined}
                  >
                    {t("compare.notesOpened", {
                      count: progress.openedCount,
                      total: progress.total,
                    })}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      )}

      {annotations.length > 0 && (
        <section className="nb-cmp__notes" aria-labelledby={`${config.id}-notes`}>
          <h3 className="nb-cmp__notes-title" id={`${config.id}-notes`}>
            {t("compare.notes")}
          </h3>
          <ol className="nb-cmp__note-list">
            {annotations.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="nb-cmp__note"
                  data-side={a.side}
                  data-opened={opened.includes(a.id) ? "true" : undefined}
                  aria-current={activeId === a.id ? "true" : undefined}
                  onClick={() => openNote(a, true)}
                >
                  <span className="nb-cmp__note-num" aria-hidden>
                    {opened.includes(a.id) ? <Check strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="nb-cmp__note-text">
                    <span className="nb-cmp__note-title">{a.title}</span>
                    <span className="nb-cmp__note-side">
                      {t("compare.onSide", { label: sideLabel(a.side) })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <AnimatePresence initial={false}>
        {unlocked && !finished && question && (
          <motion.div
            key="question"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <QuestionBlock
              moduleId={config.id}
              question={question}
              onAttempt={(n, ev, selected) => {
                setAttempts(n);
                life.attempt();
                life.emit("module:answer", { selected, correct: ev.correct, attempts: n });
                announce(ev.correct ? t("a11y.correctAnswer") : t("a11y.incorrectAnswer"));
              }}
              onFinish={(n) => complete({ score: attemptScore(n), attempts: n })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {unlocked && !finished && !question && !behavior.requireExplore && (
        <div className="nb-module__actions">
          <Button variant="primary" onClick={() => complete({})}>
            {t("common.finish")}
          </Button>
        </div>
      )}

      {finished && (
        <CompletionCard
          score={score}
          title={score === undefined ? t("compare.explored") : undefined}
          text={config.feedback.complete ?? takeaway}
          stats={[
            ...(annotations.length > 0
              ? [{ label: t("compare.notesStat"), value: `${opened.length}/${annotations.length}` }]
              : []),
            ...(question ? [{ label: t("common.attempts"), value: attempts }] : []),
          ]}
          retryLabel={t("common.restart")}
          onRetry={restart}
        />
      )}
    </ModuleShell>
  );
}

function ProgressStep({
  done,
  label,
  t,
}: {
  done: boolean;
  label: string;
  t: ReturnType<typeof useNibblearn>["t"];
}) {
  return (
    <span className="nb-cmp__step" data-done={done ? "true" : undefined}>
      <span className="nb-cmp__step-icon" aria-hidden>
        {done && <Check strokeWidth={3} />}
      </span>
      <span aria-hidden>{label}</span>
      <span className="nb-sr-only">
        {done ? t("compare.seenFull", { label }) : t("compare.notSeen", { label })}
      </span>
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * Knowledge check
 * -------------------------------------------------------------------------- */

interface QuestionBlockProps {
  moduleId: string;
  question: NonNullable<ImageCompareConfig["content"]["question"]>;
  onAttempt: (attempts: number, evaluation: ChoiceEvaluation, selected: string[]) => void;
  onFinish: (attempts: number) => void;
}

function QuestionBlock({ moduleId, question, onAttempt, onFinish }: QuestionBlockProps) {
  const { t } = useNibblearn();
  const options = useMemo(
    () => question.options.map((o, i) => ({ ...o, id: o.id ?? `opt${i}` })),
    [question.options],
  );
  const multiple = options.filter((o) => o.correct).length > 1;
  const [selected, setSelected] = useState<string[]>([]);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<ChoiceEvaluation | null>(null);
  const [attempts, setAttempts] = useState(0);
  const solved = evaluation?.correct ?? false;

  const toggle = (id: string) => {
    if (evaluation || eliminated.includes(id)) return;
    setSelected((prev) =>
      multiple ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id],
    );
  };

  const check = () => {
    if (!selected.length || evaluation) return;
    const ev = evaluateChoice(options, selected, { partialCredit: false });
    const n = attempts + 1;
    setAttempts(n);
    setEvaluation(ev);
    onAttempt(n, ev, selected);
  };

  const retry = () => {
    if (!evaluation) return;
    setEliminated((prev) => [...new Set([...prev, ...evaluation.wrongIds])]);
    setSelected([]);
    setEvaluation(null);
  };

  const stateFor = (id: string, correct: boolean): OptionState => {
    if (eliminated.includes(id)) return "incorrect";
    if (solved) return correct ? "correct" : "idle";
    if (evaluation && selected.includes(id)) return correct ? "correct" : "incorrect";
    return selected.includes(id) ? "selected" : "idle";
  };

  const promptId = `${moduleId}-question`;
  return (
    <div className="nb-cmp__question">
      <div>
        <div className="nb-cmp__question-eyebrow">{t("compare.question")}</div>
        <h3 className="nb-cmp__question-prompt" id={promptId}>
          <RichText text={question.prompt} />
        </h3>
        <p className="nb-cmp__question-mode">
          {multiple ? t("choice.selectMany") : t("choice.selectOne")}
        </p>
      </div>
      <div
        className="nb-cmp__options"
        role={multiple ? "group" : "radiogroup"}
        aria-labelledby={promptId}
      >
        {options.map((o, i) => {
          const state = stateFor(o.id, o.correct);
          const showExplanation =
            solved || eliminated.includes(o.id) || (evaluation !== null && selected.includes(o.id));
          return (
            <OptionCard
              key={o.id}
              text={o.text}
              shortcut={LETTERS[i]}
              multiple={multiple}
              state={state}
              explanation={showExplanation ? o.explanation : undefined}
              disabled={solved || evaluation !== null || eliminated.includes(o.id)}
              onClick={() => toggle(o.id)}
            />
          );
        })}
      </div>

      <AnimatedFeedback
        show={evaluation !== null}
        tone={solved ? "correct" : "incorrect"}
        title={solved ? t("common.correct") : t("common.incorrect")}
        text={solved ? undefined : t("common.tryAgainLater")}
      />
      {solved && <Explanation text={question.explanation} />}

      <div className="nb-module__actions">
        {!evaluation && (
          <Button variant="primary" onClick={check} disabled={!selected.length}>
            {t("common.check")}
          </Button>
        )}
        {evaluation && !solved && (
          <Button variant="secondary" onClick={retry} autoFocus>
            {t("common.retry")}
          </Button>
        )}
        {solved && (
          <Button variant="primary" onClick={() => onFinish(attempts)} autoFocus>
            {t("common.finish")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ImageCompare;
