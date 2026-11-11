import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Compass, Play, Trophy } from "lucide-react";
import clsx from "clsx";
import {
  branchingScenarioSchema,
  chooseScenario,
  nodeMap,
  scenarioScore,
  startScenario,
  type BranchingScenarioConfig,
  type ScenarioChoice,
  type ScenarioNode,
  type ScenarioState,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Badge } from "../../primitives/Badge";
import { OptionCard } from "../../primitives/OptionCard";
import { AnimatedFeedback, type FeedbackTone } from "../../primitives/Feedback";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./branching-scenario.css";

export type BranchingScenarioProps = ModuleProps<BranchingScenarioConfig>;

const LETTERS = "ABCDEF";

type Outcome = NonNullable<ScenarioNode["outcome"]>;

const toneByQuality: Record<ScenarioChoice["quality"], FeedbackTone> = {
  good: "correct",
  neutral: "info",
  poor: "incorrect",
};

const badgeByOutcome: Record<Outcome, "success" | "warning" | "danger"> = {
  success: "success",
  neutral: "warning",
  failure: "danger",
};

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  if (outcome === "success") return <Trophy aria-hidden />;
  if (outcome === "failure") return <AlertTriangle aria-hidden />;
  return <Compass aria-hidden />;
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

export function BranchingScenario({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: BranchingScenarioProps) {
  const parsed = useMemo(() => branchingScenarioSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="branching-scenario"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <BranchingScenarioInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function BranchingScenarioInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: BranchingScenarioProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "branching-scenario",
    onComplete,
    onEvent,
    resetKey,
  });
  // Keyed by runId so every reset starts from fresh local state.
  return (
    <ScenarioRun
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface ScenarioRunProps {
  config: BranchingScenarioConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

function ScenarioRun({ config, life, hideHeader, className }: ScenarioRunProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior, content } = config;

  const nodes = useMemo(() => nodeMap(config), [config]);
  const [started, setStarted] = useState(!content.intro);
  const [state, setState] = useState<ScenarioState>(() => startScenario(config));
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const completedRef = useRef(false);
  const choicesRef = useRef<HTMLDivElement>(null);

  const node = nodes.get(state.currentId)!;
  const isEnding = state.finished || node.kind === "ending";
  const outcome: Outcome = node.outcome ?? "neutral";
  const stepIndex = state.history.length + 1;

  const finish = useCallback(
    (next: ScenarioState) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const endNode = nodes.get(next.currentId);
      const endOutcome: Outcome = endNode?.outcome ?? "neutral";
      life.complete({
        score: behavior.showScore ? scenarioScore(config, next) : undefined,
        details: {
          path: next.history.map((s) => ({ nodeId: s.nodeId, choiceIndex: s.choiceIndex })),
          points: next.points,
          ending: next.currentId,
          outcome: endOutcome,
        },
      });
      announce(
        `${t("scenario.ending")}: ${t(`scenario.outcome.${endOutcome}`)}. ${t("a11y.moduleComplete")}`,
      );
    },
    [nodes, life, behavior.showScore, config, announce, t],
  );

  // A scenario that starts on an ending (or reaches maxSteps) is complete immediately.
  useEffect(() => {
    if (started && state.finished) finish(state);
  }, [started, state, finish]);

  const start = useCallback(() => {
    setStarted(true);
    life.emit("module:interact", { action: "start" });
  }, [life]);

  const select = useCallback(
    (index: number) => {
      if (confirmed || isEnding) return;
      setSelected((prev) => (prev === index ? null : index));
      life.emit("module:interact", { nodeId: node.id, choiceIndex: index });
    },
    [confirmed, isEnding, life, node.id],
  );

  const advance = useCallback(
    (index: number) => {
      const next = chooseScenario(config, state, index);
      if (next === state) return;
      setState(next);
      setSelected(null);
      setConfirmed(false);
      if (next.finished) finish(next);
      else
        requestAnimationFrame(() =>
          choicesRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
        );
    },
    [config, state, finish],
  );

  const confirm = useCallback(() => {
    if (selected === null || confirmed || isEnding) return;
    const choice = node.choices[selected];
    if (!choice) return;
    life.attempt();
    life.emit("module:answer", {
      nodeId: node.id,
      choiceIndex: selected,
      choiceId: choice.id,
      next: choice.next,
      points: choice.points,
      quality: choice.quality,
      step: stepIndex,
    });
    const showPoints = behavior.showScore && choice.points !== 0;
    if (choice.feedback || showPoints) {
      setConfirmed(true);
      announce(
        [
          choice.feedback,
          showPoints
            ? t("scenario.pointsEarned", { points: formatPoints(choice.points) })
            : undefined,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } else {
      advance(selected);
    }
  }, [
    selected,
    confirmed,
    isEnding,
    node,
    life,
    stepIndex,
    behavior.showScore,
    announce,
    t,
    advance,
  ]);

  const next = useCallback(() => {
    if (selected === null || !confirmed) return;
    advance(selected);
  }, [selected, confirmed, advance]);

  const restart = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  // Keyboard: A–F select a choice, Enter confirms / continues.
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (!started || isEnding) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toUpperCase();
      const li = key.length === 1 ? LETTERS.indexOf(key) : -1;
      if (li >= 0 && li < node.choices.length && !confirmed) {
        e.preventDefault();
        select(li);
      } else if (
        e.key === "Enter" &&
        (!(target instanceof HTMLButtonElement) || target.classList.contains("nb-option"))
      ) {
        e.preventDefault();
        if (!confirmed) confirm();
        else next();
      }
    },
    [started, isEnding, node.choices.length, confirmed, select, confirm, next],
  );

  const chosen = selected !== null ? node.choices[selected] : undefined;
  const feedbackTone: FeedbackTone = chosen ? toneByQuality[chosen.quality] : "info";
  const showPointsChip = Boolean(chosen && behavior.showScore && chosen.points !== 0);

  const history = behavior.showHistory && state.history.length > 0 && (
    <ol className="nb-scn__history" aria-label={t("scenario.history")}>
      {state.history.map((step, i) => (
        <li
          key={`${step.nodeId}-${i}`}
          className="nb-scn__history-item"
          data-quality={step.choice.quality}
        >
          <span className="nb-scn__history-dot" aria-hidden />
          <span className="nb-scn__history-step">{t("scenario.step", { index: i + 1 })}</span>
          <span className="nb-scn__history-text">{step.choice.text}</span>
        </li>
      ))}
    </ol>
  );

  const sceneMotion = {
    initial: reduced ? false : { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: -28 },
    transition: { duration: reduced ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] as const },
  };

  let body: ReactNode;

  if (!started) {
    body = (
      <motion.div key="intro" className="nb-scn__intro" {...sceneMotion}>
        <span className="nb-scn__intro-icon" aria-hidden>
          <Compass />
        </span>
        <RichText text={content.intro!} paragraphs className="nb-scn__intro-text" />
        <Button
          variant="primary"
          size="lg"
          onClick={start}
          trailing={<Play aria-hidden />}
          autoFocus
        >
          {t("common.start")}
        </Button>
      </motion.div>
    );
  } else if (isEnding) {
    const score = behavior.showScore ? scenarioScore(config, state) : undefined;
    body = (
      <motion.div
        key={`end-${life.runId}`}
        className="nb-scn__ending"
        data-outcome={outcome}
        {...sceneMotion}
      >
        <div className="nb-scn__ending-card">
          <Badge tone={badgeByOutcome[outcome]} className="nb-scn__outcome">
            <OutcomeIcon outcome={outcome} />
            {t(`scenario.outcome.${outcome}`)}
          </Badge>
          <div className="nb-scn__eyebrow">{t("scenario.ending")}</div>
          {node.title && <h3 className="nb-scn__title">{node.title}</h3>}
          <RichText text={node.text} paragraphs className="nb-scn__text" />
          {node.image && <SafeImage media={node.image} className="nb-scn__image" />}
          {node.summary && (
            <div className="nb-scn__summary">
              <div className="nb-scn__summary-title">{t("common.summary")}</div>
              <RichText text={node.summary} paragraphs />
            </div>
          )}
        </div>
        {history}
        <CompletionCard
          score={score}
          passThreshold={0.7}
          title={
            outcome === "success"
              ? t("common.wellDone")
              : outcome === "neutral"
                ? t("common.niceWork")
                : t("common.keepGoing")
          }
          text={config.feedback.complete}
          stats={[
            { label: t("scenario.decisions"), value: state.history.length },
            ...(behavior.showScore
              ? [{ label: t("common.points"), value: formatPoints(state.points) }]
              : []),
          ]}
          onRetry={behavior.allowRetry ? restart : undefined}
          retryLabel={t("scenario.explorePaths")}
        />
      </motion.div>
    );
  } else {
    body = (
      <motion.div key={`${life.runId}-${node.id}`} className="nb-scn__scene" {...sceneMotion}>
        {history}
        <article className="nb-scn__card" aria-labelledby={`${config.id}-scene`}>
          <div className="nb-scn__card-head">
            {node.speaker ? (
              <Badge tone="accent" className="nb-scn__speaker">
                {node.speaker}
              </Badge>
            ) : (
              <span />
            )}
            <span className="nb-counter">{t("scenario.step", { index: stepIndex })}</span>
          </div>
          {node.title && (
            <h3 className="nb-scn__title" id={`${config.id}-scene`}>
              {node.title}
            </h3>
          )}
          {!node.title && (
            <span id={`${config.id}-scene`} className="nb-sr-only">
              {t("scenario.step", { index: stepIndex })}
            </span>
          )}
          <RichText text={node.text} paragraphs className="nb-scn__text" />
          {node.image && <SafeImage media={node.image} className="nb-scn__image" />}
        </article>

        <div className="nb-scn__decision">
          <div className="nb-scn__question" id={`${config.id}-decision`}>
            {t("scenario.decision")}
          </div>
          <div
            ref={choicesRef}
            className="nb-scn__choices"
            role="radiogroup"
            aria-labelledby={`${config.id}-decision`}
          >
            {node.choices.map((c, i) => (
              <OptionCard
                key={c.id ?? i}
                text={c.text}
                shortcut={LETTERS[i]}
                state={selected === i ? "selected" : "idle"}
                disabled={confirmed}
                onClick={() => select(i)}
                className={clsx(confirmed && selected !== i && "nb-scn__choice--dimmed")}
              />
            ))}
          </div>

          <AnimatedFeedback
            show={confirmed && Boolean(chosen)}
            tone={feedbackTone}
            text={chosen?.feedback}
          >
            {showPointsChip && chosen && (
              <Badge tone={chosen.points > 0 ? "success" : "danger"} className="nb-scn__points">
                {t("scenario.pointsEarned", { points: formatPoints(chosen.points) })}
              </Badge>
            )}
          </AnimatedFeedback>

          <div className="nb-scn__footer">
            {!confirmed ? (
              <Button
                key="confirm"
                variant="primary"
                onClick={confirm}
                disabled={selected === null}
                trailing={<ArrowRight aria-hidden />}
              >
                {t("common.continue")}
              </Button>
            ) : (
              <Button
                key="next"
                variant="primary"
                onClick={next}
                trailing={<ArrowRight aria-hidden />}
                autoFocus
              >
                {t("common.continue")}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <ModuleShell
      type="branching-scenario"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      onKeyDown={onKeyDown}
    >
      <AnimatePresence mode="wait" initial={false}>
        {body}
      </AnimatePresence>
    </ModuleShell>
  );
}

export default BranchingScenario;
