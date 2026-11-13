import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Check, CornerUpLeft, Eye, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  evaluatePriorityMatrix,
  priorityMatrixSchema,
  priorityMatrixScore,
  quadrantCell,
  shuffle,
  sortQuadrants,
  type MatrixAxis,
  type MatrixItem,
  type MatrixQuadrant,
  type PriorityMatrixConfig,
  type PriorityMatrixEvaluation,
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
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./priority-matrix.css";

export type PriorityMatrixProps = ModuleProps<PriorityMatrixConfig>;

type Translator = ReturnType<typeof useNibblearn>["t"];
type ChipState = "idle" | "selected" | "correct" | "incorrect" | "locked" | "revealed";
type Assignments = Record<string, string | undefined>;

const TRAY_ID = "__tray";
const COLOR_TOKENS: Record<string, string> = {
  accent: "var(--nb-accent)",
  lime: "var(--nb-highlight, var(--nb-lime, #f59e0b))",
  highlight: "var(--nb-highlight, var(--nb-lime, #f59e0b))",
  pink: "var(--nb-pink, var(--nb-danger))",
  sky: "var(--nb-sky, var(--nb-info))",
  violet: "var(--nb-violet, var(--nb-accent))",
  success: "var(--nb-success)",
  info: "var(--nb-info)",
  warning: "var(--nb-warning)",
  danger: "var(--nb-danger)",
};
const DEFAULT_COLOR: Record<MatrixQuadrant["position"], string> = {
  "top-left": "accent",
  "top-right": "pink",
  "bottom-left": "violet",
  "bottom-right": "sky",
};

function quadrantStyle(q: MatrixQuadrant): CSSProperties {
  const color = q.color ?? DEFAULT_COLOR[q.position];
  const cell = quadrantCell(q.position);
  return {
    "--_q":
      (Object.prototype.hasOwnProperty.call(COLOR_TOKENS, color)
        ? COLOR_TOKENS[color]
        : undefined) ?? color,
    gridRow: cell.row,
    gridColumn: cell.column,
  } as CSSProperties;
}

export function PriorityMatrix({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: PriorityMatrixProps) {
  const parsed = useMemo(() => priorityMatrixSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="priority-matrix"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <PriorityMatrixInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts PriorityMatrixRun with fresh state (keyed by runId). */
function PriorityMatrixInner(props: PriorityMatrixProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "priority-matrix",
    onComplete,
    onEvent,
    resetKey,
  });
  return <PriorityMatrixRun key={life.runId} {...props} life={life} />;
}

/* ----------------------------------------------------------------------------
 * Axes
 * -------------------------------------------------------------------------- */

function Axis({ axis, orientation }: { axis: MatrixAxis; orientation: "x" | "y" }) {
  return (
    <div className={`nb-matrix__axis nb-matrix__axis--${orientation}`} aria-hidden>
      <span className="nb-matrix__axis-end">{axis.low}</span>
      <span className="nb-matrix__axis-line" />
      <span className="nb-matrix__axis-name">{axis.label}</span>
      <span className="nb-matrix__axis-line nb-matrix__axis-line--arrow" />
      <span className="nb-matrix__axis-end">{axis.high}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Chip
 * -------------------------------------------------------------------------- */

interface ChipProps {
  item: MatrixItem;
  state: ChipState;
  draggable: boolean;
  reduced: boolean;
  compact?: boolean;
  onSelect: () => void;
}

function Chip({ item, state, draggable, reduced, compact, onSelect }: ChipProps) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggable,
  });
  const marked =
    state === "correct" || state === "incorrect" || state === "revealed" || state === "locked";
  return (
    <motion.div
      layoutId={reduced ? undefined : item.id}
      layout={!reduced}
      className="nb-matrix__chip-slot"
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <button
        ref={setNodeRef}
        type="button"
        className={clsx("nb-matrix__chip", compact && "nb-matrix__chip--placed")}
        data-state={state}
        data-dragging={isDragging ? "true" : undefined}
        aria-pressed={draggable ? state === "selected" : undefined}
        aria-disabled={!draggable || undefined}
        aria-describedby={draggable ? attributes["aria-describedby"] : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...listeners}
      >
        <span className="nb-matrix__chip-text">
          <RichText text={item.text} />
        </span>
        {marked && (
          <span className="nb-matrix__chip-mark" aria-hidden>
            {state === "incorrect" ? (
              <X strokeWidth={3} />
            ) : state === "revealed" ? (
              <Eye />
            ) : (
              <Check strokeWidth={3} />
            )}
          </span>
        )}
      </button>
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
 * Tray
 * -------------------------------------------------------------------------- */

interface TrayProps {
  items: MatrixItem[];
  total: number;
  chipState: (id: string) => ChipState;
  isMovable: (id: string) => boolean;
  selectedItem?: MatrixItem;
  onSelect: (id: string) => void;
  onReturn: (id: string) => void;
  reduced: boolean;
  t: Translator;
}

function Tray({
  items,
  total,
  chipState,
  isMovable,
  selectedItem,
  onSelect,
  onReturn,
  reduced,
  t,
}: TrayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID });
  const canReturn = selectedItem && !items.some((i) => i.id === selectedItem.id);
  return (
    <section
      ref={setNodeRef}
      className="nb-matrix__tray"
      data-over={isOver ? "true" : undefined}
      data-empty={items.length === 0 ? "true" : undefined}
      aria-label={t("matrix.tray")}
    >
      <div className="nb-matrix__tray-head">
        <span className="nb-matrix__tray-label">
          {t("matrix.tray")}
          <span className="nb-matrix__count" aria-hidden>
            {items.length}/{total}
          </span>
        </span>
        {canReturn && (
          <Button
            size="sm"
            variant="soft"
            leading={<CornerUpLeft aria-hidden />}
            onClick={() => onReturn(selectedItem.id)}
          >
            {t("matrix.returnToTray")}
          </Button>
        )}
      </div>
      <div className="nb-matrix__chips">
        {items.map((item) => (
          <Chip
            key={item.id}
            item={item}
            state={chipState(item.id)}
            draggable={isMovable(item.id)}
            reduced={reduced}
            onSelect={() => onSelect(item.id)}
          />
        ))}
        {items.length === 0 && <span className="nb-matrix__empty">{t("matrix.trayEmpty")}</span>}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Quadrant
 * -------------------------------------------------------------------------- */

interface QuadrantProps {
  moduleId: string;
  quadrant: MatrixQuadrant;
  axes: PriorityMatrixConfig["content"]["axes"];
  items: MatrixItem[];
  chipState: (id: string) => ChipState;
  isMovable: (id: string) => boolean;
  selectedItem?: MatrixItem;
  showExplanation: boolean;
  quadrantById: Map<string, MatrixQuadrant>;
  onSelect: (id: string) => void;
  onPlace: (id: string) => void;
  reduced: boolean;
  t: Translator;
}

function Quadrant({
  moduleId,
  quadrant,
  axes,
  items,
  chipState,
  isMovable,
  selectedItem,
  showExplanation,
  quadrantById,
  onSelect,
  onPlace,
  reduced,
  t,
}: QuadrantProps) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });
  const canPlace = selectedItem && !items.some((i) => i.id === selectedItem.id);
  const cell = quadrantCell(quadrant.position);
  const posId = `${moduleId}-q-${quadrant.id}-pos`;
  const placeLabel = t("matrix.placeIn", { quadrant: quadrant.label });
  return (
    <section
      ref={setNodeRef}
      className={clsx("nb-matrix__quadrant", canPlace && "nb-matrix__quadrant--target")}
      style={quadrantStyle(quadrant)}
      data-position={quadrant.position}
      data-over={isOver ? "true" : undefined}
      aria-label={quadrant.label}
      aria-describedby={posId}
      onClick={canPlace ? () => onPlace(selectedItem.id) : undefined}
    >
      <span id={posId} className="nb-sr-only">
        {t("matrix.cellPosition", {
          yLabel: axes.y.label,
          y: cell.y === "high" ? axes.y.high : axes.y.low,
          xLabel: axes.x.label,
          x: cell.x === "high" ? axes.x.high : axes.x.low,
        })}
      </span>
      <header className="nb-matrix__q-head">
        <span className="nb-matrix__q-label">{quadrant.label}</span>
        {quadrant.description && (
          <span className="nb-matrix__q-desc">
            <RichText text={quadrant.description} />
          </span>
        )}
      </header>
      <div className="nb-matrix__q-body">
        {items.map((item) => {
          const state = chipState(item.id);
          const wrong = state === "incorrect" || state === "revealed";
          const belongs = wrong ? quadrantById.get(item.quadrantId) : undefined;
          return (
            <div key={item.id} className="nb-matrix__placed">
              <Chip
                item={item}
                state={state}
                draggable={isMovable(item.id)}
                reduced={reduced}
                compact
                onSelect={() => onSelect(item.id)}
              />
              {state === "incorrect" && belongs && (
                <div className="nb-matrix__note">
                  <span className="nb-matrix__note-title">
                    {t("matrix.belongsIn", { quadrant: belongs.label })}
                  </span>
                  {showExplanation && item.explanation && (
                    <span className="nb-matrix__note-text">
                      <RichText text={item.explanation} />
                    </span>
                  )}
                </div>
              )}
              {(state === "correct" || state === "revealed") &&
                showExplanation &&
                item.explanation && (
                  <div className="nb-matrix__note nb-matrix__note--ok">
                    <span className="nb-matrix__note-text">
                      <RichText text={item.explanation} />
                    </span>
                  </div>
                )}
            </div>
          );
        })}
        {items.length === 0 && !canPlace && (
          <span className="nb-matrix__drop" aria-hidden>
            {t("matrix.dropHere")}
          </span>
        )}
        {canPlace && (
          <Button
            size="sm"
            variant="soft"
            className="nb-matrix__place"
            aria-label={placeLabel}
            onClick={(e) => {
              e.stopPropagation();
              onPlace(selectedItem.id);
            }}
          >
            {placeLabel}
          </Button>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Module
 * -------------------------------------------------------------------------- */

function PriorityMatrixRun({
  life,
  config,
  hideHeader,
  className,
}: PriorityMatrixProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior } = config;
  const { axes, items } = config.content;
  const quadrants = useMemo(
    () => sortQuadrants(config.content.quadrants),
    [config.content.quadrants],
  );
  const total = items.length;
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const quadrantById = useMemo(() => new Map(quadrants.map((q) => [q.id, q])), [quadrants]);

  const [seed] = useState(() => behavior.shuffleSeed ?? seedFromString(config.id, life.runId));
  const order = useMemo(
    () => (behavior.shuffle ? shuffle(items, seed) : items),
    [items, behavior.shuffle, seed],
  );

  const [assignments, setAssignments] = useState<Assignments>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PriorityMatrixEvaluation | null>(null);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [firstFraction, setFirstFraction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const checked = evaluation !== null;
  const locked = checked && (evaluation.correct || revealed);
  const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
  const canRetry = checked && !locked && behavior.allowRetry && !exhausted;
  const canReveal = checked && !locked && (attempts >= 2 || exhausted || !behavior.allowRetry);
  const placedCount = items.filter((i) => assignments[i.id]).length;
  const itemsLeft = total - placedCount;
  const trayItems = order.filter((i) => !assignments[i.id]);
  const isMovable = useCallback(
    (id: string) => !checked && !lockedIds.includes(id),
    [checked, lockedIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const place = useCallback(
    (itemId: string, quadrantId: string | undefined) => {
      const item = itemById.get(itemId);
      if (!item || !isMovable(itemId)) return;
      setAssignments((prev) => ({ ...prev, [itemId]: quadrantId }));
      setSelected(null);
      life.emit("module:interact", { itemId, quadrantId: quadrantId ?? null });
      const q = quadrantId ? quadrantById.get(quadrantId) : undefined;
      announce(
        q
          ? t("matrix.placed", { item: item.text, quadrant: q.label })
          : t("matrix.returned", { item: item.text }),
      );
    },
    [itemById, isMovable, life, quadrantById, announce, t],
  );

  const toggleSelect = useCallback(
    (itemId: string) => {
      if (!isMovable(itemId)) return;
      setSelected((prev) => (prev === itemId ? null : itemId));
    },
    [isMovable],
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    setActiveId(id);
    setSelected(id);
  }, []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const itemId = String(e.active.id);
      if (!e.over) {
        setSelected(null);
        return;
      }
      const target = String(e.over.id);
      place(itemId, target === TRAY_ID ? undefined : target);
    },
    [place],
  );
  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setSelected(null);
  }, []);

  const check = useCallback(() => {
    if (checked || itemsLeft > 0) return;
    const ev = evaluatePriorityMatrix(items, assignments);
    const n = attempts + 1;
    setAttempts(n);
    life.attempt();
    setEvaluation(ev);
    setSelected(null);
    if (firstFraction === null) setFirstFraction(ev.score);
    const willReveal =
      !ev.correct &&
      (!behavior.allowRetry || (behavior.maxAttempts > 0 && n >= behavior.maxAttempts));
    if (willReveal) {
      setRevealed(true);
      setAssignments(Object.fromEntries(items.map((i) => [i.id, i.quadrantId])));
    }
    life.emit("module:answer", {
      assignments,
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? `${t("a11y.correctAnswer")} ${t("matrix.allCorrect")}`
        : `${t("a11y.incorrectAnswer")} ${t("matrix.correctCount", { correct: ev.correctCount, total })}`,
    );
  }, [
    checked,
    itemsLeft,
    items,
    assignments,
    attempts,
    life,
    firstFraction,
    behavior,
    announce,
    t,
    total,
  ]);

  const retry = useCallback(() => {
    if (!evaluation) return;
    setLockedIds(items.filter((i) => evaluation.items[i.id]).map((i) => i.id));
    setAssignments((prev) =>
      Object.fromEntries(items.map((i) => [i.id, evaluation.items[i.id] ? prev[i.id] : undefined])),
    );
    setEvaluation(null);
    life.emit("module:interact", { action: "retry" });
  }, [evaluation, items, life]);

  const reveal = useCallback(() => {
    setRevealed(true);
    setAssignments(Object.fromEntries(items.map((i) => [i.id, i.quadrantId])));
    life.emit("module:interact", { action: "reveal" });
    announce(t("matrix.expert"));
  }, [items, life, announce, t]);

  const score = evaluation
    ? priorityMatrixScore({
        attempts,
        allCorrect: evaluation.correct,
        revealed,
        firstFraction: firstFraction ?? 0,
      })
    : 0;

  const finish = useCallback(() => {
    if (!evaluation) return;
    setFinished(true);
    life.complete({
      score,
      correct: evaluation.correctCount,
      total,
      details: { attempts, revealed, firstFraction, assignments },
    });
    announce(t("a11y.moduleComplete"));
  }, [evaluation, score, life, total, attempts, revealed, firstFraction, assignments, announce, t]);

  const chipState = (itemId: string): ChipState => {
    if (revealed && evaluation && !evaluation.items[itemId]) return "revealed";
    if (evaluation) return evaluation.items[itemId] ? "correct" : "incorrect";
    if (lockedIds.includes(itemId)) return "locked";
    if (selected === itemId) return "selected";
    return "idle";
  };

  const matrixLabel = t("matrix.label", { y: axes.y.label, x: axes.x.label });

  if (finished && evaluation) {
    return (
      <ModuleShell
        type="priority-matrix"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        width="wide"
        announcement={message}
      >
        <CompletionCard
          score={score}
          text={
            config.feedback.complete ??
            (evaluation.correct
              ? t("matrix.allCorrect")
              : t("matrix.correctCount", { correct: evaluation.correctCount, total }))
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
          <div className="nb-matrix__summary" role="group" aria-label={t("matrix.expert")}>
            {quadrants.map((q) => (
              <div key={q.id} className="nb-matrix__summary-cell" style={quadrantStyle(q)}>
                <span className="nb-matrix__summary-label">{q.label}</span>
                <ul className="nb-matrix__summary-items">
                  {items
                    .filter((i) => i.quadrantId === q.id)
                    .map((i) => (
                      <li key={i.id}>
                        <RichText text={i.text} />
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </CompletionCard>
      </ModuleShell>
    );
  }

  const activeItem = activeId ? itemById.get(activeId) : undefined;
  const selectedItem = selected ? itemById.get(selected) : undefined;

  return (
    <ModuleShell
      type="priority-matrix"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("matrix.instructions"))}
      appearance={config.appearance}
      className={className}
      width="wide"
      announcement={message}
      aside={
        <span className="nb-counter">
          {checked
            ? t("matrix.correctCount", { correct: evaluation.correctCount, total })
            : t("matrix.placedCount", { count: placedCount, total })}
        </span>
      }
    >
      <DndContext
        id={`${config.id}-dnd`}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          screenReaderInstructions: { draggable: t("matrix.selectInstructions") },
          announcements: {
            onDragStart: ({ active }) =>
              t("a11y.pickedUp", { item: itemById.get(String(active.id))?.text ?? "" }),
            onDragOver: ({ over }) =>
              over && over.id !== TRAY_ID
                ? t("matrix.placeIn", { quadrant: quadrantById.get(String(over.id))?.label ?? "" })
                : undefined,
            onDragEnd: () => undefined,
            onDragCancel: ({ active }) =>
              t("a11y.dropCancelled", { item: itemById.get(String(active.id))?.text ?? "" }),
          },
        }}
      >
        <LayoutGroup id={config.id}>
          {!locked && (
            <Tray
              items={trayItems}
              total={total}
              chipState={chipState}
              isMovable={isMovable}
              selectedItem={selectedItem}
              onSelect={toggleSelect}
              onReturn={(id) => place(id, undefined)}
              reduced={reduced}
              t={t}
            />
          )}

          <div className="nb-matrix" role="group" aria-label={matrixLabel}>
            <Axis axis={axes.y} orientation="y" />
            <div className="nb-matrix__grid">
              {quadrants.map((q) => (
                <Quadrant
                  key={q.id}
                  moduleId={config.id}
                  quadrant={q}
                  axes={axes}
                  items={order.filter((i) => assignments[i.id] === q.id)}
                  chipState={chipState}
                  isMovable={isMovable}
                  selectedItem={selectedItem}
                  showExplanation={checked && behavior.showExplanation}
                  quadrantById={quadrantById}
                  onSelect={toggleSelect}
                  onPlace={(id) => place(id, q.id)}
                  reduced={reduced}
                  t={t}
                />
              ))}
            </div>
            <span className="nb-matrix__corner" aria-hidden />
            <Axis axis={axes.x} orientation="x" />
          </div>
        </LayoutGroup>

        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {activeItem ? (
            <div className="nb-matrix__chip nb-matrix__chip--overlay" data-state="selected">
              <span className="nb-matrix__chip-text">
                <RichText text={activeItem.text} />
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {checked && behavior.showExplanation && (
        <ul className="nb-matrix__review" aria-label={t("common.review")}>
          {order
            .filter((i) => i.explanation)
            .map((i) => {
              const state = chipState(i.id);
              const belongs = quadrantById.get(i.quadrantId);
              return (
                <li key={i.id} className="nb-matrix__review-item" data-state={state}>
                  <span
                    className="nb-matrix__review-icon"
                    role="img"
                    aria-label={state === "incorrect" ? t("common.incorrect") : t("common.correct")}
                  >
                    {state === "incorrect" ? <X strokeWidth={3} /> : <Check strokeWidth={3} />}
                  </span>
                  <span className="nb-matrix__review-body">
                    <strong>
                      <RichText text={i.text} />
                    </strong>
                    {state === "incorrect" && belongs && (
                      <span className="nb-matrix__review-belongs">
                        {t("matrix.belongsIn", { quadrant: belongs.label })}
                      </span>
                    )}
                    <RichText text={i.explanation!} />
                  </span>
                </li>
              );
            })}
        </ul>
      )}

      <AnimatedFeedback
        show={checked}
        tone={
          evaluation?.correct
            ? "correct"
            : revealed
              ? "info"
              : evaluation && evaluation.correctCount > 0
                ? "partial"
                : "incorrect"
        }
        title={evaluation?.correct ? t("matrix.allCorrect") : t("common.incorrect")}
        text={
          evaluation
            ? evaluation.correct
              ? (config.feedback.correct ?? undefined)
              : (config.feedback.incorrect ??
                t("matrix.correctCount", { correct: evaluation.correctCount, total }))
            : undefined
        }
      />

      {locked && behavior.showExplanation && <Explanation text={config.content.explanation} />}

      <div className="nb-matrix__footer">
        <span className="nb-muted nb-text-sm">
          {!checked && itemsLeft > 0 ? t("matrix.itemsLeft", { count: itemsLeft }) : ""}
        </span>
        <div className="nb-module__actions">
          {canReveal && (
            <Button variant="ghost" onClick={reveal} leading={<Eye aria-hidden />}>
              {t("common.showAnswer")}
            </Button>
          )}
          {canRetry && (
            <Button variant="secondary" onClick={retry}>
              {t("common.retry")}
            </Button>
          )}
          {!checked ? (
            <Button variant="primary" onClick={check} disabled={itemsLeft > 0}>
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

export default PriorityMatrix;
