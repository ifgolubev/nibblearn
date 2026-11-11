import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, Clock, X } from "lucide-react";
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
  matchPairsSchema,
  matchingScore,
  shuffle,
  type MatchPairsConfig,
  type Pair,
  seedFromString,
} from "@nibblearn/core";
import clsx from "clsx";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./match-pairs.css";

export type MatchPairsProps = ModuleProps<MatchPairsConfig>;

type PairWithId = Pair & { id: string };
type Side = "left" | "right";
type TileState = "idle" | "selected" | "matched" | "wrong";

interface Selection {
  side: Side;
  id: string;
}

const SHAKE_MS = 420;
const COLLAPSE_MS = 620;
const ROUND_MS = 760;

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function MatchPairs({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: MatchPairsProps) {
  const parsed = useMemo(() => matchPairsSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="match-pairs"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <MatchPairsInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function MatchPairsInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: MatchPairsProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "match-pairs",
    onComplete,
    onEvent,
    resetKey,
  });
  // Keying on runId remounts the game with fresh state (and a fresh shuffle) on every reset.
  return (
    <MatchPairsGame
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface GameProps {
  config: MatchPairsConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

function MatchPairsGame({ config, life, hideHeader, className }: GameProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior } = config;

  const pairs = useMemo<PairWithId[]>(
    () => config.content.pairs.map((p, i) => ({ ...p, id: p.id ?? `pair-${i}` })),
    [config.content.pairs],
  );
  const total = pairs.length;
  const perRound = Math.min(behavior.pairsPerRound, total);

  // A fresh random seed for every mount (= every run) so retry reshuffles.
  const [seed] = useState(() => seedFromString(config.id, life.runId));

  const [roundIndex, setRoundIndex] = useState(0);
  const [matched, setMatched] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const [showMiss, setShowMiss] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  // Elapsed-time ticker.
  useEffect(() => {
    if (!behavior.timer || finished) return;
    const id = setInterval(() => setElapsed(Math.floor(life.elapsedMs() / 1000)), 1000);
    return () => clearInterval(id);
  }, [behavior.timer, finished, life]);

  const order = useMemo(
    () => (behavior.shuffle ? shuffle(pairs, seed) : pairs),
    [pairs, behavior.shuffle, seed],
  );
  const visible = useMemo(
    () => order.slice(roundIndex * perRound, (roundIndex + 1) * perRound),
    [order, roundIndex, perRound],
  );
  const leftTiles = useMemo(
    () => (behavior.shuffle ? shuffle(visible, seed + 17 + roundIndex) : visible),
    [visible, behavior.shuffle, seed, roundIndex],
  );
  const rightTiles = useMemo(
    () => (behavior.shuffle ? shuffle(visible, seed + 101 + roundIndex) : visible),
    [visible, behavior.shuffle, seed, roundIndex],
  );

  const byId = useMemo(() => new Map(pairs.map((p) => [p.id, p])), [pairs]);
  const rounds = Math.ceil(total / perRound);
  const isLastRound = roundIndex + 1 >= rounds;

  const finish = useCallback(
    (finalMistakes: number) => {
      const score = matchingScore(total, finalMistakes);
      setFinished(true);
      life.complete({ score, correct: total, total, details: { mistakes: finalMistakes, rounds } });
      announce(`${t("match.complete")} ${t("a11y.moduleComplete")}`);
    },
    [total, life, rounds, announce, t],
  );

  // Advance rounds when every visible pair is matched.
  useEffect(() => {
    if (finished || visible.length === 0) return;
    if (!visible.every((p) => matched.includes(p.id))) return;
    const id = later(() => {
      if (isLastRound) finish(mistakes);
      else {
        setRoundIndex((r) => r + 1);
        setHidden([]);
      }
    }, ROUND_MS);
    return () => clearTimeout(id);
  }, [visible, matched, finished, isLastRound, finish, mistakes, later]);

  const attemptMatch = useCallback(
    (leftId: string, rightId: string) => {
      const left = byId.get(leftId);
      const right = byId.get(rightId);
      if (!left || !right) return;
      setSelected(null);
      life.attempt();
      if (leftId === rightId) {
        setMatched((prev) => (prev.includes(leftId) ? prev : [...prev, leftId]));
        setShowMiss(false);
        later(() => setHidden((prev) => [...prev, leftId]), COLLAPSE_MS);
        life.emit("module:answer", { pairId: leftId, correct: true });
        announce(t("match.pairMatched", { left: left.left, right: right.right }));
      } else {
        setMistakes((m) => m + 1);
        setWrong({ left: leftId, right: rightId });
        setShowMiss(true);
        later(() => setWrong(null), SHAKE_MS);
        life.emit("module:answer", { leftId, rightId, correct: false });
        announce(`${t("a11y.incorrectAnswer")} ${t("match.notAPair")}`);
      }
    },
    [byId, life, later, announce, t],
  );

  const tap = useCallback(
    (side: Side, id: string) => {
      if (finished || matched.includes(id)) return;
      if (!selected) {
        setSelected({ side, id });
        setShowMiss(false);
        life.emit("module:interact", { side, id });
        return;
      }
      if (selected.side === side) {
        setSelected(selected.id === id ? null : { side, id });
        return;
      }
      const leftId = side === "left" ? id : selected.id;
      const rightId = side === "right" ? id : selected.id;
      attemptMatch(leftId, rightId);
    },
    [finished, matched, selected, life, attemptMatch],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.data.current?.pairId ?? "");
    setDragging(id);
    setSelected({ side: "left", id });
    setShowMiss(false);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDragging(null);
      const leftId = String(e.active.data.current?.pairId ?? "");
      const rightId = e.over ? String(e.over.data.current?.pairId ?? "") : "";
      if (leftId && rightId) attemptMatch(leftId, rightId);
      else setSelected(null);
    },
    [attemptMatch],
  );

  const onDragCancel = useCallback(() => {
    setDragging(null);
    setSelected(null);
  }, []);

  const stateFor = (side: Side, id: string): TileState => {
    if (matched.includes(id)) return "matched";
    if (wrong && (side === "left" ? wrong.left === id : wrong.right === id)) return "wrong";
    if (selected && selected.side === side && selected.id === id) return "selected";
    return "idle";
  };

  const matchedCount = matched.length;

  if (finished) {
    const score = matchingScore(total, mistakes);
    const stats: { label: string; value: string | number }[] = [
      { label: t("match.matched", { count: total, total }), value: `${total}/${total}` },
      { label: t("match.mistakesLabel"), value: mistakes },
    ];
    if (behavior.timer)
      stats.push({
        label: t("common.time"),
        value: formatTime((life.result?.durationMs ?? life.elapsedMs()) / 1000),
      });
    const explained = pairs.filter((p) => p.explanation);
    return (
      <ModuleShell
        type="match-pairs"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={score}
          text={config.feedback.complete ?? t("match.complete")}
          stats={stats}
          onRetry={() => {
            life.reset();
            life.emit("module:reset");
          }}
        >
          {explained.length > 0 && (
            <ul className="nb-match__summary">
              {explained.map((p) => (
                <li key={p.id} className="nb-match__summary-item">
                  <div className="nb-match__summary-pair">
                    <Check aria-hidden strokeWidth={3} />
                    <span className="nb-match__summary-left">
                      <RichText text={p.left} />
                    </span>
                    <span className="nb-match__summary-arrow" aria-hidden>
                      →
                    </span>
                    <span className="nb-match__summary-right">
                      <RichText text={p.right} />
                    </span>
                  </div>
                  <p className="nb-match__summary-explanation">
                    <RichText text={p.explanation!} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CompletionCard>
      </ModuleShell>
    );
  }

  const aside = (
    <div className="nb-match__stats">
      <span className="nb-counter">{t("match.matched", { count: matchedCount, total })}</span>
      <span
        className={clsx(
          "nb-counter",
          "nb-match__mistakes",
          mistakes > 0 && "nb-match__mistakes--some",
        )}
      >
        {t("match.mistakes", { count: mistakes })}
      </span>
      {behavior.timer && (
        <span
          className="nb-counter nb-match__timer"
          aria-label={`${t("common.time")}: ${formatTime(elapsed)}`}
        >
          <Clock aria-hidden size={14} />
          {formatTime(elapsed)}
        </span>
      )}
    </div>
  );

  const draggingPair = dragging ? byId.get(dragging) : undefined;

  return (
    <ModuleShell
      type="match-pairs"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("match.instructions"))}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={aside}
      eyebrow={
        rounds > 1 ? (
          <span className="nb-counter">
            {t("common.step", { current: roundIndex + 1, total: rounds })}
          </span>
        ) : undefined
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
              t("a11y.pickedUp", { item: String(active.data.current?.label ?? "") }),
            onDragOver: () => undefined,
            onDragEnd: () => undefined,
            onDragCancel: ({ active }) =>
              t("a11y.dropCancelled", { item: String(active.data.current?.label ?? "") }),
          },
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={roundIndex}
            className="nb-match__board"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: reduced ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <LayoutGroup id={`${config.id}-${roundIndex}`}>
              <Column
                side="left"
                label={config.content.leftLabel}
                tiles={leftTiles.filter((p) => !hidden.includes(p.id))}
                stateFor={stateFor}
                onTap={tap}
                drag={behavior.drag}
                reduced={reduced}
                dragging={dragging}
                t={t}
              />
              <Column
                side="right"
                label={config.content.rightLabel}
                tiles={rightTiles.filter((p) => !hidden.includes(p.id))}
                stateFor={stateFor}
                onTap={tap}
                drag={behavior.drag}
                reduced={reduced}
                dragging={dragging}
                t={t}
              />
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>

        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {draggingPair ? (
            <div className="nb-match__tile nb-match__tile--overlay" data-state="selected">
              <span className="nb-match__tile-text">
                <RichText text={draggingPair.left} />
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatedFeedback
        show={showMiss}
        tone="incorrect"
        title={t("common.incorrect")}
        text={t("match.notAPair")}
      />
    </ModuleShell>
  );
}

interface ColumnProps {
  side: Side;
  label?: string;
  tiles: PairWithId[];
  stateFor: (side: Side, id: string) => TileState;
  onTap: (side: Side, id: string) => void;
  drag: boolean;
  reduced: boolean;
  dragging: string | null;
  t: ReturnType<typeof useNibblearn>["t"];
}

function Column({ side, label, tiles, stateFor, onTap, drag, reduced, dragging, t }: ColumnProps) {
  return (
    <div className="nb-match__column" role="group" aria-label={label}>
      {label && <div className="nb-match__label">{label}</div>}
      <div className="nb-match__tiles">
        <AnimatePresence initial={false}>
          {tiles.map((p) => {
            const state = stateFor(side, p.id);
            const props = {
              pair: p,
              state,
              onTap: () => onTap(side, p.id),
              drag,
              reduced,
              isDragSource: dragging === p.id,
              t,
            };
            return side === "left" ? (
              <LeftTile key={p.id} {...props} />
            ) : (
              <RightTile key={p.id} {...props} />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface TileProps {
  pair: PairWithId;
  state: TileState;
  onTap: () => void;
  drag: boolean;
  reduced: boolean;
  isDragSource: boolean;
  t: ReturnType<typeof useNibblearn>["t"];
}

function LeftTile(props: TileProps) {
  const { pair, state, drag } = props;
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `left-${pair.id}`,
    data: { pairId: pair.id, label: pair.left },
    disabled: !drag || state === "matched",
  });
  return (
    <Tile
      {...props}
      side="left"
      text={pair.left}
      setNodeRef={setNodeRef}
      listeners={listeners}
      describedBy={attributes["aria-describedby"]}
    />
  );
}

function RightTile(props: TileProps) {
  const { pair, state } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: `right-${pair.id}`,
    data: { pairId: pair.id, label: pair.right },
    disabled: state === "matched",
  });
  return <Tile {...props} side="right" text={pair.right} setNodeRef={setNodeRef} isOver={isOver} />;
}

interface TileViewProps extends TileProps {
  side: Side;
  text: string;
  setNodeRef: (el: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
  describedBy?: string;
  isOver?: boolean;
}

function Tile({
  side,
  text,
  state,
  onTap,
  reduced,
  isDragSource,
  setNodeRef,
  listeners,
  describedBy,
  isOver,
  t,
}: TileViewProps) {
  const matched = state === "matched";
  const shake = state === "wrong" && !reduced;
  return (
    <motion.div
      layout={!reduced}
      className="nb-match__slot"
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={
        shake
          ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }
          : { opacity: 1, scale: 1, x: 0 }
      }
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
      transition={
        shake
          ? { duration: SHAKE_MS / 1000, ease: "easeInOut" }
          : { duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }
      }
    >
      <button
        ref={setNodeRef}
        type="button"
        className="nb-match__tile"
        data-state={state}
        data-side={side}
        data-over={isOver ? "true" : undefined}
        data-dragging={isDragSource ? "true" : undefined}
        aria-pressed={state === "selected"}
        aria-disabled={matched || undefined}
        aria-describedby={describedBy}
        disabled={matched}
        onClick={onTap}
        {...listeners}
      >
        <span className="nb-match__tile-text">
          <RichText text={text} />
        </span>
        <span className="nb-match__tile-mark" aria-hidden>
          {matched ? <Check strokeWidth={3} /> : state === "wrong" ? <X strokeWidth={3} /> : null}
        </span>
        {isOver && !matched && (
          <span className="nb-match__drop" aria-hidden>
            {t("match.dropHere")}
          </span>
        )}
      </button>
    </motion.div>
  );
}

export default MatchPairs;
