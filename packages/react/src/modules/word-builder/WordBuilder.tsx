import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Eye, X } from "lucide-react";
import clsx from "clsx";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  buildWordTiles,
  evaluateWordOrder,
  isOperatorToken,
  scoreWordItem,
  wordBuilderSchema,
  type WordBuilderConfig,
  type WordBuilderItem,
  type WordOrderEvaluation,
  type WordTile,
  seedFromString,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { Explanation } from "../../primitives/Explanation";
import { Hint } from "../../primitives/Hint";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./word-builder.css";

export type WordBuilderProps = ModuleProps<WordBuilderConfig>;

type Translator = ReturnType<typeof useNibblearn>["t"];
type Display = WordBuilderItem["display"];
type TileState = "idle" | "correct" | "incorrect";

interface ItemRecord {
  id?: string;
  correct: boolean;
  revealed: boolean;
  attempts: number;
  score: number;
  /** Placed tokens at the last check. */
  placed: string[];
}

export function WordBuilder({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: WordBuilderProps) {
  const parsed = useMemo(() => wordBuilderSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="word-builder"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <WordBuilderInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts WordBuilderRun with fresh state (keyed by runId). */
function WordBuilderInner(props: WordBuilderProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "word-builder",
    onComplete,
    onEvent,
    resetKey,
  });
  return <WordBuilderRun key={life.runId} {...props} life={life} />;
}

/* ----------------------------------------------------------------------------
 * Token rendering (shared by tiles, the solution line and the summary)
 * -------------------------------------------------------------------------- */

function tokenKind(display: Display, text: string): "operator" | "word" {
  return display === "formula" && isOperatorToken(text) ? "operator" : "word";
}

function AnswerLine({ tokens, display }: { tokens: readonly string[]; display: Display }) {
  if (display === "sentence") {
    return <span className="nb-word__line">{tokens.join(" ")}</span>;
  }
  return (
    <span className="nb-word__line" data-display="formula">
      {tokens.map((tok, i) => (
        <span key={i} className="nb-word__line-token" data-kind={tokenKind(display, tok)}>
          {tok}
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * A placed tile: sortable, tap to send back
 * -------------------------------------------------------------------------- */

interface PlacedTileProps {
  tile: WordTile;
  index: number;
  display: Display;
  state: TileState;
  interactive: boolean;
  layoutId?: string;
  layoutDependency: string;
  reduced: boolean;
  onActivate: (id: string) => void;
  setRef: (id: string, el: HTMLButtonElement | null) => void;
  t: Translator;
}

function PlacedTile({
  tile,
  index,
  display,
  state,
  interactive,
  layoutId,
  layoutDependency,
  reduced,
  onActivate,
  setRef,
  t,
}: PlacedTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id, disabled: !interactive });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: reduced ? undefined : transition,
  };
  const label = t("word.placedTile", { word: tile.text, position: index + 1 });
  const stateLabel =
    state === "correct" ? t("common.correct") : state === "incorrect" ? t("common.incorrect") : "";
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="nb-word__slot"
      data-dragging={isDragging ? "true" : undefined}
    >
      <motion.span
        className="nb-word__fly"
        layoutId={layoutId}
        layoutDependency={layoutDependency}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
      >
        <button
          ref={(el) => {
            setActivatorNodeRef(el);
            setRef(tile.id, el);
          }}
          type="button"
          className="nb-word__tile"
          data-state={state}
          data-kind={tokenKind(display, tile.text)}
          data-display={display}
          aria-label={stateLabel ? `${label}, ${stateLabel}` : label}
          aria-describedby={interactive ? attributes["aria-describedby"] : undefined}
          aria-disabled={!interactive || undefined}
          onClick={() => {
            if (interactive) onActivate(tile.id);
          }}
          {...(interactive ? listeners : {})}
        >
          <span className="nb-word__text">{tile.text}</span>
          {state !== "idle" && (
            <span className="nb-word__mark" aria-hidden>
              {state === "correct" ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
            </span>
          )}
        </button>
      </motion.span>
    </li>
  );
}

/* ----------------------------------------------------------------------------
 * One item (keyed by index: fresh state per item)
 * -------------------------------------------------------------------------- */

interface ItemViewProps {
  moduleId: string;
  runId: number;
  item: WordBuilderItem;
  index: number;
  isLast: boolean;
  seed: number;
  behavior: WordBuilderConfig["behavior"];
  feedback: WordBuilderConfig["feedback"];
  focusOnMount: boolean;
  announce: (text: string) => void;
  life: ModuleLifecycle;
  onResolve: (record: ItemRecord) => void;
  onNext: () => void;
}

function ItemView({
  moduleId,
  runId,
  item,
  index,
  isLast,
  seed,
  behavior,
  feedback,
  focusOnMount,
  announce,
  life,
  onResolve,
  onNext,
}: ItemViewProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const display = item.display;
  const tiles = useMemo(() => buildWordTiles(item, seed), [item, seed]);
  const tileById = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);

  const [placed, setPlaced] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<WordOrderEvaluation | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const bankRefs = useRef(new Map<string, HTMLButtonElement>());
  const placedRefs = useRef(new Map<string, HTMLButtonElement>());
  const checkRef = useRef<HTMLButtonElement>(null);
  /** Clicks that follow a drag (pointer or keyboard) must not send the tile back. */
  const suppressClickUntil = useRef(0);

  const checked = evaluation !== null;
  const editable = !checked && !locked;
  const placedSet = useMemo(() => new Set(placed), [placed]);
  const placedTexts = useMemo(
    () => placed.map((id) => tileById.get(id)?.text ?? ""),
    [placed, tileById],
  );
  const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
  const canRetry = checked && !locked && behavior.allowRetry && !exhausted;
  const canReveal = canRetry && attempts >= 2;
  const layoutDependency = `${placed.join(",")}|${locked ? 1 : 0}`;
  const layoutKey = (id: string) => (reduced ? undefined : `${moduleId}-${runId}-${index}-${id}`);

  useEffect(() => {
    if (!focusOnMount) return;
    const first = tiles.find((tile) => bankRefs.current.has(tile.id));
    if (first) bankRefs.current.get(first.id)?.focus();
  }, [focusOnMount, tiles]);

  const setBankRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) bankRefs.current.set(id, el);
    else bankRefs.current.delete(id);
  }, []);
  const setPlacedRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) placedRefs.current.set(id, el);
    else placedRefs.current.delete(id);
  }, []);

  const focusLater = useCallback((get: () => HTMLElement | null | undefined) => {
    requestAnimationFrame(() => get()?.focus());
  }, []);

  const add = useCallback(
    (id: string) => {
      if (!editable || placedSet.has(id)) return;
      const tile = tileById.get(id);
      if (!tile) return;
      const next = [...placed, id];
      setPlaced(next);
      life.emit("module:interact", {
        itemIndex: index,
        action: "add",
        token: tile.text,
        position: next.length,
      });
      announce(t("word.added", { word: tile.text, position: next.length }));
      // Keep keyboard focus in the bank: the next free tile after this one, else Check.
      const start = tiles.findIndex((x) => x.id === id);
      const rotated = [...tiles.slice(start + 1), ...tiles.slice(0, start)];
      const nextFree = rotated.find((x) => !next.includes(x.id));
      focusLater(() =>
        nextFree ? bankRefs.current.get(nextFree.id) : (checkRef.current ?? undefined),
      );
    },
    [editable, placedSet, tileById, placed, life, index, announce, t, tiles, focusLater],
  );

  const remove = useCallback(
    (id: string, moveFocus: boolean) => {
      if (!editable) return;
      const at = placed.indexOf(id);
      if (at < 0) return;
      const tile = tileById.get(id);
      const next = placed.filter((x) => x !== id);
      setPlaced(next);
      life.emit("module:interact", {
        itemIndex: index,
        action: "remove",
        token: tile?.text,
        position: at + 1,
      });
      announce(t("word.removed", { word: tile?.text ?? "" }));
      if (moveFocus) {
        const neighbour = next[at] ?? next[at - 1];
        focusLater(() =>
          neighbour ? placedRefs.current.get(neighbour) : bankRefs.current.get(id),
        );
      }
    },
    [editable, placed, tileById, life, index, announce, t, focusLater],
  );

  const onPlacedActivate = useCallback(
    (id: string) => {
      if (Date.now() < suppressClickUntil.current) return;
      remove(id, true);
    },
    [remove],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Backspace" || activeId || !editable || placed.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
      const last = placed[placed.length - 1]!;
      const focusedPlaced = target ? placedRefs.current.get(last) === target : false;
      remove(last, focusedPlaced);
    },
    [activeId, editable, placed, remove],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter sends the tile back (a click); Space picks it up to reorder.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    suppressClickUntil.current = Number.POSITIVE_INFINITY;
    setActiveId(String(e.active.id));
  }, []);
  const endDrag = useCallback(() => {
    suppressClickUntil.current = Date.now() + 400;
    setActiveId(null);
  }, []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      endDrag();
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const from = placed.indexOf(String(active.id));
      const to = placed.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      setPlaced((prev) => arrayMove(prev, from, to));
      const token = tileById.get(String(active.id))?.text ?? "";
      life.emit("module:interact", { itemIndex: index, action: "move", token, from, to });
      announce(t("a11y.movedTo", { item: token, position: to + 1 }));
    },
    [endDrag, placed, tileById, life, index, announce, t],
  );

  const check = useCallback(() => {
    if (!editable || placed.length === 0) return;
    const ev = evaluateWordOrder(item, placedTexts);
    const n = attempts + 1;
    setAttempts(n);
    life.attempt();
    setEvaluation(ev);
    const out = behavior.maxAttempts > 0 && n >= behavior.maxAttempts;
    const done = ev.correct || !behavior.allowRetry || out;
    life.emit("module:answer", {
      itemIndex: index,
      placed: placedTexts,
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? `${t("a11y.correctAnswer")} ${t("word.allCorrect")}`
        : `${t("a11y.incorrectAnswer")} ${t("word.positionsCorrect", {
            correct: ev.correctCount,
            total: item.tokens.length,
          })}${done ? ` ${t("word.correctAnswer")}: ${item.tokens.join(" ")}` : ""}`,
    );
    if (done) {
      setLocked(true);
      onResolve({
        ...(item.id ? { id: item.id } : {}),
        correct: ev.correct,
        revealed: false,
        attempts: n,
        score: Number(
          scoreWordItem({ correct: ev.correct, attempts: n, lastScore: ev.score }).toFixed(4),
        ),
        placed: placedTexts,
      });
    }
  }, [
    editable,
    placed,
    item,
    placedTexts,
    attempts,
    life,
    behavior,
    index,
    announce,
    t,
    onResolve,
  ]);

  const retry = useCallback(() => {
    if (!evaluation) return;
    const keep = placed.slice(0, evaluation.prefix);
    setPlaced(keep);
    setEvaluation(null);
    life.emit("module:interact", { itemIndex: index, action: "retry", kept: keep.length });
    announce(t("word.cleared"));
    const firstFree = tiles.find((tile) => !keep.includes(tile.id));
    focusLater(() => (firstFree ? bankRefs.current.get(firstFree.id) : checkRef.current));
  }, [evaluation, placed, life, index, announce, t, tiles, focusLater]);

  const reveal = useCallback(() => {
    if (!evaluation) return;
    setLocked(true);
    life.emit("module:interact", { itemIndex: index, action: "reveal" });
    announce(`${t("word.correctAnswer")}: ${item.tokens.join(" ")}`);
    onResolve({
      ...(item.id ? { id: item.id } : {}),
      correct: false,
      revealed: true,
      attempts,
      score: Number(
        scoreWordItem({ correct: false, attempts, lastScore: evaluation.score }).toFixed(4),
      ),
      placed: placedTexts,
    });
  }, [evaluation, life, index, announce, t, item, attempts, placedTexts, onResolve]);

  const tileState = (i: number): TileState => {
    if (!evaluation) return "idle";
    return evaluation.positions[i] ? "correct" : "incorrect";
  };

  const activeTile = activeId ? tileById.get(activeId) : undefined;
  const solved = locked && evaluation?.correct === true;
  const answerId = `${moduleId}-w${index}-answer`;

  return (
    <div className="nb-word__item" onKeyDown={onKeyDown}>
      <h3 className="nb-word__prompt">
        <RichText text={item.prompt} />
      </h3>

      <div
        className="nb-word__answer-wrap"
        data-state={solved ? "solved" : checked ? "checked" : undefined}
      >
        <span id={answerId} className="nb-sr-only">
          {t("word.answer")}
        </span>
        <DndContext
          id={`${moduleId}-w${index}-dnd`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={endDrag}
          accessibility={{
            screenReaderInstructions: { draggable: t("word.dragInstructions") },
            announcements: {
              onDragStart: ({ active }) =>
                t("a11y.pickedUp", { item: tileById.get(String(active.id))?.text ?? "" }),
              onDragOver: ({ active, over }) =>
                over
                  ? t("a11y.movedTo", {
                      item: tileById.get(String(active.id))?.text ?? "",
                      position: placed.indexOf(String(over.id)) + 1,
                    })
                  : undefined,
              onDragEnd: ({ active, over }) =>
                over
                  ? t("a11y.movedTo", {
                      item: tileById.get(String(active.id))?.text ?? "",
                      position: placed.indexOf(String(over.id)) + 1,
                    })
                  : undefined,
              onDragCancel: ({ active }) =>
                t("a11y.dropCancelled", { item: tileById.get(String(active.id))?.text ?? "" }),
            },
          }}
        >
          <SortableContext items={placed} strategy={rectSortingStrategy} disabled={!editable}>
            <ol className="nb-word__answer" aria-labelledby={answerId} data-display={display}>
              {placed.map((id, i) => {
                const tile = tileById.get(id);
                if (!tile) return null;
                return (
                  <PlacedTile
                    key={id}
                    tile={tile}
                    index={i}
                    display={display}
                    state={tileState(i)}
                    interactive={editable}
                    layoutId={layoutKey(id)}
                    layoutDependency={layoutDependency}
                    reduced={reduced}
                    onActivate={onPlacedActivate}
                    setRef={setPlacedRef}
                    t={t}
                  />
                );
              })}
            </ol>
          </SortableContext>
          <DragOverlay dropAnimation={reduced ? null : undefined}>
            {activeTile ? (
              <span
                className="nb-word__tile nb-word__tile--overlay"
                data-kind={tokenKind(display, activeTile.text)}
                data-display={display}
              >
                <span className="nb-word__text">{activeTile.text}</span>
              </span>
            ) : null}
          </DragOverlay>
        </DndContext>
        {placed.length === 0 && (
          <span className="nb-word__empty" aria-hidden>
            {t("word.empty")}
          </span>
        )}
      </div>

      {!locked && (
        <div className="nb-word__bank" role="group" aria-label={t("word.bank")}>
          {tiles.map((tile) => {
            const used = placedSet.has(tile.id);
            return (
              <span key={tile.id} className="nb-word__cell">
                {used ? (
                  <span
                    className="nb-word__tile nb-word__tile--ghost"
                    data-display={display}
                    data-kind={tokenKind(display, tile.text)}
                    aria-hidden
                  >
                    <span className="nb-word__text">{tile.text}</span>
                  </span>
                ) : (
                  <motion.span
                    className="nb-word__fly"
                    layoutId={layoutKey(tile.id)}
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  >
                    <button
                      ref={(el) => setBankRef(tile.id, el)}
                      type="button"
                      className="nb-word__tile"
                      data-kind={tokenKind(display, tile.text)}
                      data-display={display}
                      disabled={!editable}
                      onClick={() => add(tile.id)}
                    >
                      <span className="nb-word__text">{tile.text}</span>
                    </button>
                  </motion.span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!locked && (
        <Hint text={item.hint} onReveal={() => life.emit("module:hint", { itemIndex: index })} />
      )}

      <AnimatedFeedback
        show={checked}
        tone={
          evaluation?.correct
            ? "correct"
            : evaluation && evaluation.correctCount > 0
              ? "partial"
              : "incorrect"
        }
        title={evaluation?.correct ? t("word.allCorrect") : t("common.incorrect")}
        text={
          evaluation
            ? evaluation.correct
              ? (feedback.correct ?? undefined)
              : (feedback.incorrect ??
                t("word.positionsCorrect", {
                  correct: evaluation.correctCount,
                  total: item.tokens.length,
                }))
            : undefined
        }
      />

      <AnimatePresence initial={false}>
        {locked && !solved && (
          <motion.div
            key="solution"
            className="nb-word__solution"
            role="group"
            aria-label={t("word.correctAnswer")}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className="nb-word__solution-label">
              <Eye aria-hidden />
              {t("word.correctAnswer")}
            </span>
            <AnswerLine tokens={item.tokens} display={display} />
          </motion.div>
        )}
      </AnimatePresence>

      {locked && behavior.showExplanation && <Explanation text={item.explanation} />}

      <div className="nb-word__footer">
        {editable ? (
          <span className="nb-word__kbd nb-muted">{t("word.keyboardHint")}</span>
        ) : (
          <span />
        )}
        <div className="nb-module__actions">
          {canReveal && (
            <Button variant="ghost" onClick={reveal} leading={<Eye aria-hidden />}>
              {t("common.showAnswer")}
            </Button>
          )}
          {locked ? (
            <Button
              key="next"
              variant="primary"
              onClick={onNext}
              trailing={<ArrowRight aria-hidden />}
              autoFocus
            >
              {isLast ? t("common.finish") : t("common.next")}
            </Button>
          ) : canRetry ? (
            <Button key="retry" variant="primary" onClick={retry} autoFocus>
              {t("common.retry")}
            </Button>
          ) : (
            <Button
              key="check"
              ref={checkRef}
              variant="primary"
              onClick={check}
              disabled={!editable || placed.length === 0}
            >
              {t("common.check")}
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

function WordBuilderRun({
  life,
  config,
  hideHeader,
  className,
}: WordBuilderProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { items } = config.content;
  const { behavior } = config;
  const total = items.length;

  const [seed] = useState(() => behavior.shuffleSeed ?? seedFromString(config.id, life.runId));
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<ItemRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const item = items[index]!;
  const resolved = records.length > index;

  const onResolve = useCallback(
    (record: ItemRecord) => setRecords((prev) => [...prev.slice(0, index), record]),
    [index],
  );

  const onNext = useCallback(() => {
    if (!resolved) return;
    if (index + 1 >= total) {
      const correct = records.filter((r) => r.correct).length;
      const score = records.reduce((s, r) => s + r.score, 0) / total;
      setFinished(true);
      life.complete({ score, correct, total, details: { items: records } });
      announce(t("a11y.moduleComplete"));
      return;
    }
    setIndex(index + 1);
  }, [resolved, index, total, records, life, announce, t]);

  const retryAll = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  const multi = behavior.showCounter && total > 1;

  if (finished) {
    const correct = records.filter((r) => r.correct).length;
    const firstTry = records.filter((r) => r.correct && r.attempts === 1).length;
    const score = records.reduce((s, r) => s + r.score, 0) / total;
    return (
      <ModuleShell
        type="word-builder"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={score}
          passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
          text={config.feedback.complete ?? t("word.summary", { correct, total })}
          stats={[
            { label: t("common.correct"), value: `${correct}/${total}` },
            { label: t("word.firstTry"), value: firstTry },
          ]}
          onRetry={retryAll}
        >
          <ul className="nb-word__summary">
            {items.map((it, i) => {
              const r = records[i];
              if (!r) return null;
              return (
                <li
                  key={i}
                  className="nb-word__summary-item"
                  data-state={r.correct ? "correct" : "incorrect"}
                >
                  <span
                    className="nb-word__summary-icon"
                    role="img"
                    aria-label={r.correct ? t("common.correct") : t("common.incorrect")}
                  >
                    {r.correct ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
                  </span>
                  <span className="nb-word__summary-body">
                    <span className="nb-word__summary-prompt">
                      <RichText text={it.prompt} />
                    </span>
                    <AnswerLine tokens={it.tokens} display={it.display} />
                    {!r.correct && r.placed.length > 0 && (
                      <span className="nb-word__summary-meta">
                        {t("word.yourAnswer", { answer: r.placed.join(" ") })}
                      </span>
                    )}
                  </span>
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
      type="word-builder"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("word.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        multi ? (
          <span className="nb-counter">{t("word.item", { current: index + 1, total })}</span>
        ) : undefined
      }
      eyebrow={
        multi ? (
          <ProgressBar value={(index + (resolved ? 1 : 0)) / total} showLabel={false} size="sm" />
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${life.runId}-${index}`}
          className={clsx("nb-word")}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <ItemView
            moduleId={config.id}
            runId={life.runId}
            item={item}
            index={index}
            isLast={index + 1 >= total}
            seed={seed + index * 977}
            behavior={behavior}
            feedback={config.feedback}
            focusOnMount={index > 0}
            announce={announce}
            life={life}
            onResolve={onResolve}
            onNext={onNext}
          />
        </motion.div>
      </AnimatePresence>
    </ModuleShell>
  );
}

export default WordBuilder;
