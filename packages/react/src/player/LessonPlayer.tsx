import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Clock,
  Flame,
  Layers,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import {
  computeLessonScore,
  createLocalStorage,
  createProgress,
  isLessonComplete,
  lessonProgressFraction,
  moduleResultPassed,
  validateLesson,
  type EventHandler,
  type Lesson,
  type LessonProgress,
  type LessonScore,
  type ModuleConfig,
  type ModuleResult,
  type ProgressStorage,
  type ValidationIssue,
} from "@nibblearn/core";
import { NibblearnProvider, useNibblearn, type ThemeMode } from "../context/NibblearnProvider";
import type { ModuleRegistry } from "../registry";
import { ModuleRenderer } from "../ModuleRenderer";
import { defaultRegistry } from "../defaultRegistry";
import { Button } from "../primitives/Button";
import { ProgressBar } from "../primitives/ProgressBar";
import { Badge } from "../primitives/Badge";
import { RichText } from "../primitives/RichText";
import { SafeImage } from "../primitives/SafeImage";
import { CompletionCard } from "../primitives/CompletionCard";
import { InvalidModule } from "../primitives/ModuleShell";
import { LiveRegion } from "../primitives/LiveRegion";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { Confetti } from "./Confetti";
import "./player.css";

export interface LessonCompletion extends LessonScore {
  lessonId: string;
  progress: LessonProgress;
}

export interface LessonPlayerProps {
  /** A lesson object (from `defineLesson`) or raw lesson JSON (validated at runtime). */
  lesson: Lesson | unknown;
  /** Module registry (defaults to all built-in modules). */
  registry?: ModuleRegistry;
  /**
   * Progress persistence. Defaults to SSR-safe localStorage. Pass `false` to disable,
   * or any `ProgressStorage` adapter to persist elsewhere.
   */
  storage?: ProgressStorage | false;
  onEvent?: EventHandler;
  /** Called once when the lesson is completed. */
  onComplete?: (completion: LessonCompletion) => void;
  /** Called whenever a module completes. */
  onModuleComplete?: (result: ModuleResult) => void;
  /** UI locale. Defaults to the lesson language. */
  locale?: string;
  /** Theme override. Defaults to `lesson.theme.mode`. */
  theme?: ThemeMode;
  /** Render a bordered, elevated frame around the player (default true). */
  framed?: boolean;
  /** Skip the intro screen. */
  autoStart?: boolean;
  className?: string;
  /** Slot rendered under the top bar (e.g. a close button in a modal). */
  header?: ReactNode;
}

type Phase = "loading" | "intro" | "module" | "summary";

/** Shows a complete lesson: intro, modules, navigation, persistence and summary. */
export function LessonPlayer(props: LessonPlayerProps) {
  const outer = useNibblearn();
  const { registry = defaultRegistry } = props;
  const validated = useMemo(
    () => validateLesson(props.lesson, { registry: registry.schemas }),
    [props.lesson, registry],
  );

  const onEvent = props.onEvent;
  const forward = useCallback<EventHandler>(
    (e) => {
      outer.emit(e.type, {
        lessonId: e.lessonId,
        moduleId: e.moduleId,
        moduleType: e.moduleType,
        payload: e.payload,
      });
      onEvent?.(e);
    },
    [outer, onEvent],
  );

  if (!validated.success) {
    return <InvalidLesson issues={validated.issues} />;
  }
  const lesson = validated.data;
  return (
    <NibblearnProvider
      locale={props.locale ?? lesson.language ?? outer.locale}
      theme={props.theme ?? lesson.theme.mode}
      accent={lesson.theme.accent}
      radius={lesson.theme.radius}
      fontFamily={lesson.theme.fontFamily}
      reducedMotion={outer.reducedMotion}
      onEvent={forward}
      className="nb-player-root"
    >
      <LessonPlayerInner {...props} lesson={lesson} registry={registry} />
    </NibblearnProvider>
  );
}

function InvalidLesson({ issues }: { issues: ValidationIssue[] }) {
  return <InvalidModule type="lesson" issues={issues} />;
}

function LessonPlayerInner({
  lesson,
  registry,
  storage: storageProp,
  onComplete,
  onModuleComplete,
  framed = true,
  autoStart = false,
  className,
  header,
}: Omit<LessonPlayerProps, "lesson"> & { lesson: Lesson; registry: ModuleRegistry }) {
  const { t, emit } = useNibblearn();
  const reduced = useReducedMotion();
  const storage = useMemo<ProgressStorage | null>(
    () => (storageProp === false ? null : (storageProp ?? createLocalStorage())),
    [storageProp],
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState<LessonProgress>(() => createProgress(lesson.id));
  const [resumable, setResumable] = useState<LessonProgress | null>(null);
  const [direction, setDirection] = useState(1);
  const [runId, setRunId] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const completedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const modules = lesson.modules;
  const index = progress.currentIndex;
  const current: ModuleConfig | undefined = modules[index];
  const score = useMemo(
    () => computeLessonScore(lesson, progress.results),
    [lesson, progress.results],
  );

  // Load persisted progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved: LessonProgress | null;
      try {
        saved = storage ? await storage.load(lesson.id) : null;
      } catch {
        saved = null; // a failing adapter must never block the lesson
      }
      if (cancelled) return;
      if (
        saved &&
        !saved.completedAt &&
        (saved.currentIndex >= 0 || Object.keys(saved.results).length > 0)
      ) {
        setResumable(saved);
        if (lesson.intro.show && !autoStart) setPhase("intro");
        else resume(saved);
        return;
      }
      if (saved?.completedAt) {
        setProgress(saved);
        completedRef.current = true;
        setPhase("summary");
        return;
      }
      if (lesson.intro.show && !autoStart) setPhase("intro");
      else start();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const persist = useCallback(
    (p: LessonProgress) => {
      setProgress(p);
      if (storage) void storage.save(p);
    },
    [storage],
  );

  const start = useCallback(() => {
    const p = { ...createProgress(lesson.id), currentIndex: 0 };
    completedRef.current = false;
    persist(p);
    setResumable(null);
    setReviewing(false);
    setDirection(1);
    setPhase("module");
    emit("lesson:start", { lessonId: lesson.id });
    setAnnouncement(t("lesson.activity", { current: 1, total: modules.length }));
  }, [lesson.id, modules.length, persist, emit, t]);

  const resume = useCallback(
    (saved: LessonProgress) => {
      const idx = Math.max(0, Math.min(saved.currentIndex, modules.length - 1));
      persist({ ...saved, currentIndex: idx, updatedAt: new Date().toISOString() });
      setResumable(null);
      setPhase("module");
      emit("lesson:resume", { lessonId: lesson.id, payload: { index: idx } });
    },
    [modules.length, persist, emit, lesson.id],
  );

  const restart = useCallback(() => {
    if (storage) void storage.clear(lesson.id);
    setRunId((r) => r + 1);
    emit("lesson:reset", { lessonId: lesson.id });
    start();
  }, [storage, lesson.id, emit, start]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= modules.length) return;
      setDirection(next > index ? 1 : -1);
      persist({ ...progress, currentIndex: next, updatedAt: new Date().toISOString() });
      emit("lesson:navigate", { lessonId: lesson.id, payload: { from: index, to: next } });
      setAnnouncement(t("lesson.activity", { current: next + 1, total: modules.length }));
      requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
    },
    [modules.length, index, progress, persist, emit, lesson.id, t],
  );

  const finish = useCallback(() => {
    const p = {
      ...progress,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist(p);
    setReviewing(false);
    setPhase("summary");
    if (!completedRef.current) {
      completedRef.current = true;
      const s = computeLessonScore(lesson, p.results);
      emit("lesson:complete", {
        lessonId: lesson.id,
        payload: { score: s.score, points: s.points, passed: s.passed },
      });
      onComplete?.({ ...s, lessonId: lesson.id, progress: p });
      setAnnouncement(t("lesson.complete"));
    }
  }, [progress, persist, lesson, emit, onComplete, t]);

  const handleModuleComplete = useCallback(
    (result: ModuleResult) => {
      const p = {
        ...progress,
        results: { ...progress.results, [result.moduleId]: result },
        updatedAt: new Date().toISOString(),
      };
      persist(p);
      onModuleComplete?.(result);
    },
    [progress, persist, onModuleComplete],
  );

  const currentDone = current ? Boolean(progress.results[current.id]) : false;
  const isLast = index === modules.length - 1;
  const canFinish =
    isLast && (lesson.completion.rule === "any" ? currentDone : isLessonComplete(lesson, progress));

  const streak = useMemo(() => {
    if (!lesson.gamification.streaks) return 0;
    let s = 0;
    for (let i = index; i >= 0; i--) {
      const r = progress.results[modules[i]!.id];
      if (!r) break;
      if (!moduleResultPassed(modules[i]!, r)) break;
      s++;
    }
    return s;
  }, [lesson.gamification.streaks, index, progress.results, modules]);

  const rootClass = ["nb-root", "nb-player", framed && "nb-player--framed", className]
    .filter(Boolean)
    .join(" ");

  // ---------- Render ----------
  if (phase === "loading") {
    return <div className={rootClass} aria-busy="true" style={{ minHeight: "12rem" }} />;
  }

  if (phase === "intro") {
    return (
      <div className={rootClass} data-nb-phase="intro">
        {header}
        <LessonIntro lesson={lesson} onStart={start} resumable={resumable} onResume={resume} />
        <LiveRegion message={announcement} />
      </div>
    );
  }

  if (phase === "summary" && !reviewing) {
    return (
      <div className={rootClass} data-nb-phase="summary">
        {header}
        {lesson.gamification.celebration && score.passed && <Confetti />}
        <LessonSummary
          lesson={lesson}
          progress={progress}
          score={score}
          onRetry={restart}
          onReview={(i) => {
            setReviewing(true);
            setDirection(1);
            persist({ ...progress, currentIndex: i });
            setPhase("module");
          }}
        />
        <LiveRegion message={announcement} />
      </div>
    );
  }

  return (
    <div className={rootClass} data-nb-phase="module">
      {header}
      <div className="nb-player__bar">
        <ProgressBar
          value={lessonProgressFraction(lesson, progress)}
          showLabel={false}
          size="sm"
          label={t("common.progress")}
        />
        <span className="nb-player__counter">
          {t("lesson.activity", { current: index + 1, total: modules.length })}
        </span>
        {lesson.gamification.streaks && streak >= 2 && (
          <span className="nb-player__streak">
            <Flame aria-hidden /> {t("lesson.streak", { count: streak })}
          </span>
        )}
        {lesson.gamification.points && (
          <span
            className="nb-player__points"
            aria-label={t("lesson.points", { points: score.points, max: score.maxPoints })}
          >
            <Star aria-hidden /> {score.points}
          </span>
        )}
      </div>

      {reviewing && (
        <div className="nb-player__review-banner">
          <span>{t("common.review")}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setReviewing(false);
              setPhase("summary");
            }}
          >
            {t("lesson.exitReview")}
          </Button>
        </div>
      )}

      <div className="nb-player__stage" ref={stageRef} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={`${runId}-${current?.id ?? index}`}
            className="nb-player__step"
            custom={direction}
            initial={reduced ? false : { opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 * direction }}
            transition={{ duration: reduced ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {current && (
              <ModuleRenderer
                key={`${runId}-${current.id}`}
                config={current}
                registry={registry}
                onComplete={handleModuleComplete}
                resetKey={runId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="nb-player__nav" aria-label={t("lesson.menu")}>
        <Button
          variant="ghost"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          leading={<ArrowLeft aria-hidden />}
        >
          {t("common.back")}
        </Button>
        <span className="nb-player__nav-hint" aria-live="polite">
          {!currentDone && !reviewing ? t("lesson.completeToContinue") : ""}
        </span>
        {isLast ? (
          <Button
            variant="primary"
            onClick={finish}
            disabled={!canFinish && !reviewing}
            trailing={<Check aria-hidden />}
          >
            {reviewing ? t("lesson.exitReview") : t("lesson.finishLesson")}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => goTo(index + 1)}
            disabled={!currentDone && !reviewing}
            trailing={<ArrowRight aria-hidden />}
          >
            {t("common.next")}
          </Button>
        )}
      </nav>
      <LiveRegion message={announcement} />
    </div>
  );
}

function LessonIntro({
  lesson,
  onStart,
  resumable,
  onResume,
}: {
  lesson: Lesson;
  onStart: () => void;
  resumable: LessonProgress | null;
  onResume: (p: LessonProgress) => void;
}) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const done = resumable ? Object.keys(resumable.results).length : 0;
  return (
    <motion.div
      className={["nb-intro", !lesson.intro.image && "nb-intro--no-image"]
        .filter(Boolean)
        .join(" ")}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="nb-intro__body">
        <div className="nb-intro__eyebrow">
          <Badge tone="accent">
            <Layers aria-hidden /> {t("lesson.activities", { count: lesson.modules.length })}
          </Badge>
          {lesson.intro.estimatedMinutes && (
            <Badge>
              <Clock aria-hidden />{" "}
              {t("lesson.estimated", { minutes: lesson.intro.estimatedMinutes })}
            </Badge>
          )}
        </div>
        <h1 className="nb-intro__title">{lesson.title}</h1>
        {lesson.description && (
          <p className="nb-intro__desc">
            <RichText text={lesson.description} />
          </p>
        )}
        {lesson.objectives.length > 0 && (
          <div className="nb-intro__objectives">
            <div className="nb-intro__objectives-title">{t("lesson.objectives")}</div>
            <ul>
              {lesson.objectives.map((o, i) => (
                <li key={i} className="nb-intro__objective">
                  <Target aria-hidden />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {resumable ? (
          <div className="nb-resume" role="region">
            <span>
              {t("lesson.resume")} ·{" "}
              {t("lesson.activity", {
                current: Math.min(resumable.currentIndex + 1, lesson.modules.length),
                total: lesson.modules.length,
              })}
              {done > 0 ? ` · ${t("common.completed")}: ${done}` : ""}
            </span>
            <div className="nb-resume__actions">
              <Button
                variant="primary"
                onClick={() => onResume(resumable)}
                trailing={<ArrowRight aria-hidden />}
              >
                {t("common.continue")}
              </Button>
              <Button variant="ghost" onClick={onStart} leading={<RotateCcw aria-hidden />}>
                {t("lesson.startOver")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="nb-intro__actions">
            <Button
              variant="primary"
              size="lg"
              onClick={onStart}
              trailing={<ArrowRight aria-hidden />}
            >
              {lesson.intro.cta ?? t("lesson.start")}
            </Button>
          </div>
        )}
      </div>
      {lesson.intro.image && <SafeImage media={lesson.intro.image} className="nb-intro__image" />}
    </motion.div>
  );
}

function LessonSummary({
  lesson,
  progress,
  score,
  onRetry,
  onReview,
}: {
  lesson: Lesson;
  progress: LessonProgress;
  score: LessonScore;
  onRetry: () => void;
  onReview: (index: number) => void;
}) {
  const { t } = useNibblearn();
  const hasScore = score.scoredModules > 0;
  const stats = [
    { label: t("common.completed"), value: `${score.completedModules}/${score.totalModules}` },
    ...(lesson.gamification.points
      ? [{ label: t("common.points"), value: `${score.points}/${score.maxPoints}` }]
      : []),
    ...(hasScore ? [{ label: t("common.score"), value: `${Math.round(score.score * 100)}%` }] : []),
  ];
  return (
    <div className="nb-summary" data-nb-passed={score.passed}>
      <CompletionCard
        title={score.passed ? t("lesson.completeTitle") : t("lesson.notPassed")}
        text={
          score.passed
            ? t("lesson.completeBody", { title: lesson.title })
            : t("lesson.notPassedBody")
        }
        score={hasScore ? score.score : undefined}
        passThreshold={lesson.completion.rule === "score" ? lesson.completion.threshold : 0}
        stats={stats}
        onRetry={onRetry}
        retryLabel={t("lesson.retryLesson")}
      >
        <ul className="nb-summary__list" aria-label={t("lesson.reviewActivities")}>
          {lesson.modules.map((m, i) => {
            const r = progress.results[m.id];
            const status = !r
              ? "todo"
              : typeof r.score === "number"
                ? moduleResultPassed(m, r)
                  ? "pass"
                  : "fail"
                : "done";
            const title = (m as { title?: string }).title ?? m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="nb-summary__item"
                  data-status={status}
                  onClick={() => onReview(i)}
                >
                  <span className="nb-summary__icon" aria-hidden>
                    {status === "pass" ? (
                      <Check />
                    ) : status === "fail" ? (
                      <X />
                    ) : status === "done" ? (
                      <Sparkles />
                    ) : (
                      <CircleDot />
                    )}
                  </span>
                  <span className="nb-summary__text">
                    <span className="nb-summary__title">{title}</span>
                    <span className="nb-summary__meta">{m.type}</span>
                  </span>
                  {r && typeof r.score === "number" && (
                    <span className="nb-summary__score">{Math.round(r.score * 100)}%</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </CompletionCard>
    </div>
  );
}

export default LessonPlayer;
