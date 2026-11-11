import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Eye, X } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  evaluateLabelDiagram,
  labelDiagramChips,
  labelDiagramSchema,
  labelDiagramScore,
  labelZoneSide,
  shuffle,
  type LabelChip,
  type LabelDiagramConfig,
  type LabelDiagramEvaluation,
  type LabelTarget,
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
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./label-diagram.css";

export type LabelDiagramProps = ModuleProps<LabelDiagramConfig>;

/** Container width (px) from which drop zones sit on the image instead of in a list. */
const WIDE_BREAKPOINT = 600;
const TRAY_ID = "tray";
const zoneDropId = (targetId: string) => `zone:${targetId}`;

type ZoneState = "empty" | "filled" | "locked" | "correct" | "incorrect";
type Translator = ReturnType<typeof useNibblearn>["t"];

export function LabelDiagram({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: LabelDiagramProps) {
  const parsed = useMemo(() => labelDiagramSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="label-diagram"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <LabelDiagramInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts LabelDiagramRun with fresh state (keyed by runId). */
function LabelDiagramInner(props: LabelDiagramProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "label-diagram",
    onComplete,
    onEvent,
    resetKey,
  });
  return <LabelDiagramRun key={life.runId} {...props} life={life} />;
}

/** Prefer the zone under the pointer; fall back to overlap for touch and keyboard-free drops. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function LabelDiagramRun({
  config,
  life,
  hideHeader,
  className,
}: LabelDiagramProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { behavior } = config;
  const { image, targets, distractors } = config.content;
  const total = targets.length;

  const chips = useMemo(() => labelDiagramChips(targets, distractors), [targets, distractors]);
  const chipById = useMemo(() => new Map(chips.map((c) => [c.id, c])), [chips]);
  const targetIndex = useMemo(() => new Map(targets.map((tg, i) => [tg.id, i + 1])), [targets]);
  const [seed] = useState(() => behavior.shuffleSeed ?? seedFromString(config.id, life.runId));
  const order = useMemo(
    () => (behavior.shuffle ? shuffle(chips, seed) : chips),
    [chips, behavior.shuffle, seed],
  );

  const [placements, setPlacements] = useState<Record<string, string | undefined>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<LabelDiagramEvaluation | null>(null);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [firstFraction, setFirstFraction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setWide(el.clientWidth >= WIDE_BREAKPOINT);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  const checked = evaluation !== null;
  const done = checked && (evaluation.correct || revealed);
  const exhausted = behavior.maxAttempts > 0 && attempts >= behavior.maxAttempts;
  const canRetry = checked && !done && behavior.allowRetry && !exhausted;
  const canReveal = checked && !done && (attempts >= 2 || exhausted || !behavior.allowRetry);

  const zoneOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const [targetId, chipId] of Object.entries(placements))
      if (chipId) m.set(chipId, targetId);
    return m;
  }, [placements]);
  const trayChips = order.filter((c) => !zoneOf.has(c.id));
  const filled = targets.filter((tg) => placements[tg.id]).length;
  const zonesLeft = total - filled;

  const zoneMovable = useCallback(
    (targetId: string) => !checked && !lockedIds.includes(targetId),
    [checked, lockedIds],
  );
  const chipMovable = useCallback(
    (chipId: string) => {
      if (checked) return false;
      const z = zoneOf.get(chipId);
      return !z || !lockedIds.includes(z);
    },
    [checked, zoneOf, lockedIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const place = useCallback(
    (chipId: string, targetId: string) => {
      const chip = chipById.get(chipId);
      if (!chip || !chipMovable(chipId) || !zoneMovable(targetId)) return;
      const from = zoneOf.get(chipId);
      setPlacements((prev) => {
        const next = { ...prev };
        const existing = prev[targetId];
        if (from) next[from] = existing && existing !== chipId ? existing : undefined;
        next[targetId] = chipId;
        return next;
      });
      setSelected(null);
      life.emit("module:interact", { action: "place", label: chip.text, targetId });
      announce(t("label.placed", { label: chip.text, index: targetIndex.get(targetId) ?? 0 }));
    },
    [chipById, chipMovable, zoneMovable, zoneOf, life, announce, t, targetIndex],
  );

  const returnChip = useCallback(
    (chipId: string) => {
      const chip = chipById.get(chipId);
      const from = zoneOf.get(chipId);
      if (!chip || !from || !zoneMovable(from)) return;
      setPlacements((prev) => ({ ...prev, [from]: undefined }));
      setSelected(null);
      life.emit("module:interact", { action: "return", label: chip.text, targetId: from });
      announce(t("label.returned", { label: chip.text }));
    },
    [chipById, zoneOf, zoneMovable, life, announce, t],
  );

  const toggleSelect = useCallback(
    (chipId: string) => {
      if (!chipMovable(chipId)) return;
      const chip = chipById.get(chipId);
      setSelected((prev) => {
        if (prev === chipId) return null;
        if (chip) announce(t("label.selected", { label: chip.text }));
        return chipId;
      });
    },
    [chipMovable, chipById, announce, t],
  );

  const activateZone = useCallback(
    (targetId: string) => {
      if (!zoneMovable(targetId)) return;
      const current = placements[targetId];
      if (selected && selected !== current) place(selected, targetId);
      else if (current) returnChip(current);
    },
    [zoneMovable, placements, selected, place, returnChip],
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setSelected(null);
  }, []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      if (!e.over) return;
      const chipId = String(e.active.id);
      const over = String(e.over.id);
      if (over === TRAY_ID) returnChip(chipId);
      else if (over.startsWith("zone:")) place(chipId, over.slice(5));
    },
    [place, returnChip],
  );

  const check = useCallback(() => {
    if (checked || zonesLeft > 0) return;
    const ev = evaluateLabelDiagram(targets, placements);
    const n = attempts + 1;
    setAttempts(n);
    life.attempt();
    setEvaluation(ev);
    setSelected(null);
    if (firstFraction === null) setFirstFraction(ev.score);
    const willReveal =
      !ev.correct &&
      (!behavior.allowRetry || (behavior.maxAttempts > 0 && n >= behavior.maxAttempts));
    if (willReveal) setRevealed(true);
    life.emit("module:answer", {
      placements: Object.fromEntries(
        targets.map((tg) => [tg.id, chipById.get(placements[tg.id] ?? "")?.text ?? null]),
      ),
      correct: ev.correct,
      correctCount: ev.correctCount,
      attempts: n,
    });
    announce(
      ev.correct
        ? `${t("a11y.correctAnswer")} ${t("label.allCorrect")}`
        : `${t("a11y.incorrectAnswer")} ${t("label.correctCount", { correct: ev.correctCount, total })}`,
    );
  }, [
    checked,
    zonesLeft,
    targets,
    placements,
    attempts,
    life,
    firstFraction,
    behavior,
    chipById,
    announce,
    t,
    total,
  ]);

  const retry = useCallback(() => {
    if (!evaluation) return;
    const ok = targets.filter((tg) => evaluation.targets[tg.id]).map((tg) => tg.id);
    setLockedIds(ok);
    setPlacements((prev) =>
      Object.fromEntries(
        targets.map((tg) => [tg.id, ok.includes(tg.id) ? prev[tg.id] : undefined]),
      ),
    );
    setEvaluation(null);
    life.emit("module:interact", { action: "retry" });
  }, [evaluation, targets, life]);

  const reveal = useCallback(() => {
    setRevealed(true);
    life.emit("module:interact", { action: "reveal" });
    announce(t("common.showAnswer"));
  }, [life, announce, t]);

  const score = evaluation
    ? labelDiagramScore(attempts, evaluation.correct, firstFraction ?? 0)
    : 0;

  const finish = useCallback(() => {
    if (!evaluation) return;
    setFinished(true);
    life.complete({
      score,
      correct: evaluation.correctCount,
      total,
      details: { attempts, revealed, firstFraction },
    });
    announce(t("a11y.moduleComplete"));
  }, [evaluation, score, life, total, attempts, revealed, firstFraction, announce, t]);

  const zoneState = (targetId: string): ZoneState => {
    if (evaluation) return evaluation.targets[targetId] ? "correct" : "incorrect";
    if (lockedIds.includes(targetId)) return "locked";
    return placements[targetId] ? "filled" : "empty";
  };

  const restart = () => {
    life.reset();
    life.emit("module:reset");
  };

  if (finished && evaluation) {
    const withNotes = behavior.showExplanation && targets.some((tg) => tg.explanation);
    return (
      <ModuleShell
        type="label-diagram"
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
              ? t("label.allCorrect")
              : t("label.correctCount", { correct: evaluation.correctCount, total }))
          }
          stats={[
            { label: t("common.correct"), value: `${evaluation.correctCount}/${total}` },
            { label: t("common.attempts"), value: attempts },
          ]}
          onRetry={restart}
        >
          {(withNotes || (behavior.showExplanation && config.content.explanation)) && (
            <div className="nb-label__notes">
              <h4 className="nb-label__notes-title">{t("label.explanations")}</h4>
              {withNotes && (
                <ol className="nb-label__notes-list">
                  {targets.map((tg, i) => (
                    <li key={tg.id} className="nb-label__note" data-ok={evaluation.targets[tg.id]}>
                      <span className="nb-label__note-num" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="nb-label__note-body">
                        <strong className="nb-label__note-label">{tg.label}</strong>
                        {tg.explanation && <RichText text={tg.explanation} />}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {config.content.explanation && (
                <p className="nb-label__notes-extra">
                  <RichText text={config.content.explanation} />
                </p>
              )}
            </div>
          )}
        </CompletionCard>
      </ModuleShell>
    );
  }

  const selectedChip = selected ? chipById.get(selected) : undefined;
  const activeChip = activeId ? chipById.get(activeId) : undefined;
  const targeting = Boolean(selectedChip || activeChip);
  const ratio =
    image.width && image.height
      ? `${image.width} / ${image.height}`
      : naturalRatio
        ? `${naturalRatio}`
        : undefined;

  const zoneProps = (tg: LabelTarget) => {
    const chipId = placements[tg.id];
    return {
      target: tg,
      index: targetIndex.get(tg.id) ?? 0,
      chip: chipId ? chipById.get(chipId) : undefined,
      state: zoneState(tg.id),
      movable: zoneMovable(tg.id),
      targeting: targeting && zoneMovable(tg.id),
      revealed,
      onActivate: () => activateZone(tg.id),
      t,
    };
  };

  return (
    <ModuleShell
      type="label-diagram"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : (config.instructions ?? t("label.instructions"))}
      appearance={config.appearance}
      className={className}
      width="wide"
      announcement={message}
      aside={
        <span className="nb-counter">
          {checked
            ? t("label.correctCount", { correct: evaluation.correctCount, total })
            : t("label.zonesLeft", { count: zonesLeft })}
        </span>
      }
    >
      <DndContext
        id={`${config.id}-dnd`}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: { draggable: t("a11y.dragInstructions") },
          announcements: {
            onDragStart: ({ active }) =>
              t("a11y.pickedUp", { item: chipById.get(String(active.id))?.text ?? "" }),
            onDragOver: ({ over }) =>
              over && String(over.id).startsWith("zone:")
                ? t("label.dragTo", { index: targetIndex.get(String(over.id).slice(5)) ?? 0 })
                : undefined,
            onDragEnd: () => undefined,
            onDragCancel: ({ active }) =>
              t("a11y.dropCancelled", { item: chipById.get(String(active.id))?.text ?? "" }),
          },
        }}
      >
        <div ref={rootRef} className="nb-label" data-wide={wide ? "true" : "false"}>
          <div
            className="nb-label__stage"
            style={ratio ? { aspectRatio: ratio } : undefined}
            data-ratio={ratio ? "true" : undefined}
            data-targeting={targeting ? "true" : undefined}
          >
            <SafeImage
              media={image}
              className="nb-label__image"
              showCaption={false}
              onLoaded={({ width, height }) => {
                if (width && height && !(image.width && image.height))
                  setNaturalRatio(width / height);
              }}
            />
            {targets.map((tg) => {
              const z = zoneProps(tg);
              return (
                <div
                  key={tg.id}
                  className="nb-label__pin"
                  style={{ left: `${tg.x}%`, top: `${tg.y}%` } as CSSProperties}
                  data-side={labelZoneSide(tg.x)}
                  data-v={tg.y < 8 ? "top" : tg.y > 92 ? "bottom" : undefined}
                >
                  <span
                    className="nb-label__dot"
                    data-state={z.state}
                    data-targeting={z.targeting ? "true" : undefined}
                    aria-hidden
                  >
                    {z.state === "correct" || z.state === "locked" ? (
                      <Check strokeWidth={3} />
                    ) : z.state === "incorrect" ? (
                      <X strokeWidth={3} />
                    ) : (
                      z.index
                    )}
                  </span>
                  {wide && <Zone {...z} variant="pill" />}
                </div>
              );
            })}
          </div>
          {image.caption && <p className="nb-label__caption">{image.caption}</p>}

          {!wide && (
            <ol className="nb-label__list" aria-label={t("label.zones")}>
              {targets.map((tg) => (
                <li key={tg.id}>
                  <Zone {...zoneProps(tg)} variant="row" />
                </li>
              ))}
            </ol>
          )}

          <Tray
            chips={trayChips}
            selected={selected}
            disabled={checked}
            onSelect={toggleSelect}
            t={t}
          />
        </div>

        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {activeChip ? (
            <span className="nb-label__chip nb-label__chip--overlay" data-state="selected">
              {activeChip.text}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatedFeedback
        show={checked}
        tone={
          evaluation?.correct
            ? "correct"
            : evaluation && evaluation.correctCount > 0
              ? "partial"
              : "incorrect"
        }
        title={evaluation?.correct ? t("label.allCorrect") : t("common.incorrect")}
        text={
          evaluation
            ? evaluation.correct
              ? (config.feedback.correct ?? undefined)
              : (config.feedback.incorrect ??
                t("label.correctCount", { correct: evaluation.correctCount, total }))
            : undefined
        }
      />

      <div className="nb-label__footer">
        <span className="nb-muted nb-text-sm">
          {!checked && zonesLeft > 0 ? t("label.zonesLeft", { count: zonesLeft }) : ""}
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
            <Button variant="primary" onClick={check} disabled={zonesLeft > 0}>
              {t("common.check")}
            </Button>
          ) : (
            done && (
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

/* ----------------------------------------------------------------------------
 * Zone: a drop target on the image (pill) or in the list (row)
 * -------------------------------------------------------------------------- */

interface ZoneProps {
  target: LabelTarget;
  index: number;
  chip?: LabelChip;
  state: ZoneState;
  movable: boolean;
  targeting: boolean;
  revealed: boolean;
  variant: "pill" | "row";
  onActivate: () => void;
  t: Translator;
}

function Zone({
  target,
  index,
  chip,
  state,
  movable,
  targeting,
  revealed,
  variant,
  onActivate,
  t,
}: ZoneProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: zoneDropId(target.id),
    disabled: !movable,
  });
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: chip?.id ?? `empty:${target.id}`,
    disabled: !chip || !movable,
  });
  const showAnswer = state === "incorrect" && revealed;
  const visible = chip ? chip.text : targeting ? t("label.tapToPlace") : t("label.dropHere");
  return (
    <div
      ref={setDropRef}
      className={clsx("nb-label__zone", `nb-label__zone--${variant}`)}
      data-over={isOver ? "true" : undefined}
    >
      {variant === "pill" && <span className="nb-label__leader" aria-hidden />}
      <button
        ref={setDragRef}
        type="button"
        className="nb-label__zone-btn"
        data-state={state}
        data-targeting={targeting ? "true" : undefined}
        data-dragging={isDragging ? "true" : undefined}
        aria-disabled={!movable || undefined}
        aria-describedby={chip && movable ? attributes["aria-describedby"] : undefined}
        title={chip?.text}
        onClick={onActivate}
        {...(chip && movable ? listeners : {})}
      >
        {variant === "row" && (
          <span className="nb-label__zone-num" aria-hidden>
            {index}
          </span>
        )}
        <span className="nb-sr-only">{`${t("label.zone", { index })}:`}</span>{" "}
        <span className="nb-label__zone-text" data-empty={chip ? undefined : "true"}>
          {state === "incorrect" && showAnswer && chip ? <s>{chip.text}</s> : visible}
        </span>
        {showAnswer && (
          <span className="nb-label__zone-answer">
            {t("label.correctLabel", { label: target.label })}
          </span>
        )}
        {(state === "correct" || state === "locked" || state === "incorrect") && (
          <span
            className="nb-label__zone-mark"
            role="img"
            aria-label={state === "incorrect" ? t("common.incorrect") : t("common.correct")}
          >
            {state === "incorrect" ? (
              <X strokeWidth={3} aria-hidden />
            ) : (
              <Check strokeWidth={3} aria-hidden />
            )}
          </span>
        )}
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Tray of unplaced labels
 * -------------------------------------------------------------------------- */

interface TrayProps {
  chips: LabelChip[];
  selected: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  t: Translator;
}

function Tray({ chips, selected, disabled, onSelect, t }: TrayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID, disabled });
  return (
    <section
      ref={setNodeRef}
      className="nb-label__tray"
      data-over={isOver ? "true" : undefined}
      aria-label={t("label.tray")}
    >
      <span className="nb-label__tray-title" aria-hidden>
        {t("label.tray")}
      </span>
      <div className="nb-label__chips">
        {chips.map((chip) => (
          <TrayChip
            key={chip.id}
            chip={chip}
            selected={selected === chip.id}
            disabled={disabled}
            onSelect={() => onSelect(chip.id)}
          />
        ))}
        {chips.length === 0 && <span className="nb-label__tray-empty">{t("label.trayEmpty")}</span>}
      </div>
    </section>
  );
}

function TrayChip({
  chip,
  selected,
  disabled,
  onSelect,
}: {
  chip: LabelChip;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: chip.id,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="nb-label__chip"
      data-state={selected ? "selected" : "idle"}
      data-dragging={isDragging ? "true" : undefined}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      aria-describedby={attributes["aria-describedby"]}
      onClick={disabled ? undefined : onSelect}
      {...listeners}
    >
      {chip.text}
    </button>
  );
}

export default LabelDiagram;
