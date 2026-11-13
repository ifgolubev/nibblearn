import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  CornerDownRight,
  GitBranch,
  ListChecks,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { processExplorerSchema, type ProcessExplorerConfig } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { resolveContentIcon } from "../../primitives/icons";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./process-explorer.css";

export type ProcessExplorerProps = ModuleProps<ProcessExplorerConfig>;

export function ProcessExplorer({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: ProcessExplorerProps) {
  const parsed = useMemo(() => processExplorerSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="process-explorer"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <ProcessExplorerInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Resolve a kebab-case icon name ("bar-chart-3") through the curated content icon set. */
function resolveIcon(name: string | undefined): LucideIcon | null {
  return resolveContentIcon(name);
}

/** Owns the lifecycle; every reset remounts ProcessExplorerRun with fresh state (keyed by runId). */
function ProcessExplorerInner(props: ProcessExplorerProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "process-explorer",
    onComplete,
    onEvent,
    resetKey,
  });
  return <ProcessExplorerRun key={life.runId} {...props} life={life} />;
}

function ProcessExplorerRun({
  life,
  config,
  hideHeader,
  className,
}: ProcessExplorerProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { stages } = config.content;
  const { behavior } = config;
  const total = stages.length;

  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<string[]>(() => [stages[0]!.id]);
  const [interacted, setInteracted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [direction, setDirection] = useState(1);
  const [focusIndex, setFocusIndex] = useState(0);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const iconFor = useMemo(() => stages.map((s) => resolveIcon(s.icon)), [stages]);
  const indexOf = useCallback((id: string) => stages.findIndex((s) => s.id === id), [stages]);
  const stage = stages[current]!;
  const allVisited = visited.length >= total;

  const select = useCallback(
    (i: number, via: string) => {
      if (i < 0 || i >= total) return;
      const target = stages[i]!;
      setDirection(i >= current ? 1 : -1);
      setCurrent(i);
      setFocusIndex(i);
      setInteracted(true);
      life.emit("module:interact", { stageId: target.id, stageIndex: i, via });
      announce(`${t("process.stage", { index: i + 1 })}: ${target.title}`);
      if (visited.includes(target.id)) return;
      const nextVisited = [...visited, target.id];
      setVisited(nextVisited);
      if (behavior.requireAll && nextVisited.length >= total) {
        life.complete({ details: { visited: nextVisited } });
        announce(`${t("process.allExplored")} ${t("a11y.moduleComplete")}`);
      }
    },
    [total, stages, current, life, announce, t, visited, behavior.requireAll],
  );

  const finish = useCallback(() => {
    life.complete({ details: { visited } });
    setFinished(true);
    announce(t("a11y.moduleComplete"));
  }, [life, visited, announce, t]);

  const restart = () => {
    life.reset();
    life.emit("module:reset");
  };

  const focusNode = (i: number) => {
    const clamped = Math.max(0, Math.min(total - 1, i));
    setFocusIndex(clamped);
    nodeRefs.current[clamped]?.focus();
  };

  const onStepperKeyDown = (e: ReactKeyboardEvent<HTMLOListElement>) => {
    const keys: Record<string, number | "home" | "end"> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: "home",
      End: "end",
    };
    const action = keys[e.key];
    if (action === undefined) return;
    e.preventDefault();
    if (action === "home") focusNode(0);
    else if (action === "end") focusNode(total - 1);
    else focusNode(focusIndex + action);
  };

  const canFinish = behavior.requireAll ? allVisited : interacted;

  if (finished) {
    return (
      <ModuleShell
        type="process-explorer"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
        width="wide"
      >
        <CompletionCard
          text={config.feedback.complete ?? t("process.allExplored")}
          stats={[{ label: t("process.stages"), value: `${visited.length}/${total}` }]}
          onRetry={restart}
          retryLabel={t("common.restart")}
        >
          <ol className="nb-process__summary">
            {stages.map((s, i) => {
              const Icon = iconFor[i];
              return (
                <li
                  key={s.id}
                  className="nb-process__summary-item"
                  data-visited={visited.includes(s.id) ? "true" : "false"}
                >
                  <span className="nb-process__summary-icon">
                    {Icon ? <Icon aria-hidden /> : <span>{i + 1}</span>}
                  </span>
                  <span className="nb-process__summary-title">{s.title}</span>
                  {visited.includes(s.id) && <Check aria-label={t("process.visited")} />}
                </li>
              );
            })}
          </ol>
        </CompletionCard>
      </ModuleShell>
    );
  }

  const StageIcon = iconFor[current];
  const panelId = `${config.id}-process-panel`;

  return (
    <ModuleShell
      type="process-explorer"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("process.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      width="wide"
      aside={
        <span className="nb-counter">
          {t("process.explored", { count: visited.length, total })}
        </span>
      }
      eyebrow={
        <ProgressBar
          value={visited.length / total}
          showLabel={false}
          size="sm"
          tone={allVisited ? "success" : "accent"}
        />
      }
    >
      <ul className="nb-sr-only">
        {stages.map((s, i) => (
          <li key={s.id}>
            {t("process.stage", { index: i + 1 })}: {s.title}
            {visited.includes(s.id) ? ` — ${t("process.visited")}` : ""}
          </li>
        ))}
      </ul>

      <div className={clsx("nb-process", `nb-process--${behavior.layout}`)}>
        <ol
          className="nb-process__stepper"
          aria-label={t("process.stages")}
          onKeyDown={onStepperKeyDown}
        >
          {stages.map((s, i) => {
            const Icon = iconFor[i];
            const isCurrent = i === current;
            const isVisited = visited.includes(s.id);
            const state = isCurrent ? "current" : isVisited ? "visited" : "todo";
            return (
              <li key={s.id} className="nb-process__item" data-state={state}>
                <button
                  ref={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                  type="button"
                  className="nb-process__node"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-controls={panelId}
                  tabIndex={focusIndex === i ? 0 : -1}
                  onFocus={() => setFocusIndex(i)}
                  onClick={() => select(i, "node")}
                >
                  <span className="nb-process__icon" aria-hidden>
                    {Icon ? <Icon /> : <span className="nb-process__icon-number">{i + 1}</span>}
                    {isVisited && !isCurrent && (
                      <span className="nb-process__icon-check">
                        <Check strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="nb-process__node-body">
                    <span className="nb-process__node-index">
                      {t("process.stage", { index: i + 1 })}
                      {isVisited && !isCurrent && (
                        <span className="nb-sr-only"> — {t("process.visited")}</span>
                      )}
                    </span>
                    <span className="nb-process__node-title">{s.title}</span>
                    {s.summary && <span className="nb-process__node-summary">{s.summary}</span>}
                    {(s.owner || s.duration) && (
                      <span className="nb-process__chips">
                        {s.owner && (
                          <span className="nb-process__chip">
                            <UserRound aria-hidden />
                            <span className="nb-sr-only">{t("process.owner")}: </span>
                            {s.owner}
                          </span>
                        )}
                        {s.duration && (
                          <span className="nb-process__chip">
                            <Clock aria-hidden />
                            <span className="nb-sr-only">{t("process.duration")}: </span>
                            {s.duration}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="nb-process__panel-wrap" id={panelId} aria-live="polite">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.article
              key={`${life.runId}-${stage.id}`}
              className="nb-process__panel"
              aria-labelledby={`${panelId}-title`}
              custom={direction}
              initial={reduced ? false : { opacity: 0, x: 16 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 * direction }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <header className="nb-process__panel-head">
                <span className="nb-process__panel-icon" aria-hidden>
                  {StageIcon ? <StageIcon /> : <span>{current + 1}</span>}
                </span>
                <div className="nb-process__panel-heading">
                  <span className="nb-process__eyebrow">
                    {t("common.step", { current: current + 1, total })}
                  </span>
                  <h3 className="nb-process__panel-title" id={`${panelId}-title`}>
                    {stage.title}
                  </h3>
                </div>
              </header>

              {(stage.owner || stage.duration) && (
                <dl className="nb-process__meta">
                  {stage.owner && (
                    <div className="nb-process__meta-item">
                      <dt>
                        <UserRound aria-hidden />
                        {t("process.owner")}
                      </dt>
                      <dd>{stage.owner}</dd>
                    </div>
                  )}
                  {stage.duration && (
                    <div className="nb-process__meta-item">
                      <dt>
                        <Clock aria-hidden />
                        {t("process.duration")}
                      </dt>
                      <dd>{stage.duration}</dd>
                    </div>
                  )}
                </dl>
              )}

              {stage.dependsOn.length > 0 && (
                <div className="nb-process__deps">
                  <span className="nb-process__deps-label">
                    <CornerDownRight aria-hidden />
                    {t("process.dependsOn")}
                  </span>
                  <div className="nb-process__deps-list">
                    {stage.dependsOn.map((id) => {
                      const i = indexOf(id);
                      const dep = stages[i];
                      if (!dep) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="nb-process__dep"
                          onClick={() => select(i, "dependency")}
                          data-visited={visited.includes(id) ? "true" : "false"}
                        >
                          {visited.includes(id) ? (
                            <Check aria-hidden strokeWidth={3} />
                          ) : (
                            <span className="nb-process__dep-index" aria-hidden>
                              {i + 1}
                            </span>
                          )}
                          {dep.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="nb-process__body">
                <RichText text={stage.details} paragraphs className="nb-process__details" />
                {stage.image && <SafeImage media={stage.image} className="nb-process__image" />}
              </div>

              {stage.checklist.length > 0 && (
                <section className="nb-process__checklist" aria-label={t("process.checklist")}>
                  <h4 className="nb-process__section-title">
                    <ListChecks aria-hidden />
                    {t("process.checklist")}
                  </h4>
                  <ul className="nb-process__checklist-items">
                    {stage.checklist.map((item, i) => (
                      <li key={i} className="nb-process__checklist-item">
                        <span className="nb-process__checklist-mark" aria-hidden>
                          <Check strokeWidth={3} />
                        </span>
                        <RichText text={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {stage.branches.length > 0 && (
                <section className="nb-process__branches" aria-label={t("process.branches")}>
                  <h4 className="nb-process__section-title">
                    <GitBranch aria-hidden />
                    {t("process.branches")}
                  </h4>
                  <div className="nb-process__branch-list">
                    {stage.branches.map((b, i) => {
                      const targetIndex = indexOf(b.to);
                      const target = stages[targetIndex];
                      return (
                        <button
                          key={i}
                          type="button"
                          className="nb-process__branch"
                          onClick={() => select(targetIndex, "branch")}
                        >
                          <span className="nb-process__branch-label">{b.label}</span>
                          {target && (
                            <span className="nb-process__branch-target">
                              <ArrowRight aria-hidden />
                              {target.title}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <footer className="nb-process__panel-nav">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => select(current - 1, "prev")}
                  disabled={current === 0}
                  leading={<ArrowLeft aria-hidden />}
                >
                  {t("process.previousStage")}
                </Button>
                <span className="nb-spacer" />
                {canFinish && (
                  <Button
                    variant={current + 1 >= total || allVisited ? "primary" : "secondary"}
                    size="sm"
                    onClick={finish}
                    leading={<Check aria-hidden />}
                  >
                    {t("common.finish")}
                  </Button>
                )}
                <Button
                  variant={
                    current + 1 >= total
                      ? "secondary"
                      : canFinish && allVisited
                        ? "secondary"
                        : "primary"
                  }
                  size="sm"
                  onClick={() => select(current + 1, "next")}
                  disabled={current + 1 >= total}
                  trailing={<ArrowRight aria-hidden />}
                >
                  {t("process.nextStage")}
                </Button>
              </footer>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </ModuleShell>
  );
}

export default ProcessExplorer;
