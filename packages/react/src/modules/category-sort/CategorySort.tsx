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
  categorySortSchema,
  evaluateCategorySort,
  shuffle,
  type Category,
  type CategorySortConfig,
  type CategorySortEvaluation,
  type SortItem,
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
import { Hint } from "../../primitives/Hint";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./category-sort.css";

export type CategorySortProps = ModuleProps<CategorySortConfig>;

type ChipState = "idle" | "selected" | "correct" | "incorrect" | "locked" | "revealed";
type Assignments = Record<string, string | undefined>;

const POOL_ID = "__pool";
const COLOR_TOKENS: Record<string, string> = {
  accent: "var(--nb-accent)",
  success: "var(--nb-success)",
  info: "var(--nb-info)",
  warning: "var(--nb-warning)",
};

function categoryStyle(color?: string): CSSProperties | undefined {
  if (!color) return undefined;
  const token = Object.prototype.hasOwnProperty.call(COLOR_TOKENS, color)
    ? COLOR_TOKENS[color]
    : undefined;
  return { "--nb-sort-color": token ?? color } as CSSProperties;
}

/** Fraction correct on the first check; if eventually all correct, decays 0.25 per extra attempt down to 0.5. */
function sortScore(attempts: number, allCorrect: boolean, firstFraction: number): number {
  if (allCorrect) return attempts <= 1 ? 1 : Math.max(0.5, 1 - 0.25 * (attempts - 1));
  return firstFraction;
}

export function CategorySort({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: CategorySortProps) {
  const parsed = useMemo(() => categorySortSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="category-sort"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <CategorySortInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function CategorySortInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: CategorySortProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "category-sort",
    onComplete,
    onEvent,
    resetKey,
  });
  return (
    <CategorySortGame
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface GameProps {
  config: CategorySortConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

function CategorySortGame({ config, life, hideHeader, className }: GameProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior } = config;
  const { categories, items } = config.content;
  const total = items.length;
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [seed] = useState(() => behavior.shuffleSeed ?? seedFromString(config.id, life.runId));
  const order = useMemo(
    () => (behavior.shuffle ? shuffle(items, seed) : items),
    [items, behavior.shuffle, seed],
  );

  const [assignments, setAssignments] = useState<Assignments>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<CategorySortEvaluation | null>(null);
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
  const poolItems = order.filter((i) => !assignments[i.id]);
  const isMovable = useCallback(
    (id: string) => !checked && !lockedIds.includes(id),
    [checked, lockedIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const place = useCallback(
    (itemId: string, categoryId: string | undefined) => {
      const item = itemById.get(itemId);
      if (!item || !isMovable(itemId)) return;
      setAssignments((prev) => ({ ...prev, [itemId]: categoryId }));
      setSelected(null);
      life.emit("module:interact", { itemId, categoryId: categoryId ?? null });
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      announce(
        category
          ? t("sort.placed", { item: item.text, category: category.label })
          : `${item.text}: ${t("sort.unsorted")}`,
      );
    },
    [itemById, isMovable, life, categoryById, announce, t],
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
      place(itemId, target === POOL_ID ? undefined : target);
    },
    [place],
  );
  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setSelected(null);
  }, []);

  const check = useCallback(() => {
    if (checked || itemsLeft > 0) return;
    const ev = evaluateCategorySort(items, assignments);
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
      setAssignments(Object.fromEntries(items.map((i) => [i.id, i.categoryId])));
    }
    life.emit("module:answer", {
      assignments,
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? `${t("a11y.correctAnswer")} ${t("sort.allCorrect")}`
        : `${t("a11y.incorrectAnswer")} ${t("sort.correctCount", { correct: ev.correctCount, total })}`,
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
    const correctIds = items.filter((i) => evaluation.items[i.id]).map((i) => i.id);
    setLockedIds(correctIds);
    setAssignments((prev) =>
      Object.fromEntries(items.map((i) => [i.id, evaluation.items[i.id] ? prev[i.id] : undefined])),
    );
    setEvaluation(null);
    life.emit("module:interact", { action: "retry" });
  }, [evaluation, items, life]);

  const reveal = useCallback(() => {
    setRevealed(true);
    setAssignments(Object.fromEntries(items.map((i) => [i.id, i.categoryId])));
    life.emit("module:interact", { action: "reveal" });
    announce(t("common.showAnswer"));
  }, [items, life, announce, t]);

  const finish = useCallback(() => {
    if (!evaluation) return;
    const score = sortScore(attempts, evaluation.correct, firstFraction ?? 0);
    setFinished(true);
    life.complete({
      score,
      correct: evaluation.correctCount,
      total,
      details: { attempts, revealed, firstFraction },
    });
    announce(t("a11y.moduleComplete"));
  }, [evaluation, attempts, firstFraction, life, total, revealed, announce, t]);

  const chipState = (itemId: string): ChipState => {
    if (revealed && evaluation && !evaluation.items[itemId]) return "revealed";
    if (evaluation) return evaluation.items[itemId] ? "correct" : "incorrect";
    if (lockedIds.includes(itemId)) return "locked";
    if (selected === itemId) return "selected";
    return "idle";
  };

  if (finished && evaluation) {
    const score = sortScore(attempts, evaluation.correct, firstFraction ?? 0);
    return (
      <ModuleShell
        type="category-sort"
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
              ? t("sort.allCorrect")
              : t("sort.correctCount", { correct: evaluation.correctCount, total }))
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
          <ul className="nb-sort__summary">
            {categories.map((c) => (
              <li key={c.id} className="nb-sort__summary-cat" style={categoryStyle(c.color)}>
                <span className="nb-sort__summary-label">{c.label}</span>
                <span className="nb-sort__summary-items">
                  {items
                    .filter((i) => i.categoryId === c.id)
                    .map((i) => i.text)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </CompletionCard>
      </ModuleShell>
    );
  }

  const activeItem = activeId ? itemById.get(activeId) : undefined;
  const selectedItem = selected ? itemById.get(selected) : undefined;

  return (
    <ModuleShell
      type="category-sort"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("sort.instructions"))}
      appearance={config.appearance}
      className={className}
      width="wide"
      announcement={message}
      aside={
        <span className="nb-counter">
          {checked
            ? t("sort.correctCount", { correct: evaluation.correctCount, total })
            : t("sort.itemsLeft", { count: itemsLeft })}
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
          screenReaderInstructions: { draggable: t("a11y.dragInstructions") },
          announcements: {
            onDragStart: ({ active }) =>
              t("a11y.pickedUp", { item: itemById.get(String(active.id))?.text ?? "" }),
            onDragOver: ({ over }) =>
              over && over.id !== POOL_ID
                ? t("sort.placeIn", { category: categoryById.get(String(over.id))?.label ?? "" })
                : undefined,
            onDragEnd: () => undefined,
            onDragCancel: ({ active }) =>
              t("a11y.dropCancelled", { item: itemById.get(String(active.id))?.text ?? "" }),
          },
        }}
      >
        <LayoutGroup id={config.id}>
          <Pool
            items={poolItems}
            chipState={chipState}
            isMovable={isMovable}
            selectedItem={selectedItem}
            onSelect={toggleSelect}
            onReturn={(id) => place(id, undefined)}
            reduced={reduced}
            t={t}
          />

          <div className="nb-sort__zones" data-count={categories.length}>
            {categories.map((c) => (
              <Zone
                key={c.id}
                category={c}
                items={items.filter((i) => assignments[i.id] === c.id)}
                chipState={chipState}
                isMovable={isMovable}
                selectedItem={selectedItem}
                showExplanation={checked && behavior.showExplanation}
                categoryById={categoryById}
                onSelect={toggleSelect}
                onPlace={(id) => place(id, c.id)}
                onRemove={(id) => place(id, undefined)}
                reduced={reduced}
                t={t}
              />
            ))}
          </div>
        </LayoutGroup>

        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {activeItem ? (
            <div className="nb-sort__chip nb-sort__chip--overlay" data-state="selected">
              <span className="nb-sort__chip-text">
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
        title={evaluation?.correct ? t("sort.allCorrect") : t("common.incorrect")}
        text={
          evaluation
            ? evaluation.correct
              ? (config.feedback.correct ?? undefined)
              : (config.feedback.incorrect ??
                t("sort.correctCount", { correct: evaluation.correctCount, total }))
            : undefined
        }
      />

      <div className="nb-sort__footer">
        <span className="nb-muted nb-text-sm">
          {!checked && itemsLeft > 0 ? t("sort.itemsLeft", { count: itemsLeft }) : ""}
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

type Translator = ReturnType<typeof useNibblearn>["t"];

interface PoolProps {
  items: SortItem[];
  chipState: (id: string) => ChipState;
  isMovable: (id: string) => boolean;
  selectedItem?: SortItem;
  onSelect: (id: string) => void;
  onReturn: (id: string) => void;
  reduced: boolean;
  t: Translator;
}

function Pool({
  items,
  chipState,
  isMovable,
  selectedItem,
  onSelect,
  onReturn,
  reduced,
  t,
}: PoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID });
  const canReturn = selectedItem && !items.some((i) => i.id === selectedItem.id);
  return (
    <section
      ref={setNodeRef}
      className="nb-sort__pool"
      data-over={isOver ? "true" : undefined}
      data-empty={items.length === 0 ? "true" : undefined}
      aria-label={t("sort.unsorted")}
    >
      <div className="nb-sort__pool-head">
        <span className="nb-sort__pool-label">{t("sort.unsorted")}</span>
        {canReturn && (
          <Button
            size="sm"
            variant="soft"
            leading={<CornerUpLeft aria-hidden />}
            onClick={() => onReturn(selectedItem.id)}
          >
            {t("sort.removeFrom")}
          </Button>
        )}
      </div>
      <div className="nb-sort__chips">
        {items.map((item) => (
          <Chip
            key={item.id}
            item={item}
            state={chipState(item.id)}
            draggable={isMovable(item.id)}
            onSelect={() => onSelect(item.id)}
            reduced={reduced}
          />
        ))}
        {items.length === 0 && (
          <span className="nb-sort__empty">{t("sort.itemsLeft", { count: 0 })}</span>
        )}
      </div>
    </section>
  );
}

interface ZoneProps {
  category: Category;
  items: SortItem[];
  chipState: (id: string) => ChipState;
  isMovable: (id: string) => boolean;
  selectedItem?: SortItem;
  showExplanation: boolean;
  categoryById: Map<string, Category>;
  onSelect: (id: string) => void;
  onPlace: (id: string) => void;
  onRemove: (id: string) => void;
  reduced: boolean;
  t: Translator;
}

function Zone({
  category,
  items,
  chipState,
  isMovable,
  selectedItem,
  showExplanation,
  categoryById,
  onSelect,
  onPlace,
  onRemove,
  reduced,
  t,
}: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id });
  const canPlace = selectedItem && !items.some((i) => i.id === selectedItem.id);
  const placeLabel = t("sort.placeIn", { category: category.label });
  return (
    <section
      ref={setNodeRef}
      className={clsx("nb-sort__zone", canPlace && "nb-sort__zone--target")}
      style={categoryStyle(category.color)}
      data-over={isOver ? "true" : undefined}
      aria-label={category.label}
      onClick={canPlace ? () => onPlace(selectedItem.id) : undefined}
    >
      <header className="nb-sort__zone-head">
        <div className="nb-sort__zone-title">
          <span className="nb-sort__zone-label">{category.label}</span>
          <span className="nb-sort__zone-count" aria-hidden>
            {items.length}
          </span>
        </div>
        {category.description && (
          <p className="nb-sort__zone-desc">
            <RichText text={category.description} />
          </p>
        )}
      </header>
      <div className="nb-sort__zone-body">
        {items.map((item) => {
          const state = chipState(item.id);
          const wrong = state === "incorrect" || state === "revealed";
          const belongs = wrong ? categoryById.get(item.categoryId) : undefined;
          return (
            <div key={item.id} className="nb-sort__placed">
              <div className="nb-sort__placed-row">
                <Chip
                  item={item}
                  state={state}
                  draggable={isMovable(item.id)}
                  onSelect={() => onSelect(item.id)}
                  reduced={reduced}
                />
                {isMovable(item.id) && (
                  <Button
                    icon
                    size="sm"
                    variant="ghost"
                    className="nb-sort__remove"
                    aria-label={`${t("sort.removeFrom")}: ${item.text}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </div>
              {wrong && belongs && (
                <div className="nb-sort__note">
                  <span className="nb-sort__note-title">
                    {t("sort.belongsIn", { category: belongs.label })}
                  </span>
                  {showExplanation && item.explanation && (
                    <span className="nb-sort__note-text">
                      <RichText text={item.explanation} />
                    </span>
                  )}
                </div>
              )}
              {state === "correct" && showExplanation && item.explanation && (
                <div className="nb-sort__note nb-sort__note--ok">
                  <span className="nb-sort__note-text">
                    <RichText text={item.explanation} />
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && !canPlace && (
          <span className="nb-sort__empty" aria-hidden>
            {t("match.dropHere")}
          </span>
        )}
        {canPlace && (
          <Button
            size="sm"
            variant="soft"
            className="nb-sort__place"
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

interface ChipProps {
  item: SortItem;
  state: ChipState;
  draggable: boolean;
  onSelect: () => void;
  reduced: boolean;
}

function Chip({ item, state, draggable, onSelect, reduced }: ChipProps) {
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
      className="nb-sort__chip-slot"
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <button
        ref={setNodeRef}
        type="button"
        className="nb-sort__chip"
        data-state={state}
        data-dragging={isDragging ? "true" : undefined}
        aria-pressed={state === "selected"}
        aria-disabled={!draggable || undefined}
        aria-describedby={attributes["aria-describedby"]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...listeners}
      >
        <span className="nb-sort__chip-text">
          <RichText text={item.text} />
        </span>
        {marked && (
          <span className="nb-sort__chip-mark" aria-hidden>
            {state === "incorrect" ? <X strokeWidth={3} /> : <Check strokeWidth={3} />}
          </span>
        )}
      </button>
    </motion.div>
  );
}

export default CategorySort;
