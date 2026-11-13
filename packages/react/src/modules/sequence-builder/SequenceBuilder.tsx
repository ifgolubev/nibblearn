import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, Eye, GripVertical, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  evaluateSequence,
  moveItem,
  sequenceBuilderSchema,
  shuffleDerangement,
  type SequenceBuilderConfig,
  type SequenceEvaluation,
  type SequenceItem,
  seedFromString,
} from "@nibblearn/core";
import clsx from "clsx";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { Explanation } from "../../primitives/Explanation";
import { Hint } from "../../primitives/Hint";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./sequence-builder.css";

export type SequenceBuilderProps = ModuleProps<SequenceBuilderConfig>;

type RowState = "idle" | "correct" | "incorrect";

export function SequenceBuilder({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: SequenceBuilderProps) {
  const parsed = useMemo(() => sequenceBuilderSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="sequence-builder"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <SequenceBuilderInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function SequenceBuilderInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: SequenceBuilderProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "sequence-builder",
    onComplete,
    onEvent,
    resetKey,
  });
  return (
    <SequenceGame
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface GameProps {
  config: SequenceBuilderConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

/** Score: full credit first time, decays per retry; half credit at most when the solution was revealed. */
function sequenceScore(attempts: number, revealed: boolean, lastFraction: number): number {
  if (revealed) return lastFraction * 0.5;
  if (attempts <= 1) return 1;
  return Math.max(0.5, 1 - 0.25 * (attempts - 1));
}

function SequenceGame({ config, life, hideHeader, className }: GameProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior } = config;
  const items = config.content.items;
  const total = items.length;
  const correctOrder = useMemo(() => items.map((i) => i.id), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [seed] = useState(() => behavior.shuffleSeed ?? seedFromString(config.id, life.runId));
  const [order, setOrder] = useState<string[]>(() => shuffleDerangement(correctOrder, seed));
  const [evaluation, setEvaluation] = useState<SequenceEvaluation | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const checked = evaluation !== null;
  const locked = checked && (evaluation.correct || revealed);
  const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
  const canRetry = checked && !locked && behavior.allowRetry && !exhausted;
  const canReveal = checked && !locked && (attempts >= 2 || exhausted || !behavior.allowRetry);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (checked || to < 0 || to >= total || from === to) return;
      setOrder((prev) => moveItem(prev, from, to));
      const item = byId.get(order[from]!);
      life.emit("module:interact", { itemId: order[from], from, to });
      announce(t("a11y.movedTo", { item: item?.text ?? "", position: to + 1 }));
    },
    [checked, total, order, byId, life, announce, t],
  );

  const onDragStart = useCallback((e: DragStartEvent) => setActiveId(String(e.active.id)), []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const from = order.indexOf(String(active.id));
      const to = order.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      setOrder((prev) => arrayMove(prev, from, to));
      life.emit("module:interact", { itemId: active.id, from, to });
      announce(
        t("a11y.movedTo", { item: byId.get(String(active.id))?.text ?? "", position: to + 1 }),
      );
    },
    [order, byId, life, announce, t],
  );
  const onDragCancel = useCallback(() => setActiveId(null), []);

  const check = useCallback(() => {
    if (checked) return;
    const ev = evaluateSequence(correctOrder, order);
    const n = attempts + 1;
    setAttempts(n);
    life.attempt();
    setEvaluation(ev);
    const willReveal =
      !ev.correct &&
      (!behavior.allowRetry || (behavior.maxAttempts > 0 && n >= behavior.maxAttempts));
    if (willReveal) setRevealed(true);
    life.emit("module:answer", {
      order,
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? `${t("a11y.correctAnswer")} ${t("seq.allCorrect")}`
        : `${t("a11y.incorrectAnswer")} ${t("seq.correctCount", { correct: ev.correctCount, total })}`,
    );
  }, [checked, correctOrder, order, attempts, life, behavior, announce, t, total]);

  const retry = useCallback(() => {
    setEvaluation(null);
    life.emit("module:interact", { action: "retry" });
  }, [life]);

  const reveal = useCallback(() => {
    setRevealed(true);
    life.emit("module:interact", { action: "reveal" });
    announce(t("seq.correctOrder"));
  }, [life, announce, t]);

  const finish = useCallback(() => {
    if (!evaluation) return;
    const score = sequenceScore(attempts, revealed, evaluation.score);
    setFinished(true);
    life.complete({
      score,
      correct: evaluation.correctCount,
      total,
      details: { order, attempts, revealed },
    });
    announce(t("a11y.moduleComplete"));
  }, [evaluation, attempts, revealed, life, total, order, announce, t]);

  const rowState = (index: number): RowState => {
    if (!evaluation) return "idle";
    return evaluation.positions[index] ? "correct" : "incorrect";
  };

  if (finished && evaluation) {
    const score = sequenceScore(attempts, revealed, evaluation.score);
    return (
      <ModuleShell
        type="sequence-builder"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={score}
          text={
            config.feedback.complete ??
            (evaluation.correct
              ? t("seq.allCorrect")
              : t("seq.correctCount", { correct: evaluation.correctCount, total }))
          }
          stats={[
            { label: t("common.correct"), value: `${evaluation.correctCount}/${total}` },
            { label: t("common.attempts"), value: attempts },
          ]}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        >
          <ol className="nb-seq__solution nb-seq__solution--summary">
            {items.map((item, i) => (
              <li key={item.id} className="nb-seq__solution-item">
                <span className="nb-seq__badge nb-seq__badge--solution">{i + 1}</span>
                <span className="nb-seq__solution-text">
                  <RichText text={item.text} />
                </span>
              </li>
            ))}
          </ol>
        </CompletionCard>
      </ModuleShell>
    );
  }

  const activeItem = activeId ? byId.get(activeId) : undefined;
  const showSolution = revealed;

  return (
    <ModuleShell
      type="sequence-builder"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("seq.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        checked ? (
          <span className="nb-counter">
            {t("seq.correctCount", { correct: evaluation.correctCount, total })}
          </span>
        ) : undefined
      }
    >
      <DndContext
        id={`${config.id}-dnd`}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          screenReaderInstructions: { draggable: t("a11y.dragInstructions") },
          announcements: {
            onDragStart: ({ active }) =>
              t("a11y.pickedUp", { item: byId.get(String(active.id))?.text ?? "" }),
            onDragOver: ({ active, over }) =>
              over
                ? t("a11y.movedTo", {
                    item: byId.get(String(active.id))?.text ?? "",
                    position: order.indexOf(String(over.id)) + 1,
                  })
                : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? t("a11y.movedTo", {
                    item: byId.get(String(active.id))?.text ?? "",
                    position: order.indexOf(String(over.id)) + 1,
                  })
                : undefined,
            onDragCancel: ({ active }) =>
              t("a11y.dropCancelled", { item: byId.get(String(active.id))?.text ?? "" }),
          },
        }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={checked}>
          <ol className="nb-seq__list" aria-label={config.title}>
            {order.map((id, index) => (
              <SortableRow
                key={id}
                item={byId.get(id)!}
                index={index}
                total={total}
                state={rowState(index)}
                locked={checked}
                showPosition={behavior.showPositions}
                reduced={reduced}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                t={t}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {activeItem ? (
            <div className="nb-seq__row nb-seq__row--overlay" data-state="idle">
              {behavior.showPositions && (
                <span className="nb-seq__badge">{order.indexOf(activeItem.id) + 1}</span>
              )}
              <span className="nb-seq__handle" aria-hidden>
                <GripVertical />
              </span>
              <span className="nb-seq__text">
                <RichText text={activeItem.text} />
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!checked && <Hint text={config.content.hint} onReveal={() => life.emit("module:hint")} />}

      <AnimatedFeedback
        show={checked}
        tone={
          evaluation?.correct
            ? "correct"
            : evaluation && evaluation.correctCount > 0
              ? "partial"
              : "incorrect"
        }
        title={evaluation?.correct ? t("seq.allCorrect") : t("common.incorrect")}
        text={
          evaluation
            ? evaluation.correct
              ? (config.feedback.correct ?? undefined)
              : (config.feedback.incorrect ??
                t("seq.correctCount", { correct: evaluation.correctCount, total }))
            : undefined
        }
      />

      <AnimatePresence initial={false}>
        {showSolution && (
          <motion.section
            key="solution"
            className="nb-seq__solution-panel"
            aria-label={t("seq.correctOrder")}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h4 className="nb-seq__solution-title">
              <Eye aria-hidden size={16} />
              {t("seq.correctOrder")}
            </h4>
            <ol className="nb-seq__solution">
              {items.map((item, i) => (
                <li key={item.id} className="nb-seq__solution-item">
                  <span className="nb-seq__badge nb-seq__badge--solution">{i + 1}</span>
                  <div className="nb-seq__solution-body">
                    <span className="nb-seq__solution-text">
                      <RichText text={item.text} />
                    </span>
                    {item.description && (
                      <span className="nb-seq__solution-desc">
                        <RichText text={item.description} />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </motion.section>
        )}
      </AnimatePresence>

      {locked && behavior.showExplanation && <Explanation text={config.content.explanation} />}

      <div className="nb-seq__footer">
        <span className="nb-muted nb-text-sm">
          {checked && !locked ? t("common.attempts") + `: ${attempts}` : ""}
        </span>
        <div className="nb-module__actions">
          {canReveal && (
            <Button variant="ghost" onClick={reveal} leading={<Eye aria-hidden />}>
              {t("seq.showSolution")}
            </Button>
          )}
          {canRetry && (
            <Button variant="secondary" onClick={retry}>
              {t("common.retry")}
            </Button>
          )}
          {!checked ? (
            <Button variant="primary" onClick={check}>
              {t("common.check")}
            </Button>
          ) : (
            locked && (
              <Button variant="primary" onClick={finish} autoFocus>
                {t("common.finish")}
              </Button>
            )
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

interface RowProps {
  item: SequenceItem;
  index: number;
  total: number;
  state: RowState;
  locked: boolean;
  showPosition: boolean;
  reduced: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  t: ReturnType<typeof useNibblearn>["t"];
}

function SortableRow({
  item,
  index,
  total,
  state,
  locked,
  showPosition,
  reduced,
  onMoveUp,
  onMoveDown,
  t,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: locked });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reduced ? undefined : transition,
  };
  const position = t("seq.position", { position: index + 1 });
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx("nb-seq__row", isDragging && "nb-seq__row--ghost")}
      data-state={state}
      aria-label={`${position}: ${item.text}`}
    >
      {showPosition && (
        <span className="nb-seq__badge" aria-hidden>
          {index + 1}
        </span>
      )}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="nb-seq__handle"
        aria-label={item.text}
        disabled={locked}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden />
      </button>
      <span className="nb-seq__text">
        <RichText text={item.text} />
      </span>
      <span className="nb-seq__mark" aria-hidden>
        {state === "correct" ? (
          <Check strokeWidth={3} />
        ) : state === "incorrect" ? (
          <X strokeWidth={3} />
        ) : null}
      </span>
      <span className="nb-seq__controls">
        <Button
          icon
          size="sm"
          variant="ghost"
          aria-label={`${t("a11y.moveUp")}: ${item.text}`}
          disabled={locked || index === 0}
          onClick={onMoveUp}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          icon
          size="sm"
          variant="ghost"
          aria-label={`${t("a11y.moveDown")}: ${item.text}`}
          disabled={locked || index === total - 1}
          onClick={onMoveDown}
        >
          <ArrowDown aria-hidden />
        </Button>
      </span>
    </li>
  );
}

export default SequenceBuilder;
